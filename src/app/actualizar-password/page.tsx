import { Suspense } from "react";
import { ActualizarPasswordForm } from "./_components/actualizar-password-form";

export default function ActualizarPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <Suspense>
        <ActualizarPasswordForm />
      </Suspense>
    </main>
  );
}
