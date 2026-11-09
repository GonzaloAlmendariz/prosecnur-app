import { create } from "zustand";
import type {
  DiferenciasInformeRespuesta,
  DiferenciasLaminaRespuesta,
  ReglaDiferencias,
} from "../../../../api/graficosDiferencias";
import type { CargaDiferencias, FiltroRevision } from "./modeloDiferencias";

// =============================================================================
// Estado UI efímero de «Diferencias entre grupos» (patrón de validacion/store.ts)
// =============================================================================
// El estado duro (la regla del estudio y las marcas) vive en el backend: la regla en `graficos_config$significancia`
// del .pulso y las marcas se recalculan allí. Aquí sólo queda:
//   - el par (y su ranura) elegido por lámina en «Por qué» y el filtro de la revisión en lote;
//   - la última respuesta de cada endpoint, para que el inspector, «Por qué» y la revisión no pidan lo mismo dos veces;
//   - `version`: sube al aplicar una regla y fuerza a todos a volver a pedir.
// La lámina elegida NO vive aquí: la dice `?foco=<slide.id>` (LaminasWorkbench).

export type EntradaLamina = {
  clave: string;
  carga: CargaDiferencias<DiferenciasLaminaRespuesta>;
  /** Se pidió con el plan sin guardar: el backend pudo leer la versión anterior y se vuelve a pedir al guardarse. */
  sucio: boolean;
};

type Estado = {
  /** Índice del par abierto en «Por qué», por lámina. */
  parElegido: Record<string, number>;
  /** La ranura de ese par (`grafico_2`…), por lámina: la del gráfico desde el que se abrió. */
  ranuraElegida: Record<string, string>;
  filtro: FiltroRevision;
  /** Respuesta de GET /api/graficos/diferencias?slide= por lámina, con la clave de lo que se pidió. */
  laminas: Record<string, EntradaLamina>;
  informe: CargaDiferencias<DiferenciasInformeRespuesta> | null;
  /** Regla en edición del diálogo; `null` = sin abrir (toma la guardada al abrir). */
  borrador: ReglaDiferencias | null;
  version: number;

  /** Sin `ranura`, conserva la elegida. */
  elegirPar: (slideId: string, indice: number, ranura?: string) => void;
  setFiltro: (f: FiltroRevision) => void;
  setCargaLamina: (slideId: string, entrada: EntradaLamina) => void;
  setInforme: (carga: CargaDiferencias<DiferenciasInformeRespuesta> | null) => void;
  setBorrador: (r: ReglaDiferencias | null) => void;
  /** Tras guardar una regla: se olvidan las respuestas y todos vuelven a pedir. */
  reglaAplicada: () => void;
  reiniciar: () => void;
};

const INICIAL = {
  parElegido: {},
  ranuraElegida: {},
  filtro: "revisar" as FiltroRevision,
  laminas: {},
  informe: null,
  borrador: null,
  version: 0,
};

export const useDiferenciasUi = create<Estado>((set) => ({
  ...INICIAL,
  elegirPar: (slideId, indice, ranura) => set((s) => ({
    parElegido: { ...s.parElegido, [slideId]: indice },
    ranuraElegida: ranura === undefined ? s.ranuraElegida : { ...s.ranuraElegida, [slideId]: ranura },
  })),
  setFiltro: (filtro) => set({ filtro }),
  setCargaLamina: (slideId, entrada) => set((s) => ({ laminas: { ...s.laminas, [slideId]: entrada } })),
  setInforme: (informe) => set({ informe }),
  setBorrador: (borrador) => set({ borrador }),
  reglaAplicada: () => set((s) => ({ laminas: {}, informe: null, borrador: null, version: s.version + 1 })),
  reiniciar: () => set((s) => ({ ...INICIAL, version: s.version + 1 })),
}));

// Abrir otro .pulso cambia el sid (`pulso:session-changed`, api/core.ts): lo guardado aquí es del proyecto anterior.
if (typeof window !== "undefined") {
  window.addEventListener("pulso:session-changed", () => useDiferenciasUi.getState().reiniciar());
}
