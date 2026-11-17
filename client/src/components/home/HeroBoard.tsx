"use client";

import { useEffect, useState } from "react";
import { Chessboard } from "react-chessboard";

// Italian Game after 5 moves; decorative only
const SHOWCASE_FEN = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5";

export default function HeroBoard({ maxWidth = 460 }: { maxWidth?: number }) {
  const [width, setWidth] = useState(maxWidth);

  useEffect(() => {
    function handleResize() {
      setWidth(Math.min(maxWidth, window.innerWidth - 64));
    }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [maxWidth]);

  return (
    <Chessboard
      id="showcase"
      boardWidth={width}
      position={SHOWCASE_FEN}
      arePiecesDraggable={false}
      customDarkSquareStyle={{ backgroundColor: "#4b7399" }}
      customLightSquareStyle={{ backgroundColor: "#eae9d2" }}
      customSquareStyles={{
        c4: { background: "rgba(255, 255, 0, 0.4)" },
        f7: { background: "radial-gradient(circle, rgba(255,0,0,.45) 30%, transparent 32%)" }
      }}
    />
  );
}
