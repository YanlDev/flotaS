import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MantenimientoPanel } from "./_components/mantenimiento-panel";

export default async function MantenimientosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const { id } = await params;

  const vehiculo = await prisma.vehiculo.findUnique({
    where: { id },
    include: { sucursal: { select: { nombre: true, ciudad: true } } },
  });

  if (!vehiculo) notFound();

  if (profile.rol === "jefe_sucursal" && vehiculo.sucursalId !== profile.sucursalId) {
    redirect("/vehiculos");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/vehiculos" className="hover:underline">Vehículos</Link>
            <span>/</span>
            <Link href={`/vehiculos/${id}`} className="hover:underline font-mono">{vehiculo.placa}</Link>
            <span>/</span>
            <span>Mantenimientos</span>
          </div>
          <h1 className="text-2xl font-bold">Mantenimientos</h1>
          <p className="text-muted-foreground text-sm">
            {vehiculo.marca} {vehiculo.modelo} · {vehiculo.sucursal.nombre}
            {vehiculo.kmActuales != null && (
              <span className="ml-2 font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                {vehiculo.kmActuales.toLocaleString("es-PE")} km actuales
              </span>
            )}
          </p>
        </div>
        <Link href={`/vehiculos/${id}`}>
          <Button variant="outline" size="sm">← Volver al vehículo</Button>
        </Link>
      </div>

      <MantenimientoPanel
        vehiculoId={id}
        kmActuales={vehiculo.kmActuales}
        puedeEditar={profile.rol !== "visor"}
        esAdmin={profile.rol === "admin"}
      />
    </div>
  );
}
