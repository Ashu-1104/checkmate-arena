"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useContext, useState } from "react";

import { SessionContext } from "@/context/session";
import { createGame } from "@/lib/game";

// minutes+increment; "" is an untimed game
const TIME_CONTROLS = ["1+0", "3+0", "3+2", "5+0", "5+3", "10+0", "10+5", "15+10"];

export default function CreateGame() {
  const session = useContext(SessionContext);
  const [buttonLoading, setButtonLoading] = useState(false);
  const router = useRouter();

  async function submitCreateGame(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session?.user?.id) return;
    setButtonLoading(true);

    const target = e.target as HTMLFormElement;
    const unlisted = target.elements.namedItem("createUnlisted") as HTMLInputElement;
    const startingSide = (target.elements.namedItem("createStartingSide") as HTMLSelectElement)
      .value;

    const timeValue = (target.elements.namedItem("createTimeControl") as HTMLSelectElement).value;
    const [minutes, increment] = timeValue.split("+").map(Number);
    const timeControl = timeValue ? { initial: minutes * 60, increment } : undefined;

    const game = await createGame(startingSide, unlisted.checked, timeControl);

    if (game) {
      router.push(`/${game.code}`);
    } else {
      setButtonLoading(false);
      // TODO: Show error message
    }
  }

  return (
    <form className="form-control" onSubmit={submitCreateGame}>
      <label className="label cursor-pointer">
        <span className="label-text">Unlisted/invite-only</span>
        <input type="checkbox" className="checkbox" name="createUnlisted" id="createUnlisted" />
      </label>
      <label className="label" htmlFor="createTimeControl">
        <span className="label-text">Time control</span>
      </label>
      <select
        className="select select-bordered mb-2"
        name="createTimeControl"
        id="createTimeControl"
        defaultValue="5+3"
      >
        <option value="">Unlimited</option>
        {TIME_CONTROLS.map((tc) => (
          <option key={tc} value={tc}>
            {tc}
          </option>
        ))}
      </select>
      <label className="label" htmlFor="createStartingSide">
        <span className="label-text">Select your side</span>
      </label>
      <div className="input-group">
        <select
          className="select select-bordered"
          name="createStartingSide"
          id="createStartingSide"
        >
          <option value="random">Random</option>
          <option value="white">White</option>
          <option value="black">Black</option>
        </select>
        <button
          className={
            "btn" +
            (buttonLoading ? " loading" : "") +
            (!session?.user?.id ? " btn-disabled text-base-content" : "")
          }
          type="submit"
        >
          Create
        </button>
      </div>
    </form>
  );
}
