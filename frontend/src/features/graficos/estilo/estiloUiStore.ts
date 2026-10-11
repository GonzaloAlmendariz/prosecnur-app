// Estado UI efímero de la pestaña «Estilo del cliente»: el catálogo de opciones, la subida de cada logo y la vista previa
// del Word. Nada de esto se persiste: el estilo mismo vive en `usePlanStore` (y en el backend, por su ámbito).

import { create } from "zustand";
import type { EstiloLugarLogo, EstiloOpciones } from "../../../api/graficosEstilo";

export type FaseVistaPrevia = "inactiva" | "exportando" | "convirtiendo" | "lista" | "error";

export type VistaPreviaWord = {
  fase: FaseVistaPrevia;
  jobId: string | null;
  /** Portada y contraportada del último Word regenerado desde aquí (data URI). */
  portada: string | null;
  contraportada: string | null;
  exportado: string;
  mensaje: string;
};

const VISTA_PREVIA_INICIAL: VistaPreviaWord = {
  fase: "inactiva", jobId: null, portada: null, contraportada: null, exportado: "", mensaje: "",
};

type EstiloUi = {
  opciones: EstiloOpciones | null;
  opcionesError: string;
  setOpciones: (opciones: EstiloOpciones | null, error?: string) => void;
  subiendo: Partial<Record<EstiloLugarLogo, boolean>>;
  errorLogo: Partial<Record<EstiloLugarLogo, string>>;
  setSubiendo: (lugar: EstiloLugarLogo, subiendo: boolean) => void;
  setErrorLogo: (lugar: EstiloLugarLogo, mensaje: string) => void;
  vistaPrevia: VistaPreviaWord;
  setVistaPrevia: (patch: Partial<VistaPreviaWord>) => void;
  reiniciarVistaPrevia: () => void;
};

export const useEstiloUi = create<EstiloUi>((set) => ({
  opciones: null,
  opcionesError: "",
  setOpciones: (opciones, error = "") => set({ opciones, opcionesError: error }),
  subiendo: {},
  errorLogo: {},
  setSubiendo: (lugar, subiendo) => set((s) => ({ subiendo: { ...s.subiendo, [lugar]: subiendo } })),
  setErrorLogo: (lugar, mensaje) => set((s) => ({ errorLogo: { ...s.errorLogo, [lugar]: mensaje } })),
  vistaPrevia: VISTA_PREVIA_INICIAL,
  setVistaPrevia: (patch) => set((s) => ({ vistaPrevia: { ...s.vistaPrevia, ...patch } })),
  reiniciarVistaPrevia: () => set({ vistaPrevia: VISTA_PREVIA_INICIAL }),
}));
