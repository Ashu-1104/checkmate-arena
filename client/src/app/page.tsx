import { IconBolt, IconCpu, IconEye, IconLink, IconTrophy, IconClock } from "@tabler/icons-react";
import Link from "next/link";

import CreateGame from "@/components/home/CreateGame";
import HeroBoard from "@/components/home/HeroBoard";
import JoinGame from "@/components/home/JoinGame";
import PublicGames from "@/components/home/PublicGames/PublicGames";

export const revalidate = 0;

const FEATURES = [
  { icon: IconClock, text: "Live chess clocks" },
  { icon: IconTrophy, text: "Elo ratings" },
  { icon: IconCpu, text: "Stockfish AI" },
  { icon: IconEye, text: "Spectate & chat" }
];

export default function Home() {
  return (
    <div className="flex w-full flex-col gap-16 py-10">
      <section className="grid items-center gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <span className="badge badge-primary badge-outline w-fit gap-1 py-3">
            <IconBolt size={14} /> Real-time multiplayer chess
          </span>
          <h1 className="text-4xl font-extrabold leading-tight md:text-6xl">
            Play chess with anyone,{" "}
            <span className="from-primary to-accent bg-gradient-to-r bg-clip-text text-transparent">
              anywhere.
            </span>
          </h1>
          <p className="max-w-xl text-lg opacity-80">
            Challenge a friend with a link, jump into a public game, or test yourself against
            Stockfish. Live clocks, Elo ratings and spectator chat are built in.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#play" className="btn btn-primary btn-lg normal-case">
              Create a game
            </a>
            <Link href="/computer" className="btn btn-outline btn-lg gap-2 normal-case">
              <IconCpu /> Play vs computer
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {FEATURES.map((f) => (
              <span key={f.text} className="badge badge-lg bg-base-200 gap-2 border-0 py-4">
                <f.icon size={16} className="text-primary" /> {f.text}
              </span>
            ))}
          </div>
        </div>
        <div className="flex justify-center">
          <div className="from-primary/40 to-accent/40 rotate-2 rounded-3xl bg-gradient-to-br p-4 shadow-2xl transition hover:rotate-0">
            <HeroBoard maxWidth={460} />
          </div>
        </div>
      </section>

      <section id="play" className="grid scroll-mt-8 gap-6 md:grid-cols-3">
        <div className="card bg-base-200 shadow-lg">
          <div className="card-body items-center">
            <h2 className="card-title">Create a game</h2>
            <CreateGame />
          </div>
        </div>
        <div className="card bg-base-200 shadow-lg">
          <div className="card-body items-center">
            <IconLink size={40} className="text-primary" />
            <h2 className="card-title">Join a friend</h2>
            <p className="mb-2 text-center text-sm opacity-70">Paste an invite link or code.</p>
            <JoinGame />
          </div>
        </div>
        <div className="card from-primary to-secondary text-primary-content bg-gradient-to-br shadow-lg">
          <div className="card-body items-center justify-center text-center">
            <IconCpu size={40} />
            <h2 className="card-title">Play vs computer</h2>
            <p className="text-sm opacity-90">Eight levels of Stockfish, right in your browser.</p>
            <Link href="/computer" className="btn mt-2 normal-case">
              Start now
            </Link>
          </div>
        </div>
      </section>

      <section className="flex justify-center">
        <PublicGames />
      </section>
    </div>
  );
}
