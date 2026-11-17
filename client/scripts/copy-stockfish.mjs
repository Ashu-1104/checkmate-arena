// Copies the Stockfish engine (GPLv3, unmodified) into public/ so it can run as a Web Worker.
import { copyFileSync, mkdirSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const source = dirname(require.resolve("stockfish.js/package.json"));
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "engine");

mkdirSync(target, { recursive: true });
for (const file of ["stockfish.js", "stockfish.wasm", "stockfish.wasm.js", "Copying.txt"]) {
  copyFileSync(join(source, file), join(target, file));
}
console.log("Copied Stockfish to public/engine");
