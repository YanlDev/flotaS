"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

interface Props {
  vehiculoId: string;
  placa: string;
}

export function EliminarVehiculoButton({ vehiculoId, placa }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEliminar() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/vehiculos/${vehiculoId}`, {
        method: "DELETE",
      });

      const json = await res.json() as { error?: string };

      if (!res.ok) {
        setError(json.error ?? "Error al eliminar el vehículo");
        return;
      }

      setOpen(false);
      router.refresh();
      router.push("/vehiculos");
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4 mr-1.5" />
        Eliminar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar vehículo {placa}?</DialogTitle>
            <DialogDescription>
              Esta acción es irreversible. Se eliminarán permanentemente todos
              los datos del vehículo <span className="font-semibold font-mono">{placa}</span>.
              No se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleEliminar}
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
