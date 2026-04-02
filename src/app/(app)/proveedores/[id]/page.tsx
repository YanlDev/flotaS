import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { getSignedDownloadUrl } from "@/lib/wasabi";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ArrowLeft,
  FileText,
  MapPin,
  User,
  Car,
  ExternalLink,
  CalendarDays,
  IdCard,
  CheckCircle2,
} from "lucide-react";
import { RegistroPlacaModal } from "../_components/registro-placa-modal";
import { EditarProveedorModal } from "../_components/editar-proveedor-modal";
import { EliminarProveedorButton } from "../_components/eliminar-proveedor-button";
import { EliminarPlacaButton } from "../_components/eliminar-placa-button";
import { EditarPlacaModal } from "../_components/editar-placa-modal";

export default async function ProveedorDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  if (profile.rol !== "admin" && profile.rol !== "comercial") {
    redirect("/dashboard");
  }

  const { id } = await params;

  const proveedor = await prisma.proveedor.findFirst({
    where: { id, deletedAt: null },
    include: {
      sucursal: { select: { nombre: true, ciudad: true } },
      creador: { select: { nombreCompleto: true } },
      placas: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!proveedor) redirect("/proveedores");

  // comercial solo ve su sucursal
  if (profile.rol === "comercial" && proveedor.sucursalId !== profile.sucursalId) {
    redirect("/proveedores");
  }

  // URLs firmadas de documentos de placas
  const placasConUrls = await Promise.all(
    proveedor.placas.map(async (p) => ({
      ...p,
      fechaCaducidadStr: p.fechaCaducidadContrato
        ? p.fechaCaducidadContrato.toISOString().split("T")[0]
        : null,
      licenciaConducirUrl: p.licenciaConducirKey
        ? await getSignedDownloadUrl(p.licenciaConducirKey, 7200)
        : null,
      tarjetaPropiedadUrl: p.tarjetaPropiedadKey
        ? await getSignedDownloadUrl(p.tarjetaPropiedadKey, 7200)
        : null,
      contratoArrendamientoUrl: p.contratoArrendamientoKey
        ? await getSignedDownloadUrl(p.contratoArrendamientoKey, 7200)
        : null,
    }))
  );

  // URL firmada para ficha RUC
  const fichaRucUrl = proveedor.fichaRucKey
    ? await getSignedDownloadUrl(proveedor.fichaRucKey, 7200)
    : null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-start gap-4">
        <Link href="/proveedores">
          <Button variant="ghost" size="icon" className="shrink-0 mt-0.5">
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{proveedor.razonSocial}</h1>
          <p className="text-sm text-muted-foreground font-mono mt-0.5">{proveedor.ruc}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <EditarProveedorModal proveedor={proveedor} />
          {profile.rol === "admin" && (
            <EliminarProveedorButton proveedorId={proveedor.id} razonSocial={proveedor.razonSocial} />
          )}
        </div>
      </div>

      {/* INFO DEL PROVEEDOR */}
      <div className="rounded-2xl border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Datos del proveedor</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">RUC</p>
            <p className="font-mono font-semibold">{proveedor.ruc}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Razón Social</p>
            <p className="font-medium">{proveedor.razonSocial}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Usuario SUNAT</p>
            <p className="text-sm">{proveedor.usuarioSunat}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">SOL</p>
            <p className="text-sm">{proveedor.sol}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">DNI</p>
            <p className="font-mono text-sm">{proveedor.dni}</p>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin size={11} /> Dirección de Concesión
            </p>
            <p className="text-sm">{proveedor.direccionConcesion}</p>
          </div>
          {proveedor.sucursal && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Sucursal</p>
              <p className="text-sm">{proveedor.sucursal.nombre} · {proveedor.sucursal.ciudad}</p>
            </div>
          )}
          {proveedor.creador && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <User size={11} /> Registrado por
              </p>
              <p className="text-sm">{proveedor.creador.nombreCompleto}</p>
            </div>
          )}
        </div>

        {/* Ficha RUC */}
        {fichaRucUrl && (
          <div className="border-t pt-4 flex items-center gap-3">
            <FileText size={18} className="text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Ficha RUC</p>
              <p className="text-xs text-muted-foreground">Documento PDF</p>
            </div>
            <a href={fichaRucUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink size={14} />
                Ver PDF
              </Button>
            </a>
          </div>
        )}
      </div>

      {/* PLACAS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold">
            Placas registradas
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({placasConUrls.length})
            </span>
          </h2>
          <RegistroPlacaModal proveedorId={proveedor.id} />
        </div>

        {placasConUrls.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed p-12 flex flex-col items-center gap-3 text-center">
            <Car size={36} className="text-muted-foreground/30" />
            <div>
              <p className="font-medium text-muted-foreground">Sin placas registradas</p>
              <p className="text-sm text-muted-foreground/70 mt-0.5">
                Usa el botón "Agregar placa" para registrar vehículos de este proveedor.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {placasConUrls.map((p) => {
              const esArrendado = p.tenencia === "arrendado";
              const caducado = p.fechaCaducidadContrato
                ? p.fechaCaducidadContrato <= hoy
                : false;
              const proximoVencer = p.fechaCaducidadContrato
                ? !caducado && (p.fechaCaducidadContrato.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24) <= 30
                : false;

              return (
                <div key={p.id} className="rounded-2xl border bg-card p-5 space-y-4">
                  {/* Cabecera */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-muted p-2">
                        <Car size={16} className="text-muted-foreground" />
                      </div>
                      <p className="font-mono font-bold text-lg tracking-widest">{p.placa}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          esArrendado
                            ? "bg-amber-100 text-amber-700 border-0 text-xs"
                            : "bg-emerald-100 text-emerald-700 border-0 text-xs"
                        }
                      >
                        {esArrendado ? "Arrendado" : "Propio"}
                      </Badge>
                      <EditarPlacaModal
                        proveedorId={proveedor.id}
                        placaId={p.id}
                        placa={p.placa}
                        tenencia={p.tenencia}
                        nombreConductor={p.nombreConductor ?? null}
                        numeroLicencia={p.numeroLicencia ?? null}
                        enPlanilla={p.enPlanilla}
                        fechaCaducidadStr={p.fechaCaducidadStr}
                        tieneLicencia={!!p.licenciaConducirKey}
                        tieneTarjeta={!!p.tarjetaPropiedadKey}
                        tieneContrato={!!p.contratoArrendamientoKey}
                      />
                      {profile.rol === "admin" && (
                        <EliminarPlacaButton
                          proveedorId={proveedor.id}
                          placaId={p.id}
                          placa={p.placa}
                        />
                      )}
                    </div>
                  </div>

                  {/* Alerta de vencimiento */}
                  {caducado && (
                    <p className="text-xs bg-red-100 text-red-700 rounded-lg px-3 py-1.5 font-medium">
                      ⚠ Contrato de arrendamiento vencido
                    </p>
                  )}
                  {proximoVencer && !caducado && (
                    <p className="text-xs bg-amber-100 text-amber-700 rounded-lg px-3 py-1.5 font-medium">
                      ⚠ Contrato próximo a vencer
                    </p>
                  )}

                  {/* Nombre propietario (arrendado) */}
                  {p.nombrePropietario && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User size={13} />
                      <span className="truncate">{p.nombrePropietario}</span>
                    </div>
                  )}

                  {/* Conductor */}
                  {p.nombreConductor && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User size={13} />
                      <span className="truncate">Conductor: {p.nombreConductor}</span>
                    </div>
                  )}
                  {p.numeroLicencia && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <IdCard size={13} />
                      <span className="font-mono">Licencia: {p.numeroLicencia}</span>
                    </div>
                  )}
                  {p.enPlanilla && (
                    <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                      <CheckCircle2 size={13} />
                      <span>En planilla</span>
                    </div>
                  )}

                  {/* Fecha caducidad */}
                  {p.fechaCaducidadStr && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarDays size={13} />
                      <span>Vence: {p.fechaCaducidadStr}</span>
                    </div>
                  )}

                  {/* Documentos */}
                  <div className="space-y-2">
                    {p.licenciaConducirUrl && (
                      <DocLink href={p.licenciaConducirUrl} label="Licencia de conducir" />
                    )}
                    {p.tarjetaPropiedadUrl && (
                      <DocLink href={p.tarjetaPropiedadUrl} label="Tarjeta de propiedad" />
                    )}
                    {p.contratoArrendamientoUrl && (
                      <DocLink href={p.contratoArrendamientoUrl} label="Contrato de arrendamiento" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 hover:bg-muted/60 transition-colors group"
    >
      <div className="flex items-center gap-2 min-w-0">
        <FileText size={13} className="text-muted-foreground shrink-0" />
        <span className="text-xs font-medium truncate">{label}</span>
      </div>
      <ExternalLink size={12} className="text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
    </a>
  );
}
