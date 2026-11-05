// Deshacer por campo (H10 del checklist de usabilidad, 2026-11-05). Cada edición del plan apila un paso de deshacer
// (`dirty`, store.ts); escribir «Econ. y Fin.» eran doce pasos y un stepper, uno por clic. Las ediciones seguidas sobre
// el MISMO control, sin una pausa de más de `VENTANA_AGRUPAR_MS`, se agrupan en un solo paso: el primero guarda el estado
// de antes y los siguientes no apilan. El grupo se corta al salir del control (blur), al deshacer o rehacer, y al pasar
// la ventana. Nada se pierde: el estado nuevo es siempre el último; sólo cambia cuántos pasos hay que deshacer.
//
// El control en edición lo fija `useDeshacerPorCampo` (escucha el foco del documento); aquí no hay DOM.

export const VENTANA_AGRUPAR_MS = 600;

export type Agrupador = {
  /** El control que tiene el foco (cualquier identidad estable), o null si ninguno edita. */
  fijarCampo: (campo: object | null) => void;
  /** Se llama en cada edición deshacible: true si va en el mismo paso que la anterior. */
  agrupa: (ahora?: number) => boolean;
  /** La próxima edición abre paso propio (deshacer, rehacer, hidratar). */
  cortar: () => void;
};

export function crearAgrupador(ventanaMs = VENTANA_AGRUPAR_MS, reloj: () => number = Date.now): Agrupador {
  let campo: object | null = null;
  let ultimo: { campo: object; t: number } | null = null;
  return {
    fijarCampo: (c) => {
      if (c !== campo) ultimo = null;
      campo = c;
    },
    agrupa: (ahora = reloj()) => {
      const mismo = campo !== null && ultimo !== null && ultimo.campo === campo && ahora - ultimo.t < ventanaMs;
      ultimo = campo ? { campo, t: ahora } : null;
      return mismo;
    },
    cortar: () => {
      ultimo = null;
    },
  };
}

/** El agrupador del plan de Gráficos: uno por pestaña, como el store. */
export const agrupadorDelPlan = crearAgrupador();
