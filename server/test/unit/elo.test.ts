import { describe, expect, it } from "vitest";

import { calculateRatings, expectedScore } from "../../src/utils/elo.js";

describe("expectedScore", () => {
    it("is 50% between equal players", () => {
        expect(expectedScore(1500, 1500)).toBe(0.5);
    });

    it("favours the higher rated player", () => {
        expect(expectedScore(1800, 1400)).toBeCloseTo(0.909, 3);
    });
});

describe("calculateRatings", () => {
    it("moves equal players by half the K-factor", () => {
        expect(calculateRatings(1200, 1200, 1)).toEqual({
            white: 1216,
            black: 1184,
            whiteChange: 16,
            blackChange: -16
        });
    });

    it("leaves equal players unchanged on a draw", () => {
        const result = calculateRatings(1200, 1200, 0.5);
        expect(result.whiteChange).toBe(0);
        expect(result.blackChange).toBe(0);
    });

    it("rewards an upset more than an expected win", () => {
        const upset = calculateRatings(1200, 1600, 1).whiteChange;
        const expected = calculateRatings(1600, 1200, 1).whiteChange;
        expect(upset).toBeGreaterThan(expected);
    });

    it("is zero-sum", () => {
        const { whiteChange, blackChange } = calculateRatings(1432, 1287, 0);
        expect(whiteChange + blackChange).toBe(0);
    });
});
