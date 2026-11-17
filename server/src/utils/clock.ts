import type { Clock, TimeControl } from "@chessu/types";

// minutes + increment presets offered in the client
export const TIME_CONTROLS: TimeControl[] = [
    { initial: 60, increment: 0 },
    { initial: 180, increment: 0 },
    { initial: 180, increment: 2 },
    { initial: 300, increment: 0 },
    { initial: 300, increment: 3 },
    { initial: 600, increment: 0 },
    { initial: 600, increment: 5 },
    { initial: 900, increment: 10 }
];

export const parseTimeControl = (value: unknown): TimeControl | undefined => {
    if (!value || typeof value !== "object") return undefined;
    const { initial, increment } = value as TimeControl;
    return TIME_CONTROLS.find((tc) => tc.initial === initial && tc.increment === increment);
};

export const createClock = (tc: TimeControl): Clock => ({
    white: tc.initial * 1000,
    black: tc.initial * 1000
});

// time left for the side to move at `now`
export const remainingTime = (clock: Clock, side: "white" | "black", now: number) => {
    if (clock.lastMoveAt === undefined) return clock[side];
    return clock[side] - (now - clock.lastMoveAt);
};

// Returns the clock after `side` moves at `now`, or flagged=true if their time had already run out.
// White's first move is free: clocks start running only after it.
export const applyMove = (
    clock: Clock,
    side: "white" | "black",
    tc: TimeControl,
    now: number
): { clock: Clock; flagged: boolean } => {
    const remaining = remainingTime(clock, side, now);
    if (remaining <= 0) {
        return { clock: { ...clock, [side]: 0 }, flagged: true };
    }
    const added = clock.lastMoveAt === undefined ? 0 : tc.increment * 1000;
    return {
        clock: { white: clock.white, black: clock.black, [side]: remaining + added, lastMoveAt: now },
        flagged: false
    };
};
