"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Loader2, Upload } from "lucide-react";

interface ProveedorEditable {
  id: string;
  razonSocial: string;
  usuarioSunat: string;
  sol: string;
  dni: string;
  direccionConcesion: string;
  fichaRucKey: string | null;
}

interface Props {
  proveedor: ProveedorEditable;
}

export function EditarProveedorModal({ proveedor }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nuevaFichaNombre, setNuevaFichaNombre] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await fetch(`/api/proveedores/${proveedor.id}`, {
        method: "PATCH",
        body: formData,
      });

      if (!res.ok) {
        try {
          const data = await res.json() as { error?: string };
          setError(data.error ?? "Error al actualizar el proveedor");
        } catch {
          setError(`Error al actualizar el proveedor (${res.status})`);
        }
        return;
      }

      setOpen(false);
      setNuevaFichaNombre(null);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="gap-2 shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-3">
        <Pencil size={14} />
        Editar
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar proveedor</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">

          <div className="space-y-1">
            <label className="text-sm font-medium">Razón Social</label>
            <input
              name="razonSocial"
              defaultValue={proveedor.razonSocial}
              placeholder="EMPRESA SAC"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Usuario SUNAT</label>
            <input
              name="usuarioSunat"
              defaultValue={proveedor.usuarioSunat}
              placeholder="Usuario SUNAT"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">SOL</label>
            <input
              name="sol"
              defaultValue={proveedor.sol}
              placeholder="Clave SOL"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">DNI</label>
            <input
              name="dni"
              defaultValue={proveedor.dni}
              maxLength={8}
              pattern="\d{8}"
              placeholder="12345678"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Dirección de Concesión</label>
            <input
              name="direccionConcesion"
              defaultValue={proveedor.direccionConcesion}
              placeholder="Av. Ejemplo 123, Lima"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Reemplazar Ficha RUC */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              {proveedor.fichaRucKey ? "Reemplazar Ficha RUC (opcional)" : "Subir Ficha RUC (PDF)"}
            </label>
            <label className="flex items-center gap-3 w-full rounded-lg border bg-background px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
              <Upload size={16} className="text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground truncate">
                {nuevaFichaNombre ?? "Seleccionar PDF..."}
              </span>
              <input
                type="file"
                name="fichaRuc"
                accept="application/pdf"
                className="sr-only"
                onChange={(e) => setNuevaFichaNombre(e.target.files?.[0]?.name ?? null)}
              />
            </label>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
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
  );
}
