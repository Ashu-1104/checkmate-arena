export interface Game {
    id?: number;
    pgn?: string;
    white?: User;
    black?: User;
    winner?: "white" | "black" | "draw";
    endReason?:
        | "draw"
        | "checkmate"
        | "stalemate"
        | "repetition"
        | "insufficient"
        | "abandoned"
        | "timeout"
        | "resigned"
        | "agreement";
    host?: User;
    code?: string;
    unlisted?: boolean;
    timeout?: number;
    observers?: User[];
    startedAt?: number;
    endedAt?: number;

    // undefined for untimed games
    timeControl?: TimeControl;
    clock?: Clock;
    flagTimeout?: number;

    drawOffer?: "white" | "black" | null; // side with a pending draw offer

    // set when a finished game between two registered users was rated
    ratingChange?: { white: number; black: number };
}

export interface TimeControl {
    initial: number; // seconds
    increment: number; // seconds added after each move
}

export interface Clock {
    white: number; // remaining ms
    black: number;
    lastMoveAt?: number; // server timestamp of the last move; clock is paused until the first move
    serverTime?: number; // server timestamp when this clock was sent, used to correct client drift
}

export interface User {
    id?: number | string; // string for guest IDs
    name?: string | null;
    email?: string;
    wins?: number;
    losses?: number;
    draws?: number;
    rating?: number;

    // mainly for players, not spectators
    connected?: boolean;
    disconnectedOn?: number;
}
