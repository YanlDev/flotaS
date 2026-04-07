import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CombustiblePanel } from "./_components/combustible-panel";

export default async function CombustiblePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.rol === "comercial") redirect("/proveedores");

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
            <span>Combustible</span>
          </div>
          <h1 className="text-2xl font-bold">Combustible</h1>
          <p className="text-muted-foreground text-sm">
            {vehiculo.marca} {vehiculo.modelo} · {vehiculo.sucursal.nombre}
          </p>
        </div>
        <Link href={`/vehiculos/${id}`}>
          <Button variant="outline" size="sm">← Volver al vehículo</Button>
        </Link>
      </div>

      <CombustiblePanel
        vehiculoId={id}
        tipoCombustibleVehiculo={vehiculo.combustible ?? "diesel"}
        puedeCargar={profile.rol === "admin" || profile.rol === "jefe_sucursal"}
        puedeRevisar={profile.rol === "admin"}
        puedeEliminar={profile.rol === "admin"}
      />
    </div>
  );
}
