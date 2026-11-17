// Boots the compiled server against a real PostgreSQL database (PG* env vars) and
// plays games over the HTTP actions and Server-Sent Events stream. Run `pnpm build` first.
import { spawn, type ChildProcess } from "child_process";
import { randomUUID } from "crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PORT = 3101;
const API = `http://127.0.0.1:${PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const run = Date.now().toString(36); // unique names per test run

interface Player {
    cookie: string;
}
// a player's browser tab: the events it received, and emit() to send an action
interface TestSocket {
    events: [string, unknown][];
    emit(action: string, arg?: unknown): void;
    close(): void;
}

let server: ChildProcess;
const sockets: TestSocket[] = [];

async function post(path: string, body: object, cookie?: string) {
    return fetch(API + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
        body: JSON.stringify(body)
    });
}

async function guest(name: string): Promise<Player> {
    const res = await post("/v1/auth/guest", { name });
    return { cookie: res.headers.getSetCookie()[0].split(";")[0] };
}

async function registered(name: string): Promise<Player> {
    const res = await post("/v1/auth/register", {
        name,
        email: `${name}@example.com`,
        password: "password123"
    });
    return { cookie: res.headers.getSetCookie()[0].split(";")[0] };
}

async function createGame(host: Player, body: object) {
    const res = await post("/v1/games", body, host.cookie);
    return ((await res.json()) as { code: string }).code;
}

function join(player: Player, code: string) {
    const clientId = randomUUID();
    const abort = new AbortController();
    const headers = {
        cookie: player.cookie,
        "Content-Type": "application/json",
        "X-Client-Id": clientId
    };
    let queue = Promise.resolve();
    const socket: TestSocket = {
        events: [],
        // actions are sent in order, like Socket.IO emits
        emit: (action, arg) => {
            queue = queue.then(async () => {
                await fetch(`${API}/v1/live/${code}/${action}`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ arg })
                });
            });
        },
        close: () => abort.abort()
    };
    fetch(`${API}/v1/live/${code}/events?clientId=${clientId}`, { headers, signal: abort.signal })
        .then(async (res) => {
            socket.emit("joinLobby"); // the stream is open, as on "connect"
            const decoder = new TextDecoder();
            let buffer = "";
            for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
                buffer += decoder.decode(chunk, { stream: true });
                let end;
                while ((end = buffer.indexOf("\n\n")) >= 0) {
                    const block = buffer.slice(0, end);
                    buffer = buffer.slice(end + 2);
                    const type = /^event: (.*)$/m.exec(block)?.[1];
                    const data = /^data: (.*)$/m.exec(block)?.[1];
                    if (type && data !== undefined) socket.events.push([type, JSON.parse(data)]);
                }
            }
        })
        .catch(() => undefined);
    sockets.push(socket);
    return socket;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function last(socket: TestSocket, event: string): any {
    return [...socket.events].reverse().find((e) => e[0] === event)?.[1];
}

// host plays white, opponent joins as black
async function startGame(white: Player, black: Player, body: object = {}) {
    const code = await createGame(white, { side: "white", ...body });
    const w = join(white, code);
    await wait(400);
    const b = join(black, code);
    await wait(400);
    b.emit("joinAsPlayer");
    await wait(400);
    return { w, b };
}

async function play(moves: [TestSocket, string, string][]) {
    for (const [socket, from, to] of moves) {
        socket.emit("sendMove", { from, to });
        await wait(400);
    }
}

describe.skipIf(!process.env.PGHOST)("game server", () => {
    beforeAll(async () => {
        server = spawn("node", ["dist/server.js"], {
            env: { ...process.env, PORT: String(PORT), LIVE_POLL_MS: "100" },
            stdio: ["ignore", "pipe", "inherit"]
        });
        await new Promise<void>((resolve) => {
            server.stdout?.on("data", (d) => String(d).includes("Tables initialized") && resolve());
        });
    }, 20000);

    afterAll(() => {
        sockets.forEach((s) => s.close());
        server?.kill();
    });

    it("runs the clock for timed games", async () => {
        const { w, b } = await startGame(await guest(`w${run}`), await guest(`b${run}`), {
            timeControl: { initial: 180, increment: 2 }
        });
        expect(last(b, "receivedLatestGame").clock).toMatchObject({ white: 180000, black: 180000 });

        await play([[w, "e2", "e4"]]);
        await wait(500);
        await play([[b, "e7", "e5"]]);

        const clock = last(w, "clockUpdate");
        expect(clock.white).toBe(180000); // white's first move is free
        expect(clock.black).toBeLessThan(182000); // thinking time minus the 2s increment
        expect(clock.black).toBeGreaterThan(181000);
    });

    it("handles draw offers", async () => {
        const { w, b } = await startGame(await guest(`dw${run}`), await guest(`db${run}`));
        await play([[w, "d2", "d4"]]);

        w.emit("offerDraw");
        await wait(200);
        expect(last(b, "drawOffered")).toMatchObject({ side: "white" });

        w.emit("respondDraw", true); // the player who offered cannot accept
        await play([[b, "d7", "d5"]]); // moving declines the offer
        expect(last(w, "drawDeclined")).toBeDefined();
        expect(last(w, "gameOver")).toBeUndefined();

        w.emit("offerDraw");
        await wait(200);
        b.emit("respondDraw", true);
        await wait(500);
        expect(last(w, "gameOver")).toMatchObject({ reason: "agreement" });
    });

    it("ends a game on time without server timers", async () => {
        const { w, b } = await startGame(await guest(`tw${run}`), await guest(`tb${run}`), {
            timeControl: { initial: 60, increment: 0 }
        });
        await play([
            [w, "e2", "e4"],
            [b, "e7", "e5"]
        ]);
        // white to move: pretend the last move was 61 seconds ago
        const code = (last(w, "receivedLatestGame") as { code: string }).code;
        const db = new pg.Client();
        await db.connect();
        await db.query(
            `UPDATE live_game SET state = jsonb_set(state, '{clock,lastMoveAt}', to_jsonb($2::bigint)) WHERE code = $1`,
            [code, Date.now() - 61000]
        );
        await db.end();
        await wait(600); // the players' event streams notice the fallen flag
        expect(last(b, "gameOver")).toMatchObject({ reason: "timeout", winnerSide: "black" });
    });

    it("delivers chat to the other players", async () => {
        const { w, b } = await startGame(await guest(`cw${run}`), await guest(`cb${run}`));
        w.emit("chat", "good luck!");
        await wait(500);
        expect(last(b, "chat")).toMatchObject({
            message: "good luck!",
            author: { name: `cw${run}` }
        });
        expect(last(w, "chat")).toBeUndefined();
    });

    it("ends the game on resignation", async () => {
        const { w, b } = await startGame(await guest(`rw${run}`), await guest(`rb${run}`));
        b.emit("resign");
        await wait(500);
        expect(last(w, "gameOver")).toMatchObject({ reason: "resigned", winnerSide: "white" });
    });

    it("updates ratings and the leaderboard after a rated game", async () => {
        const winnerName = `mate${run}`;
        const { w, b } = await startGame(
            await registered(`fool${run}`),
            await registered(winnerName)
        );
        await play([
            [w, "f2", "f3"],
            [b, "e7", "e5"],
            [w, "g2", "g4"],
            [b, "d8", "h4"]
        ]);
        await wait(500);

        expect(last(w, "gameOver")).toMatchObject({
            reason: "checkmate",
            winnerSide: "black",
            ratingChange: { white: -16, black: 16 }
        });

        const leaderboard = (await (await fetch(`${API}/v1/leaderboard`)).json()) as {
            name: string;
            rating: number;
        }[];
        expect(leaderboard.find((u) => u.name === winnerName)?.rating).toBe(1216);
    });
});
