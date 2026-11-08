// Qué muestra el visor mientras la vista previa del motor va y viene (auditoría de Arte, hallazgo 7). Con «Previsualizar»
// activo, cada cambio de args pide otra imagen (el coordinador espera 600 ms a que el analista deje de cambiar y corta la
// anterior, previewLaminaCoordinador.ts). Mientras llega, la última imagen buena se queda NÍTIDA con un chip
// «Actualizando»; un error se dice sin borrarla. Nada de desenfocar la hoja: el analista sigue leyendo la lámina.

import type { EstadoPreviewLamina } from "../previewLaminaCoordinador";

export type EntradaPresentacion = {
  /** «Previsualizar» activo. */
  verComoQueda: boolean;
  /** Dato obligatorio pendiente (faltaLamina.ts): sin dibujo, queda la maqueta. */
  falta: string | null;
  fase: EstadoPreviewLamina["estado"];
  /** La imagen del motor para la parte que se mira: la vigente o, mientras llega otra, la anterior de esta lámina. */
  imagenMotor: string | null;
  /** La que el lote de miniaturas ya dibujó en segundo plano. */
  imagenLote: string | null;
  error: string | null;
};

export type PresentacionPreview = {
  /** La imagen que se pinta; `null` deja la maqueta. */
  src: string | null;
  /** Hay imagen y está llegando otra: se conserva nítida con el chip «Actualizando». */
  actualizando: boolean;
  /** No hay imagen todavía y el motor dibuja la primera: aviso «Dibujando la lámina…» sobre la maqueta. */
  dibujandoPrimera: boolean;
  /** El motor falló: se avisa; si había imagen, sigue a la vista. */
  error: string | null;
};

const enCurso = (fase: EstadoPreviewLamina["estado"]) => fase === "esperando" || fase === "cargando";

export function presentacionPreview(e: EntradaPresentacion): PresentacionPreview {
  const activa = e.verComoQueda && !e.falta;
  const src = activa ? e.imagenMotor ?? e.imagenLote : null;
  return {
    src,
    actualizando: activa && enCurso(e.fase) && src !== null,
    dibujandoPrimera: activa && enCurso(e.fase) && src === null,
    error: activa ? e.error : null,
  };
}
