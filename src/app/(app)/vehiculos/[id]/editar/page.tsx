import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VehiculoEditForm } from "./_components/vehiculo-edit-form";

export default async function EditarVehiculoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.rol !== "admin") redirect("/vehiculos");

  const { id } = await params;

  const [vehiculo, sucursales, conductoresDisponibles] = await Promise.all([
    prisma.vehiculo.findUnique({
      where: { id },
      include: {
        sucursal: { select: { id: true, nombre: true, ciudad: true } },
        conductor: { select: { id: true, nombreCompleto: true } },
      },
    }),
    prisma.sucursal.findMany({
      where: { activa: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, ciudad: true },
    }),
    prisma.conductor.findMany({
      where: { activo: true, OR: [{ vehiculoId: null }, { vehiculoId: id }] },
      orderBy: { nombreCompleto: "asc" },
      select: { id: true, nombreCompleto: true, licenciaCategoria: true },
    }),
  ]);

  if (!vehiculo) notFound();

  const vehiculoSerialized = {
    id: vehiculo.id,
    placa: vehiculo.placa,
    sucursalId: vehiculo.sucursalId,
    sucursal: vehiculo.sucursal,
    conductorId: vehiculo.conductor?.id ?? null,
    tipo: vehiculo.tipo as string,
    marca: vehiculo.marca,
    modelo: vehiculo.modelo,
    anio: vehiculo.anio,
    color: vehiculo.color,
    motor: vehiculo.motor,
    numeroMotor: vehiculo.numeroMotor,
    numeroChasis: vehiculo.numeroChasis,
    propietario: vehiculo.propietario,
    rucPropietario: vehiculo.rucPropietario,
    transmision: vehiculo.transmision as string | null,
    traccion: vehiculo.traccion as string | null,
    combustible: vehiculo.combustible as string | null,
    numAsientos: vehiculo.numAsientos,
    capacidadCargaKg: vehiculo.capacidadCargaKg,
    kmActuales: vehiculo.kmActuales,
    zonaOperacion: vehiculo.zonaOperacion,
    fechaAdquisicion: vehiculo.fechaAdquisicion
      ? vehiculo.fechaAdquisicion.toISOString().split("T")[0]
      : null,
    estado: vehiculo.estado as string,
    problemaActivo: vehiculo.problemaActivo,
    observaciones: vehiculo.observaciones,
    gps: vehiculo.gps,
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Editar vehículo</h1>
          <p className="text-muted-foreground text-sm mt-0.5 font-mono">{vehiculo.placa}</p>
        </div>
        <Link href={`/vehiculos/${id}`}>
          <Button variant="outline" size="sm">← Volver</Button>
        </Link>
      </div>

      <VehiculoEditForm
        vehiculo={vehiculoSerialized}
        sucursales={sucursales}
        conductoresDisponibles={conductoresDisponibles}
      />
    </div>
  );
}
