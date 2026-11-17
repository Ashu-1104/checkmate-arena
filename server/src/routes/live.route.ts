import type { NextFunction, Request, Response } from "express";
import { Router } from "express";

import { runAction } from "../live/handlers.js";
import { streamGame } from "../live/stream.js";

const router = Router();

// players need a session (guest or registered), as Socket.IO connections did
const requireUser = (req: Request, res: Response, next: NextFunction) => {
    if (req.session?.user) next();
    else res.status(401).end();
};

router.get("/:code/events", requireUser, (req, res, next) => {
    streamGame(req, res).catch(next);
});

router.post("/:code/:action", requireUser, async (req, res, next) => {
    try {
        const clientId = String(req.get("X-Client-Id") || "").slice(0, 64);
        if (!clientId) {
            res.status(400).end();
            return;
        }
        const known = await runAction(
            req.params.code,
            req.params.action,
            req.session.user,
            clientId,
            req.body?.arg
        );
        res.status(known ? 204 : 404).end();
    } catch (err) {
        next(err);
    }
});

export default router;
