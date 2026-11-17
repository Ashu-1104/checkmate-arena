import type { Game, TimeControl } from "@chessu/types";

// "5+3" style label, minutes + increment seconds
export const formatTimeControl = (tc?: TimeControl) =>
    tc ? `${tc.initial / 60}+${tc.increment}` : "Unlimited";

// m:ss, with tenths of a second under 10 seconds
export const formatClock = (ms: number) => {
    const clamped = Math.max(0, ms);
    if (clamped < 10000) return (Math.floor(clamped / 100) / 10).toFixed(1);
    const totalSeconds = Math.floor(clamped / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

// sentence describing how a finished game ended
export const describeResult = (endReason: Game["endReason"], winner: Game["winner"]) => {
    if (winner !== "draw") {
        if (endReason === "abandoned") return `The game was won by ${winner} due to abandonment.`;
        if (endReason === "timeout") return `The game was won on time (${winner}).`;
        if (endReason === "resigned") return `The game was won by resignation (${winner}).`;
        return `The game was won by checkmate (${winner}).`;
    }
    if (endReason === "abandoned") return "The game ended in a draw due to abandonment.";
    if (endReason === "timeout") return "The game ended in a draw on time (insufficient material).";
    if (endReason === "agreement") return "The game ended in a draw by agreement.";
    return "The game ended in a draw.";
};
