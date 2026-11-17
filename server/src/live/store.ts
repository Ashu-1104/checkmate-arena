import type { Game, User } from "@chessu/types";
import { Chess } from "chess.js";
import type { PoolClient } from "pg";

import { db } from "../db/index.js";
import { remainingTime } from "../utils/clock.js";

// Games in progress live in Postgres instead of server memory, so any serverless instance can
// handle any request. Players receive updates over Server-Sent Events (see stream.ts), which
// read the events written here.

// a client that has not polled its event stream for this long counts as disconnected
export const PRESENCE_MS = 12_000;

export type Target = "all" | "others" | "self";

export interface Outbox {
    emit(target: Target, type: string, payload?: unknown): void;
    // the game with each player's connection status filled in
    view(): Promise<Game>;
    // sends that view, like "receivedLatestGame" did over Socket.IO
    latest(target: Target): Promise<void>;
    finished: boolean; // set when the game ends; the live game is then removed
}

interface PresenceRow {
    user_id: string;
    user_name: string | null;
    last_seen: Date;
}

type Queryable = Pick<PoolClient, "query">;

export const touchPresence = (code: string, clientId: string, user: User) =>
    db.query(
        `INSERT INTO live_presence (code, client_id, user_id, user_name, last_seen) VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (code, client_id) DO UPDATE SET user_id = EXCLUDED.user_id, user_name = EXCLUDED.user_name, last_seen = now()`,
        [code, clientId, String(user.id), user.name ?? null]
    );

export const dropPresence = (code: string, clientId: string) =>
    db.query(`DELETE FROM live_presence WHERE code = $1 AND client_id = $2`, [code, clientId]);

export const isPresent = async (code: string, clientId: string) =>
    Boolean(
        (
            await db.query(`SELECT 1 FROM live_presence WHERE code = $1 AND client_id = $2`, [
                code,
                clientId
            ])
        ).rowCount
    );

const presenceOf = async (code: string, q: Queryable = db) =>
    (
        await q.query(`SELECT user_id, user_name, last_seen FROM live_presence WHERE code = $1`, [
            code
        ])
    ).rows as PresenceRow[];

// Fills in connected, disconnectedOn and observers from presence (this used to be socket bookkeeping).
export function withPresence(game: Game, rows: PresenceRow[], now = Date.now()): Game {
    const lastSeen = new Map<string, PresenceRow>();
    for (const row of rows) {
        const prev = lastSeen.get(row.user_id);
        if (!prev || prev.last_seen < row.last_seen) lastSeen.set(row.user_id, row);
    }
    const seenAt = (id: User["id"]) => lastSeen.get(String(id))?.last_seen.getTime();
    const online = (id: User["id"]) => now - (seenAt(id) ?? 0) < PRESENCE_MS;

    const view: Game = JSON.parse(JSON.stringify(game));
    for (const side of ["host", "white", "black"] as const) {
        const player = view[side];
        if (!player) continue;
        player.connected = online(player.id);
        player.disconnectedOn = player.connected ? undefined : seenAt(player.id);
    }
    const players = [view.white?.id, view.black?.id].map(String);
    view.observers = [...lastSeen.values()]
        .filter((row) => !players.includes(row.user_id) && online(row.user_id))
        .map((row) => ({ id: row.user_id, name: row.user_name }));
    if (view.clock) view.clock.serverTime = now;
    return view;
}

// The side whose time has run out, if the clock is running.
export function flaggedSide(game: Game, now = Date.now()) {
    if (
        !game.clock ||
        game.clock.lastMoveAt === undefined ||
        game.endReason ||
        !game.white ||
        !game.black
    ) {
        return undefined;
    }
    const chess = new Chess();
    if (game.pgn) chess.loadPgn(game.pgn);
    const side = chess.turn() === "w" ? "white" : "black";
    return remainingTime(game.clock, side, now) <= 0 ? side : undefined;
}

export const insertGame = (game: Game) =>
    db.query(`INSERT INTO live_game (code, state) VALUES ($1, $2::jsonb)`, [
        game.code,
        JSON.stringify(game)
    ]);

export async function loadGame(code: string) {
    const res = await db.query(`SELECT state FROM live_game WHERE code = $1`, [code]);
    if (!res.rows[0]) return undefined;
    return withPresence(res.rows[0].state as Game, await presenceOf(code));
}

export const listGames = async () =>
    (await db.query(`SELECT state FROM live_game ORDER BY created_at`)).rows.map(
        (r) => r.state as Game
    );

export const latestEventId = async (code: string) =>
    Number(
        (
            await db.query(`SELECT COALESCE(MAX(id), 0) AS id FROM live_event WHERE code = $1`, [
                code
            ])
        ).rows[0].id
    );

export const sendEvent = (code: string, type: string, payload: unknown, skipClient?: string) =>
    db.query(
        `INSERT INTO live_event (code, type, payload, skip_client) VALUES ($1, $2, $3::jsonb, $4)`,
        [code, type, JSON.stringify(payload ?? null), skipClient ?? null]
    );

// Removes lobbies nobody has watched for 1 minute (20 minutes once moves were made), like the
// old in-memory timeouts, plus old events and presence rows.
export async function purgeStale() {
    await db.query(
        `DELETE FROM live_game g WHERE g.created_at < now() - interval '2 minutes' AND NOT EXISTS (
            SELECT 1 FROM live_presence p WHERE p.code = g.code AND p.last_seen > now() -
                CASE WHEN COALESCE(g.state->>'pgn', '') <> '' THEN interval '20 minutes' ELSE interval '1 minute' END)`
    );
    await db.query(`DELETE FROM live_event WHERE created_at < now() - interval '1 hour'`);
    await db.query(`DELETE FROM live_presence WHERE last_seen < now() - interval '1 day'`);
}

// Runs `fn` with the game locked, then saves the game and the events it emitted in one transaction,
// so two players acting at the same moment are handled one after the other.
export async function withGame(
    code: string,
    clientId: string | undefined,
    fn: (game: Game, out: Outbox) => Promise<void> | void
) {
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const res = await client.query(`SELECT state FROM live_game WHERE code = $1 FOR UPDATE`, [
            code
        ]);
        if (!res.rows[0]) {
            await client.query("ROLLBACK");
            return false;
        }
        const game = res.rows[0].state as Game;
        const events: [Target, string, unknown][] = [];
        let presence: PresenceRow[] | undefined;
        const out: Outbox = {
            finished: false,
            emit: (target, type, payload) => events.push([target, type, payload]),
            view: async () => withPresence(game, (presence ??= await presenceOf(code, client))),
            latest: async (target) => {
                events.push([target, "receivedLatestGame", await out.view()]);
            }
        };

        await fn(game, out);

        if (out.finished) {
            await client.query(`DELETE FROM live_game WHERE code = $1`, [code]);
        } else {
            await client.query(
                `UPDATE live_game SET state = $2::jsonb, updated_at = now() WHERE code = $1`,
                [code, JSON.stringify(game)]
            );
        }
        for (const [target, type, payload] of events) {
            await client.query(
                `INSERT INTO live_event (code, type, payload, only_client, skip_client) VALUES ($1, $2, $3::jsonb, $4, $5)`,
                [
                    code,
                    type,
                    JSON.stringify(payload ?? null),
                    target === "self" ? clientId : null,
                    target === "others" ? clientId : null
                ]
            );
        }
        await client.query("COMMIT");
        return true;
    } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
    } finally {
        client.release();
    }
}
