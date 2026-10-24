// Registro de módulo de los coordinadores de vista previa (U6, QA de CCSS 2026-10-24).
//
// Vivían en un `useRef` de `usePreviewLamina` y se perdían al desmontar el visor (cambiar de pestaña, abrir el
// Inspector modal): «Previsualizar» volvía a dibujar cada lámina, ~20 s, aunque ya estuviera dibujada. Aquí viven por
// ámbito (sesión y alcance del informe) y por lámina, y comparten una caché de respuestas por la clave de la lámina y
// del plan (`clavePreview`), con tope, para que volver a una versión anterior (deshacer) tampoco pida otra vuelta.
// Puro salvo el reloj del coordinador; quien lo usa decide cuándo olvidar (cambio de base, de datos o de sesión).

import type { PreviewSlideResponse } from "../../../api/graficos";
import type { CachePreview, crearCoordinadorPreviewLamina } from "../previewLaminaCoordinador";

type Coordinador = ReturnType<typeof crearCoordinadorPreviewLamina>;

/** Tope de respuestas guardadas: cada una trae las imágenes de la lámina en base64. */
export const MAX_RESPUESTAS_PREVIEW = 48;

export function crearRegistroPreviewLaminas(
  fabricar: (slideId: string, cache: CachePreview) => Coordinador,
  max = MAX_RESPUESTAS_PREVIEW,
) {
  const coordinadores = new Map<string, Coordinador>();
  const respuestas = new Map<string, PreviewSlideResponse>();   // orden de inserción = de uso (LRU)
  let ambitoActual: string | null = null;

  const cache: CachePreview = {
    leer(clave) {
      const r = respuestas.get(clave);
      if (r) { respuestas.delete(clave); respuestas.set(clave, r); }
      return r;
    },
    guardar(clave, respuesta) {
      respuestas.delete(clave);
      respuestas.set(clave, respuesta);
      while (respuestas.size > max) respuestas.delete(respuestas.keys().next().value as string);
    },
    descartar(clave) { respuestas.delete(clave); },
  };

  function olvidar() {
    for (const c of coordinadores.values()) c.cancelar();
    coordinadores.clear();
    respuestas.clear();
  }

  return {
    /** El coordinador de `slideId` en `ambito`; otro ámbito (proyecto, sesión, alcance) empieza de cero. */
    coordinador(ambito: string, slideId: string): Coordinador {
      if (ambito !== ambitoActual) { olvidar(); ambitoActual = ambito; }
      let c = coordinadores.get(slideId);
      if (!c) { c = fabricar(slideId, cache); coordinadores.set(slideId, c); }
      return c;
    },
    olvidar,
  };
}
