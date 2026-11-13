// Estado efímero del emparejamiento por el texto de la pregunta (ítem 4).
//
// Vive en un store porque lo dispara la subida de respuestas (accionesDeInsumos)
// y lo muestran el aviso de carga de la página y el de "Agregar base". Guarda el
// archivo recién subido en memoria: la propuesta y la carga lo vuelven a subir,
// porque una carga fallida retira su subida del registro. Por eso el diálogo no
// es direccionable: sin el archivo en memoria no hay nada que mostrar.

import { create } from "zustand";
import {
  apiCargaEmparejamientoTexto,
  apiCargaEmparejamientoTextoAplicar,
  type ParejaAceptada,
  type PropuestaEmparejamiento,
} from "../../../../api/cargaEmparejamiento";
import { apiUpload } from "../../../../api/estudio";

export type ResultadoEmparejamiento = Awaited<ReturnType<typeof apiCargaEmparejamientoTextoAplicar>>;

type Fase = "inactivo" | "leyendo" | "lista" | "error";

type EstadoEmparejamiento = {
  fase: Fase;
  archivo: File | null;
  propuesta: PropuestaEmparejamiento | null;
  error: string;
  abierto: boolean;
  alCargar: ((resultado: ResultadoEmparejamiento) => Promise<void>) | null;
  ofrecer: (archivo: File, alCargar: (resultado: ResultadoEmparejamiento) => Promise<void>) => Promise<void>;
  abrir: () => void;
  cerrar: () => void;
  limpiar: () => void;
  /** Sube otra vez el archivo y lo carga con las parejas aceptadas. Lanza el error del backend. */
  aplicar: (parejas: ParejaAceptada[]) => Promise<void>;
};

const INICIAL = { fase: "inactivo" as Fase, archivo: null, propuesta: null, error: "", abierto: false, alCargar: null };

export const useEmparejamientoTexto = create<EstadoEmparejamiento>((set, get) => ({
  ...INICIAL,
  ofrecer: async (archivo, alCargar) => {
    set({ ...INICIAL, fase: "leyendo", archivo, alCargar });
    try {
      const subida = await apiUpload(archivo, "data");
      const propuesta = await apiCargaEmparejamientoTexto(subida.file_id);
      if (get().archivo !== archivo) return;
      set({ fase: "lista", propuesta });
    } catch (e: unknown) {
      if (get().archivo !== archivo) return;
      set({ fase: "error", error: (e as Error).message });
    }
  },
  abrir: () => set({ abierto: true }),
  cerrar: () => set({ abierto: false }),
  limpiar: () => set({ ...INICIAL }),
  aplicar: async (parejas) => {
    const { archivo, alCargar } = get();
    if (!archivo) throw new Error("Vuelve a subir la base para emparejarla por el texto de la pregunta.");
    const subida = await apiUpload(archivo, "data");
    const resultado = await apiCargaEmparejamientoTextoAplicar(subida.file_id, parejas);
    set({ ...INICIAL });
    if (alCargar) await alCargar(resultado);
  },
}));
