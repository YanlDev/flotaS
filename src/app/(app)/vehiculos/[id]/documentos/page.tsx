import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/get-profile";
import { getSignedDownloadUrl } from "@/lib/wasabi";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DocumentosPanel } from "./_components/documentos-panel";

export default async function DocumentosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const { id } = await params;

  const vehiculo = await prisma.vehiculo.findUnique({
    where: { id },
    include: { sucursal: { select: { nombre: true, ciudad: true } } },
  });

  if (!vehiculo) notFound();

  if (profile.rol === "jefe_sucursal" && vehiculo.sucursalId !== profile.sucursalId) {
    redirect("/vehiculos");
  }

  const documentos = await prisma.documentoVehicular.findMany({
    where: { vehiculoId: id },
    orderBy: { createdAt: "desc" },
    include: { subidor: { select: { nombreCompleto: true } } },
  });

  // Serializar + generar signed URLs
  const docsSerializados = await Promise.all(
    documentos.map(async (doc) => ({
      id: doc.id,
      tipo: doc.tipo,
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
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Documentos</h1>
          <p className="text-muted-foreground text-sm mt-0.5 font-mono">{vehiculo.placa}</p>
        </div>
        <Link href={`/vehiculos/${id}`}>
          <Button variant="outline" size="sm">← Volver</Button>
        </Link>
      </div>

      <DocumentosPanel
        vehiculoId={id}
        documentos={docsSerializados}
        puedeGestionar={puedeGestionar}
      />
    </div>
  );
}
