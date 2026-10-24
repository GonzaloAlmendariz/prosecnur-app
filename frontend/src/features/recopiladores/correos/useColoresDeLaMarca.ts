// useColoresDeLaMarca.ts — los colores del banner o del logo para la paleta del
// correo (GOAL editor profesional, L3). La imagen es la primera de la cabecera:
// el banner, o el primer logo de la franja. Se lee la que ya se ve (recién
// subida, la de la vista previa o su URL), con useColoresDelBanner.

import type { MailTemplate } from "../../../api/materialMail";
import { srcDeImagenDelBloque } from "./estructuraCorreo";
import { CABECERA } from "./modeloCorreo";
import { useColoresDelBanner } from "./useColoresDelBanner";

/** El id de la imagen de la cabecera de la que salen los colores de la marca. */
export function imagenDeLaMarca(template: Pick<MailTemplate, "header">): string | null {
  const h = template.header;
  return h.kind === "banner" ? h.image_ref : h.logo_ids[0] ?? null;
}

export function useColoresDeLaMarca(
  template: Pick<MailTemplate, "header" | "images"> | null | undefined,
  imagenesLocales: Readonly<Record<string, string>>,
  htmlDeLaVista: string | null | undefined,
): string[] {
  const id = template ? imagenDeLaMarca(template) : null;
  const src = template && id ? imagenesLocales[id] ?? srcDeImagenDelBloque(htmlDeLaVista, CABECERA) ?? template.images[id]?.url ?? null : null;
  const leidos = useColoresDelBanner(src);
  return leidos.estado === "listo" ? leidos.colores : [];
}
