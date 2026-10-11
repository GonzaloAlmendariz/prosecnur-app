// Estado UI efímero de las guías del visor (plan F6 §8): qué capas están encendidas, qué roles se ocultan y qué
// elemento se resalta desde la lista. Vive sólo mientras la app está abierta: no entra en la config del proyecto ni en
// el entregable (D17), y no cambia la vista previa (no participa de su clave).

import { create } from "zustand";
import { CAPAS_APAGADAS, type CapaGuia, type CapasGuias } from "./modeloGuias";

type GuiasUi = {
  capas: CapasGuias;
  /** Roles que el filtro deja fuera; un rol nuevo aparece visible. */
  rolesOcultos: string[];
  /** Elemento señalado desde la lista del panel (teclado o mouse), por id de `construirGuias`. */
  resaltada: string | null;
  alternarCapa: (c: CapaGuia) => void;
  alternarRol: (rol: string) => void;
  mostrarTodosLosRoles: () => void;
  apagarCapas: () => void;
  setResaltada: (id: string | null) => void;
};

export const useGuiasUi = create<GuiasUi>((set) => ({
  capas: CAPAS_APAGADAS,
  rolesOcultos: [],
  resaltada: null,
  alternarCapa: (c) => set((s) => ({ capas: { ...s.capas, [c]: !s.capas[c] } })),
  alternarRol: (rol) => set((s) => ({
    rolesOcultos: s.rolesOcultos.includes(rol) ? s.rolesOcultos.filter((r) => r !== rol) : [...s.rolesOcultos, rol],
  })),
  mostrarTodosLosRoles: () => set({ rolesOcultos: [] }),
  apagarCapas: () => set({ capas: CAPAS_APAGADAS }),
  setResaltada: (resaltada) => set((s) => (s.resaltada === resaltada ? s : { resaltada })),
}));

export const capasEncendidas = (capas: CapasGuias): number => Object.values(capas).filter(Boolean).length;
