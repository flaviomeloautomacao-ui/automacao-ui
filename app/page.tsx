import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-8 p-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Automação DHA
        </h1>
        <p className="text-center text-zinc-600 dark:text-zinc-400">
          Selecione uma opção para começar:
        </p>
        <nav className="flex flex-col gap-4 w-full">
          <Link
            href="/upload"
            className="flex h-12 items-center justify-center rounded-lg bg-foreground text-background font-medium transition-colors hover:opacity-90"
          >
            Upload de Arquivo
          </Link>
          <Link
            href="/jobs"
            className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-700 font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Ver Jobs
          </Link>
        </nav>
      </main>
    </div>
  );
}
