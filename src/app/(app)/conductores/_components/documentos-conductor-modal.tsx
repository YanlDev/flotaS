"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText, Download, Trash2, Upload, Plus,
  AlertTriangle, CheckCircle, XCircle, Eye,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────

interface Documento {
  id: string;
  nombre: string;
  mimeType: string;
  tamanoBytes: number | null;
  vencimiento: string | null;
  subidoPor: string | null;
  createdAt: string;
  downloadUrl: string;
}

interface Props {
  conductorId: string;
  conductorNombre: string;
  open: boolean;
  onClose: () => void;
  puedeGestionar: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function VencimientoBadge({ vencimiento }: { vencimiento: string | null }) {
  if (!vencimiento) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const vence = new Date(vencimiento + "T00:00:00");
  const diff = Math.ceil((vence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0)
    return <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5"><XCircle size={11} />Vencido ({new Date(vencimiento).toLocaleDateString("es-PE")})</span>;
  if (diff <= 30)
    return <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"><AlertTriangle size={11} />Vence en {diff}d</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"><CheckCircle size={11} />{new Date(vencimiento).toLocaleDateString("es-PE")}</span>;
}

// ─── Componente ───────────────────────────────────────────────────

export function DocumentosConductorModal({ conductorId, conductorNombre, open, onClose, puedeGestionar }: Props) {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Documento | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Documento | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/conductores/${conductorId}/documentos`)
      .then((r) => r.json() as Promise<Documento[]>)
      .then((data) => setDocs(data))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [open, conductorId]);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    setUploading(true);

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch(`/api/conductores/${conductorId}/documentos`, {
        method: "POST",
        body: form,
      });
      const json = await res.json() as { error?: string; id?: string };

      if (!res.ok) {
        setUploadError(json.error ?? "Error al subir el documento");
        return;
      }

      // Recargar documentos
      const updated = await fetch(`/api/conductores/${conductorId}/documentos`).then((r) => r.json() as Promise<Documento[]>);
      setDocs(updated);
      setUploadOpen(false);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setUploadError("Error de conexión. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/conductores/${conductorId}/documentos/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) setDocs((prev) => prev.filter((d) => d.id !== deleteTarget.id));
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={16} />
              Documentos — {conductorNombre}
            </DialogTitle>
            <DialogDescription>
              Brevete, certificados y otros documentos del conductor.
            </DialogDescription>
          </DialogHeader>

          {puedeGestionar && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Plus size={14} className="mr-1.5" />Subir documento
              </Button>
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Cargando...</div>
          ) : docs.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center space-y-2">
              <FileText size={32} className="mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Sin documentos registrados</p>
              {puedeGestionar && (
                <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>Subir el primero</Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.id} className="rounded-lg border bg-card px-4 py-3 flex items-start gap-3">
                  <FileText size={16} className="mt-0.5 shrink-0 text-primary" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-medium text-sm truncate">{doc.nombre}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {doc.tamanoBytes && <span>{formatBytes(doc.tamanoBytes)}</span>}
                      {doc.subidoPor && <span>Subido por {doc.subidoPor}</span>}
                      <span>{new Date(doc.createdAt).toLocaleDateString("es-PE")}</span>
                    </div>
                    <VencimientoBadge vencimiento={doc.vencimiento} />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Previsualizar" onClick={() => setPreviewDoc(doc)}>
                      <Eye size={14} />
                    </Button>
                    <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Descargar">
                        <Download size={14} />
                      </Button>
                    </a>
                    {puedeGestionar && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(doc)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Sub-modal: Previsualizar documento ─────────────── */}
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

      {/* ── Sub-modal: Subir documento ──────────────────────── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subir documento</DialogTitle>
            <DialogDescription>PDF, JPG o PNG · Máximo 10 MB</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="doc-nombre">Nombre descriptivo *</Label>
              <Input id="doc-nombre" name="nombre" placeholder="Ej: Brevete A2b — vence 2026" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-vencimiento">Fecha de vencimiento</Label>
              <Input id="doc-vencimiento" name="vencimiento" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-archivo">Archivo *</Label>
              <input
                ref={fileRef}
                id="doc-archivo"
                name="archivo"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                required
                className="w-full text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:text-xs file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted/80 cursor-pointer"
              />
            </div>
            {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>Cancelar</Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? <><Upload size={13} className="mr-1.5 animate-pulse" />Subiendo...</> : <><Upload size={13} className="mr-1.5" />Subir</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Sub-modal: Confirmar eliminación ────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar documento?</DialogTitle>
            <DialogDescription>
              Se eliminará permanentemente <span className="font-semibold">{deleteTarget?.nombre}</span>. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
