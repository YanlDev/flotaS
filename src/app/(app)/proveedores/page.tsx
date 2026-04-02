import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, SlidersHorizontal, MapPin, FileText, Car, Eye } from "lucide-react";
import { RegistroProveedorModal } from "./_components/registro-proveedor-modal";
import { EditarProveedorModal } from "./_components/editar-proveedor-modal";
import { EliminarProveedorButton } from "./_components/eliminar-proveedor-button";
import { TenenciaVehiculo } from "@/generated/prisma/client";

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ sucursalId?: string; q?: string; tenencia?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  if (profile.rol !== "admin" && profile.rol !== "comercial") {
    redirect("/dashboard");
  }

  const { sucursalId, q, tenencia } = await searchParams;
  const tenenciaFiltro = tenencia === "propio" || tenencia === "arrendado" ? tenencia as TenenciaVehiculo : undefined;

  const sucursalFiltro =
    profile.rol === "comercial"
      ? (profile.sucursalId ?? undefined)
      : (sucursalId ?? undefined);

  const [proveedores, sucursales] = await Promise.all([
    prisma.proveedor.findMany({
      where: {
        deletedAt: null,
        ...(sucursalFiltro && { sucursalId: sucursalFiltro }),
        ...(q && {
          OR: [
            { ruc: { contains: q, mode: "insensitive" } },
            { razonSocial: { contains: q, mode: "insensitive" } },
            { dni: { contains: q, mode: "insensitive" } },
          ],
        }),
        ...(tenenciaFiltro && {
          placas: { some: { deletedAt: null, tenencia: tenenciaFiltro } },
        }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        sucursal: { select: { nombre: true } },
        _count: { select: { placas: { where: { deletedAt: null } } } },
      },
    }),
    profile.rol === "admin"
      ? prisma.sucursal.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Proveedores</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {proveedores.length} {proveedores.length === 1 ? "proveedor registrado" : "proveedores registrados"}
          </p>
        </div>
        <RegistroProveedorModal sucursales={sucursales} rol={profile.rol} sucursalId={profile.sucursalId ?? null} />
      </div>

      {/* FILTROS */}
      <form className="rounded-xl border bg-card p-3 flex flex-wrap gap-2 items-center">
        <SlidersHorizontal size={15} className="text-muted-foreground shrink-0" />
        <input
          name="q"
          defaultValue={q}
          placeholder="RUC, razón social, DNI..."
          className="flex-1 min-w-[160px] text-sm bg-transparent outline-none placeholder:text-muted-foreground"
        />
        <div className="h-5 w-px bg-border hidden sm:block" />
        <select
          name="tenencia"
          defaultValue={tenencia ?? ""}
          className="text-sm bg-transparent outline-none text-foreground pr-2"
        >
          <option value="">Todos los vehículos</option>
          <option value="propio">Solo propietarios</option>
          <option value="arrendado">Solo arrendatarios</option>
        </select>
        {profile.rol === "admin" && (
          <>
            <div className="h-5 w-px bg-border hidden sm:block" />
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
          </>
        )}
        <Button type="submit" variant="outline" size="sm">Buscar</Button>
      </form>

      {/* Badge de filtro activo */}
      {tenenciaFiltro && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtrando por:</span>
          <Badge className={tenenciaFiltro === "propio" ? "bg-emerald-100 text-emerald-700 border-0" : "bg-amber-100 text-amber-700 border-0"}>
            {tenenciaFiltro === "propio" ? "Propietarios" : "Arrendatarios"}
          </Badge>
        </div>
      )}

      {/* LISTADO */}
      {proveedores.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed p-16 flex flex-col items-center gap-3 text-center">
          <Building2 size={40} className="text-muted-foreground/30" />
          <div>
            <p className="font-medium text-muted-foreground">No se encontraron proveedores</p>
            {q || sucursalId ? (
              <p className="text-sm text-muted-foreground/70 mt-0.5">Prueba con otros filtros.</p>
            ) : (
              <p className="text-sm text-primary mt-0.5">Usa el botón "Registrar proveedor" para comenzar.</p>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ── TABLA — desktop ─────────────────────────────── */}
          <div className="hidden md:block rounded-xl border bg-card overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">RUC</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Razón Social</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">DNI</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground max-w-[220px]">Dirección Concesión</th>
                  {profile.rol === "admin" && (
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Sucursal</th>
                  )}
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Placas</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {proveedores.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.ruc}</td>
                    <td className="px-4 py-3 font-medium max-w-[200px]">
                      <span className="truncate block">{p.razonSocial}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.dni}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px]">
                      <span className="truncate block">{p.direccionConcesion}</span>
                    </td>
                    {profile.rol === "admin" && (
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {p.sucursal?.nombre ?? <span className="text-muted-foreground/40">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                        <Car size={11} />
                        {p._count.placas}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/proveedores/${p.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10">
                            <Eye size={14} />
                          </Button>
                        </Link>
                        <EditarProveedorModal proveedor={p} variant="icon" />
                        {profile.rol === "admin" && (
                          <EliminarProveedorButton proveedorId={p.id} razonSocial={p.razonSocial} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── CARDS — mobile ──────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
            {proveedores.map((p) => (
              <Link key={p.id} href={`/proveedores/${p.id}`}>
                <article className="group rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
                      <Building2 size={20} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm leading-tight truncate group-hover:text-primary transition-colors">
                        {p.razonSocial}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{p.ruc}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <FileText size={12} className="shrink-0" />
                      <span className="truncate">DNI: {p.dni}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className="shrink-0" />
                      <span className="truncate">{p.direccionConcesion}</span>
                    </div>
                  </div>
                  <div className="border-t pt-3 flex items-center justify-between">
                    {p.sucursal ? (
                      <span className="text-xs text-muted-foreground">{p.sucursal.nombre}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">Sin sucursal</span>
                    )}
                    <div className="flex items-center gap-1 text-xs font-medium text-primary">
                      <Car size={12} />
                      {p._count.placas} {p._count.placas === 1 ? "placa" : "placas"}
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
