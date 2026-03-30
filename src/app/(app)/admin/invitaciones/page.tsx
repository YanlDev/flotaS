import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { redirect } from "next/navigation";
import { InvitacionesClient } from "./_components/invitaciones-client";

export default async function InvitacionesPage() {
  const profile = await getProfile();
  if (!profile || profile.rol !== "admin") redirect("/dashboard");

  const [invitaciones, sucursales] = await Promise.all([
    prisma.invitacion.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        token: true,
        email: true,
        rol: true,
        usado: true,
        expiraEn: true,
        sucursal: { select: { nombre: true } },
      },
    }),
    prisma.sucursal.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } }),
  ]);

  const invitacionesSerialized = invitaciones.map((i) => ({
    ...i,
    expiraEn: i.expiraEn.toISOString(),
  }));

  return (
    <div className="p-6">
      <InvitacionesClient
        invitaciones={invitacionesSerialized}
        sucursales={sucursales}
      />
    </div>
  );
}
