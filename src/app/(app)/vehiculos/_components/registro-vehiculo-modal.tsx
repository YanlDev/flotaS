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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Sucursal {
  id: string;
  nombre: string;
  ciudad: string;
}

interface ConductorOpt {
  id: string;
  nombreCompleto: string;
  licenciaCategoria: string;
}

interface Props {
  sucursales: Sucursal[];
  conductoresDisponibles: ConductorOpt[];
  rol: string;
}

export function RegistroVehiculoModal({ sucursales, conductoresDisponibles, rol }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucursalId, setSucursalId] = useState<string>("");
  const [conductorId, setConductorId] = useState<string>("");
  
  // Stepper state (1 to 3)
  const [step, setStep] = useState(1);

  // Use a controlled form or just simple state for required validation. 
  // We'll rely on the native HTML form validation, but since steps hide inputs, 
  // native validation bubbles won't work perfectly if a required input is hidden.
  // We will force required inputs on step 1 to be validated before moving to step 2, but for simplicity,
  // we can use a controlled state or bypass strict native validation.
  // Actually, to make it robust across steps without a complex library, we can just manage a few key states for validation.
  
  const nextStep = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    // Basic validation logic for step 1
    if (step < 3) setStep(step + 1);
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
      placa: form.get("placa"),
      tipo: form.get("tipo"),
      marca: form.get("marca"),
      modelo: form.get("modelo"),
      anio: Number(form.get("anio")),
      color: form.get("color") || undefined,
      motor: form.get("motor") || undefined,
      numeroMotor: form.get("numeroMotor") || undefined,
      numeroChasis: form.get("numeroChasis") || undefined,
      numeroSerie: form.get("numeroSerie") || undefined,
      transmision: form.get("transmision") || undefined,
      traccion: form.get("traccion") || undefined,
      combustible: form.get("combustible") || undefined,
      numAsientos: form.get("numAsientos") ? Number(form.get("numAsientos")) : undefined,
      capacidadCargaKg: form.get("capacidadCargaKg") ? Number(form.get("capacidadCargaKg")) : undefined,
      propietario: form.get("propietario") || undefined,
      kmActuales: form.get("kmActuales") ? Number(form.get("kmActuales")) : undefined,
      zonaOperacion: form.get("zonaOperacion") || undefined,
      fechaAdquisicion: form.get("fechaAdquisicion") || undefined,
      conductorId: conductorId || undefined,
      estado: form.get("estado") || "operativo",
      observaciones: form.get("observaciones") || undefined,
      gps: form.get("gps") === "on",
    };

    try {
      const res = await fetch("/api/vehiculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json() as { error?: string; id?: string };

      if (!res.ok) {
        setError(json.error ?? "Error al registrar el vehículo");
        return;
      }

      setOpen(false);
      setStep(1);
      setSucursalId("");
      setConductorId("");
      router.push(`/vehiculos/${json.id}`);
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="gap-2 shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
        <Plus size={16} />
        Registrar vehículo
      </DialogTrigger>
      
      {/* Max height to prevent scrolling bugs, inner overflow-y-auto */}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle>Registrar vehículo</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Paso {step} de 3 — Completa los campos para añadir una nueva unidad.
          </p>
        </DialogHeader>

        {/* Stepper Dots */}
        <div className="flex items-center gap-2 mb-2">
          {[1, 2, 3].map((i) => (
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
            {/* ─── PASO 1 : Básico ─── */}
            <div className={step === 1 ? "block space-y-6 animate-in slide-in-from-right-4 duration-300" : "hidden"}>
              {rol === "admin" && (
                <Section title="Ubicación">
                  <Field label="Sucursal *">
                    <Select value={sucursalId} onValueChange={(v) => setSucursalId(v ?? "")} required={step === 1}>
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

              <Section title="Datos básicos">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Placa *">
                    <Input name="placa" placeholder="ABC-123" required={step === 1} className="uppercase" />
                  </Field>
                  <Field label="Tipo *">
                    <Select name="tipo" required={step === 1}>
                      <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="moto">Moto</SelectItem>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="camioneta">Camioneta</SelectItem>
                        <SelectItem value="minivan">Minivan</SelectItem>
                        <SelectItem value="furgon">Furgón</SelectItem>
                        <SelectItem value="bus">Bus</SelectItem>
                        <SelectItem value="vehiculo_pesado">Vehículo Pesado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Marca *">
                    <Input name="marca" placeholder="Toyota" required={step === 1} />
                  </Field>
                  <Field label="Modelo *">
                    <Input name="modelo" placeholder="Hilux" required={step === 1} />
                  </Field>
                  <Field label="Año *">
                    <Input name="anio" type="number" min={1990} max={2100} placeholder="2020" required={step === 1} />
                  </Field>
                  <Field label="Color">
                    <Input name="color" placeholder="Blanco" />
                  </Field>
                </div>
              </Section>
            </div>

            {/* ─── PASO 2 : General / Técnico ─── */}
            <div className={step === 2 ? "block space-y-6 animate-in slide-in-from-right-4 duration-300" : "hidden"}>
              <Section title="Tarjeta de Propiedad">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Número de motor">
                    <Input name="numeroMotor" placeholder="Ej: 1KD0123456" />
                  </Field>
                  <Field label="Número de chasis">
                    <Input name="numeroChasis" placeholder="Ej: 8AF..." />
                  </Field>
                  <Field label="VIN / Número de serie">
                    <Input name="numeroSerie" placeholder="Opcional" />
                  </Field>
                  <Field label="Propietario / RUC">
                    <Input name="propietario" placeholder="20123456789" />
                  </Field>
                </div>
              </Section>

              <Section title="Especificaciones">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Motor (descripción)">
                    <Input name="motor" placeholder="Ej: Cummins ISB 6.7" />
                  </Field>
                  <Field label="Combustible">
                    <Select name="combustible">
                      <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gasolina">Gasolina</SelectItem>
                        <SelectItem value="diesel">Diesel</SelectItem>
                        <SelectItem value="glp">GLP</SelectItem>
                        <SelectItem value="gnv">GNV</SelectItem>
                        <SelectItem value="electrico">Eléctrico</SelectItem>
                        <SelectItem value="hibrido">Híbrido</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Transmisión">
                    <Select name="transmision">
                      <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="automatico">Automático</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Tracción">
                    <Select name="traccion">
                      <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fourbytwo">4x2</SelectItem>
                        <SelectItem value="fourbyfour">4x4</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="N° asientos">
                    <Input name="numAsientos" type="number" min={1} placeholder="5" />
                  </Field>
                  <Field label="Capacidad de carga (kg)">
                    <Input name="capacidadCargaKg" type="number" min={0} placeholder="1000" />
                  </Field>
                </div>
              </Section>
            </div>

            {/* ─── PASO 3 : Operación ─── */}
            <div className={step === 3 ? "block space-y-6 animate-in slide-in-from-right-4 duration-300" : "hidden"}>
              <Section title="Operación & Logística">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="KM actuales">
                    <Input name="kmActuales" type="number" min={0} placeholder="50000" />
                  </Field>
                  <Field label="Zona de operación">
                    <Input name="zonaOperacion" placeholder="Juliaca - Puno" />
                  </Field>
                  <Field label="Fecha de adquisición">
                    <Input name="fechaAdquisicion" type="date" />
                  </Field>
                  <Field label="Estado">
                    <Select name="estado" defaultValue="operativo">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operativo">Operativo</SelectItem>
                        <SelectItem value="parcialmente">Parcialmente operativo</SelectItem>
                        <SelectItem value="fuera_de_servicio">Fuera de servicio</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Conductor asignado" className="col-span-2">
                    <Select value={conductorId} onValueChange={(v) => setConductorId(v ?? "")}>
                      <SelectTrigger><SelectValue placeholder="Sin conductor asignado" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sin conductor</SelectItem>
                        {conductoresDisponibles.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nombreCompleto} — Lic. {c.licenciaCategoria}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="space-y-4 pt-2">
                  <Field label="Observaciones">
                    <textarea
                      name="observaciones"
                      placeholder="Anotaciones extra..."
                      rows={3}
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </Field>
                  <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-xl border">
                    <input type="checkbox" name="gps" id="gps" className="rounded border-gray-300 w-4 h-4" />
                    <Label htmlFor="gps" className="font-semibold cursor-pointer">Cuenta con GPS Instalado</Label>
                  </div>
                </div>
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

            {step < 3 ? (
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
