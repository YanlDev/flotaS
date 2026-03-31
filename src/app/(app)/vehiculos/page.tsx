import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { getSignedDownloadUrl } from "@/lib/wasabi";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EstadoVehiculo } from "@/generated/prisma/client";
import { Car, MapPin, Gauge, SlidersHorizontal, ImageOff } from "lucide-react";
import { RegistroVehiculoModal } from "./_components/registro-vehiculo-modal";

// ─── UI maps ─────────────────────────────────────────────────────

const ESTADO: Record<EstadoVehiculo, { label: string; badge: string; bar: string }> = {
  operativo:         { label: "Operativo",        badge: "bg-emerald-100 text-emerald-700 border-0", bar: "bg-emerald-500" },
  parcialmente:      { label: "Parcial",           badge: "bg-amber-100 text-amber-700 border-0",    bar: "bg-amber-500"   },
  fuera_de_servicio: { label: "Fuera de servicio", badge: "bg-red-100 text-red-700 border-0",        bar: "bg-red-500"     },
};

const TIPO_LABEL: Record<string, string> = {
  moto: "Moto", auto: "Auto", camioneta: "Camioneta",
  minivan: "Minivan", furgon: "Furgón", bus: "Bus", vehiculo_pesado: "Vehículo Pesado",
};

// ─── Page ─────────────────────────────────────────────────────────

