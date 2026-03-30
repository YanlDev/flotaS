import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EliminarConductorButton } from "../_components/eliminar-conductor-button";
import {
  Car, MapPin, ShieldAlert, Fuel, FileText,
  User, CheckCircle2, ChevronRight, Pencil, Phone, Mail, IdCard, CalendarX2,
} from "lucide-react";

export default async function ConductorDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const { id } = await params;

  const [conductor, resumenCombustible] = await Promise.all([
    prisma.conductor.findUnique({
      where: { id },
      include: {
        sucursal: { select: { nombre: true, ciudad: true } },
        vehiculo: { select: { id: true, placa: true, marca: true, modelo: true } },
        creador:  { select: { nombreCompleto: true } },
      },
    }),
    prisma.cargaCombustible.aggregate({
      where: { conductorId: id },
      _sum:   { totalSoles: true, galones: true },
      _count: { id: true },
      _max:   { fecha: true },
    }),
  ]);

  if (!conductor) notFound();

  // Jefe solo puede ver su sucursal
  if (profile.rol === "jefe_sucursal" && conductor.sucursalId !== profile.sucursalId) {
    redirect("/conductores");
  }

  const puedeEditar  = profile.rol === "admin";
  const puedeEliminar = profile.rol === "admin";

  // Alerta de licencia vencida
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const isLicenciaVencida =
    conductor.licenciaVencimiento &&
    Math.ceil((conductor.licenciaVencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)) <= 0;

  // Datos de combustible
  const totalSoles   = Number(resumenCombustible._sum.totalSoles  ?? 0);
  const totalGalones = Number(resumenCombustible._sum.galones     ?? 0);
  const totalCargas  = resumenCombustible._count.id;
  const ultimaCarga  = resumenCombustible._max.fecha;

  return (
    <div className="space-y-5">

      {/* ── BARRA SUPERIOR ────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/conductores">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2">
              <ChevronRight size={14} className="rotate-180" />
              Volver
            </Button>
          </Link>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <User size={20} />
            </div>
            <div>
              <h1 className="font-bold text-xl leading-none">{conductor.nombreCompleto}</h1>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                DNI: {conductor.dni}
              </p>
            </div>
          </div>
          <Badge variant={conductor.activo ? "default" : "destructive"} className="text-xs ml-2">
            {conductor.activo ? "Activo" : "Inactivo"}
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {puedeEditar && (
            <Link href={`/conductores/${id}/editar`}>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Pencil size={13} />
                Editar
              </Button>
            </Link>
          )}
          {puedeEliminar && (
            <EliminarConductorButton conductorId={id} nombre={conductor.nombreCompleto} />
          )}
        </div>
      </div>

      {/* ── ALERTA LICENCIA VENCIDA ─────────────────────────── */}
      {isLicenciaVencida && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2.5">
          <ShieldAlert size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">
            Licencia de conducir vencida ({conductor.licenciaVencimiento?.toLocaleDateString("es-PE")})
          </p>
        </div>
      )}

      {/* ── ACCESOS RÁPIDOS ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* Vehículo asignado */}
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${
          conductor.vehiculo
            ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-700"
            : "bg-card"
        }`}>
          <div className={`p-2.5 rounded-lg ${conductor.vehiculo ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-muted"}`}>
            <Car size={18} className={conductor.vehiculo ? "text-emerald-600" : "text-muted-foreground opacity-50"} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Vehículo asignado</p>
            <p className={`text-sm font-semibold truncate ${
              conductor.vehiculo ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
            }`}>
              {conductor.vehiculo
                ? `${conductor.vehiculo.placa} — ${conductor.vehiculo.marca} ${conductor.vehiculo.modelo}`
                : "Sin vehículo"}
            </p>
          </div>
        </div>

        {/* Documentos */}
        <Link href={`/conductores/${id}/documentos`}>
          <div className="rounded-xl border bg-card p-4 flex items-center gap-3 hover:bg-muted/50 hover:border-primary/30 transition-colors cursor-pointer">
            <div className="p-2.5 rounded-lg bg-muted">
              <FileText size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Documentos</p>
              <p className="text-sm font-semibold">Ver documentos</p>
            </div>
          </div>
        </Link>

        {/* Combustible */}
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10">
            <Fuel size={18} className="text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Cargas registradas</p>
            {totalCargas > 0 ? (
              <p className="text-sm font-semibold">
                {totalCargas} carga{totalCargas !== 1 ? "s" : ""} ·{" "}
                <span className="text-muted-foreground font-normal">
                  S/. {totalSoles.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Sin cargas registradas</p>
            )}
          </div>
        </div>

      </div>

      {/* ── RESUMEN COMBUSTIBLE (solo si tiene cargas) ──────── */}
      {totalCargas > 0 && (
        <div className="rounded-xl border bg-card shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Fuel size={15} className="text-amber-500" />
            <h2 className="text-sm font-semibold">Resumen de combustible</h2>
            {conductor.vehiculo && (
              <Link
                href={`/vehiculos/${conductor.vehiculo.id}/combustible`}
                className="ml-auto text-xs text-primary hover:underline"
              >
                Ver historial completo →
              </Link>
            )}
          </div>
          <Separator className="mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <ResumenItem
              label="Total gastado"
              value={`S/. ${totalSoles.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <ResumenItem
              label="Total galones"
              value={`${totalGalones.toLocaleString("es-PE", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} gal`}
            />
            <ResumenItem
              label="Cargas realizadas"
              value={`${totalCargas}`}
            />
            <ResumenItem
              label="Última carga"
              value={ultimaCarga
                ? new Date(ultimaCarga).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })
                : "—"}
            />
          </div>
        </div>
      )}

      {/* ── INFORMACIÓN DEL CONDUCTOR ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard title="Datos Personales" icon={<IdCard size={15} className="text-blue-600" />}>
          <InfoRow label="Nombre Completo" value={conductor.nombreCompleto} />
          <InfoRow label="DNI"             value={conductor.dni} mono />
          <InfoRow label="Teléfono"        value={conductor.telefono} icon={<Phone size={12} />} />
          <InfoRow label="Email"           value={conductor.email} icon={<Mail size={12} />} />
        </InfoCard>

        <InfoCard title="Licencia de Conducir" icon={<CheckCircle2 size={15} className="text-violet-600" />}>
          <InfoRow label="Categoría" value={conductor.licenciaCategoria} mono />
          <InfoRow label="Número"    value={conductor.licenciaNumero} mono />
          <InfoRow
            label="Vencimiento"
            value={conductor.licenciaVencimiento
              ? new Date(conductor.licenciaVencimiento).toLocaleDateString("es-PE")
              : null}
            icon={<CalendarX2 size={12} className={isLicenciaVencida ? "text-red-500" : ""} />}
          />
        </InfoCard>

        <InfoCard title="Operación y Asignación" icon={<MapPin size={15} className="text-emerald-600" />}>
          <InfoRow label="Vehículo / Placa" value={conductor.vehiculo ? conductor.vehiculo.placa : "Ninguno"} mono={!!conductor.vehiculo} />
          <InfoRow label="Marca / Modelo"   value={conductor.vehiculo ? `${conductor.vehiculo.marca} ${conductor.vehiculo.modelo}` : null} />
          <InfoRow label="Sucursal"         value={conductor.sucursal?.nombre} />
          <InfoRow label="Registrado por"   value={conductor.creador?.nombreCompleto} />
        </InfoCard>
      </div>

    </div>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────────

function InfoCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <Separator />
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono, icon }: { label: string; value?: string | null; mono?: boolean; icon?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground text-xs shrink-0 flex items-center gap-1">{icon}{label}</span>
      <span className={`font-medium text-right truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function ResumenItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}
