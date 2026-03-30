"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Camera, X, Loader2, ZoomIn, ChevronLeft, ChevronRight,
  RotateCcw, ImageOff,
} from "lucide-react";
import Image from "next/image";

// ─── Tipos ────────────────────────────────────────────────────────

type Categoria = "frontal" | "posterior" | "lateral_der" | "lateral_izq" | "cabina" | "odometro" | "otro";

interface Foto {
  id: string;
  url: string;
  categoria: Categoria;
  descripcion: string | null;
  createdAt: string;
}

interface Props {
  vehiculoId: string;
  fotosIniciales: Foto[];
  puedeSubir: boolean;
}

// ─── Config de slots ──────────────────────────────────────────────

const SLOTS: { categoria: Categoria; label: string; icon: string }[] = [
  { categoria: "frontal",     label: "Vista frontal",  icon: "↑" },
  { categoria: "posterior",   label: "Vista trasera",  icon: "↓" },
  { categoria: "lateral_der", label: "Lado derecho",   icon: "→" },
  { categoria: "lateral_izq", label: "Lado izquierdo", icon: "←" },
  { categoria: "cabina",      label: "Cabina / Interior", icon: "●" },
  { categoria: "odometro",    label: "Odómetro",       icon: "◎" },
];

// ─── Componente ───────────────────────────────────────────────────

