import { fetchLeaderboard } from "@/lib/user";

export const metadata = {
  title: "Leaderboard | KnightLink",
  description: "Top rated KnightLink players."
};

export default async function Leaderboard() {
  const users = await fetchLeaderboard();

  return (
    <div className="mt-8 flex w-full flex-col items-center gap-6 px-4">
      <h1 className="text-3xl font-bold">Leaderboard</h1>
      <p className="text-sm opacity-70">
        Ratings use the Elo system and change after games between registered players.
      </p>

      <div className="bg-base-200 w-full max-w-2xl overflow-x-auto rounded-xl">
        <table className="table-zebra table w-full">
          <thead>
            <tr>
              <th className="w-12">#</th>
              <th>Player</th>
              <th className="text-end">Rating</th>
              <th className="text-end">W / D / L</th>
            </tr>
          </thead>
          <tbody>
            {users && users.length > 0 ? (
              users.map((user, i) => (
                <tr key={user.id}>
                  <td className="font-bold">{i + 1}</td>
                  <td>
                    <a className="text-primary link-hover font-bold" href={`/user/${user.name}`}>
                      {user.name}
                    </a>
                  </td>
                  <td className="text-end font-mono">{user.rating}</td>
                  <td className="text-end font-mono">
                    {user.wins} / {user.draws} / {user.losses}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center">
                  No rated games yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
