// Estado de Catálogo › Tipos como un reducer puro: la carga del catálogo, la
// caché de miniaturas, el filtro, la selección y la acción «Usar este tipo».
//
// Va junto porque sus transiciones van juntas: un catálogo nuevo puede dejar
// sin tarjeta a la selección o sin tipos al filtro, y eso se corrige en el
// mismo paso en que llega, no en un efecto aparte que pinte un cuadro intermedio.

import type { MaterialCatalogPayload, MaterialCatalogPreview } from "../../../api/materialCatalog";
import { FAMILIA_TODOS, familiasDelCatalogo, filtrarPorFamilia, seleccionInicial } from "./modeloCatalogo";

export type CargaDelCatalogo =
  | { estado: "cargando"; previo: MaterialCatalogPayload | null }
  | { estado: "listo"; catalogo: MaterialCatalogPayload }
  | { estado: "error"; mensaje: string };

export type VistaDePagina =
  | { estado: "cargando" }
  | { estado: "lista"; vista: MaterialCatalogPreview }
  | { estado: "error"; mensaje: string };

export type EstadoCatalogo = {
  carga: CargaDelCatalogo;
  familia: string;
  seleccion: string | null;
  vistas: Record<string, VistaDePagina>;
  /** `preset_id` que se está fijando como plantilla activa. */
  usando: string | null;
  errorAccion: string;
};

export type AccionCatalogo =
  | { type: "carga-inicio" }
  | { type: "carga-ok"; catalogo: MaterialCatalogPayload }
  | { type: "carga-error"; mensaje: string }
  | { type: "familia"; familia: string }
  | { type: "seleccionar"; presetId: string }
  | { type: "vista-inicio"; clave: string }
  | { type: "vista-ok"; clave: string; vista: MaterialCatalogPreview }
  | { type: "vista-error"; clave: string; mensaje: string }
  | { type: "usar-inicio"; presetId: string }
  | { type: "usar-fin"; error?: string };

export const ESTADO_INICIAL_CATALOGO: EstadoCatalogo = {
  carga: { estado: "cargando", previo: null },
  familia: FAMILIA_TODOS,
  seleccion: null,
  vistas: {},
  usando: null,
  errorAccion: "",
};

export function catalogoVisible(carga: CargaDelCatalogo): MaterialCatalogPayload | null {
  if (carga.estado === "listo") return carga.catalogo;
  if (carga.estado === "cargando") return carga.previo;
  return null;
}

export function reducirCatalogo(estado: EstadoCatalogo, accion: AccionCatalogo): EstadoCatalogo {
  switch (accion.type) {
    case "carga-inicio":
      // Recargar no vacía la galería: lo que ya se ve se queda hasta que llegue lo nuevo.
      return { ...estado, carga: { estado: "cargando", previo: catalogoVisible(estado.carga) } };
    case "carga-ok": {
      const { presets } = accion.catalogo;
      const familias = familiasDelCatalogo(presets).map((f) => f.id);
      const familia = familias.includes(estado.familia) ? estado.familia : FAMILIA_TODOS;
      const sigue = presets.some((p) => p.preset_id === estado.seleccion);
      return {
        ...estado,
        carga: { estado: "listo", catalogo: accion.catalogo },
        familia,
        seleccion: sigue ? estado.seleccion : seleccionInicial(filtrarPorFamilia(presets, familia)),
      };
    }
    case "carga-error":
      return { ...estado, carga: { estado: "error", mensaje: accion.mensaje } };
    case "familia": {
      const catalogo = catalogoVisible(estado.carga);
      const visibles = catalogo ? filtrarPorFamilia(catalogo.presets, accion.familia) : [];
      const sigue = visibles.some((p) => p.preset_id === estado.seleccion);
      return {
        ...estado,
        familia: accion.familia,
        seleccion: sigue ? estado.seleccion : seleccionInicial(visibles) ?? estado.seleccion,
      };
    }
    case "seleccionar":
      return { ...estado, seleccion: accion.presetId, errorAccion: "" };
    case "vista-inicio":
      return { ...estado, vistas: { ...estado.vistas, [accion.clave]: { estado: "cargando" } } };
    case "vista-ok":
      return { ...estado, vistas: { ...estado.vistas, [accion.clave]: { estado: "lista", vista: accion.vista } } };
    case "vista-error":
      return {
        ...estado,
        vistas: { ...estado.vistas, [accion.clave]: { estado: "error", mensaje: accion.mensaje } },
      };
    case "usar-inicio":
      return { ...estado, usando: accion.presetId, errorAccion: "" };
    case "usar-fin":
      return { ...estado, usando: null, errorAccion: accion.error ?? "" };
    default:
      return estado;
  }
}
