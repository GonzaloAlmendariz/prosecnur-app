// «Mis secciones» del estudio en el editor (GOAL editor profesional, L9; ADR
// 0113). La lista vive en el backend (collection_state$mail_sections, en el
// `.pulso`); aquí sólo se lee y se escribe, y cada escritura anota la revisión
// global en el store del correo (si no, el próximo guardado del correo daría 409).

import { create } from "zustand";

import { getSession } from "../../../api/core";
import type { MailBlock, MailTemplate } from "../../../api/materialMail";
import { apiMailSectionCreate, apiMailSectionDelete, apiMailSections, type MailSavedSection, type MailSavedSectionImage } from "../../../api/materialMailMisSecciones";
import { useCorreosStore } from "./store";

type Estado = "sin-cargar" | "cargando" | "lista" | "error";

type MisSecciones = {
  secciones: MailSavedSection[];
  /** La sesión (el proyecto) de la que son: otro proyecto no hereda la lista. */
  sesion: string | null;
  estado: Estado;
  error: string | null;
  cargar: () => Promise<void>;
  /** Guarda una copia de `block` con `name`; devuelve la sección o `null` si falló (el error queda en `error`). */
  guardar: (name: string, block: MailBlock, template: Pick<MailTemplate, "images">, campaignId?: string | null) => Promise<MailSavedSection | null>;
  borrar: (sectionId: string) => Promise<boolean>;
  limpiarError: () => void;
};

/** Las fotos que nombra un bloque (las ranuras de imagen del render). */
export function fotosDelBloque(block: MailBlock): string[] {
  const r = block as unknown as Record<string, unknown>;
  return ["image_ref", "mobile_ref", "left", "right"].map((k) => r[k]).filter((v): v is string => typeof v === "string" && v !== "");
}

/** Descripción y URL de sus fotos, de `template.images`. */
export function fotosParaGuardar(block: MailBlock, template: Pick<MailTemplate, "images">): Record<string, MailSavedSectionImage> {
  const out: Record<string, MailSavedSectionImage> = {};
  for (const id of fotosDelBloque(block)) {
    const e = template.images[id];
    if (e) out[id] = { ...(e.alt ? { alt: e.alt } : {}), ...(e.url ? { url: e.url } : {}) };
  }
  return out;
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : "No se pudo completar.");

export const useMisSecciones = create<MisSecciones>((set, get) => ({
  secciones: [],
  sesion: null,
  estado: "sin-cargar",
  error: null,
  cargar: async () => {
    if (get().estado === "cargando") return;
    // Del mismo proyecto, lo que había se sigue viendo mientras se relee; de
    // otro, se vacía: lo ajeno nunca se ofrece mientras llega lo propio.
    const sesion = getSession();
    set((s) => ({ estado: "cargando", error: null, ...(s.sesion === sesion ? {} : { secciones: [], sesion }) }));
    try {
      const out = await apiMailSections();
      useCorreosStore.getState().anotarRevision(out.state_revision);
      set({ secciones: out.sections, estado: "lista", sesion });
    } catch (e) {
      set({ estado: "error", error: mensaje(e) });
    }
  },
  guardar: async (name, block, template, campaignId) => {
    const revision = useCorreosStore.getState().stateRevision;
    if (revision === null) { set({ error: "El correo todavía no termina de cargar: vuelve a intentarlo en un momento." }); return null; }
    try {
      const out = await apiMailSectionCreate({
        expected_revision: revision, name, block, images: fotosParaGuardar(block, template), campaign_id: campaignId ?? null,
      });
      useCorreosStore.getState().anotarRevision(out.state_revision);
      if (out.section) set((s) => ({ secciones: [...s.secciones, out.section!], error: null }));
      return out.section;
    } catch (e) {
      set({ error: mensaje(e) });
      return null;
    }
  },
  borrar: async (sectionId) => {
    const revision = useCorreosStore.getState().stateRevision;
    if (revision === null) { set({ error: "El correo todavía no termina de cargar: vuelve a intentarlo en un momento." }); return false; }
    try {
      const out = await apiMailSectionDelete({ expected_revision: revision, section_id: sectionId });
      useCorreosStore.getState().anotarRevision(out.state_revision);
      set((s) => ({ secciones: s.secciones.filter((x) => x.section_id !== sectionId), error: null }));
      return true;
    } catch (e) {
      set({ error: mensaje(e) });
      return false;
    }
  },
  limpiarError: () => set({ error: null }),
}));
