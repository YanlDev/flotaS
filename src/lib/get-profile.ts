import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// cache() deduplica la llamada dentro de un mismo request
export const getProfile = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.profile.findUnique({
    where: { id: user.id },
    include: { sucursal: { select: { id: true, nombre: true, ciudad: true } } },
  });
});
