import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IdCard, MapPin, SlidersHorizontal, User, Car } from "lucide-react";
import { RegistroConductorModal } from "./_components/registro-conductor-modal";

export default async function ConductoresPage({
  searchParams,
}: {
  searchParams: Promise<{ sucursalId?: string; q?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const { sucursalId, q } = await searchParams;

  const sucursalFiltro =
    profile.rol === "jefe_sucursal" ? (profile.sucursalId ?? undefined) : (sucursalId ?? undefined);

  const [conductores, sucursales, vehiculosDisponibles] = await Promise.all([
    prisma.conductor.findMany({
      where: {
        ...(sucursalFiltro && { sucursalId: sucursalFiltro }),
        ...(q && {
          OR: [
            { nombreCompleto: { contains: q, mode: "insensitive" } },
            { dni: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        sucursal: { select: { nombre: true } },
        vehiculo: { select: { id: true, placa: true } },
      },
    }),
    profile.rol === "admin"
      ? prisma.sucursal.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } })
      : Promise.resolve([]),
    profile.rol === "admin"
      ? prisma.vehiculo.findMany({
          // Buscar vehículos sin conductor
          where: { estado: { in: ["operativo", "parcialmente"] }, conductor: null },
          orderBy: { placa: "asc" },
          select: { id: true, placa: true, marca: true, modelo: true },
        })
      : Promise.resolve([]),
  ]);

  const puedeCrear = profile.rol === "admin";

  return (
    <div className="space-y-6">

      {/* ── HEADER ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Conductores</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {conductores.length} conductores registrados
            </p>
          </div>
          {puedeCrear && (
            <RegistroConductorModal 
              sucursales={sucursales} 
              vehiculosDisponibles={vehiculosDisponibles} 
              rol={profile.rol} 
            />
          )}
        </div>

        {/* ── FILTROS ─────────────────────────────────────────── */}
        <form className="rounded-xl border bg-card p-3 flex flex-wrap gap-2 items-center">
          <SlidersHorizontal size={15} className="text-muted-foreground shrink-0" />
          <input
            name="q"
            defaultValue={q}
            placeholder="DNI, Nombre..."
            className="flex-1 min-w-[200px] text-sm bg-transparent outline-none placeholder:text-muted-foreground"
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
          <Button type="submit" variant="outline" size="sm">Buscar</Button>
        </form>

        {/* ── CONTENIDO ───────────────────────────────────────── */}
        {conductores.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed p-16 flex flex-col items-center gap-3 text-center">
            <IdCard size={40} className="text-muted-foreground/30" />
            <div>
              <p className="font-medium text-muted-foreground">No se encontraron conductores</p>
              {q || sucursalId ? (
                <p className="text-sm text-muted-foreground/70 mt-0.5">Prueba con otros filtros.</p>
              ) : puedeCrear ? (
                <p className="text-sm text-primary mt-0.5">
                  Usa el botón "Registrar conductor" superior para comenzar.
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {conductores.map((c) => (
              <Link key={c.id} href={`/conductores/${c.id}`}>
                <article className="group relative rounded-2xl border bg-card p-5 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer flex flex-col h-full space-y-4">
                  
                  {/* Etiqueta de Activo/Inactivo */}
                  <div className="absolute top-4 right-4">
                    <Badge variant={c.activo ? "default" : "destructive"} className="text-[10px] px-1.5 py-0.5 shadow-sm">
                      {c.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-inner">
                      <User size={22} className="opacity-80" />
                    </div>
                    <div className="min-w-0 pr-12">
                      <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                        {c.nombreCompleto}
                      </h3>
                      <p className="text-sm font-mono text-muted-foreground truncate">{c.dni}</p>
                    </div>
                  </div>

                  <div className="space-y-3 mt-auto flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Licencia</span>
                      <Badge variant="outline" className="font-mono bg-background text-xs">{c.licenciaCategoria}</Badge>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Asignación</span>
                      {c.vehiculo ? (
                        <div className="flex items-center gap-1.5 text-foreground bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full dark:bg-emerald-500/10 dark:text-emerald-400">
                          <Car size={13} className="shrink-0" />
                          <span className="font-medium text-xs truncate max-w-[100px]">{c.vehiculo.placa}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60 italic text-xs">Sin vehículo</span>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-3 mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                      <MapPin size={12} className="shrink-0" />
                      <span className="text-xs truncate font-medium">{c.sucursal?.nombre || "Sin sucursal"}</span>
                    </div>
                  </div>

                </article>
              </Link>
            ))}
          </div>
        )}
    </div>
  );
}
