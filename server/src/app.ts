import cors from "cors";
import "dotenv/config";
import express from "express";

import { INIT_TABLES, db } from "./db/index.js";
import session from "./middleware/session.js";
import routes from "./routes/index.js";

const corsConfig = {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true
};

// created once per server (or serverless instance); retried if it fails
let tablesReady: Promise<unknown> | undefined;
export const initTables = () =>
    (tablesReady ??= db.query(INIT_TABLES).catch((err) => {
        tablesReady = undefined;
        throw err;
    }));

const app = express();

// middleware
app.use(cors(corsConfig));
app.use((req, res, next) => {
    initTables().then(() => next(), next);
});
app.use(express.json());
app.set("trust proxy", 1);
app.use(session);
app.use("/v1", routes);

export default app;
