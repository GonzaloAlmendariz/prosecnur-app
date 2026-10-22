// reduccionDeImagen.ts — lo que se dice de una imagen que el backend redujo al
// subirla (2026-10-22). Desde entonces una imagen más ancha que 1.200 px o más
// pesada que 1 MB no se rechaza: se reduce y la respuesta trae `reduccion`.

import type { MailImageReduccion } from "../../../api/materialMail";

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
