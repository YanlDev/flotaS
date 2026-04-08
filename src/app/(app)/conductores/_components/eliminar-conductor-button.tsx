"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  conductorId: string;
  nombre: string;
}

export function EliminarConductorButton({ conductorId, nombre }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/conductores/${conductorId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error ?? "Error al eliminar");
        setLoading(false);
        return;
      }
      setOpen(false);
      router.refresh();
      router.push("/conductores");
    } catch {
      alert("Error de red");
      setLoading(false);
    }
  }

  return (
    <>
      {/* Botón externo — sin asChild (no funciona en esta versión de shadcn) */}
      <Button
        variant="destructive"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Trash2 size={13} />
        Eliminar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar conductor?</DialogTitle>
            <DialogDescription>
              Se eliminará permanentemente a{" "}
              <span className="font-semibold">{nombre}</span>. Esta acción no
              se puede deshacer. Si el conductor tiene documentos o cargas
              registradas, la operación será rechazada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? "Eliminando..." : "Sí, eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
