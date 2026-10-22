// Cuánto mide el correo dentro del iframe de la vista previa.
//
// El iframe va con `scrolling="no"`: el scroll es del lienzo, así que su alto
// tiene que ser el del documento. Medirlo exige que el lienzo esté a la vista:
// con la pestaña oculta (`hidden`, display:none) el documento no tiene layout y
// `scrollHeight` sale 0. Si esa lectura se aplicaba, el iframe quedaba en el
// alto mínimo y el correo se cortaba al volver al editor (QA de Contactos,
// 2026-10-22: 319 px de 2.380). Por eso una medida tomada a oscuras queda
// pendiente y se aplica cuando el lienzo vuelve a tener ancho.

/** El alto con que nace el iframe y bajo el cual nunca baja. */
export const ALTO_MINIMO_DE_LA_HOJA = 320;

export type DocumentoMedible = {
  /** `null` mientras el iframe cambia de documento (el resize puede caer ahí). */
  documentElement: { scrollHeight: number; scrollWidth: number } | null;
  body?: { scrollWidth: number } | null;
};

export type MedidaDeLaHoja = { alto: number; ancho: number };

/** La medida del documento, o `null` si no se puede medir todavía (oculto o sin layout). */
export function medirLaHoja(doc: DocumentoMedible | null, anchoVisible: number): MedidaDeLaHoja | null {
  const raiz = doc?.documentElement ?? null;
  if (!doc || !raiz || !(anchoVisible > 0)) return null;
  const alto = raiz.scrollHeight;
  if (!(alto > 0)) return null;
  return {
    alto: Math.max(ALTO_MINIMO_DE_LA_HOJA, Math.ceil(alto)),
    ancho: Math.ceil(Math.max(raiz.scrollWidth, doc.body?.scrollWidth ?? 0)),
  };
}

export type MedidorDeLaHoja = {
  /** El iframe terminó de cargar un documento nuevo. */
  alCargar: () => void;
  /** El lienzo cambió de tamaño (incluido: pasó de oculto a visible). */
  alRedimensionar: () => void;
};

/**
 * Mide al cargar y vuelve a medir cuando el lienzo cambia de tamaño; aplica
 * solo lo que cambió, para no despertar a la capa de edición en cada resize.
 */
export function crearMedidorDeLaHoja(opciones: {
  doc: () => DocumentoMedible | null;
  anchoVisible: () => number;
  aplicar: (medida: MedidaDeLaHoja) => void;
}): MedidorDeLaHoja {
  let pendiente = false;
  let ultima: MedidaDeLaHoja | null = null;
  const medir = (forzar: boolean) => {
    const medida = medirLaHoja(opciones.doc(), opciones.anchoVisible());
    if (!medida) {
      if (forzar) pendiente = true;
      return;
    }
    const cambio = !ultima || ultima.alto !== medida.alto || ultima.ancho !== medida.ancho;
    if (!forzar && !pendiente && !cambio) return;
    pendiente = false;
    ultima = medida;
    opciones.aplicar(medida);
  };
  return {
    alCargar: () => medir(true),
    alRedimensionar: () => medir(false),
  };
}