export default async function VehiculosPage({
  searchParams,
}: {
  searchParams: Promise<{ sucursalId?: string; estado?: string; q?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const { sucursalId, estado, q } = await searchParams;

  const sucursalFiltro =
    profile.rol === "jefe_sucursal" ? (profile.sucursalId ?? undefined) : (sucursalId ?? undefined);

  const [vehiculosRaw, sucursales, conductoresDisponibles] = await Promise.all([
    prisma.vehiculo.findMany({
      where: {
        ...(sucursalFiltro && { sucursalId: sucursalFiltro }),
        ...(estado && { estado: estado as EstadoVehiculo }),
        ...(q && {
          OR: [
            { placa:          { contains: q, mode: "insensitive" } },
            { marca:          { contains: q, mode: "insensitive" } },
            { modelo:         { contains: q, mode: "insensitive" } },
            { conductorNombre:{ contains: q, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        sucursal: { select: { nombre: true } },
        fotos: {
          where: { categoria: "frontal" },
          select: { key: true },
          take: 1,
        },
      },
    }),
    profile.rol === "admin"
      ? prisma.sucursal.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } })
      : Promise.resolve([]),
    profile.rol === "admin"
      ? prisma.conductor.findMany({
          where: { activo: true, vehiculoId: null },
          orderBy: { nombreCompleto: "asc" },
          select: { id: true, nombreCompleto: true, licenciaCategoria: true },
        })
      : Promise.resolve([]),
  ]);

  // Alertas de mantenimiento por vehículo
  const idsVehiculos = vehiculosRaw.map((v) => v.id);
  const mantenimientosAlerta = idsVehiculos.length > 0
    ? await prisma.mantenimiento.findMany({
        where: {
          vehiculoId: { in: idsVehiculos },
          OR: [{ proximoKm: { not: null } }, { proximaFecha: { not: null } }],
        },
        select: { vehiculoId: true, proximoKm: true, proximaFecha: true },
      })
    : [];

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const alertaPorVehiculo = new Map<string, "vencido" | "proximo">();
  for (const m of mantenimientosAlerta) {
    const v = vehiculosRaw.find((x) => x.id === m.vehiculoId);
    if (!v) continue;
    if (m.proximoKm && v.kmActuales != null) {
      const diff = m.proximoKm - v.kmActuales;
      if (diff <= 0) { alertaPorVehiculo.set(v.id, "vencido"); continue; }
      if (diff <= 1000 && alertaPorVehiculo.get(v.id) !== "vencido") alertaPorVehiculo.set(v.id, "proximo");
    }
    if (m.proximaFecha) {
      const diffDias = Math.ceil((m.proximaFecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDias <= 0) { alertaPorVehiculo.set(v.id, "vencido"); continue; }
      if (diffDias <= 30 && alertaPorVehiculo.get(v.id) !== "vencido") alertaPorVehiculo.set(v.id, "proximo");
    }
  }

  // Generar URLs firmadas para fotos frontales en paralelo
  const vehiculos = await Promise.all(
    vehiculosRaw.map(async (v) => ({
      ...v,
      fotoUrl: v.fotos[0]?.key ? await getSignedDownloadUrl(v.fotos[0].key, 7200) : null,
      alertaMant: alertaPorVehiculo.get(v.id) ?? null,
    }))
  );

  const puedeCrear = profile.rol === "admin";

  // Contadores por estado
  const counts = {
    total:       vehiculos.length,
    operativo:   vehiculos.filter((v) => v.estado === "operativo").length,
    parcialmente: vehiculos.filter((v) => v.estado === "parcialmente").length,
    fuera:       vehiculos.filter((v) => v.estado === "fuera_de_servicio").length,
  };

  return (
    <div className="space-y-6">

      {/* ── HEADER ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Flota vehicular</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {counts.total} vehículos
              {counts.operativo > 0 && <span className="ml-2 text-emerald-600">· {counts.operativo} operativos</span>}
              {counts.parcialmente > 0 && <span className="ml-2 text-amber-600">· {counts.parcialmente} parciales</span>}
              {counts.fuera > 0 && <span className="ml-2 text-red-600">· {counts.fuera} fuera de servicio</span>}
            </p>
          </div>
          {puedeCrear && (
            <RegistroVehiculoModal sucursales={sucursales} conductoresDisponibles={conductoresDisponibles} rol={profile.rol} />
          )}
        </div>

        {/* ── FILTROS ─────────────────────────────────────────── */}
        <form className="rounded-xl border bg-card p-3 flex flex-wrap gap-2 items-center">
          <SlidersHorizontal size={15} className="text-muted-foreground shrink-0" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Placa, marca, modelo, conductor..."
            className="flex-1 min-w-[160px] text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
          <div className="h-5 w-px bg-border hidden sm:block" />
          {profile.rol === "admin" && (
            <select
              name="sucursalId"
              defaultValue={sucursalId}
              className="text-sm bg-transparent outline-none text-foreground pr-2"
            >
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          )}
          <select
            name="estado"
            defaultValue={estado}
            className="text-sm bg-transparent outline-none text-foreground pr-2"
          >
            <option value="">Todos los estados</option>
            <option value="operativo">Operativo</option>
            <option value="parcialmente">Parcial</option>
            <option value="fuera_de_servicio">Fuera de servicio</option>
          </select>
          <Button type="submit" variant="outline" size="sm">Buscar</Button>
        </form>

        {/* ── CONTENIDO ───────────────────────────────────────── */}
        {vehiculos.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed p-16 flex flex-col items-center gap-3 text-center">
            <Car size={40} className="text-muted-foreground/30" />
            <div>
              <p className="font-medium text-muted-foreground">No se encontraron vehículos</p>
              {q || estado || sucursalId ? (
                <p className="text-sm text-muted-foreground/70 mt-0.5">Prueba con otros filtros.</p>
              ) : puedeCrear ? (
                <p className="text-sm text-primary mt-0.5">
                  Usa el botón "Registrar vehículo" superior para comenzar.
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {vehiculos.map((v) => {
              const est = ESTADO[v.estado];
              return (
                <Link key={v.id} href={`/vehiculos/${v.id}`}>
                  <article className="group rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">

                    {/* Foto del vehículo */}
                    <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                      {v.fotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={v.fotoUrl}
                          alt={`${v.placa} - Vista frontal`}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/30">
                          <ImageOff size={28} />
                          <p className="text-[10px] font-medium uppercase tracking-wide">Sin foto</p>
                        </div>
                      )}

                      {/* Badge de estado — top right */}
                      <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                        <Badge className={`${est.badge} text-[10px] px-1.5 py-0.5 shadow-sm`}>
                          {est.label}
                        </Badge>
                        {v.alertaMant && (
                          <Badge className={`text-[10px] px-1.5 py-0.5 shadow-sm border-0 ${v.alertaMant === "vencido" ? "bg-red-500 text-white" : "bg-amber-400 text-amber-900"}`}>
                            {v.alertaMant === "vencido" ? "⚠ Mant. vencido" : "⚠ Mant. próximo"}
                          </Badge>
                        )}
                      </div>

                      {/* Barra de estado — bottom */}
                      <div className={`absolute bottom-0 left-0 right-0 h-1 ${est.bar}`} />
                    </div>

                    {/* Info */}
                    <div className="p-3 space-y-2">
                      {/* Placa */}
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono font-bold text-base tracking-widest text-foreground group-hover:text-primary transition-colors truncate">
                          {v.placa}
                        </p>
                        <span className="text-xs text-muted-foreground shrink-0">{v.anio}</span>
                      </div>

                      {/* Marca + modelo + tipo */}
                      <div>
                        <p className="text-sm font-medium truncate">{v.marca} {v.modelo}</p>
                        <p className="text-xs text-muted-foreground">{TIPO_LABEL[v.tipo] ?? v.tipo}</p>
                      </div>

                      <div className="border-t pt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 text-muted-foreground min-w-0">
                          <MapPin size={11} className="shrink-0" />
                          <span className="text-xs truncate">{v.sucursal.nombre}</span>
                        </div>
                        {v.kmActuales != null && (
                          <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                            <Gauge size={11} />
                            <span className="text-xs">{(v.kmActuales / 1000).toFixed(0)}k km</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}
    </div>
  );
}
