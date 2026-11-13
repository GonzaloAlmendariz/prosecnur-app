import { create } from "zustand";

import { ESTADO_MARCO_INICIAL, type EstadoMarco, type PasoMarco } from "./modeloMarco";

/**
 * Estado del recorrido del marco por actor, mientras se arma. Es efímero: lo que se guarda es la receta, al
 * declarar el marco (`/marco-publico/declarar`), que viaja en el `.pulso`. Cambiar de archivo descarta lo decidido
 * sobre el anterior.
 */
type Recorridos = {
  porActor: Record<string, EstadoMarco>;
  paso: Record<string, PasoMarco>;
  actualizar: (actor: string, cambio: (e: EstadoMarco) => EstadoMarco) => void;
  irAPaso: (actor: string, paso: PasoMarco) => void;
  descartar: (actor: string) => void;
};

export const useRecorridoMarcoStore = create<Recorridos>((set) => ({
  porActor: {},
  paso: {},
  actualizar: (actor, cambio) =>
    set((s) => ({ porActor: { ...s.porActor, [actor]: cambio(s.porActor[actor] ?? ESTADO_MARCO_INICIAL) } })),
  irAPaso: (actor, paso) => set((s) => ({ paso: { ...s.paso, [actor]: paso } })),
  descartar: (actor) =>
    set((s) => {
      const porActor = { ...s.porActor };
      const paso = { ...s.paso };
      delete porActor[actor];
      delete paso[actor];
      return { porActor, paso };
    }),
}));
