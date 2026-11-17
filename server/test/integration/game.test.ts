// Boots the compiled server against a real PostgreSQL database (PG* env vars) and
// plays games over Socket.IO. Run `pnpm build` first.
import { spawn, type ChildProcess } from "child_process";
import { io, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PORT = 3101;
const API = `http://127.0.0.1:${PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const run = Date.now().toString(36); // unique names per test run

interface Player {
    cookie: string;
}
type TestSocket = Socket & { events: [string, unknown][] };

let server: ChildProcess;
const sockets: Socket[] = [];

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
    const socket = io(API, {
        extraHeaders: { cookie: player.cookie },
        transports: ["websocket"]
    }) as TestSocket;
    socket.events = [];
    socket.onAny((event, payload) => socket.events.push([event, payload]));
    socket.on("connect", () => socket.emit("joinLobby", code));
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
    await wait(300);
    const b = join(black, code);
    await wait(300);
    b.emit("joinAsPlayer");
    await wait(300);
    return { w, b };
}

async function play(moves: [TestSocket, string, string][]) {
    for (const [socket, from, to] of moves) {
        socket.emit("sendMove", { from, to });
        await wait(150);
    }
}

describe.skipIf(!process.env.PGHOST)("game server", () => {
    beforeAll(async () => {
        server = spawn("node", ["dist/server.js"], {
            env: { ...process.env, PORT: String(PORT) },
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
