// reduccionDeImagen.ts — lo que se dice de una imagen que el backend redujo al
// subirla (2026-10-22). Desde entonces una imagen más ancha que 1.200 px o más
// pesada que 1 MB no se rechaza: se reduce y la respuesta trae `reduccion`.

import type { MailCheck, MailImageReduccion } from "../../../api/materialMail";

/** `"1200×675"` → `"1200 × 675"`: el signo de multiplicar con espacios. */
export function medidaLegible(medida: string): string {
  return medida.trim().replace(/\s*[×xX]\s*/, " × ");
}

export type LineaDeReduccion = {
  texto: string;
  /** Lo que el backend avisa además (p. ej. que el PNG salió JPEG), tal cual. */
  aviso: string | null;
};

/** La línea que va junto a la imagen; `null` si no se redujo o no se sabe a cuánto. */
export function lineaDeReduccion(reduccion: MailImageReduccion | null | undefined): LineaDeReduccion | null {
  if (!reduccion?.reducida || !reduccion.a.trim()) return null;
  return {
    texto: `La reducimos a ${medidaLegible(reduccion.a)} para el correo.`,
    aviso: reduccion.aviso,
  };
}

/**
 * La medida del banner que se muestra en su tarjeta: la real guardada, una sola
 * vez. Si la línea de reducción ya la dice, `null`; si no, la que midió la
 * revisión (`banner_size` trae «1200×675» en `value`). Sin medida, `null`: no
 * se inventa la pedida al cliente.
 */
export function medidaDelBanner(
  check: Pick<MailCheck, "value"> | null | undefined,
  reduccion: MailImageReduccion | null | undefined,
): string | null {
  if (lineaDeReduccion(reduccion)) return null;
  const valor = typeof check?.value === "string" ? check.value : "";
  return /^\s*\d+\s*[×xX]\s*\d+\s*$/.test(valor) ? `${medidaLegible(valor)} px` : null;
}

/** La línea del chequeo del banner sólo si dice algo además de la medida: un `ok` es la medida. */
export function chequeoDelBannerVisible(check: Pick<MailCheck, "status"> | null | undefined): boolean {
  return Boolean(check && check.status !== "ok");
}
