import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EstadoVehiculo } from "@/generated/prisma/client";
import {
  Truck,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileWarning,
  Building2,
  ArrowRight,
  Wrench,
} from "lucide-react";

// ─── helpers ─────────────────────────────────────────────────────

function diasHasta(fecha: Date): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function DashboardPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.rol === "comercial") redirect("/proveedores");

  const sucursalFiltro =
    profile.rol === "jefe_sucursal" ? profile.sucursalId ?? undefined : undefined;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const en30Dias = new Date(hoy);
  en30Dias.setDate(en30Dias.getDate() + 30);

  const [
    totalVehiculos,
    porEstado,
    sucursales,
    docsPorVencer,
    ultimosVehiculos,
    mantenimientosRaw,
  ] = await Promise.all([
    // Total vehículos
    prisma.vehiculo.count({
      where: { ...(sucursalFiltro && { sucursalId: sucursalFiltro }) },
    }),
    // Por estado
    prisma.vehiculo.groupBy({
      by: ["estado"],
      _count: { estado: true },
      where: { ...(sucursalFiltro && { sucursalId: sucursalFiltro }) },
    }),
    // Sucursales (solo admin)
    profile.rol === "admin"
      ? prisma.sucursal.findMany({
          where: { activa: true },
          include: {
            _count: { select: { vehiculos: true } },
          },
          orderBy: { nombre: "asc" },
        })
      : Promise.resolve([]),
    // Documentos por vencer (próximos 30 días)
    prisma.documentoVehicular.findMany({
      where: {
        vencimiento: { gte: hoy, lte: en30Dias },
        vehiculo: { ...(sucursalFiltro && { sucursalId: sucursalFiltro }) },
      },
      include: {
        vehiculo: { select: { placa: true, id: true } },
      },
      orderBy: { vencimiento: "asc" },
      take: 8,
    }),
    // Últimos 5 vehículos registrados
    prisma.vehiculo.findMany({
      where: { ...(sucursalFiltro && { sucursalId: sucursalFiltro }) },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { sucursal: { select: { nombre: true } } },
    }),
    // Mantenimientos con próximo programado
    prisma.mantenimiento.findMany({
      where: {
        vehiculo: {
          deletedAt: null,
          ...(sucursalFiltro && { sucursalId: sucursalFiltro }),
        },
        OR: [
          { proximoKm: { not: null } },
          { proximaFecha: { not: null } },
        ],
      },
      select: {
        categoria: true,
        proximoKm: true,
        proximaFecha: true,
        vehiculo: { select: { id: true, placa: true, kmActuales: true, sucursal: { select: { nombre: true } } } },
      },
    }),
  ]);

  const conteos: Record<EstadoVehiculo, number> = {
    operativo: 0,
    parcialmente: 0,
    fuera_de_servicio: 0,
  };
  for (const g of porEstado) conteos[g.estado] = g._count.estado;

  const CATEGORIA_LABEL: Record<string, string> = {
    aceite_filtros: "Aceite + Filtros", llantas: "Llantas", frenos: "Frenos",
    liquidos: "Líquidos", bateria: "Batería", alineacion_balanceo: "Alineación",
    suspension: "Suspensión", transmision: "Transmisión", electricidad: "Eléctrico",
    revision_general: "Revisión general", otro: "Otro",
  };

  type AlertaMant = {
    vehiculoId: string; placa: string; sucursal: string;
    categoria: string; tipo: "vencido" | "proximo"; detalle: string;
    diffKm?: number;
  };

  const alertasMantMap = new Map<string, AlertaMant>();
  for (const m of mantenimientosRaw) {
    const v = m.vehiculo;
    const label = CATEGORIA_LABEL[m.categoria] ?? m.categoria;
    const key = `${v.id}-${m.categoria}`;

    if (m.proximoKm && v.kmActuales != null) {
      const diff = m.proximoKm - v.kmActuales;
      if (diff <= 0) {
        alertasMantMap.set(key, { vehiculoId: v.id, placa: v.placa, sucursal: v.sucursal.nombre, categoria: m.categoria, tipo: "vencido", detalle: `${label} vencido por km` });
        continue;
      }
      if (diff <= 1000) {
        if (!alertasMantMap.has(key))
          alertasMantMap.set(key, { vehiculoId: v.id, placa: v.placa, sucursal: v.sucursal.nombre, categoria: m.categoria, tipo: "proximo", detalle: `${label}: faltan ${diff.toLocaleString("es-PE")} km`, diffKm: diff });
      }
    }
    if (m.proximaFecha) {
      const diffDias = Math.ceil((m.proximaFecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDias <= 0) {
        alertasMantMap.set(key, { vehiculoId: v.id, placa: v.placa, sucursal: v.sucursal.nombre, categoria: m.categoria, tipo: "vencido", detalle: `${label} vencido por fecha` });
      } else if (diffDias <= 30 && !alertasMantMap.has(key)) {
        alertasMantMap.set(key, { vehiculoId: v.id, placa: v.placa, sucursal: v.sucursal.nombre, categoria: m.categoria, tipo: "proximo", detalle: `${label}: en ${diffDias} días` });
      }
    }
  }

  const alertasMant = Array.from(alertasMantMap.values())
    .sort((a, b) => (a.tipo === "vencido" ? -1 : 1) - (b.tipo === "vencido" ? -1 : 1));

  const TIPO_DOC: Record<string, string> = {
    soat: "SOAT", revision_tecnica: "Rev. Técnica",
    tarjeta_propiedad: "Tarj. Propiedad", otro: "Documento",
  };

  const ESTADO_BADGE: Record<EstadoVehiculo, { label: string; class: string }> = {
    operativo:         { label: "Operativo",  class: "bg-emerald-100 text-emerald-700 border-0" },
    parcialmente:      { label: "Parcial",    class: "bg-amber-100 text-amber-700 border-0" },
    fuera_de_servicio: { label: "F. servicio", class: "bg-red-100 text-red-700 border-0" },
  };

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Bienvenido, <span className="font-medium text-foreground">{profile.nombreCompleto}</span>
          {profile.sucursal && ` · ${profile.sucursal.nombre}`}
        </p>
      </div>

      {/* ── KPI Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total flota"
          value={totalVehiculos}
          icon={<Truck size={20} />}
          iconClass="text-primary bg-primary/10"
        />
        <KpiCard
          label="Operativos"
          value={conteos.operativo}
          icon={<CheckCircle2 size={20} />}
          iconClass="text-emerald-600 bg-emerald-100"
          valueClass="text-emerald-600"
        />
        <KpiCard
          label="Parciales"
          value={conteos.parcialmente}
          icon={<AlertCircle size={20} />}
          iconClass="text-amber-600 bg-amber-100"
          valueClass="text-amber-600"
        />
        <KpiCard
          label="Fuera servicio"
          value={conteos.fuera_de_servicio}
          icon={<XCircle size={20} />}
          iconClass="text-red-600 bg-red-100"
          valueClass="text-red-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Documentos por vencer ───────────────────────── */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileWarning size={16} className="text-amber-500" />
              <h2 className="font-semibold text-sm">Documentos próximos a vencer</h2>
            </div>
            <span className="text-xs text-muted-foreground">próximos 30 días</span>
          </div>

          {docsPorVencer.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500/50" />
              Sin documentos próximos a vencer
            </div>
          ) : (
            <ul className="divide-y">
              {docsPorVencer.map((doc) => {
                const dias = doc.vencimiento ? diasHasta(doc.vencimiento) : null;
                const isVencido = dias !== null && dias < 0;
                const isUrgente = dias !== null && dias <= 7;
                return (
                  <li key={doc.id}>
                    <Link
                      href={`/vehiculos/${doc.vehiculo.id}/documentos`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className={`h-2 w-2 rounded-full shrink-0 ${isVencido ? "bg-red-500" : isUrgente ? "bg-amber-500" : "bg-yellow-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {TIPO_DOC[doc.tipo] ?? doc.tipo} — <span className="font-mono">{doc.vehiculo.placa}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{doc.nombre}</p>
                      </div>
                      <span className={`text-xs font-medium shrink-0 ${isVencido ? "text-red-600" : isUrgente ? "text-amber-600" : "text-muted-foreground"}`}>
                        {dias === null ? "—" : isVencido ? `Vencido` : dias === 0 ? "Hoy" : `${dias}d`}
                      </span>
                      <ArrowRight size={13} className="text-muted-foreground shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Mantenimientos urgentes ─────────────────────── */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench size={16} className="text-violet-500" />
              <h2 className="font-semibold text-sm">Mantenimientos urgentes</h2>
            </div>
            <span className="text-xs text-muted-foreground">≤1,000 km o 30 días</span>
          </div>

          {alertasMant.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500/50" />
              Todos los servicios al día
            </div>
          ) : (
            <ul className="divide-y">
              {alertasMant.slice(0, 8).map((a, i) => {
                const esCritico = a.tipo === "vencido" || (a.tipo === "proximo" && a.diffKm !== undefined && a.diffKm <= 100);
                return (
                  <li key={i}>
                    <Link
                      href={`/vehiculos/${a.vehiculoId}/mantenimientos`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className={`h-2 w-2 rounded-full shrink-0 ${esCritico ? "bg-red-500" : "bg-amber-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium sm:truncate">
                          <span className="font-mono">{a.placa}</span> — {a.detalle}
                        </p>
                        <p className="text-xs text-muted-foreground">{a.sucursal}</p>
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ${esCritico ? "text-red-600" : "text-amber-600"}`}>
                        {a.tipo === "vencido" ? "Vencido" : "Próximo"}
                      </span>
                      <ArrowRight size={13} className="text-muted-foreground shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Últimos vehículos ────────────────────────────── */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-primary" />
              <h2 className="font-semibold text-sm">Últimos registros</h2>
            </div>
            <Link href="/vehiculos" className="text-xs text-primary hover:underline">
              Ver todos
            </Link>
          </div>
          <ul className="divide-y">
            {ultimosVehiculos.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/vehiculos/${v.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <span className="font-mono font-bold text-sm text-primary w-20 shrink-0">{v.placa}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{v.marca} {v.modelo} <span className="text-muted-foreground text-xs">{v.anio}</span></p>
                    <p className="text-xs text-muted-foreground">{v.sucursal.nombre}</p>
                  </div>
                  <Badge className={ESTADO_BADGE[v.estado].class}>
                    {ESTADO_BADGE[v.estado].label}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Sucursales (solo admin) ───────────────────────── */}
      {profile.rol === "admin" && sucursales.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Building2 size={16} className="text-muted-foreground" />
            <h2 className="font-semibold text-sm">Flota por sucursal</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 divide-x divide-y sm:divide-y-0">
            {sucursales.map((s) => {
              const pct = totalVehiculos > 0
                ? Math.round((s._count.vehiculos / totalVehiculos) * 100)
                : 0;
              return (
                <div key={s.id} className="p-4 text-center space-y-1">
                  <p className="text-2xl font-bold">{s._count.vehiculos}</p>
                  <p className="text-xs font-medium truncate">{s.nombre}</p>
                  <p className="text-[11px] text-muted-foreground">{pct}% del total</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente KPI ───────────────────────────────────────────────

function KpiCard({
  label, value, icon, iconClass, valueClass = "text-foreground",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconClass: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${iconClass}`}>
        {icon}
      </div>
      <div>
        <p className={`text-2xl font-bold leading-none ${valueClass}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}
