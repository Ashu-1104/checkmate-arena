import type { Action, CustomSquares, Lobby, Message } from "@/types";
import type { Clock, Game, User } from "@chessu/types";
import type { Dispatch, SetStateAction } from "react";

import type { LiveSocket as Socket } from "@/lib/liveSocket";

import { syncPgn, syncSide } from "./utils";

export function initSocket(
    user: User,
    socket: Socket,
    lobby: Lobby,
    actions: {
        updateLobby: Dispatch<Action>;
        addMessage: Function;
        updateCustomSquares: Dispatch<Partial<CustomSquares>>;
        makeMove: Function;
        setNavFen: Dispatch<SetStateAction<string | null>>;
        setNavIndex: Dispatch<SetStateAction<number | null>>;
        setClockOffset: Dispatch<SetStateAction<number>>;
    }
) {
    socket.on("connect", () => {
        socket.emit("joinLobby", lobby.code);
    });
    // TODO: handle disconnect

    socket.on("chat", (message: Message) => {
        actions.addMessage(message);
    });

    socket.on("receivedLatestGame", (latestGame: Game) => {
        if (latestGame.clock?.serverTime) {
            actions.setClockOffset(latestGame.clock.serverTime - Date.now());
        }
        if (latestGame.pgn && latestGame.pgn !== lobby.actualGame.pgn()) {
            syncPgn(latestGame.pgn, lobby, actions);
        }
        actions.updateLobby({ type: "updateLobby", payload: latestGame });

        syncSide(user, latestGame, lobby, actions);
    });

    socket.on("receivedMove", (m: { from: string; to: string; promotion?: string }) => {
        const success = actions.makeMove(m);
        if (!success) {
            socket.emit("getLatestGame");
        }
    });

    socket.on("clockUpdate", (clock: Clock) => {
        if (clock.serverTime) actions.setClockOffset(clock.serverTime - Date.now());
        actions.updateLobby({ type: "updateLobby", payload: { clock } });
    });

    socket.on("drawOffered", ({ name, side }: { name: string; side: "white" | "black" }) => {
        actions.updateLobby({ type: "updateLobby", payload: { drawOffer: side } });
        actions.addMessage({ author: { name: "server" }, message: `${name} has offered a draw.` });
    });

    socket.on("drawDeclined", ({ name }: { name: string }) => {
        actions.updateLobby({ type: "updateLobby", payload: { drawOffer: null } });
        actions.addMessage({
            author: { name: "server" },
            message: `${name} declined the draw offer.`
        });
    });

    socket.on("userJoinedAsPlayer", ({ name, side }: { name: string; side: "white" | "black" }) => {
        actions.addMessage({
            author: { name: "server" },
            message: `${name} is now playing as ${side}.`
        });
    });

    socket.on(
        "gameOver",
        ({
            reason,
            winnerName,
            winnerSide,
            id,
            ratingChange
        }: {
            reason: Game["endReason"];
            winnerName?: string;
            winnerSide?: "white" | "black" | "draw";
            id: number;
            ratingChange?: Game["ratingChange"];
        }) => {
            const m = {
                author: { name: "server" }
            } as Message;

            if (reason === "abandoned") {
                if (!winnerSide) {
                    m.message = `${winnerName} has claimed a draw due to abandonment.`;
                } else {
                    m.message = `${winnerName} (${winnerSide}) has claimed the win due to abandonment.`;
                }
            } else if (reason === "resigned") {
                const loserSide = winnerSide === "white" ? "black" : "white";
                m.message = `${loserSide} resigned. ${winnerName} (${winnerSide}) has won.`;
            } else if (reason === "agreement") {
                m.message = "The game has been drawn by agreement.";
            } else if (reason === "timeout" && winnerSide) {
                m.message = `${winnerName} (${winnerSide}) has won on time.`;
            } else if (reason === "timeout") {
                m.message = "The game has been drawn on time due to insufficient material.";
            } else if (reason === "checkmate") {
                m.message = `${winnerName} (${winnerSide}) has won by checkmate.`;
            } else {
                let message = "The game has ended in a draw";
                if (reason === "repetition") {
                    message = message.concat(" due to threefold repetition");
                } else if (reason === "insufficient") {
                    message = message.concat(" due to insufficient material");
                } else if (reason === "stalemate") {
                    message = "The game has been drawn due to stalemate";
                }
                m.message = message.concat(".");
            }
            actions.updateLobby({
                type: "updateLobby",
                payload: { endReason: reason, winner: winnerSide || "draw", id }
            });
            actions.addMessage(m);

            if (ratingChange) {
                const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
                actions.addMessage({
                    author: { name: "server" },
                    message: `Rating change: white ${signed(ratingChange.white)}, black ${signed(ratingChange.black)}.`
                });
            }
        }
    );
}
