import { RegistroForm } from "./_components/registro-form";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function RegistroPage({ searchParams }: Props) {
  const { token } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <RegistroForm token={token} />
    </main>
  );
}
