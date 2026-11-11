// Estado de Correo > Seguimiento (patrón de `validacion/store.ts`).
//
// Lo duro vive en el backend, scopeado por la sesión del proyecto: la
// configuración, los grupos, el plan y quién respondió. Aquí está la última
// lectura de eso, las conexiones (para elegir audiencia y encuestas) y el
// latido de "antes de cada envío", que lo comparten la vista y el host de
// fondo (`AntesDeCadaEnvioHost`). Cambiar de proyecto lo olvida todo.

import { create } from "zustand";

import { apiOpcionesDeSincronizacion, type OpcionesDeSincronizacion } from "../../../api/mailchimpSync";
import { apiSeguimiento, type EstadoSeguimiento, type LatidoAntesDeEnvio, type ResultadosDeHorario } from "../../../api/mailSeguimiento";
import { mensajeDeError } from "../correos/mailchimpPorApiModel";
import type { IdDePaso } from "./modeloSeguimiento";

export type Carga = "inicial" | "cargando" | "lista" | "error";

export type EstadoDelFondo = {
  /** `null`: todavía no se sabe (no se leyó la configuración ni hubo latido). */
  activo: boolean | null;
  ultimo: LatidoAntesDeEnvio | null;
  /** El último latido falló (sin conexión, Mailchimp sin clave): se dice en la vista. */
  error: string;
  /** Hay una actualización automática corriendo. */
  corriendo: boolean;
};

export type EstadoDeSeguimiento = {
  estado: EstadoSeguimiento | null;
  carga: Carga;
  error: string;
  opciones: OpcionesDeSincronizacion | null;
  errorOpciones: string;
  fondo: EstadoDelFondo;
  /** Última lectura de los resultados de la prueba de horarios (la usan la cabecera y el paso 6). */
  resultados: ResultadosDeHorario | null;
  /** Horas desde el envío con que se leen los resultados; `null` = las guardadas en el estudio. */
  horizonte: number | null;
  /** Pasos de la prueba abiertos o cerrados a pedido (estado de UI, no dirección). */
  pasosAbiertos: Partial<Record<IdDePaso, boolean>>;

  cargar: (opciones?: { silencioso?: boolean }) => Promise<void>;
  cargarOpciones: () => Promise<void>;
  /** Una mutación devolvió el estado completo: se adopta tal cual. */
  aplicar: (estado: EstadoSeguimiento) => void;
  setFondo: (cambio: Partial<EstadoDelFondo>) => void;
  setResultados: (resultados: ResultadosDeHorario | null) => void;
  setHorizonte: (horizonte: number) => void;
  alternarPaso: (id: IdDePaso, abierto: boolean) => void;
  reset: () => void;
};

const FONDO_INICIAL: EstadoDelFondo = { activo: null, ultimo: null, error: "", corriendo: false };

const INICIAL = {
  estado: null,
  carga: "inicial" as Carga,
  error: "",
  opciones: null,
  errorOpciones: "",
  fondo: FONDO_INICIAL,
  resultados: null,
  horizonte: null,
  pasosAbiertos: {},
};

export const useSeguimientoStore = create<EstadoDeSeguimiento>((set, get) => ({
  ...INICIAL,

  cargar: async ({ silencioso = false } = {}) => {
    if (!silencioso) set({ carga: "cargando", error: "" });
    try {
      get().aplicar(await apiSeguimiento());
    } catch (e) {
      if (!silencioso || !get().estado) set({ carga: "error", error: mensajeDeError(e, "No se pudo leer el seguimiento.") });
    }
  },

  cargarOpciones: async () => {
    try {
      set({ opciones: await apiOpcionesDeSincronizacion(), errorOpciones: "" });
    } catch (e) {
      set({ errorOpciones: mensajeDeError(e, "No se pudieron leer las conexiones.") });
    }
  },

  aplicar: (estado) => set((s) => ({
    estado,
    carga: "lista",
    error: "",
    fondo: { ...s.fondo, activo: estado.config.antes_de_envio.activo },
  })),

  setFondo: (cambio) => set((s) => ({ fondo: { ...s.fondo, ...cambio } })),

  setResultados: (resultados) => set({ resultados }),

  setHorizonte: (horizonte) => set({ horizonte }),

  alternarPaso: (id, abierto) => set((s) => ({ pasosAbiertos: { ...s.pasosAbiertos, [id]: abierto } })),

  reset: () => set({ ...INICIAL, fondo: FONDO_INICIAL, pasosAbiertos: {} }),
}));
