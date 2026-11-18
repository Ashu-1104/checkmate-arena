import { IconBrandGithub } from "@tabler/icons-react";

export default function Footer() {
  return (
    <footer className="footer border-base-300 dark:border-neutral text-base-content mx-1 mt-4 w-auto grid-flow-col items-center justify-between border-t-2 p-4 md:mx-16 lg:mx-40">
      <div className="items-center">
        <p>
          CheckMate Arena by Ashutosh Tiwari
        </p>
      </div>
      <div className="items-center">
        <a
          href="https://github.com/Ashu-1104/checkmate-arena"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-sm gap-1 normal-case"
        >
          <IconBrandGithub className="inline-block" size={16} />
          GitHub
        </a>
      </div>
    </footer>
  );
}
