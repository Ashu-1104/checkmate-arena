import app, { initTables } from "./app.js";

// Long-running server for local development and Docker. On Vercel, app.ts is the entrypoint.
await initTables();
console.log("Tables initialized");

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`CheckMate Arena api server listening on :${port}`);
});
