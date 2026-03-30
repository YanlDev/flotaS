import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { redirect } from "next/navigation";
import { SucursalesPanel } from "./_components/sucursales-panel";

export default async function SucursalesPage() {
  const profile = await getProfile();
  if (!profile || profile.rol !== "admin") redirect("/dashboard");

  const sucursales = await prisma.sucursal.findMany({
    orderBy: { nombre: "asc" },
    include: {
      _count: { select: { vehiculos: true, profiles: true } },
    },
  });

  const sucursalesSerializadas = sucursales.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    ciudad: s.ciudad,
    region: s.region,
    activa: s.activa,
    totalVehiculos: s._count.vehiculos,
    totalUsuarios: s._count.profiles,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Sucursales</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {sucursales.length} sucursal{sucursales.length !== 1 ? "es" : ""} registradas
        </p>
      </div>
      <SucursalesPanel sucursales={sucursalesSerializadas} />
    </div>
  );
}
