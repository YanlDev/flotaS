"use client";

import { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Sucursal {
  id: string;
  nombre: string;
  ciudad: string;
}

interface VehiculoOpt {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
}

interface Props {
  sucursales: Sucursal[];
  vehiculosDisponibles: VehiculoOpt[];
  rol: string;
}

const CATEGORIAS_LICENCIA = ["A1", "A2a", "A2b", "A3a", "A3b", "A3c", "B", "B2C", "C", "D", "E"];

export function RegistroConductorModal({ sucursales, vehiculosDisponibles, rol }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucursalId, setSucursalId] = useState<string | null>(null);
  const [vehiculoId, setVehiculoId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  
  const [step, setStep] = useState(1);

  const nextStep = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (step < 2) setStep(step + 1);
  };
  
  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {
      sucursalId,
      vehiculoId,
      licenciaCategoria: categoria,
      nombreCompleto: form.get("nombreCompleto"),
      dni: form.get("dni"),
      telefono: form.get("telefono") || undefined,
      email: form.get("email") || undefined,
      licenciaNumero: form.get("licenciaNumero") || undefined,
      licenciaVencimiento: form.get("licenciaVencimiento") || undefined,
    };

    try {
      const res = await fetch("/api/conductores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json() as { error?: string; id?: string };

      if (!res.ok) {
        setError(json.error ?? "Error al registrar el conductor");
        return;
      }

      setOpen(false);
      setStep(1);
      setSucursalId(null);
      setVehiculoId(null);
      setCategoria(null);
      router.push(`/conductores/${json.id}`);
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Botón externo — sin DialogTrigger asChild (no funciona en esta versión de shadcn) */}
      <Button onClick={() => setOpen(true)} size="sm" className="gap-2 shrink-0">
        <Plus size={16} />
        Registrar conductor
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle>Registrar conductor</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Paso {step} de 2 — Completa los campos del conductor.
          </p>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-colors ${
                step >= i ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto pr-2 pb-2">
            
            {/* PASO 1 : Personales */}
            <div className={step === 1 ? "block space-y-6 animate-in slide-in-from-right-4 duration-300" : "hidden"}>
              {rol === "admin" && (
                <Section title="Ubicación">
                  <Field label="Sucursal *">
                    <Select value={sucursalId} onValueChange={setSucursalId} required={step === 1}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una sucursal" />
                      </SelectTrigger>
                      <SelectContent>
                        {sucursales.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nombre} — {s.ciudad}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </Section>
              )}

              <Section title="Datos personales">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="DNI *">
                    <Input name="dni" placeholder="12345678" required={step === 1} maxLength={15} />
                  </Field>
                  <Field label="Nombre completo *">
                    <Input name="nombreCompleto" placeholder="Juan Pérez" required={step === 1} className="uppercase" />
                  </Field>
                  <Field label="Teléfono">
                    <Input name="telefono" placeholder="987654321" />
                  </Field>
                  <Field label="Correo electrónico">
                    <Input name="email" type="email" placeholder="correo@ejemplo.com" />
                  </Field>
                </div>
              </Section>
            </div>

            {/* PASO 2 : Licencia y Vehículo */}
            <div className={step === 2 ? "block space-y-6 animate-in slide-in-from-right-4 duration-300" : "hidden"}>
              <Section title="Licencia de Conducir">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Categoría *">
                    <Select value={categoria} onValueChange={setCategoria} required={step === 2}>
                      <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS_LICENCIA.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Número de licencia">
                    <Input name="licenciaNumero" placeholder="Q12345678" />
                  </Field>
                  <Field label="Fecha de vencimiento">
                    <Input name="licenciaVencimiento" type="date" />
                  </Field>
                </div>
              </Section>

              <Section title="Asignación (Opcional)">
                <Field label="Vehículo asignado">
                  <Select value={vehiculoId} onValueChange={setVehiculoId}>
                    <SelectTrigger><SelectValue placeholder="Sin vehículo asignado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignación</SelectItem>
                      {vehiculosDisponibles.map((v) => (
                         <SelectItem key={v.id} value={v.id}>
                           {v.placa} — {v.marca} {v.modelo}
                         </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Solo aparecen los vehículos que no tienen conductor actualmente.
                  </p>
                </Field>
              </Section>
            </div>

          </div>

          {error && <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg font-medium">{error}</p>}

          <div className="pt-4 border-t flex justify-between gap-3 mt-auto">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={prevStep} disabled={loading}>
                <ChevronLeft size={16} className="mr-1" />
                Atrás
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
                Cancelar
              </Button>
            )}

            {step < 2 ? (
              <Button type="button" onClick={nextStep} disabled={loading}>
                Continuar
                <ChevronRight size={16} className="ml-1" />
              </Button>
            ) : (
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? "Registrando..." : (
                  <>
                    <Check size={16} />
                    Finalizar Registro
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-base">{title}</h2>
        <Separator className="mt-1" />
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-xs text-muted-foreground font-medium">{label}</Label>
      {children}
    </div>
  );
}
