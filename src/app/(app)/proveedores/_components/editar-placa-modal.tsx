"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Loader2, Upload, CheckCircle2 } from "lucide-react";

interface Props {
  proveedorId: string;
  placaId: string;
  placa: string;
  tenencia: "propio" | "arrendado";
  nombreConductor: string | null;
  numeroLicencia: string | null;
  enPlanilla: boolean;
  fechaCaducidadStr: string | null;
  tieneLicencia: boolean;
  tieneTarjeta: boolean;
  tieneContrato: boolean;
}

export function EditarPlacaModal({
  proveedorId,
  placaId,
  placa,
  tenencia,
  nombreConductor,
  numeroLicencia,
  enPlanilla,
  fechaCaducidadStr,
  tieneLicencia,
  tieneTarjeta,
  tieneContrato,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  function setArchivoNombre(campo: string, nombre: string | null) {
    setArchivos((prev) => ({ ...prev, [campo]: nombre ?? "" }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    // Asegurar que enPlanilla siempre se envíe
    if (!formData.get("enPlanilla")) formData.set("enPlanilla", "false");

    startTransition(async () => {
      const res = await fetch(
        `/api/proveedores/${proveedorId}/placas/${placaId}`,
        { method: "PATCH", body: formData }
      );

      if (!res.ok) {
        try {
          const data = (await res.json()) as { error?: string };
          setError(data.error ?? "Error al guardar los cambios");
        } catch {
          setError(`Error al guardar los cambios (${res.status})`);
        }
        return;
      }

      setOpen(false);
      setArchivos({});
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
        onClick={() => setOpen(true)}
      >
        <Pencil size={14} />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Editar placa{" "}
              <span className="font-mono text-primary">{placa}</span>
            </DialogTitle>
          </DialogHeader>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 mt-2">

            {/* Conductor */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Nombre del conductor</label>
              <input
                name="nombreConductor"
                defaultValue={nombreConductor ?? ""}
                placeholder="Juan Pérez García"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Número de licencia</label>
              <input
                name="numeroLicencia"
                defaultValue={numeroLicencia ?? ""}
                placeholder="Q12345678"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* En planilla */}
            <label className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
              <input
                type="checkbox"
                name="enPlanilla"
                value="true"
                defaultChecked={enPlanilla}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-sm">Conductor en planilla</span>
            </label>

            {/* Fecha caducidad contrato (solo arrendado) */}
            {tenencia === "arrendado" && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Fecha de caducidad del contrato</label>
                <input
                  type="date"
                  name="fechaCaducidadContrato"
                  defaultValue={fechaCaducidadStr ?? ""}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            )}

            {/* Documentos */}
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground">Documentos</p>

              <FileInput
                name="licenciaConducir"
                label="Licencia de conducir"
                tieneArchivo={tieneLicencia}
                fileName={archivos["licenciaConducir"]}
                onChange={(n) => setArchivoNombre("licenciaConducir", n)}
              />

              {tenencia === "propio" && (
                <FileInput
                  name="tarjetaPropiedad"
                  label="Tarjeta de propiedad"
                  tieneArchivo={tieneTarjeta}
                  fileName={archivos["tarjetaPropiedad"]}
                  onChange={(n) => setArchivoNombre("tarjetaPropiedad", n)}
                />
              )}

              {tenencia === "arrendado" && (
                <FileInput
                  name="contratoArrendamiento"
                  label="Contrato de arrendamiento"
                  tieneArchivo={tieneContrato}
                  accept="application/pdf"
                  fileName={archivos["contratoArrendamiento"]}
                  onChange={(n) => setArchivoNombre("contratoArrendamiento", n)}
                />
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} className="gap-2">
                {isPending && <Loader2 size={15} className="animate-spin" />}
                Guardar cambios
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FileInput({
  name,
  label,
  tieneArchivo,
  accept = "application/pdf,image/jpeg,image/png,image/webp",
  fileName,
  onChange,
}: {
  name: string;
  label: string;
  tieneArchivo: boolean;
  accept?: string;
  fileName?: string;
  onChange: (name: string | null) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {tieneArchivo && !fileName && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 size={11} /> Cargado
          </span>
        )}
      </div>
      <label className="flex items-center gap-3 w-full rounded-lg border bg-background px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
        <Upload size={16} className="text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground truncate">
          {fileName || (tieneArchivo ? "Reemplazar archivo..." : "Seleccionar archivo...")}
        </span>
        <input
          type="file"
          name={name}
          accept={accept}
          className="sr-only"
          onChange={(e) => onChange(e.target.files?.[0]?.name ?? null)}
        />
      </label>
    </div>
  );
}
