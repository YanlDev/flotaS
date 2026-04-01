"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CartillaButton({ vehiculoId }: { vehiculoId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/vehiculos/${vehiculoId}/cartilla`);
      if (!res.ok) {
        console.error("Error al generar cartilla:", res.status);
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = res.headers.get("content-disposition")
        ?.match(/filename="(.+)"/)?.[1] ?? `cartilla-${vehiculoId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error al descargar cartilla:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5"
      onClick={handleDownload}
      disabled={loading}
    >
      <FileDown size={13} />
      {loading ? "Generando..." : "Exportar cartilla"}
    </Button>
  );
}
