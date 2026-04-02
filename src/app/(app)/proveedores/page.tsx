import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Building2, SlidersHorizontal, MapPin, FileText, Car } from "lucide-react";
import { RegistroProveedorModal } from "./_components/registro-proveedor-modal";

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ sucursalId?: string; q?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  if (profile.rol !== "admin" && profile.rol !== "comercial") {
    redirect("/dashboard");
  }

  const { sucursalId, q } = await searchParams;

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {proveedores.map((p) => (
            <Link key={p.id} href={`/proveedores/${p.id}`}>
              <article className="group rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer p-5 space-y-4">

                {/* Cabecera */}
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

                {/* Info */}
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <FileText size={12} className="shrink-0" />
                    <span className="truncate">DNI: {p.dni}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">{p.direccionConcesion}</span>
                  </div>
                </div>

                {/* Footer */}
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
      )}
    </div>
  );
}
