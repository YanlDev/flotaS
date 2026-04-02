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


interface Sucursal {
  id: string;
  nombre: string;
}

interface Props {
  sucursales: Sucursal[];
  rol: string;
  sucursalId: string | null;
}

export function RegistroProveedorModal({ sucursales, rol, sucursalId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fichaRucNombre, setFichaRucNombre] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await fetch("/api/proveedores", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        try {
          const data = await res.json() as { error?: string };
          setError(data.error ?? "Error al registrar el proveedor");
        } catch {
          setError(`Error al registrar el proveedor (${res.status})`);
        }
        return;
      }

      setOpen(false);
      formRef.current?.reset();
      setFichaRucNombre(null);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="gap-2 shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
        <Plus size={16} />
        Registrar proveedor
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar proveedor</DialogTitle>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 mt-2">

          {/* RUC */}
          <div className="space-y-1">
            <label className="text-sm font-medium">RUC *</label>
            <input
              name="ruc"
              required
              maxLength={11}
              pattern="\d{11}"
              placeholder="12345678901"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 font-mono"
            />
          </div>

          {/* Razón Social */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Razón Social *</label>
            <input
              name="razonSocial"
              required
              placeholder="EMPRESA SAC"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Usuario SUNAT */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Usuario SUNAT *</label>
            <input
              name="usuarioSunat"
              required
              placeholder="Usuario SUNAT"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* SOL */}
          <div className="space-y-1">
            <label className="text-sm font-medium">SOL *</label>
            <input
              name="sol"
              required
              placeholder="Clave SOL"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* DNI */}
          <div className="space-y-1">
            <label className="text-sm font-medium">DNI *</label>
            <input
              name="dni"
              required
              maxLength={8}
              pattern="\d{8}"
              placeholder="12345678"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 font-mono"
            />
          </div>

          {/* Dirección de Concesión */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Dirección de Concesión *</label>
            <input
              name="direccionConcesion"
              required
              placeholder="Av. Ejemplo 123, Lima"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Sucursal (solo admin) */}
          {rol === "admin" && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Sucursal</label>
              <select
                name="sucursalId"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Sin sucursal específica</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          )}
          {rol === "comercial" && sucursalId && (
            <input type="hidden" name="sucursalId" value={sucursalId} />
          )}

          {/* Ficha RUC */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Ficha RUC (PDF) *</label>
            <label className="flex items-center gap-3 w-full rounded-lg border bg-background px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
              <Upload size={16} className="text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground truncate">
                {fichaRucNombre ?? "Seleccionar archivo PDF..."}
              </span>
              <input
                type="file"
                name="fichaRuc"
                required
                accept="application/pdf"
                className="sr-only"
                onChange={(e) => setFichaRucNombre(e.target.files?.[0]?.name ?? null)}
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
              Registrar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
