"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  ShieldCheck,
  Wrench,
  File,
  Download,
  Trash2,
  Upload,
  Plus,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────

type TipoDocumento = "soat" | "revision_tecnica" | "tarjeta_propiedad" | "otro";

interface Documento {
  id: string;
  tipo: TipoDocumento;
  nombre: string;
  mimeType: string;
  tamanoBytes: number | null;
  vencimiento: string | null;
  subidoPor: string | null;
  createdAt: string;
  downloadUrl: string;
}

interface Props {
  vehiculoId: string;
  documentos: Documento[];
  puedeGestionar: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────

const TIPO_CONFIG: Record<TipoDocumento, { label: string; icon: React.ReactNode; color: string }> = {
  soat:              { label: "SOAT",               icon: <ShieldCheck size={16} />, color: "text-blue-600" },
  revision_tecnica:  { label: "Revisión Técnica",   icon: <Wrench size={16} />,      color: "text-violet-600" },
  tarjeta_propiedad: { label: "Tarjeta Propiedad",  icon: <FileText size={16} />,    color: "text-emerald-600" },
  otro:              { label: "Otro",                icon: <File size={16} />,        color: "text-slate-500" },
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getVencimientoStatus(vencimiento: string | null): {
  label: string;
  class: string;
  icon: React.ReactNode;
} | null {
  if (!vencimiento) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(vencimiento + "T00:00:00");
  const diffDias = Math.ceil((vence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    return {
      label: `Vencido (${new Date(vencimiento).toLocaleDateString("es-PE")})`,
      class: "bg-red-50 text-red-700 border-red-200",
      icon: <XCircle size={13} />,
    };
  }
  if (diffDias <= 30) {
    return {
      label: `Vence en ${diffDias} días (${new Date(vencimiento).toLocaleDateString("es-PE")})`,
      class: "bg-amber-50 text-amber-700 border-amber-200",
      icon: <AlertTriangle size={13} />,
    };
  }
  return {
    label: new Date(vencimiento).toLocaleDateString("es-PE"),
    class: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle size={13} />,
  };
}

// ─── Componente principal ─────────────────────────────────────────

export function DocumentosPanel({ vehiculoId, documentos: inicial, puedeGestionar }: Props) {
  const router = useRouter();
  const [docs, setDocs] = useState<Documento[]>(inicial);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Documento | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Documento | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Upload form state ──
  const [tipo, setTipo] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    setUploading(true);

    const form = new FormData(e.currentTarget);
    form.set("tipo", tipo);

    try {
      const res = await fetch(`/api/vehiculos/${vehiculoId}/documentos`, {
        method: "POST",
        body: form,
      });
      const json = await res.json() as { error?: string };

      if (!res.ok) {
        setUploadError(json.error ?? "Error al subir el documento");
        return;
      }

      setUploadOpen(false);
      setTipo("");
      if (fileRef.current) fileRef.current.value = "";

      // Refrescar desde servidor
      startTransition(() => router.refresh());
    } catch {
      setUploadError("Error de conexión. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(
        `/api/vehiculos/${vehiculoId}/documentos/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      }
    } finally {
      setDeleteTarget(null);
    }
  }

  // Agrupar por tipo
  const grupos = (["soat", "revision_tecnica", "tarjeta_propiedad", "otro"] as TipoDocumento[]).map(
    (tipo) => ({
      tipo,
      docs: docs.filter((d) => d.tipo === tipo),
    })
  );

  return (
    <>
      {/* Botón subir */}
      {puedeGestionar && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus size={15} className="mr-1.5" />
            Subir documento
          </Button>
        </div>
      )}

      {/* Lista agrupada */}
      {docs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center space-y-2">
          <FileText size={36} className="mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground">No hay documentos registrados.</p>
          {puedeGestionar && (
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
              Subir el primero
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map(({ tipo, docs: grupoDocs }) => {
            if (grupoDocs.length === 0) return null;
            const cfg = TIPO_CONFIG[tipo];
            return (
              <div key={tipo} className="space-y-2">
                {/* Cabecera de grupo */}
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className={cfg.color}>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {grupoDocs.length} {grupoDocs.length === 1 ? "archivo" : "archivos"}
                  </span>
                </div>

                {/* Tarjetas de documento */}
                <div className="space-y-2">
                  {grupoDocs.map((doc) => {
                    const vState = getVencimientoStatus(doc.vencimiento);
                    return (
                      <div
                        key={doc.id}
                        className="rounded-lg border bg-card shadow-sm px-4 py-3 flex items-start gap-3"
                      >
                        {/* Icono tipo */}
                        <div className={`mt-0.5 shrink-0 ${cfg.color}`}>{cfg.icon}</div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="font-medium text-sm truncate">{doc.nombre}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {doc.tamanoBytes && <span>{formatBytes(doc.tamanoBytes)}</span>}
                            {doc.subidoPor && <span>Subido por {doc.subidoPor}</span>}
                            <span>{new Date(doc.createdAt).toLocaleDateString("es-PE")}</span>
                          </div>
                          {/* Badge vencimiento */}
                          {vState && (
                            <div
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${vState.class}`}
                            >
                              {vState.icon}
                              {vState.label}
                            </div>
                          )}
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Previsualizar" onClick={() => setPreviewDoc(doc)}>
                            <Eye size={15} />
                          </Button>
                          <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Descargar">
                              <Download size={15} />
                            </Button>
                          </a>
                          {puedeGestionar && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              title="Eliminar"
                              onClick={() => setDeleteTarget(doc)}
                            >
                              <Trash2 size={15} />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: Subir documento ──────────────────────────── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subir documento</DialogTitle>
            <DialogDescription>
              PDF, JPG o PNG · Máximo 10 MB
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo de documento *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v ?? "")} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soat">SOAT</SelectItem>
                  <SelectItem value="revision_tecnica">Revisión Técnica</SelectItem>
                  <SelectItem value="tarjeta_propiedad">Tarjeta de Propiedad</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre descriptivo *</Label>
              <Input
                id="nombre"
                name="nombre"
                placeholder="Ej: SOAT 2025 — Toyota Hilux"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vencimiento">Fecha de vencimiento</Label>
              <Input id="vencimiento" name="vencimiento" type="date" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="archivo">Archivo *</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  id="archivo"
                  name="archivo"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  required
                  className="flex-1 text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:text-xs file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted/80 cursor-pointer"
                />
              </div>
            </div>

            {uploadError && (
              <p className="text-sm text-destructive">{uploadError}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={uploading || !tipo}>
                {uploading ? (
                  <>
                    <Upload size={14} className="mr-1.5 animate-pulse" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload size={14} className="mr-1.5" />
                    Subir
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Previsualizar documento ──────────────────── */}
      <Dialog open={!!previewDoc} onOpenChange={(o) => { if (!o) setPreviewDoc(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{previewDoc?.nombre}</DialogTitle>
            <DialogDescription className="flex items-center gap-3">
              <span className="text-xs">{previewDoc?.mimeType}</span>
              {previewDoc?.downloadUrl && (
                <a href={previewDoc.downloadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <Download size={12} />Descargar
                </a>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden rounded-md border bg-muted/30 min-h-[400px]">
            {previewDoc?.mimeType === "application/pdf" ? (
              <iframe
                src={previewDoc.downloadUrl}
                className="w-full h-full min-h-[500px]"
                title={previewDoc.nombre}
              />
            ) : previewDoc?.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewDoc.downloadUrl}
                alt={previewDoc.nombre}
                className="w-full h-full object-contain max-h-[500px]"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Confirmar eliminación ────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar documento?</DialogTitle>
            <DialogDescription>
              Se eliminará permanentemente <span className="font-semibold">{deleteTarget?.nombre}</span>.
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
