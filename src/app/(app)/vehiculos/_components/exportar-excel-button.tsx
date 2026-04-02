"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  q?:          string;
  estado?:     string;
  sucursalId?: string;
}

export function ExportarExcelButton({ q, estado, sucursalId }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q)          params.set("q",          q);
      if (estado)     params.set("estado",     estado);
      if (sucursalId) params.set("sucursalId", sucursalId);

      const url = `/api/vehiculos/exportar${params.size > 0 ? "?" + params.toString() : ""}`;
      const res = await fetch(url);
      if (!res.ok) return;

      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = href;
      a.download = res.headers.get("content-disposition")
        ?.match(/filename="(.+)"/)?.[1] ?? "flota-vehicular.xlsx";
      a.click();
      URL.revokeObjectURL(href);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5"
      onClick={handleExport}
      disabled={loading}
    >
      <FileSpreadsheet size={14} className="text-emerald-600" />
      {loading ? "Exportando..." : "Exportar Excel"}
    </Button>
  );
}
