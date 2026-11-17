import { API_URL } from "@/config";
import type { Game, User } from "@chessu/types";

export const fetchProfileData = async (name: string) => {
    try {
        // TODO: handle caching more efficiently?
        const res = await fetch(`${API_URL}/v1/users/${name}`, {
            next: { revalidate: 10 }
        });

        if (res && res.status === 200) {
            const data: User & { recentGames: Game[] } = await res.json();
            return data;
        }
    } catch (err) {
        console.error(err);
    }
};

export const fetchLeaderboard = async () => {
    try {
        const res = await fetch(`${API_URL}/v1/leaderboard`, {
            next: { revalidate: 10 }
        });

        if (res && res.status === 200) {
            const users: User[] = await res.json();
            return users;
        }
    } catch (err) {
        console.error(err);
    }
};
