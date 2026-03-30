import { redirect } from "next/navigation";
import { getProfile } from "@/lib/get-profile";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile || !profile.activo) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        rol={profile.rol}
        nombre={profile.nombreCompleto}
        sucursal={profile.sucursal?.nombre}
      />
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0 pt-4 md:pt-0 bg-muted/30">
        <div className="max-w-6xl mx-auto w-full p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
