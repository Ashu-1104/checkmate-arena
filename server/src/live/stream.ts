import type { Request, Response } from "express";

import { db } from "../db/index.js";
import { settleClock } from "./handlers.js";
import { flaggedSide, latestEventId, loadGame, touchPresence } from "./store.js";

const POLL_MS = Number(process.env.LIVE_POLL_MS) || 1000;
// end before the serverless time limit; the browser's EventSource reconnects on its own
const MAX_SECONDS = Number(process.env.LIVE_MAX_SECONDS) || 280;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// GET /v1/live/:code/events?clientId=... : the Server-Sent Events stream for one browser tab.
// Polling also keeps the tab's presence fresh, so opponents see it as connected.
export async function streamGame(req: Request, res: Response) {
    const code = req.params.code;
    const clientId = String(req.query.clientId || "").slice(0, 64);
    if (!clientId) {
        res.status(400).end();
        return;
    }
    const resumeFrom = Number(req.get("Last-Event-ID"));
    let lastId = resumeFrom > 0 ? resumeFrom : await latestEventId(code);

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
    });
    res.write("retry: 1000\n\n");

    let open = true;
    req.on("close", () => {
        open = false;
    });

    const until = Date.now() + MAX_SECONDS * 1000;
    let players = "";
    for (let polls = 1; open && Date.now() < until; polls++) {
        await touchPresence(code, clientId, req.session.user);

        const { rows } = await db.query(
            `SELECT id, type, payload FROM live_event WHERE code = $1 AND id > $2
               AND (only_client IS NULL OR only_client = $3) AND (skip_client IS NULL OR skip_client <> $3)
             ORDER BY id LIMIT 200`,
            [code, lastId, clientId]
        );
        for (const event of rows) {
            lastId = Number(event.id);
            res.write(
                `id: ${lastId}\nevent: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`
            );
        }

        let game = await loadGame(code);
        if (game && flaggedSide(game)) {
            await settleClock(code); // the gameOver event arrives with the next poll
            game = await loadGame(code);
        }
        if (game) {
            // a player connected or dropped: send the game again so the board shows it
            const now = `${game.white?.connected}|${game.black?.connected}`;
            if (players && now !== players) {
                res.write(`event: receivedLatestGame\ndata: ${JSON.stringify(game)}\n\n`);
            }
            players = now;
        }
        if (polls % 15 === 0) res.write(": ping\n\n");
        await sleep(POLL_MS);
    }
    if (open) res.end();
}
