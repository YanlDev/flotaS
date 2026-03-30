import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { redirect } from "next/navigation";
import { UsuariosPanel } from "./_components/usuarios-panel";

export default async function UsuariosPage() {
  const profile = await getProfile();
  if (!profile || profile.rol !== "admin") redirect("/dashboard");

  const [usuarios, sucursales] = await Promise.all([
    prisma.profile.findMany({
      orderBy: [{ activo: "desc" }, { nombreCompleto: "asc" }],
      include: { sucursal: { select: { id: true, nombre: true } } },
    }),
    prisma.sucursal.findMany({
      where: { activa: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  const usuariosSerializados = usuarios.map((u) => ({
    id: u.id,
    nombreCompleto: u.nombreCompleto,
    email: u.email,
    rol: u.rol as string,
    activo: u.activo,
    sucursalId: u.sucursalId,
    sucursalNombre: u.sucursal?.nombre ?? null,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Gestión de accesos al sistema
        </p>
      </div>
      <UsuariosPanel
        usuarios={usuariosSerializados}
        sucursales={sucursales}
        adminId={profile.id}
      />
    </div>
  );
}
