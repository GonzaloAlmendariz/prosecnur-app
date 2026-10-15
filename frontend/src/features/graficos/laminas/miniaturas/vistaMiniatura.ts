// Qué dibuja cada miniatura de la tira (pura; la pinta `ContenidoMiniatura.tsx`). Tests en vistaMiniatura.test.ts.

import type { EntradaMiniatura } from "./loteMiniaturas";

export type VistaMiniatura = "imagen" | "actualizando" | "esqueleto" | "composicion" | "sin_datos" | "error" | "ficha";

/** Qué se dibuja: decide entre la entrada del lote y la imagen que dejó la vista previa de la lámina activa. */
export function vistaDeMiniatura(entrada: EntradaMiniatura | undefined, imagenPreview: string | undefined): { vista: VistaMiniatura; src: string | null } {
  if (!entrada) return imagenPreview ? { vista: "imagen", src: imagenPreview } : { vista: "ficha", src: null };
  switch (entrada.estado) {
    case "ok": return entrada.src ? { vista: "imagen", src: entrada.src } : { vista: "composicion", src: null };
    case "sin_datos": return { vista: "sin_datos", src: entrada.src };
    case "sin_imagen": return { vista: "composicion", src: null };
    case "error": return { vista: "error", src: null };
    case "pendiente": {
      const previa = entrada.anterior ?? imagenPreview ?? null;
      return previa ? { vista: "actualizando", src: previa } : { vista: "esqueleto", src: null };
    }
  }
}

/** Sufijo del nombre accesible: el estado se oye, no sólo se ve. */
export function rotuloEstado(vista: VistaMiniatura): string {
  switch (vista) {
    case "actualizando": return ", actualizando miniatura";
    case "esqueleto": return ", dibujando miniatura";
    case "sin_datos": return ", sin datos";
    case "error": return ", no se pudo dibujar la miniatura";
    default: return "";
  }
}
