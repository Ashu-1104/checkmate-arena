"use client";

import { IconAlertCircle } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useContext, useState } from "react";

import { SITE_HOST } from "@/config";
import { SessionContext } from "@/context/session";
import { fetchActiveGame } from "@/lib/game";

export default function JoinGame() {
  const session = useContext(SessionContext);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const router = useRouter();

  async function submitJoinGame(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session?.user?.id) return;

    const target = e.target as HTMLFormElement;
    const codeEl = target.elements.namedItem("joinGameCode") as HTMLInputElement;

    let code = codeEl.value;
    if (!code) return;

    setButtonLoading(true);

    if (code.startsWith(SITE_HOST)) {
      code = "http://" + code;
    }
    if (code.startsWith("http")) {
      code = new URL(code).pathname.split("/")[1];
    }

    const game = await fetchActiveGame(code);

    if (game && game.code) {
      router.push(`/${game.code}`);
    } else {
      setButtonLoading(false);
      setNotFound(true);
    }
  }

  return (
    <form className="flex flex-col items-center gap-2" onSubmit={submitJoinGame}>
      <div className="input-group justify-center">
        <input
          type="text"
          placeholder="Invite link or code"
          className={"input input-bordered" + (notFound ? " input-error" : "")}
          name="joinGameCode"
          id="joinGameCode"
          onChange={() => setNotFound(false)}
          aria-invalid={notFound}
          aria-describedby="joinGameError"
        />
        <button
          className={
            "btn" +
            (buttonLoading ? " loading" : "") +
            (!session?.user?.id ? " btn-disabled text-base-content" : "")
          }
          type="submit"
        >
          Join
        </button>
      </div>
      {notFound && (
        <p id="joinGameError" role="alert" className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
          <IconAlertCircle size={16} /> Game not found. Check the invite link or code.
        </p>
      )}
    </form>
  );
}
