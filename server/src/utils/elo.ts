export const DEFAULT_RATING = 1200;
const K_FACTOR = 32;

// probability that a player rated `rating` scores against `opponent`
export const expectedScore = (rating: number, opponent: number) =>
    1 / (1 + Math.pow(10, (opponent - rating) / 400));

// whiteScore: 1 = white won, 0.5 = draw, 0 = black won
export const calculateRatings = (white: number, black: number, whiteScore: 0 | 0.5 | 1) => {
    const whiteChange = Math.round(K_FACTOR * (whiteScore - expectedScore(white, black)));
    const blackChange = Math.round(K_FACTOR * (1 - whiteScore - expectedScore(black, white)));
    return {
        white: white + whiteChange,
        black: black + blackChange,
        whiteChange,
        blackChange
    };
};
