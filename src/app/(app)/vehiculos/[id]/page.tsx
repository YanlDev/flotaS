import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { getSignedDownloadUrl } from "@/lib/wasabi";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EstadoVehiculo } from "@/generated/prisma/client";
import { EliminarVehiculoButton } from "./_components/eliminar-vehiculo-button";
import { FotosPanel } from "./_components/fotos-panel";
import {
  FileText, Gauge, Fuel, Users, MapPin, Wifi, WifiOff, Phone,
  User, AlertTriangle, ChevronRight, Wrench, ShieldCheck, Pencil, Building2,
} from "lucide-react";

// ─── Mapas de UI ─────────────────────────────────────────────────

const ESTADO_CONFIG: Record<EstadoVehiculo, { label: string; badge: string; dot: string; bar: string }> = {
  operativo:         { label: "Operativo",        badge: "bg-emerald-100 text-emerald-700 border-0", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  parcialmente:      { label: "Parcial",           badge: "bg-amber-100 text-amber-700 border-0",    dot: "bg-amber-500",   bar: "bg-amber-500"   },
  fuera_de_servicio: { label: "Fuera de servicio", badge: "bg-red-100 text-red-700 border-0",        dot: "bg-red-500",     bar: "bg-red-500"     },
};

const TIPO_LABEL: Record<string, string> = {
  moto: "Moto", auto: "Auto", camioneta: "Camioneta",
  minivan: "Minivan", furgon: "Furgón", bus: "Bus", vehiculo_pesado: "Vehículo Pesado",
};

const COMBUSTIBLE_LABEL: Record<string, string> = {
  gasolina: "Gasolina", diesel: "Diesel", glp: "GLP",
  gnv: "GNV", electrico: "Eléctrico", hibrido: "Híbrido",
};

const TIPO_DOC_LABEL: Record<string, string> = {
  soat: "SOAT", revision_tecnica: "Rev. Técnica",
  tarjeta_propiedad: "Tarj. Propiedad", otro: "Documento",
};

// ─── Page ────────────────────────────────────────────────────────

export default async function VehiculoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const { id } = await params;

  const [vehiculo, documentos, fotosRaw, mantenimientos] = await Promise.all([
    prisma.vehiculo.findUnique({
      where: { id },
      include: {
        sucursal: { select: { nombre: true, ciudad: true } },
        creador:  { select: { nombreCompleto: true } },
      },
    }),
    prisma.documentoVehicular.findMany({
      where: { vehiculoId: id },
      select: { id: true, tipo: true, nombre: true, vencimiento: true },
      orderBy: { vencimiento: "asc" },
    }),
    prisma.fotoVehiculo.findMany({
      where: { vehiculoId: id },
      orderBy: { createdAt: "asc" },
      select: { id: true, key: true, categoria: true, descripcion: true, createdAt: true },
    }),
    prisma.mantenimiento.findMany({
      where: { vehiculoId: id },
      select: { categoria: true, proximoKm: true, proximaFecha: true },
    }),
  ]);

  if (!vehiculo) notFound();

  if (profile.rol === "jefe_sucursal" && vehiculo.sucursalId !== profile.sucursalId) {
    redirect("/vehiculos");
  }

  const puedeEditar     = profile.rol === "admin";
  const puedeEliminar   = profile.rol === "admin";
  const puedeSubirFotos =
    profile.rol === "admin" ||
    (profile.rol === "jefe_sucursal" && vehiculo.sucursalId === profile.sucursalId);

  const fotos = await Promise.all(
    fotosRaw.map(async (f) => ({
      ...f,
      url: await getSignedDownloadUrl(f.key, 3600),
      createdAt: f.createdAt.toISOString(),
    }))
  );

  const cfg = ESTADO_CONFIG[vehiculo.estado];

  // Alertas de documentos (vencidos o < 30 días)
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const docsAlerta = documentos.filter((d) => {
    if (!d.vencimiento) return false;
    const diff = Math.ceil((d.vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    return diff <= 30;
  });

  const CATEGORIA_LABEL: Record<string, string> = {
    aceite_filtros: "Aceite + Filtros", llantas: "Llantas", frenos: "Frenos",
    liquidos: "Líquidos", bateria: "Batería", alineacion_balanceo: "Alineación",
    suspension: "Suspensión", transmision: "Transmisión", electricidad: "Eléctrico",
    revision_general: "Revisión general", otro: "Otro",
  };

  type AlertaMant = { categoria: string; tipo: "vencido" | "proximo"; detalle: string };
  const alertasMant: AlertaMant[] = [];
  for (const m of mantenimientos) {
    const label = CATEGORIA_LABEL[m.categoria] ?? m.categoria;
    if (m.proximoKm && vehiculo.kmActuales != null) {
      const diff = m.proximoKm - vehiculo.kmActuales;
      if (diff <= 0) alertasMant.push({ categoria: m.categoria, tipo: "vencido", detalle: `${label}: vencido por km (${m.proximoKm.toLocaleString("es-PE")} km)` });
      else if (diff <= 1000) alertasMant.push({ categoria: m.categoria, tipo: "proximo", detalle: `${label}: faltan ${diff.toLocaleString("es-PE")} km` });
    }
    if (m.proximaFecha) {
      const diffDias = Math.ceil((m.proximaFecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDias <= 0) alertasMant.push({ categoria: m.categoria, tipo: "vencido", detalle: `${label}: fecha de servicio vencida` });
      else if (diffDias <= 30) alertasMant.push({ categoria: m.categoria, tipo: "proximo", detalle: `${label}: en ${diffDias} días` });
    }
  }
  const mantVencidos = alertasMant.filter((a) => a.tipo === "vencido");
  const mantProximos = alertasMant.filter((a) => a.tipo === "proximo");

  return (
    <div className="space-y-5">

        {/* ── BARRA SUPERIOR ────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/vehiculos">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2">
                <ChevronRight size={14} className="rotate-180" />
                Volver
              </Button>
            </Link>
            <div className="h-5 w-px bg-border" />
            <div>
              <h1 className="font-bold text-xl font-mono tracking-wider leading-none">{vehiculo.placa}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {TIPO_LABEL[vehiculo.tipo]} · {vehiculo.marca} {vehiculo.modelo} {vehiculo.anio}
              </p>
              {(vehiculo.propietario || vehiculo.rucPropietario) && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Building2 size={12} className="text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium text-foreground">{vehiculo.propietario ?? "—"}</span>
                  {vehiculo.rucPropietario && (
                    <span className="text-xs text-muted-foreground font-mono">· RUC {vehiculo.rucPropietario}</span>
                  )}
                </div>
              )}
            </div>
            <Badge className={`${cfg.badge} text-xs`}>{cfg.label}</Badge>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {puedeEditar && (
              <Link href={`/vehiculos/${id}/editar`}>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Pencil size={13} />
                  Editar
                </Button>
              </Link>
            )}
            {puedeEliminar && (
              <EliminarVehiculoButton vehiculoId={id} placa={vehiculo.placa} />
            )}
          </div>
        </div>

        {/* ── ALERTA PROBLEMA ACTIVO ─────────────────────────── */}
        {vehiculo.problemaActivo && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-medium">{vehiculo.problemaActivo}</p>
          </div>
        )}

        {/* ── ALERTA DOCUMENTOS ────────────────────────────────── */}
        {docsAlerta.length > 0 && (
          <Link href={`/vehiculos/${id}/documentos`}>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3 hover:bg-amber-100 transition-colors cursor-pointer">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800">
                  {docsAlerta.length === 1 ? "1 documento próximo a vencer" : `${docsAlerta.length} documentos próximos a vencer`}
                </p>
                <p className="text-xs text-amber-700 truncate">
                  {docsAlerta.map((d) => TIPO_DOC_LABEL[d.tipo] ?? d.tipo).join(" · ")}
                </p>
              </div>
              <ChevronRight size={14} className="text-amber-600 shrink-0" />
            </div>
          </Link>
        )}

        {/* ── ALERTA MANTENIMIENTO ─────────────────────────────── */}
        {mantVencidos.length > 0 && (
          <Link href={`/vehiculos/${id}/mantenimientos`}>
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3 hover:bg-red-100 transition-colors cursor-pointer">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-800">
                  {mantVencidos.length === 1 ? "1 mantenimiento vencido" : `${mantVencidos.length} mantenimientos vencidos`}
                </p>
                <p className="text-xs text-red-700 truncate">{mantVencidos.map((a) => a.detalle).join(" · ")}</p>
              </div>
              <ChevronRight size={14} className="text-red-500 shrink-0 mt-0.5" />
            </div>
          </Link>
        )}
        {mantVencidos.length === 0 && mantProximos.length > 0 && (
          <Link href={`/vehiculos/${id}/mantenimientos`}>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3 hover:bg-amber-100 transition-colors cursor-pointer">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800">
                  {mantProximos.length === 1 ? "1 mantenimiento próximo" : `${mantProximos.length} mantenimientos próximos`}
                </p>
                <p className="text-xs text-amber-700 truncate">{mantProximos.map((a) => a.detalle).join(" · ")}</p>
              </div>
              <ChevronRight size={14} className="text-amber-600 shrink-0 mt-0.5" />
            </div>
          </Link>
        )}

        {/* ── GALERÍA FOTOGRÁFICA ───────────────────────────────── */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          {/* Barra de estado */}
          <div className={`h-1 w-full ${cfg.bar}`} />

          <div className="p-4 md:p-5">
            <FotosPanel
              vehiculoId={id}
              fotosIniciales={fotos}
              puedeSubir={puedeSubirFotos}
            />
          </div>
        </div>

        {/* ── ACCESOS RÁPIDOS ─────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickLink
            href={`/vehiculos/${id}/documentos`}
            icon={<FileText size={18} />}
            label="Documentos"
            badge={docsAlerta.length > 0 ? String(docsAlerta.length) : undefined}
            badgeClass="bg-red-500"
          />
          <QuickLink
            href={`/vehiculos/${id}/combustible`}
            icon={<Fuel size={18} />}
            label="Combustible"
          />
          <QuickLink
            href={`/vehiculos/${id}/mantenimientos`}
            icon={<Wrench size={18} />}
            label="Mantenimientos"
          />
          <div className="rounded-xl border bg-card p-3 flex flex-col items-center gap-2 text-center">
            <div className={`p-2 rounded-lg ${vehiculo.gps ? "bg-emerald-100" : "bg-muted"}`}>
              {vehiculo.gps
                ? <Wifi size={18} className="text-emerald-600" />
                : <WifiOff size={18} className="text-muted-foreground" />}
            </div>
            <p className={`text-xs font-medium ${vehiculo.gps ? "text-emerald-700" : "text-muted-foreground"}`}>
              {vehiculo.gps ? "GPS Activo" : "Sin GPS"}
            </p>
          </div>
        </div>

        {/* ── STATS ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Gauge size={16} className="text-blue-500" />}
            label="KM actuales"
            value={vehiculo.kmActuales != null ? vehiculo.kmActuales.toLocaleString("es-PE") + " km" : "—"}
          />
          <StatCard
            icon={<Fuel size={16} className="text-orange-500" />}
            label="Combustible"
            value={vehiculo.combustible ? (COMBUSTIBLE_LABEL[vehiculo.combustible] ?? vehiculo.combustible) : "—"}
          />
          <StatCard
            icon={<Users size={16} className="text-violet-500" />}
            label="Asientos"
            value={vehiculo.numAsientos?.toString() ?? "—"}
          />
          <StatCard
            icon={<MapPin size={16} className="text-emerald-500" />}
            label="Sucursal"
            value={vehiculo.sucursal.nombre}
          />
        </div>

        {/* ── INFORMACIÓN TÉCNICA ─────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoCard title="Tarjeta de Propiedad — SUNARP" icon={<ShieldCheck size={15} className="text-blue-600" />}>
            <InfoRow label="Número de motor"  value={vehiculo.numeroMotor} />
            <InfoRow label="Número de chasis" value={vehiculo.numeroChasis} />
            <InfoRow label="Propietario"      value={vehiculo.propietario} />
            <InfoRow label="RUC Propietario"  value={vehiculo.rucPropietario} mono />
          </InfoCard>

          <InfoCard title="Datos técnicos" icon={<Wrench size={15} className="text-violet-600" />}>
            <InfoRow label="Motor"       value={vehiculo.motor} />
            <InfoRow label="Transmisión" value={vehiculo.transmision} />
            <InfoRow label="Tracción"    value={vehiculo.traccion} />
            <InfoRow label="Cap. carga"  value={vehiculo.capacidadCargaKg ? `${vehiculo.capacidadCargaKg.toLocaleString("es-PE")} kg` : null} />
          </InfoCard>

          {(vehiculo.conductorNombre || vehiculo.conductorTel) && (
            <InfoCard title="Conductor asignado" icon={<User size={15} className="text-slate-500" />}>
              <InfoRow label="Nombre"   value={vehiculo.conductorNombre} icon={<User size={12} />} />
              <InfoRow label="Teléfono" value={vehiculo.conductorTel}    icon={<Phone size={12} />} />
            </InfoCard>
          )}

          <InfoCard title="Operación" icon={<MapPin size={15} className="text-emerald-600" />}>
            <InfoRow label="Zona"           value={vehiculo.zonaOperacion} />
            <InfoRow label="Ciudad"         value={`${vehiculo.sucursal.nombre} — ${vehiculo.sucursal.ciudad}`} />
            <InfoRow label="Adquisición"    value={vehiculo.fechaAdquisicion ? new Date(vehiculo.fechaAdquisicion).toLocaleDateString("es-PE") : null} />
            <InfoRow label="Registrado por" value={vehiculo.creador?.nombreCompleto} />
          </InfoCard>
        </div>

        {/* ── OBSERVACIONES ─────────────────────────────────── */}
        {vehiculo.observaciones && (
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observaciones</p>
            <Separator />
            <p className="text-sm text-muted-foreground leading-relaxed">{vehiculo.observaciones}</p>
          </div>
        )}
    </div>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────────

function QuickLink({
  href, icon, label, badge, badgeClass,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  badgeClass?: string;
}) {
  return (
    <Link href={href}>
      <div className="rounded-xl border bg-card p-3 flex flex-col items-center gap-2 text-center hover:bg-muted/50 hover:shadow-sm transition-all cursor-pointer relative group">
        <div className="p-2 rounded-lg bg-muted group-hover:bg-background transition-colors">
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <p className="text-xs font-medium">{label}</p>
        {badge && (
          <span className={`absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full ${badgeClass} text-white text-[10px] flex items-center justify-center font-bold shadow`}>
            {badge}
          </span>
        )}
      </div>
    </Link>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3.5 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-muted shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="font-semibold text-sm truncate">{value}</p>
      </div>
    </div>
  );
}

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
