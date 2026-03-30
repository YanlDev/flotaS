import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { EditarConductorForm } from "./_components/editar-conductor-form";

export default async function EditarConductorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getProfile();
  if (!profile || profile.rol !== "admin") redirect("/vehiculos"); // solo admin

  const { id } = await params;

  const [conductor, sucursales, vehiculosDisponibles] = await Promise.all([
    prisma.conductor.findUnique({
      where: { id },
      include: {
        vehiculo: { select: { id: true, placa: true } }
      }
    }),
    prisma.sucursal.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } }),
    prisma.vehiculo.findMany({
      // Buscar vehículos sin conductor o el vehículo actual asignado a este conductor
      where: { 
        estado: { in: ["operativo", "parcialmente"] }, 
        OR: [{ conductor: null }, { conductor: { id } }]
      },
      orderBy: { placa: "asc" },
      select: { id: true, placa: true, marca: true, modelo: true },
    })
  ]);

  if (!conductor) notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* ── BARRA SUPERIOR ──────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link href={`/conductores/${id}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2">
            <ChevronRight size={14} className="rotate-180" />
            Volver
          </Button>
        </Link>
        <div className="h-5 w-px bg-border" />
        <h1 className="font-bold text-xl">Editar Conductor</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Actualiza los datos personales y asignaciones del conductor.
      </p>

      {/* ── FORMULARIO PRINCIPAL ───────────────────────── */}
      <EditarConductorForm 
        conductor={conductor} 
        sucursales={sucursales} 
        vehiculosDisponibles={vehiculosDisponibles} 
      />

    </div>
  );
}
