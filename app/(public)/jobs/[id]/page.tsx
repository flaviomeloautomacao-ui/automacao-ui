interface JobDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-4">Job #{id}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Detalhes do job — em construção.
      </p>
    </main>
  );
}
