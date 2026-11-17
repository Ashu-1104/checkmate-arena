import ComputerGame from "@/components/computer/ComputerGame";

export const metadata = {
  title: "Play vs Computer | KnightLink",
  description: "Play chess against the Stockfish engine at eight difficulty levels."
};

export default function Computer() {
  return <ComputerGame />;
}
