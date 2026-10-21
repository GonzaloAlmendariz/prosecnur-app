// useColoresDelBanner.ts — los colores que más pesan en el banner (E1n).
//
// Se leen en el cliente con un canvas pequeño sobre la imagen que ya se ve
// (blob recién subido, la de la vista previa o la URL pública). Una imagen de
// otro origen sin CORS deja el canvas «manchado» y `getImageData` lanza: en
// ese caso, y sin banner, no hay sugerencias y sólo queda el acento.

import { useEffect, useState } from "react";

import { coloresDominantes } from "./modeloEstilo";

export type ColoresDelBanner =
  | { estado: "sin-banner" }
  | { estado: "leyendo" }
  | { estado: "listo"; colores: string[] }
  | { estado: "ilegible" };

/** Lado mayor del canvas: sobra para tres colores y no pesa. */
const LADO = 64;

export function useColoresDelBanner(src: string | null | undefined): ColoresDelBanner {
  const [leido, setLeido] = useState<{ src: string; resultado: ColoresDelBanner } | null>(null);

  useEffect(() => {
    if (!src || typeof Image === "undefined" || typeof document === "undefined") return;
    let vigente = true;
    const img = new Image();
    if (!/^(data|blob):/i.test(src)) img.crossOrigin = "anonymous";
    const terminar = (resultado: ColoresDelBanner) => { if (vigente) setLeido({ src, resultado }); };
    img.onload = () => {
      try {
        const escala = LADO / Math.max(img.naturalWidth || 1, img.naturalHeight || 1);
        const w = Math.max(1, Math.round((img.naturalWidth || 1) * escala));
        const h = Math.max(1, Math.round((img.naturalHeight || 1) * escala));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return terminar({ estado: "ilegible" });
        ctx.drawImage(img, 0, 0, w, h);
        const colores = coloresDominantes(ctx.getImageData(0, 0, w, h).data);
        terminar(colores.length ? { estado: "listo", colores } : { estado: "ilegible" });
      } catch {
        // Canvas manchado por una imagen de otro origen: no se puede leer.
        terminar({ estado: "ilegible" });
      }
    };
    img.onerror = () => terminar({ estado: "ilegible" });
    img.src = src;
    return () => { vigente = false; };
  }, [src]);

  if (!src) return { estado: "sin-banner" };
  return leido?.src === src ? leido.resultado : { estado: "leyendo" };
}
