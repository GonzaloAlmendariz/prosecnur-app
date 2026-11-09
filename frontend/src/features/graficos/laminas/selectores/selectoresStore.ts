// Estado UI efímero de los selectores de tipo (F6.2). Qué panel está abierto y qué lámina o ranura se cambia viven en
// la dirección (`panel`, `foco`); aquí sólo lo que el analista va eligiendo dentro del diálogo.

import { create } from "zustand";
import type { FamiliaGrafico } from "./tiposGrafico";
import type { IntencionLamina } from "./tiposLamina";
import type { OpcionLamina } from "./opcionesLamina";
import type { IntencionContarId } from "./intencionesContar";
import type { EstadoInventario } from "./fichaDatos";
import { alternarEnComparacion } from "./modoYComparacion";

/** «cambiar» la lámina del foco o «insertar» una nueva detrás de ella. */
export type ModoSelectorLamina = "cambiar" | "insertar";

type SelectoresUi = {
  modoLamina: ModoSelectorLamina;
  /** La recomendación elegida (ADR 0135, revisado por el 0139); `null` la deriva el diálogo de la lámina. */
  contar: IntencionContarId | null;
  /** ¿Se ven los tipos de lámina (y no las recomendaciones)? `null` lo deriva el diálogo. */
  porTipo: boolean | null;
  /** La familia elegida dentro de «Tipo de lámina». */
  intencion: IntencionLamina | null;
  /** Buscar por pregunta o tipo (cabecera del diálogo). */
  busqueda: string;
  /** La tarjeta elegida: un tipo o un tipo con su payload de partida (`p_slide_hallazgos:resumen`). */
  candidato: OpcionLamina | null;
  variante: string | null;
  /** Segundo paso de «Usar esta lámina» cuando hay gráficos o textos que no caben. */
  confirmando: boolean;
  familia: FamiliaGrafico | null;
  candidatoGrafico: string | null;
  /** «Comparar»: hasta dos tarjetas, en el orden en que se marcaron. */
  comparar: OpcionLamina[];
  /** La vista partida reemplaza la galería y el detalle dentro del mismo diálogo (no es otro panel). */
  viendoComparacion: boolean;
  /** Lo que el estudio tiene para cada tipo (`apiGraficosInventario`), pedido una vez por apertura del selector. */
  inventario: EstadoInventario;
  /** Al abrir el selector de lámina: modo y elección limpia (la intención la deriva el diálogo de la lámina). */
  prepararLamina: (modo: ModoSelectorLamina) => void;
  /** El segmentado «Insertar detrás / Cambiar esta lámina»: cambia el modo y suelta la elección y la comparación. */
  cambiarModoLamina: (modo: ModoSelectorLamina) => void;
  alternarComparar: (opcion: OpcionLamina) => void;
  verComparacion: (ver: boolean) => void;
  setInventario: (inventario: EstadoInventario) => void;
  elegirContar: (i: IntencionContarId) => void;
  elegirIntencion: (i: IntencionLamina) => void;
  buscar: (texto: string) => void;
  elegirCandidato: (opcion: OpcionLamina, variante: string | null) => void;
  elegirVariante: (v: string) => void;
  setConfirmando: (c: boolean) => void;
  prepararGrafico: () => void;
  elegirFamilia: (f: FamiliaGrafico) => void;
  elegirGrafico: (nombre: string) => void;
};

/**
 * El modo con que arranca el selector cuando nadie lo pidió: abrir `?panel=tipo-lamina` por enlace, sin intención,
 * inserta. «Cambiar» sólo cuando quien abre lo pide sobre la lámina del foco (InspectorLamina → «Cambiar»).
 */
export const MODO_LAMINA_POR_DEFECTO: ModoSelectorLamina = "insertar";

export const useSelectoresUi = create<SelectoresUi>((set) => ({
  modoLamina: MODO_LAMINA_POR_DEFECTO,
  contar: null,
  porTipo: null,
  intencion: null,
  busqueda: "",
  candidato: null,
  variante: null,
  confirmando: false,
  familia: null,
  candidatoGrafico: null,
  comparar: [],
  viendoComparacion: false,
  inventario: { estado: "inactivo" },
  prepararLamina: (modoLamina) => set({
    modoLamina, contar: null, porTipo: null, intencion: null, busqueda: "", candidato: null, variante: null, confirmando: false,
    comparar: [], viendoComparacion: false,
  }),
  // R5-11: pasar de «Insertar» a «Cambiar» (o al revés) no vacía «Comparar»: las tarjetas marcadas siguen siendo las
  // que se están comparando; sólo cambia lo que hace «Usar esta».
  cambiarModoLamina: (modoLamina) => set({ modoLamina, candidato: null, variante: null, confirmando: false }),
  // S6: marcar la segunda tarjeta no salta a la vista partida; la galería sigue y la barra ofrece «Ver lado a lado».
  // Quitar una la cierra.
  alternarComparar: (opcion) => set((s) => {
    const comparar = alternarEnComparacion(s.comparar, opcion);
    return { comparar, viendoComparacion: comparar.length === 2 && s.viendoComparacion, confirmando: false };
  }),
  verComparacion: (ver) => set((s) => ({ viendoComparacion: ver && s.comparar.length === 2, confirmando: false })),
  setInventario: (inventario) => set({ inventario }),
  elegirContar: (contar) => set({ contar, porTipo: false, busqueda: "", candidato: null, variante: null, confirmando: false, viendoComparacion: false }),
  elegirIntencion: (intencion) => set({ intencion, porTipo: true, busqueda: "", candidato: null, variante: null, confirmando: false, viendoComparacion: false }),
  buscar: (busqueda) => set({ busqueda, candidato: null, variante: null, confirmando: false, viendoComparacion: false }),
  elegirCandidato: (candidato, variante) => set({ candidato, variante, confirmando: false }),
  elegirVariante: (variante) => set({ variante, confirmando: false }),
  setConfirmando: (confirmando) => set({ confirmando }),
  prepararGrafico: () => set({ familia: null, candidatoGrafico: null }),
  elegirFamilia: (familia) => set({ familia, candidatoGrafico: null }),
  elegirGrafico: (candidatoGrafico) => set({ candidatoGrafico }),
}));
