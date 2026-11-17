"use client";

import type { Clock as ClockType } from "@chessu/types";
import { useEffect, useState } from "react";

import { formatClock } from "@/lib/format";

export default function Clock({
  clock,
  side,
  running,
  offset
}: {
  clock: ClockType;
  side: "white" | "black";
  running: boolean;
  offset: number; // server time minus client time
}) {
  const [, setTick] = useState(0);

  // re-render while this clock is ticking
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(interval);
  }, [running]);

  const remaining =
    running && clock.lastMoveAt !== undefined
      ? clock[side] - (Date.now() + offset - clock.lastMoveAt)
      : clock[side];

  return (
    <span
      className={
        "badge badge-lg ml-auto min-w-[4.5rem] justify-center font-mono" +
        (running ? (remaining < 20000 ? " badge-error" : " badge-primary") : " badge-ghost")
      }
    >
      {formatClock(remaining)}
    </span>
  );
}
