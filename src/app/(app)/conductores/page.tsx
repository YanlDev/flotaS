import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { redirect } from "next/navigation";
import { ConductoresPanel } from "./_components/conductores-panel";

export default async function ConductoresPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const esVisor = profile.rol === "visor";
  const sucursalFiltro =
    profile.rol === "jefe_sucursal" ? profile.sucursalId ?? undefined : undefined;

  const [conductores, sucursales, vehiculosDisponibles] = await Promise.all([
    prisma.conductor.findMany({
      where: { ...(sucursalFiltro && { sucursalId: sucursalFiltro }) },
      orderBy: [{ activo: "desc" }, { nombreCompleto: "asc" }],
      include: {
        sucursal: { select: { nombre: true } },
        vehiculo: { select: { id: true, placa: true, marca: true, modelo: true } },
      },
    }),
    profile.rol === "admin"
      ? prisma.sucursal.findMany({ where: { activa: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } })
      : Promise.resolve(profile.sucursalId
          ? [{ id: profile.sucursalId, nombre: profile.sucursal?.nombre ?? "" }]
          : []),
    prisma.vehiculo.findMany({
      where: {
        ...(sucursalFiltro && { sucursalId: sucursalFiltro }),
        conductor: { is: null }, // Solo vehículos sin conductor asignado
      },
      select: { id: true, placa: true, marca: true, modelo: true },
      orderBy: { placa: "asc" },
    }),
  ]);

  const conductoresSerializados = conductores.map((c) => ({
    id: c.id,
    nombreCompleto: c.nombreCompleto,
    dni: c.dni,
    telefono: c.telefono,
    email: c.email,
    licenciaCategoria: c.licenciaCategoria as string,
    licenciaNumero: c.licenciaNumero,
    licenciaVencimiento: c.licenciaVencimiento
      ? c.licenciaVencimiento.toISOString().split("T")[0]
      : null,
    activo: c.activo,
    sucursalId: c.sucursalId,
    sucursalNombre: c.sucursal?.nombre ?? null,
    vehiculoId: c.vehiculoId,
    vehiculoPlaca: c.vehiculo?.placa ?? null,
    vehiculoDesc: c.vehiculo ? `${c.vehiculo.marca} ${c.vehiculo.modelo}` : null,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Conductores</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Gestión de conductores de la flota
        </p>
      </div>
      <ConductoresPanel
        conductores={conductoresSerializados}
        sucursales={sucursales}
        vehiculosDisponibles={vehiculosDisponibles}
        esAdmin={profile.rol === "admin"}
        puedeEditar={!esVisor}
        sucursalDefaultId={profile.sucursalId ?? null}
      />
    </div>
  );
}
