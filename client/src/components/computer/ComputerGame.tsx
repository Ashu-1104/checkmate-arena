"use client";

import { IconArrowBackUp, IconCpu, IconRefresh } from "@tabler/icons-react";
import type { Move, Square } from "chess.js";
import { Chess } from "chess.js";
import { useEffect, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";

import { LEVELS, useStockfish } from "./useStockfish";

type Side = "w" | "b";
type SquareStyles = { [square: string]: { background: string; borderRadius?: string } };

const HIGHLIGHT = "rgba(255, 255, 0, 0.4)";

export default function ComputerGame() {
  const { ready, getBestMove, stop } = useStockfish();

  const gameRef = useRef(new Chess());
  const [gameId, setGameId] = useState(0); // restarts the engine turn on a new game
  const [fen, setFen] = useState(gameRef.current.fen());
  const [playerSide, setPlayerSide] = useState<Side>("w");
  const [level, setLevel] = useState(3);
  const [thinking, setThinking] = useState(false);
  const [lastMove, setLastMove] = useState<SquareStyles>({});
  const [options, setOptions] = useState<SquareStyles>({});
  const [moveFrom, setMoveFrom] = useState<Square | null>(null);
  const [boardWidth, setBoardWidth] = useState(480);

  const game = gameRef.current;
  const playerTurn = game.turn() === playerSide && !game.isGameOver() && !thinking;

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1920) setBoardWidth(580);
      else if (window.innerWidth >= 1536) setBoardWidth(540);
      else if (window.innerWidth >= 768) setBoardWidth(480);
      else setBoardWidth(350);
    }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // let the engine move whenever it is its turn
  useEffect(() => {
    if (!ready || thinking || game.isGameOver() || game.turn() === playerSide) return;

    setThinking(true);
    getBestMove(game.fen(), level).then((uci) => {
      applyMove({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      setThinking(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fen, playerSide, gameId]);

  function applyMove(m: { from: string; to: string; promotion?: string }) {
    try {
      const result = game.move(m);
      setFen(game.fen());
      setLastMove({
        [result.from]: { background: HIGHLIGHT },
        [result.to]: { background: HIGHLIGHT }
      });
      setOptions({});
      return true;
    } catch {
      return false;
    }
  }

  function newGame(side: Side | "random" = playerSide) {
    stop();
    setGameId((id) => id + 1);
    game.reset();
    setThinking(false);
    setLastMove({});
    setOptions({});
    setMoveFrom(null);
    setPlayerSide(side === "random" ? (Math.random() < 0.5 ? "w" : "b") : side);
    setFen(game.fen());
  }

  // take back the last full move (yours and the engine's reply)
  function undo() {
    if (thinking) return;
    game.undo();
    if (game.turn() !== playerSide) game.undo();
    setLastMove({});
    setOptions({});
    setFen(game.fen());
  }

  function showOptions(square: Square) {
    const moves = game.moves({ square, verbose: true }) as Move[];
    if (!moves.length) return false;
    const squares: SquareStyles = { [square]: { background: HIGHLIGHT } };
    for (const move of moves) {
      squares[move.to] = {
        background: game.get(move.to as Square)
          ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
          : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
        borderRadius: "50%"
      };
    }
    setOptions(squares);
    return true;
  }

  function onDrop(from: Square, to: Square) {
    if (!playerTurn) return false;
    setMoveFrom(null);
    return applyMove({ from, to, promotion: "q" });
  }

  function onSquareClick(square: Square) {
    if (!playerTurn) return;
    if (moveFrom && applyMove({ from: moveFrom, to: square, promotion: "q" })) {
      setMoveFrom(null);
      return;
    }
    setMoveFrom(showOptions(square) ? square : null);
  }

  function getStatus() {
    if (!ready) return "Loading engine...";
    if (game.isCheckmate())
      return game.turn() === playerSide ? "Checkmate. The computer wins." : "Checkmate. You win!";
    if (game.isStalemate()) return "Draw by stalemate.";
    if (game.isThreefoldRepetition()) return "Draw by threefold repetition.";
    if (game.isInsufficientMaterial()) return "Draw by insufficient material.";
    if (game.isDraw()) return "Draw.";
    if (thinking) return "Computer is thinking...";
    return game.inCheck() ? "Your move. You are in check!" : "Your move.";
  }

  const history = game.history();
  const movePairs = Array.from({ length: Math.ceil(history.length / 2) }, (_, i) =>
    history.slice(i * 2, i * 2 + 2)
  );

  return (
    <div className="flex w-full flex-wrap justify-center gap-6 px-4 py-4 lg:gap-10 2xl:gap-16">
      <div className="relative h-min">
        <Chessboard
          boardWidth={boardWidth}
          customDarkSquareStyle={{ backgroundColor: "#4b7399" }}
          customLightSquareStyle={{ backgroundColor: "#eae9d2" }}
          position={fen}
          boardOrientation={playerSide === "b" ? "black" : "white"}
          isDraggablePiece={({ piece }) => playerTurn && piece.startsWith(playerSide)}
          onPieceDragBegin={(_piece, square) => playerTurn && showOptions(square)}
          onPieceDragEnd={() => setOptions({})}
          onPieceDrop={onDrop}
          onSquareClick={onSquareClick}
          customSquareStyles={{ ...lastMove, ...options }}
        />
      </div>

      <div className="flex max-w-lg flex-1 flex-col gap-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <IconCpu /> Play vs Computer
        </h1>

        <div className="bg-base-300 rounded-lg p-4 font-bold">{getStatus()}</div>

        <div className="form-control">
          <label className="label" htmlFor="computerLevel">
            <span className="label-text">Difficulty: level {level}</span>
          </label>
          <input
            type="range"
            min={1}
            max={LEVELS.length}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="range range-primary range-sm"
            id="computerLevel"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sm btn-primary normal-case" onClick={() => newGame("w")}>
            New game as white
          </button>
          <button className="btn btn-sm btn-primary normal-case" onClick={() => newGame("b")}>
            New game as black
          </button>
          <button className="btn btn-sm gap-1 normal-case" onClick={() => newGame("random")}>
            <IconRefresh size={16} /> Random side
          </button>
          <button
            className={
              "btn btn-sm gap-1 normal-case" + (thinking || !history.length ? " btn-disabled" : "")
            }
            onClick={undo}
          >
            <IconArrowBackUp size={16} /> Undo
          </button>
        </div>

        <div className="bg-base-200 h-48 overflow-y-auto rounded-lg p-2">
          <table className="table-compact table w-full">
            <tbody>
              {movePairs.map((pair, i) => (
                <tr key={i}>
                  <td className="w-10">{i + 1}.</td>
                  <td>{pair[0]}</td>
                  <td>{pair[1] || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs opacity-70">
          Powered by the Stockfish chess engine (GPLv3), running in your browser.
        </p>
      </div>
    </div>
  );
}
