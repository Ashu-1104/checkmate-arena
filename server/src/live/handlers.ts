import type { Game, User } from "@chessu/types";
import { Chess } from "chess.js";

import { db } from "../db/index.js";
import GameModel from "../db/models/game.model.js";
import { applyMove } from "../utils/clock.js";
import {
    dropPresence,
    flaggedSide,
    isPresent,
    sendEvent,
    touchPresence,
    withGame,
    type Outbox
} from "./store.js";

// The game actions players send (formerly Socket.IO events). Each runs inside withGame, so the
// game is locked while it changes, and its events reach players through their event streams.

interface Context {
    game: Game;
    out: Outbox;
    user: User;
}

// Saves a finished game, notifies the room and removes it from the active games.
async function finishGame(
    game: Game,
    out: Outbox,
    reason: Game["endReason"],
    winner: "white" | "black" | "draw",
    winnerName = winner === "draw" ? undefined : game[winner]?.name
) {
    game.endReason = reason;
    game.winner = winner;

    const saved = await GameModel.save(game);
    game.id = saved?.id;

    out.emit("all", "gameOver", {
        reason,
        winnerName,
        winnerSide: winner === "draw" ? undefined : winner,
        id: game.id,
        ratingChange: saved?.ratingChange
    });
    out.finished = true;
}

// The side whose flag fell loses, unless the opponent only has a king left (then it is a draw).
async function endOnTime(game: Game, out: Outbox, side: "white" | "black") {
    if (game.endReason) return;
    if (game.clock) game.clock[side] = 0;

    const opponent = side === "white" ? "black" : "white";
    const chess = new Chess();
    if (game.pgn) chess.loadPgn(game.pgn);
    const opponentOnlyKing = chess
        .board()
        .flat()
        .every((sq) => !sq || sq.color !== opponent[0] || sq.type === "k");

    await finishGame(game, out, "timeout", opponentOnlyKing ? "draw" : opponent);
}

function playerSide(game: Game, userId: User["id"]): "white" | "black" | undefined {
    if (game.white?.id === userId) return "white";
    if (game.black?.id === userId) return "black";
    return undefined;
}

// the player's side, if the game has two players and is still in progress
function playingSide(game: Game, user: User) {
    if (game.endReason || game.winner || !game.white || !game.black) return undefined;
    return playerSide(game, user.id);
}

