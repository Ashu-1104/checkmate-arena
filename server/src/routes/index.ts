import { Router } from "express";

import auth from "./auth.route.js";
import games from "./games.route.js";
import leaderboard from "./leaderboard.route.js";
import live from "./live.route.js";
import users from "./users.route.js";

const router = Router();

router.use("/games", games);
router.use("/auth", auth);
router.use("/users", users);
router.use("/leaderboard", leaderboard);
router.use("/live", live);

export default router;
