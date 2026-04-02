import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { getSignedDownloadUrl } from "@/lib/wasabi";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DocumentosConductorPanel } from "./_components/documentos-conductor-panel";
import { ChevronRight, User } from "lucide-react";

export default async function DocumentosConductorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.rol === "comercial") redirect("/proveedores");

  const { id } = await params;

  const conductor = await prisma.conductor.findUnique({
    where: { id },
    include: { sucursal: { select: { nombre: true } } },
  });

  if (!conductor) notFound();

  if (profile.rol === "jefe_sucursal" && conductor.sucursalId !== profile.sucursalId) {
    redirect("/conductores");
  }

  const documentos = await prisma.documentoConductor.findMany({
    where: { conductorId: id },
    orderBy: { createdAt: "desc" },
    include: { subidor: { select: { nombreCompleto: true } } },
  });

  // Serializar + generar signed URLs
  const docsSerializados = await Promise.all(
    documentos.map(async (doc) => ({
      id: doc.id,
      nombre: doc.nombre,
      mimeType: doc.mimeType,
      tamanoBytes: doc.tamanoBytes,
      vencimiento: doc.vencimiento ? doc.vencimiento.toISOString().split("T")[0] : null,
      subidoPor: doc.subidor?.nombreCompleto ?? null,
      createdAt: doc.createdAt.toISOString(),
      downloadUrl: await getSignedDownloadUrl(doc.archivoKey, 3600),
    }))
  );

  const puedeGestionar = profile.rol !== "visor";

  return (
    <div className="space-y-5 max-w-4xl mx-auto">

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/conductores/${id}`}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2">
              <ChevronRight size={14} className="rotate-180" />
              Volver
            </Button>
          </Link>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <User size={16} />
            </div>
            <div>
              <h1 className="font-bold text-xl leading-none">Documentos</h1>
              <p className="text-xs text-muted-foreground mt-0.5 font-semibold">
                {conductor.nombreCompleto}
              </p>
            </div>
          </div>
        </div>
      </div>

      <DocumentosConductorPanel
        conductorId={id}
        documentos={docsSerializados}
        puedeGestionar={puedeGestionar}
      />
    </div>
  );
}
