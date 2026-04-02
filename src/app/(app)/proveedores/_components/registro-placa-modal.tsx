"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, Upload } from "lucide-react";

interface Props {
  proveedorId: string;
}

export function RegistroPlacaModal({ proveedorId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tenencia, setTenencia] = useState<"propio" | "arrendado">("propio");
  const [archivos, setArchivos] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  function setArchivoNombre(campo: string, nombre: string | null) {
    setArchivos((prev) => ({ ...prev, [campo]: nombre ?? "" }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await fetch(`/api/proveedores/${proveedorId}/placas`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        try {
          const data = await res.json() as { error?: string };
          setError(data.error ?? "Error al registrar la placa");
        } catch {
          setError(`Error al registrar la placa (${res.status})`);
        }
        return;
      }

      setOpen(false);
      formRef.current?.reset();
      setTenencia("propio");
      setArchivos({});
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="gap-2 shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
        <Plus size={16} />
        Agregar placa
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar placa de proveedor</DialogTitle>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 mt-2">

          {/* Placa */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Placa *</label>
            <input
              name="placa"
              required
              placeholder="ABC-123"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 font-mono uppercase"
            />
          </div>

          {/* Tenencia */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Tenencia del vehículo *</label>
            <div className="grid grid-cols-2 gap-2">
              {(["propio", "arrendado"] as const).map((t) => (
                <label
                  key={t}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                    tenencia === t
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="tenencia"
                    value={t}
                    checked={tenencia === t}
                    onChange={() => setTenencia(t)}
                    className="sr-only"
                  />
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${tenencia === t ? "border-primary" : "border-muted-foreground/40"}`}>
                    {tenencia === t && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </div>
                  <span className="text-sm capitalize">{t === "propio" ? "Propio" : "Arrendado"}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Conductor */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Nombre del conductor *</label>
            <input
              name="nombreConductor"
              required
              placeholder="Juan Pérez García"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Número de licencia de conducir *</label>
            <input
              name="numeroLicencia"
              required
              placeholder="Q12345678"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* En planilla */}
          <label className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
            <input type="checkbox" name="enPlanilla" value="true" className="h-4 w-4 rounded accent-primary" />
            <span className="text-sm">Conductor en planilla</span>
          </label>

          {/* Licencia de conducir (siempre requerida) */}
          <FileInput
            name="licenciaConducir"
            label="Licencia de conducir (documento) *"
            required
            fileName={archivos["licenciaConducir"]}
            onChange={(n) => setArchivoNombre("licenciaConducir", n)}
          />

          {/* Tarjeta de propiedad (solo si propio) */}
          {tenencia === "propio" && (
            <FileInput
              name="tarjetaPropiedad"
              label="Tarjeta de propiedad *"
              required
              fileName={archivos["tarjetaPropiedad"]}
              onChange={(n) => setArchivoNombre("tarjetaPropiedad", n)}
            />
          )}

          {/* Contrato de arrendamiento + campos adicionales (solo si arrendado) */}
          {tenencia === "arrendado" && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium">Nombres y apellidos del propietario *</label>
                <input
                  name="nombrePropietario"
                  required
                  placeholder="Juan Pérez García"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <FileInput
                name="contratoArrendamiento"
                label="Contrato de arrendamiento (PDF) *"
                required
                accept="application/pdf"
                fileName={archivos["contratoArrendamiento"]}
                onChange={(n) => setArchivoNombre("contratoArrendamiento", n)}
              />
              <div className="space-y-1">
                <label className="text-sm font-medium">Fecha de caducidad del contrato *</label>
                <input
                  type="date"
                  name="fechaCaducidadContrato"
                  required
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 size={15} className="animate-spin" />}
              Registrar placa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FileInput({
  name,
  label,
  required,
  accept = "application/pdf,image/jpeg,image/png,image/webp",
  fileName,
  onChange,
}: {
  name: string;
  label: string;
  required?: boolean;
  accept?: string;
  fileName?: string;
  onChange: (name: string | null) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <label className="flex items-center gap-3 w-full rounded-lg border bg-background px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
        <Upload size={16} className="text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground truncate">
          {fileName || "Seleccionar archivo..."}
        </span>
        <input
          type="file"
          name={name}
          required={required}
          accept={accept}
          className="sr-only"
          onChange={(e) => onChange(e.target.files?.[0]?.name ?? null)}
        />
      </label>
    </div>
  );
}