const actions: Record<string, (ctx: Context, arg: unknown) => Promise<void>> = {
    async joinLobby({ game, out, user }) {
        for (const side of ["host", "white", "black"] as const) {
            const player = game[side];
            if (player && player.id === user.id && player.name !== user.name)
                player.name = user.name;
        }
        await out.latest("all");
    },

    async leaveLobby({ out }) {
        await out.latest("others");
    },

    async getLatestGame({ out }) {
        await out.latest("self");
    },

    async claimAbandoned({ game, out, user }, type) {
        if (!game.pgn || !game.white || !game.black || !playerSide(game, user.id)) {
            console.log(`claimAbandoned: Invalid game or user is not a player.`);
            return;
        }
        const view = await out.view();
        const opponent = playerSide(game, user.id) === "white" ? view.black : view.white;
        if (opponent?.connected || Date.now() - (opponent?.disconnectedOn as number) < 50000) {
            console.log(
                `claimAbandoned: Invalid claim by ${user.name}. Opponent is still connected or disconnected less than 50 seconds ago.`
            );
            return;
        }
        const winner =
            type === "draw" ? "draw" : playerSide(game, user.id) === "white" ? "white" : "black";
        await finishGame(game, out, "abandoned", winner, user.name as string);
    },

    async sendMove({ game, out, user }, arg) {
        if (game.endReason || game.winner) return;
        const m = arg as { from: string; to: string; promotion?: string };
        const chess = new Chess();
        if (game.pgn) {
            chess.loadPgn(game.pgn);
        }

        try {
            const prevTurn = chess.turn();

            if (
                (prevTurn === "b" && user.id !== game.black?.id) ||
                (prevTurn === "w" && user.id !== game.white?.id)
            ) {
                throw new Error("not turn to move");
            }

            const side = prevTurn === "w" ? "white" : "black";
            let clockResult;
            if (game.timeControl && game.clock) {
                clockResult = applyMove(game.clock, side, game.timeControl, Date.now());
                if (clockResult.flagged) {
                    await endOnTime(game, out, side);
                    return;
                }
            }

            const newMove = chess.move(m);

            if (newMove) {
                game.pgn = chess.pgn();
                out.emit("others", "receivedMove", m);
                if (game.drawOffer) {
                    // making a move declines a pending draw offer
                    game.drawOffer = null;
                    out.emit("all", "drawDeclined", { name: user.name });
                }
                if (clockResult) {
                    game.clock = clockResult.clock;
                    out.emit("all", "clockUpdate", { ...game.clock, serverTime: Date.now() });
                }
                if (chess.isGameOver()) {
                    let reason: Game["endReason"];
                    if (chess.isCheckmate()) reason = "checkmate";
                    else if (chess.isStalemate()) reason = "stalemate";
                    else if (chess.isThreefoldRepetition()) reason = "repetition";
                    else if (chess.isInsufficientMaterial()) reason = "insufficient";
                    else if (chess.isDraw()) reason = "draw";

                    const winnerSide =
                        reason === "checkmate" ? (prevTurn === "w" ? "white" : "black") : "draw";
                    await finishGame(game, out, reason, winnerSide);
                }
            } else {
                throw new Error("invalid move");
            }
        } catch (e) {
            console.log("sendMove error: " + e);
            await out.latest("self");
        }
    },

    async joinAsPlayer({ game, out, user }) {
        const sessionUser = { id: user.id, name: user.name, connected: true };
        if (!game.white) {
            game.white = sessionUser;
            out.emit("all", "userJoinedAsPlayer", { name: user.name, side: "white" });
            game.startedAt = Date.now();
        } else if (!game.black) {
            game.black = sessionUser;
            out.emit("all", "userJoinedAsPlayer", { name: user.name, side: "black" });
            game.startedAt = Date.now();
        } else {
            console.log("joinAsPlayer: attempted to join a game with already 2 players");
        }
        await out.latest("all");
    },

    async resign({ game, out, user }) {
        const side = playingSide(game, user);
        if (!side) return;
        await finishGame(game, out, "resigned", side === "white" ? "black" : "white");
    },

    async offerDraw({ game, out, user }) {
        const side = playingSide(game, user);
        if (!side || !game.pgn || game.drawOffer) return;
        game.drawOffer = side;
        out.emit("all", "drawOffered", { name: user.name, side });
    },

    async respondDraw({ game, out, user }, accept) {
        const side = playingSide(game, user);
        // only the opponent of the player who offered can respond
        if (!side || !game.drawOffer || game.drawOffer === side) return;
        if (accept) {
            await finishGame(game, out, "agreement", "draw");
        } else {
            game.drawOffer = null;
            out.emit("all", "drawDeclined", { name: user.name });
        }
    }
};

// Runs a player's action on the game `code`. Returns false for an unknown action.
export async function runAction(
    code: string,
    action: string,
    user: User,
    clientId: string,
    arg: unknown
) {
    if (action === "chat") {
        // chat also works after the game has ended, so it does not need the live game
        if (await isPresent(code, clientId)) {
            await sendEvent(code, "chat", { author: user, message: arg }, clientId);
        }
        return true;
    }
    const handler = actions[action];
    if (!handler) return false;

    if (action === "joinLobby") await touchPresence(code, clientId, user);
    if (action === "leaveLobby") await dropPresence(code, clientId);

    await withGame(code, clientId, async (game, out) => {
        // the clock is checked whenever the game is touched (there are no timers on serverless)
        const flagged = flaggedSide(game);
        if (flagged) await endOnTime(game, out, flagged);
        else await handler({ game, out, user }, arg);
    });
    return true;
}

// Ends the game if the side to move has run out of time.
export const settleClock = (code: string) =>
    withGame(code, undefined, async (game, out) => {
        const flagged = flaggedSide(game);
        if (flagged) await endOnTime(game, out, flagged);
    });

// Shows a player's new name, or registered account, in the live games they are part of.
export async function updatePlayer(oldId: User["id"], user: User) {
    await db.query(`UPDATE live_presence SET user_id = $2, user_name = $3 WHERE user_id = $1`, [
        String(oldId),
        String(user.id),
        user.name ?? null
    ]);
    const { rows } = await db.query(
        `SELECT code FROM live_game WHERE state->'white'->>'id' = $1 OR state->'black'->>'id' = $1
           OR state->'host'->>'id' = $1 OR code IN (SELECT code FROM live_presence WHERE user_id = $2)`,
        [String(oldId), String(user.id)]
    );
    for (const { code } of rows) {
        await withGame(code, undefined, async (game, out) => {
            for (const side of ["host", "white", "black"] as const) {
                if (game[side]?.id === oldId) game[side] = { id: user.id, name: user.name };
            }
            await out.latest("all");
        });
    }
}
