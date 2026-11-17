import { useCallback, useEffect, useRef, useState } from "react";

// skill level (0-20) and search limits for each difficulty
export const LEVELS = [
    { skill: 0, depth: 1, movetime: 200 },
    { skill: 3, depth: 2, movetime: 300 },
    { skill: 6, depth: 4, movetime: 400 },
    { skill: 9, depth: 6, movetime: 600 },
    { skill: 12, depth: 8, movetime: 800 },
    { skill: 15, depth: 10, movetime: 1000 },
    { skill: 18, depth: 12, movetime: 1500 },
    { skill: 20, depth: 15, movetime: 2000 }
];

// Runs Stockfish in a Web Worker and talks to it over the UCI protocol.
export function useStockfish() {
    const workerRef = useRef<Worker | null>(null);
    // eslint-disable-next-line no-unused-vars
    const pendingRef = useRef<((move: string) => void) | null>(null);
    const searchingRef = useRef(false);
    const ignoreRef = useRef(0); // replies still owed for searches that were stopped
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const url =
            typeof WebAssembly === "object" ? "/engine/stockfish.wasm.js" : "/engine/stockfish.js";
        const worker = new Worker(url);

        worker.onmessage = (e: MessageEvent) => {
            const line = String(e.data);
            if (line === "readyok") {
                setReady(true);
            } else if (line.startsWith("bestmove")) {
                if (ignoreRef.current > 0) {
                    ignoreRef.current--;
                    return;
                }
                searchingRef.current = false;
                const resolve = pendingRef.current;
                pendingRef.current = null;
                resolve?.(line.split(" ")[1]);
            }
        };
        worker.postMessage("uci");
        worker.postMessage("isready");
        workerRef.current = worker;

        return () => {
            worker.terminate();
            workerRef.current = null;
        };
    }, []);

    // resolves with a UCI move such as "e7e5" or "a7a8q"
    const getBestMove = useCallback((fen: string, level: number) => {
        return new Promise<string>((resolve) => {
            const worker = workerRef.current;
            if (!worker) return;
            const { skill, depth, movetime } = LEVELS[level - 1];
            pendingRef.current = resolve;
            searchingRef.current = true;
            worker.postMessage(`setoption name Skill Level value ${skill}`);
            worker.postMessage(`position fen ${fen}`);
            worker.postMessage(`go depth ${depth} movetime ${movetime}`);
        });
    }, []);

    // the stopped search still answers with a bestmove, which is skipped
    const stop = useCallback(() => {
        pendingRef.current = null;
        if (!searchingRef.current) return;
        searchingRef.current = false;
        ignoreRef.current++;
        workerRef.current?.postMessage("stop");
    }, []);

    return { ready, getBestMove, stop };
}
