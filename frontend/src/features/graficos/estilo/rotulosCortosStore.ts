// Estado UI efímero de Identidad › Rótulos cortos (ADR 0141): el ranking leído, la base y el ranking a la vista, la
// búsqueda, los borradores de cada campo, sus errores y los avisos de colisión del último guardado. El corto mismo vive
// en `plan.rotulos_cortos` (usePlanStore) y en el backend: tras cada POST la respuesta vuelve al store del plan, porque el
// autosave guarda el plan entero y pisaría lo que el POST escribió.

import { create } from "zustand";
import {
  apiGraficosRotulosGuardar,
  apiGraficosRotulosRanking,
  ErrorRotuloCorto,
  type AvisoRotulos,
  type RankingRotulos,
} from "../../../api/graficosRotulos";
import { usePlanStore } from "../store";
import { cambioDe, claveFila, errorCorto, pedidoGuardar, type FilaRanking, type TipoRanking } from "./modeloRotulosCortos";

type RotulosCortosUi = {
  ranking: RankingRotulos | null;
  cargando: boolean;
  errorCarga: string;
  base: string | null;
  tipo: TipoRanking;
  consulta: string;
  borradores: Record<string, string>;
  errores: Record<string, string>;
  guardando: Record<string, boolean>;
  avisos: AvisoRotulos[];
  cargar: () => Promise<void>;
  setBase: (base: string) => void;
  setTipo: (tipo: TipoRanking) => void;
  setConsulta: (consulta: string) => void;
  setBorrador: (fila: FilaRanking, texto: string) => void;
  descartar: (fila: FilaRanking) => void;
  /** Guarda el borrador de una fila (vacío quita su corto). Devuelve si quedó guardado o no había nada que guardar. */
  guardar: (fila: FilaRanking, borrador: string) => Promise<boolean>;
};

const sin = (m: Record<string, string> | Record<string, boolean>, k: string) =>
  Object.fromEntries(Object.entries(m).filter(([c]) => c !== k));

let pedidoVigente = 0;

export const useRotulosCortosUi = create<RotulosCortosUi>((set, get) => ({
  ranking: null,
  cargando: false,
  errorCarga: "",
  base: null,
  tipo: "preguntas",
  consulta: "",
  borradores: {},
  errores: {},
  guardando: {},
  avisos: [],

  cargar: async () => {
    const n = ++pedidoVigente;
    set({ cargando: true, errorCarga: "" });
    try {
      const ranking = await apiGraficosRotulosRanking();
      if (n === pedidoVigente) set({ ranking, cargando: false });
    } catch (e) {
      if (n === pedidoVigente) set({ cargando: false, errorCarga: e instanceof Error && e.message ? e.message : "No se pudo leer el ranking de rótulos." });
    }
  },
  setBase: (base) => set({ base }),
  setTipo: (tipo) => set({ tipo }),
  setConsulta: (consulta) => set({ consulta }),
  setBorrador: (fila, texto) => {
    const k = claveFila(fila.tipo, fila.clave);
    set((s) => ({ borradores: { ...s.borradores, [k]: texto }, errores: sin(s.errores, k) as Record<string, string> }));
  },
  descartar: (fila) => {
    const k = claveFila(fila.tipo, fila.clave);
    set((s) => ({ borradores: sin(s.borradores, k) as Record<string, string>, errores: sin(s.errores, k) as Record<string, string> }));
  },

  guardar: async (fila, borrador) => {
    const k = claveFila(fila.tipo, fila.clave);
    if (get().guardando[k]) return false;
    if (cambioDe(fila, borrador) === "nada") { get().descartar(fila); return true; }
    const local = errorCorto(fila.etiqueta, borrador);
    if (local) { set((s) => ({ errores: { ...s.errores, [k]: local } })); return false; }
    set((s) => ({ guardando: { ...s.guardando, [k]: true } }));
    try {
      const r = await apiGraficosRotulosGuardar(pedidoGuardar(usePlanStore.getState().plan.rotulos_cortos, fila, borrador));
      usePlanStore.getState().setRotulosCortos(r.rotulos_cortos);
      set((s) => ({
        borradores: sin(s.borradores, k) as Record<string, string>,
        errores: sin(s.errores, k) as Record<string, string>,
        guardando: sin(s.guardando, k) as Record<string, boolean>,
        avisos: r.avisos,
      }));
      return true;
    } catch (e) {
      // El backend valida la sección entera: el error puede ser de otra entrada ya guardada. Va junto a la suya.
      const destino = e instanceof ErrorRotuloCorto && e.clave ? claveFila(fila.tipo, e.clave) : k;
      const mensaje = e instanceof ErrorRotuloCorto ? e.mensaje : e instanceof Error && e.message ? e.message : "No se pudo guardar el rótulo corto.";
      set((s) => ({ errores: { ...s.errores, [destino]: mensaje, ...(destino !== k ? { [k]: "No se guardó: otro rótulo corto de la lista tiene un problema." } : {}) }, guardando: sin(s.guardando, k) as Record<string, boolean> }));
      return false;
    }
  },
}));
