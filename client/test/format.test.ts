import { describe, expect, it } from "vitest";

import { describeResult, formatClock, formatTimeControl } from "@/lib/format";

describe("formatClock", () => {
    it("shows minutes and seconds", () => {
        expect(formatClock(5 * 60 * 1000)).toBe("5:00");
        expect(formatClock(65 * 1000)).toBe("1:05");
    });

    it("shows tenths of a second under ten seconds", () => {
        expect(formatClock(9450)).toBe("9.4");
    });

    it("never shows negative time", () => {
        expect(formatClock(-500)).toBe("0.0");
    });
});

describe("formatTimeControl", () => {
    it("formats minutes and increment", () => {
        expect(formatTimeControl({ initial: 180, increment: 2 })).toBe("3+2");
    });

    it("labels untimed games", () => {
        expect(formatTimeControl(undefined)).toBe("Unlimited");
    });
});

describe("describeResult", () => {
    it("describes each way a game can end", () => {
        expect(describeResult("checkmate", "white")).toBe("The game was won by checkmate (white).");
        expect(describeResult("timeout", "black")).toBe("The game was won on time (black).");
        expect(describeResult("resigned", "white")).toBe(
            "The game was won by resignation (white)."
        );
        expect(describeResult("agreement", "draw")).toBe("The game ended in a draw by agreement.");
    });
});