export function FotosPanel({ vehiculoId, fotosIniciales, puedeSubir }: Props) {
  const [fotos, setFotos] = useState<Foto[]>(fotosIniciales);
  const [lightbox, setLightbox] = useState<number | null>(null); // índice en `todasParaLightbox`
  const [subiendoCat, setSubiendoCat] = useState<Categoria | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const categoriaPendiente = useRef<Categoria>("otro");

  // Fotos planas para el lightbox (slots primero, luego extras)
  const slotFotos = SLOTS.map((s) => fotos.find((f) => f.categoria === s.categoria) ?? null);
  const extraFotos = fotos.filter((f) => f.categoria === "otro");
  const todasParaLightbox: Foto[] = [
    ...slotFotos.filter((f): f is Foto => f !== null),
    ...extraFotos,
  ];

  const abrirInput = useCallback((categoria: Categoria) => {
    if (!puedeSubir) return;
    categoriaPendiente.current = categoria;
    inputRef.current?.click();
  }, [puedeSubir]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const categoria = categoriaPendiente.current;

    setError(null);
    setSubiendoCat(categoria);

    try {
      const form = new FormData();
      form.append("archivo", archivo);
      form.append("categoria", categoria);

      const res = await fetch(`/api/vehiculos/${vehiculoId}/fotos`, {
        method: "POST",
        body: form,
      });

      const json = await res.json() as Foto & { error?: string };

      if (!res.ok) {
        setError(json.error ?? "Error al subir foto");
        return;
      }

      // Reemplaza o agrega
      if (categoria !== "otro") {
        setFotos((prev) => {
          const sin = prev.filter((f) => f.categoria !== categoria);
          return [...sin, json];
        });
      } else {
        setFotos((prev) => [...prev, json]);
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSubiendoCat(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleEliminar(fotoId: string) {
    setEliminandoId(fotoId);
    setError(null);
    try {
      const res = await fetch(`/api/fotos/${fotoId}`, { method: "DELETE" });
      if (res.ok) {
        setFotos((prev) => prev.filter((f) => f.id !== fotoId));
        if (lightbox !== null) setLightbox(null);
      } else {
        const json = await res.json() as { error?: string };
        setError(json.error ?? "Error al eliminar");
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setEliminandoId(null);
    }
  }

  function navLightbox(dir: 1 | -1) {
    if (lightbox === null) return;
    const next = (lightbox + dir + todasParaLightbox.length) % todasParaLightbox.length;
    setLightbox(next);
  }

  const totalFotos = fotos.length;
  const totalSlotsCubiertos = SLOTS.filter((s) => fotos.some((f) => f.categoria === s.categoria)).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Camera size={16} className="text-sky-600" />
          <h2 className="font-semibold text-sm">Evidencia fotográfica</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {totalSlotsCubiertos}/6 vistas · {totalFotos} fotos
          </span>
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Grid de slots fijos */}
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
        {SLOTS.map((slot) => {
          const foto = fotos.find((f) => f.categoria === slot.categoria) ?? null;
          const cargando = subiendoCat === slot.categoria;
          const lightboxIdx = todasParaLightbox.findIndex((f) => f.id === foto?.id);

          return (
            <SlotCard
              key={slot.categoria}
              label={slot.label}
              foto={foto}
              cargando={cargando}
              eliminandoId={eliminandoId}
              puedeSubir={puedeSubir}
              onVerFoto={() => lightboxIdx >= 0 && setLightbox(lightboxIdx)}
              onSubir={() => abrirInput(slot.categoria)}
              onEliminar={handleEliminar}
            />
          );
        })}
      </div>

      {/* Sección "Otras vistas" */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Otras vistas
          </p>
          {puedeSubir && (
            <button
              type="button"
              onClick={() => abrirInput("otro")}
              disabled={subiendoCat === "otro"}
              className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
            >
              {subiendoCat === "otro" ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <span>+ Agregar foto extra</span>
              )}
            </button>
          )}
        </div>

        {extraFotos.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Sin fotos adicionales.</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {extraFotos.map((foto) => {
              const lightboxIdx = todasParaLightbox.findIndex((f) => f.id === foto.id);
              return (
                <div
                  key={foto.id}
                  className="group relative aspect-square rounded-lg overflow-hidden border bg-muted cursor-pointer"
                  onClick={() => setLightbox(lightboxIdx)}
                >
                  <Image
                    src={foto.url}
                    alt="Vista extra"
                    fill
                    className="object-cover"
                    unoptimized
                    sizes="10vw"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLightbox(lightboxIdx); }}
                      className="p-1 rounded-full bg-white/90"
                    >
                      <ZoomIn size={12} className="text-gray-800" />
                    </button>
                    {puedeSubir && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleEliminar(foto.id); }}
                        disabled={eliminandoId === foto.id}
                        className="p-1 rounded-full bg-white/90"
                      >
                        {eliminandoId === foto.id
                          ? <Loader2 size={12} className="text-red-600 animate-spin" />
                          : <X size={12} className="text-red-600" />}
                      </button>
                    )}
                  </div>
                  {foto.descripcion && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 px-1.5 py-1">
                      <p className="text-white text-[9px] truncate">{foto.descripcion}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Input oculto */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      {/* Lightbox */}
      {lightbox !== null && todasParaLightbox[lightbox] && (
        <Lightbox
          foto={todasParaLightbox[lightbox]}
          total={todasParaLightbox.length}
          idx={lightbox}
          puedeEliminar={puedeSubir}
          eliminandoId={eliminandoId}
          onClose={() => setLightbox(null)}
          onPrev={() => navLightbox(-1)}
          onNext={() => navLightbox(1)}
          onEliminar={handleEliminar}
        />
      )}
    </div>
  );
}

// ─── SlotCard ─────────────────────────────────────────────────────

function SlotCard({
  label, foto, cargando, eliminandoId, puedeSubir,
  onVerFoto, onSubir, onEliminar,
}: {
  label: string;
  foto: Foto | null;
  cargando: boolean;
  eliminandoId: string | null;
  puedeSubir: boolean;
  onVerFoto: () => void;
  onSubir: () => void;
  onEliminar: (id: string) => void;
}) {
  const estaEliminando = foto ? eliminandoId === foto.id : false;

  if (cargando) {
    return (
      <div className="aspect-[4/3] rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-2">
        <Loader2 size={20} className="text-primary animate-spin" />
        <p className="text-[10px] text-primary font-medium">Subiendo...</p>
      </div>
    );
  }

  if (!foto) {
    return (
      <button
        type="button"
        onClick={puedeSubir ? onSubir : undefined}
        disabled={!puedeSubir}
        className={`aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all
          ${puedeSubir
            ? "border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer group"
            : "border-border/50 bg-muted/30 cursor-default"
          }`}
      >
        {puedeSubir ? (
          <Camera size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
        ) : (
          <ImageOff size={16} className="text-muted-foreground/50" />
        )}
        <p className={`text-[10px] text-center px-1 leading-tight font-medium
          ${puedeSubir ? "text-muted-foreground group-hover:text-primary" : "text-muted-foreground/50"}`}>
          {label}
        </p>
      </button>
    );
  }

  return (
    <div className="group relative aspect-[4/3] rounded-xl overflow-hidden border bg-muted shadow-sm cursor-pointer"
      onClick={onVerFoto}
    >
      <Image
        src={foto.url}
        alt={label}
        fill
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        unoptimized
        sizes="(max-width: 640px) 33vw, 16vw"
      />

      {/* Label en parte inferior */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2">
        <p className="text-white text-[10px] font-medium truncate">{label}</p>
      </div>

      {/* Overlay de acciones */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onVerFoto(); }}
          className="p-1.5 rounded-full bg-white/90 hover:bg-white transition-colors shadow"
          title="Ver"
        >
          <ZoomIn size={13} className="text-gray-800" />
        </button>
        {puedeSubir && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSubir(); }}
              className="p-1.5 rounded-full bg-white/90 hover:bg-white transition-colors shadow"
              title="Reemplazar"
            >
              <RotateCcw size={13} className="text-blue-600" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEliminar(foto.id); }}
              disabled={estaEliminando}
              className="p-1.5 rounded-full bg-white/90 hover:bg-white transition-colors shadow"
              title="Eliminar"
            >
              {estaEliminando
                ? <Loader2 size={13} className="text-red-600 animate-spin" />
                : <X size={13} className="text-red-600" />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────

function Lightbox({
  foto, total, idx, puedeEliminar, eliminandoId,
  onClose, onPrev, onNext, onEliminar,
}: {
  foto: Foto;
  total: number;
  idx: number;
  puedeEliminar: boolean;
  eliminandoId: string | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onEliminar: (id: string) => void;
}) {
  const LABEL_MAP: Record<Categoria, string> = {
    frontal: "Vista frontal", posterior: "Vista trasera",
    lateral_der: "Lado derecho", lateral_izq: "Lado izquierdo",
    cabina: "Cabina / Interior", odometro: "Odómetro", otro: "Extra",
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white/60 text-sm font-medium">
          {LABEL_MAP[foto.categoria]}
          {foto.descripcion && <span className="ml-2 text-white/40">— {foto.descripcion}</span>}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">{idx + 1} / {total}</span>
          {puedeEliminar && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300 hover:bg-red-900/30 h-8"
              onClick={() => onEliminar(foto.id)}
              disabled={eliminandoId === foto.id}
            >
              {eliminandoId === foto.id
                ? <Loader2 size={14} className="animate-spin" />
                : <X size={14} />}
              <span className="ml-1 text-xs">Eliminar</span>
            </Button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Foto principal */}
      <div
        className="flex-1 relative flex items-center justify-center px-12 min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={foto.url}
          alt={LABEL_MAP[foto.categoria]}
          fill
          className="object-contain"
          unoptimized
        />
      </div>

      {/* Navegación */}
      {total > 1 && (
        <div
          className="flex items-center justify-center gap-4 py-4 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onPrev}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? "w-6 bg-white" : "w-1.5 bg-white/30"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onNext}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
