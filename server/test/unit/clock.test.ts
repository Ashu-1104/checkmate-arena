import { describe, expect, it } from "vitest";

import { applyMove, createClock, parseTimeControl, remainingTime } from "../../src/utils/clock.js";

const blitz = { initial: 180, increment: 2 };

describe("parseTimeControl", () => {
    it("accepts offered presets", () => {
        expect(parseTimeControl({ initial: 180, increment: 2 })).toEqual(blitz);
    });

    it("rejects anything else", () => {
        expect(parseTimeControl({ initial: 7, increment: 99 })).toBeUndefined();
        expect(parseTimeControl("3+2")).toBeUndefined();
        expect(parseTimeControl(undefined)).toBeUndefined();
    });
});

describe("applyMove", () => {
    it("does not run the clock or add increment before the first move", () => {
        const { clock, flagged } = applyMove(createClock(blitz), "white", blitz, 1000);
        expect(flagged).toBe(false);
        expect(clock).toEqual({ white: 180000, black: 180000, lastMoveAt: 1000 });
    });

    it("subtracts thinking time and adds the increment", () => {
        const start = { white: 180000, black: 180000, lastMoveAt: 1000 };
        const { clock } = applyMove(start, "black", blitz, 6000);
        expect(clock.black).toBe(180000 - 5000 + 2000);
        expect(clock.white).toBe(180000);
        expect(clock.lastMoveAt).toBe(6000);
    });

    it("flags a player who moves after their time ran out", () => {
        const start = { white: 3000, black: 180000, lastMoveAt: 0 };
        const { clock, flagged } = applyMove(start, "white", blitz, 3001);
        expect(flagged).toBe(true);
        expect(clock.white).toBe(0);
    });
});

describe("remainingTime", () => {
    it("is the stored time while the clock is paused", () => {
        expect(remainingTime(createClock(blitz), "white", 99999)).toBe(180000);
    });

    it("counts down from the last move", () => {
        expect(remainingTime({ white: 10000, black: 0, lastMoveAt: 500 }, "white", 2500)).toBe(
            8000
        );
    });
});
