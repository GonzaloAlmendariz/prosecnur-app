// Estado de la pestaña Contactos (ADR 0112 §4).
//
// Lo duro —los contactos, las variables de control, los enlaces y quién
// respondió— vive en el backend, scopeado por campaña. Aquí solo hay lo que la
// vista necesita mientras existe: los filtros del tablero, la búsqueda, la
// página, el par del cruce y la última lectura de cada consulta. Cambiar de
// campaña lo olvida todo de una vez (`abrirCampana`): un filtro de una campaña
// no significa nada en otra.
//
// Privacidad: la página de contactos trae correos y vive solo en memoria.

import { create } from "zustand";

import type {
  EnlacesGenerados,
  FiltroDeEstado,
  FiltroDeRespuesta,
  PaginaDeContactos,
  PerfilDeContactos,
  VariableDelPerfil,
} from "../../../../api/mailContactos";
import { alternarFiltro, filtrosDeControl, quitarFiltro, type Filtros } from "./modeloContactos";

export type Carga = "inicial" | "cargando" | "lista" | "error";

export type VistaDelCruce = "casos" | "fila";

type EstadoDelEnlace = {
  url: string;
  /** El usuario ya escribió en el campo: el enlace guardado no lo pisa. */
  tocado: boolean;
  generando: boolean;
  resultado: EnlacesGenerados | null;
  error: string;
};

/**
 * La distribución de una variable filtrada, leída SIN su propio filtro: así su
 * tarjeta sigue mostrando todas sus categorías y se puede sumar otra (OR).
 */
export type FacetaDeVariable = {
  variable: VariableDelPerfil;
  base: number;
  /** Los filtros con que se leyó (sin los de su columna): si ya no son esos, no se usa. */
  clave: string;
};

export type EstadoContactos = {
  campana: string | null;

  // --- Lo que se pide ---
  filtros: Filtros;
  busqueda: string;
  estado: FiltroDeEstado;
  respondio: FiltroDeRespuesta;
  pagina: number;
  cruce: [string, string] | null;
  vistaDelCruce: VistaDelCruce;
  todasLasColumnas: boolean;
  /** Variables cuya tarjeta muestra todas las categorías. */
  expandidas: Record<string, boolean>;
  /** Sube para volver a pedir todo (Actualizar, después de escribir). */
  refresco: number;

  // --- Lo que llegó ---
  perfil: PerfilDeContactos | null;
  perfilCarga: Carga;
  perfilError: string;
  /** Por columna filtrada: su distribución sin su propio filtro. */
  facetas: Record<string, FacetaDeVariable>;
  lista: PaginaDeContactos | null;
  listaCarga: Carga;
  listaError: string;
  guardandoControl: boolean;
  controlError: string;
  enlace: EstadoDelEnlace;

  // --- Acciones ---
  abrirCampana: (campana: string | null) => void;
  alternarFiltro: (columna: string, valor: string) => void;
  quitarFiltro: (columna: string, valor: string) => void;
  limpiarFiltros: () => void;
  setBusqueda: (busqueda: string) => void;
  setEstado: (estado: FiltroDeEstado) => void;
  setRespondio: (respondio: FiltroDeRespuesta) => void;
  setPagina: (pagina: number) => void;
  setCruce: (cruce: [string, string] | null) => void;
  setVistaDelCruce: (vista: VistaDelCruce) => void;
  setTodasLasColumnas: (todas: boolean) => void;
  alternarExpandida: (variable: string) => void;
  refrescar: () => void;

  perfilInicio: () => void;
  perfilListo: (perfil: PerfilDeContactos) => void;
  perfilFallo: (mensaje: string) => void;
  facetaLista: (columna: string, faceta: FacetaDeVariable) => void;
  listaInicio: () => void;
  listaLista: (lista: PaginaDeContactos) => void;
  listaFallo: (mensaje: string) => void;
  controlInicio: () => void;
  /** Las variables guardadas: los filtros de columnas que dejaron de ser de control se sueltan. */
  controlListo: (control: string[]) => void;
  controlFallo: (mensaje: string) => void;
  setUrlDelEnlace: (url: string) => void;
  enlaceInicio: () => void;
  enlaceListo: (resultado: EnlacesGenerados) => void;
  enlaceFallo: (mensaje: string) => void;
};

const ENLACE_INICIAL: EstadoDelEnlace = { url: "", tocado: false, generando: false, resultado: null, error: "" };

const INICIAL = {
  campana: null,
  filtros: {},
  busqueda: "",
  estado: "todos" as FiltroDeEstado,
  respondio: "todos" as FiltroDeRespuesta,
  pagina: 1,
  cruce: null,
  vistaDelCruce: "casos" as VistaDelCruce,
  todasLasColumnas: false,
  expandidas: {},
  refresco: 0,
  perfil: null,
  perfilCarga: "inicial" as Carga,
  perfilError: "",
  facetas: {},
  lista: null,
  listaCarga: "inicial" as Carga,
  listaError: "",
  guardandoControl: false,
  controlError: "",
  enlace: ENLACE_INICIAL,
} satisfies Partial<EstadoContactos>;

export const useContactosStore = create<EstadoContactos>((set, get) => ({
  ...INICIAL,

  abrirCampana: (campana) => {
    if (get().campana === campana) return;
    set({ ...INICIAL, campana });
  },
  // Filtrar cambia el universo de la lista: vuelve a la primera página.
  alternarFiltro: (columna, valor) => set((s) => ({ filtros: alternarFiltro(s.filtros, columna, valor), pagina: 1 })),
  quitarFiltro: (columna, valor) => set((s) => ({ filtros: quitarFiltro(s.filtros, columna, valor), pagina: 1 })),
  limpiarFiltros: () => set({ filtros: {}, pagina: 1 }),
  setBusqueda: (busqueda) => set({ busqueda, pagina: 1 }),
  setEstado: (estado) => set({ estado, pagina: 1 }),
  setRespondio: (respondio) => set({ respondio, pagina: 1 }),
  setPagina: (pagina) => set({ pagina: Math.max(1, Math.round(pagina)) }),
  setCruce: (cruce) => set({ cruce }),
  setVistaDelCruce: (vistaDelCruce) => set({ vistaDelCruce }),
  setTodasLasColumnas: (todasLasColumnas) => set({ todasLasColumnas }),
  alternarExpandida: (variable) => set((s) => ({ expandidas: { ...s.expandidas, [variable]: !s.expandidas[variable] } })),
  refrescar: () => set((s) => ({ refresco: s.refresco + 1 })),

  perfilInicio: () => set({ perfilCarga: "cargando", perfilError: "" }),
  perfilListo: (perfil) => set((s) => ({
    perfil,
    perfilCarga: "lista",
    perfilError: "",
    ...(perfil.enlace_url && !s.enlace.tocado && !s.enlace.url
      ? { enlace: { ...s.enlace, url: perfil.enlace_url } }
      : {}),
  })),
  perfilFallo: (perfilError) => set({ perfilCarga: "error", perfilError }),
  listaInicio: () => set({ listaCarga: "cargando", listaError: "" }),
  facetaLista: (columna, faceta) => set((s) => ({ facetas: { ...s.facetas, [columna]: faceta } })),
  // El enlace del recopilador guardado prellena el campo al recargar, mientras
  // nadie haya escrito en él.
  listaLista: (lista) => set((s) => ({
    lista,
    listaCarga: "lista",
    listaError: "",
    ...(lista.resumen.enlace_url && !s.enlace.tocado && !s.enlace.url
      ? { enlace: { ...s.enlace, url: lista.resumen.enlace_url } }
      : {}),
  })),
  listaFallo: (listaError) => set({ listaCarga: "error", listaError }),
  controlInicio: () => set({ guardandoControl: true, controlError: "" }),
  controlListo: (control) => set((s) => ({
    guardandoControl: false,
    filtros: filtrosDeControl(s.filtros, control),
    perfil: s.perfil ? { ...s.perfil, control } : s.perfil,
    pagina: 1,
    refresco: s.refresco + 1,
  })),
  controlFallo: (controlError) => set({ guardandoControl: false, controlError }),
  setUrlDelEnlace: (url) => set((s) => ({ enlace: { ...s.enlace, url, tocado: true, error: "" } })),
  enlaceInicio: () => set((s) => ({ enlace: { ...s.enlace, generando: true, error: "", resultado: null } })),
  enlaceListo: (resultado) => set((s) => ({ enlace: { ...s.enlace, generando: false, resultado }, refresco: s.refresco + 1 })),
  enlaceFallo: (error) => set((s) => ({ enlace: { ...s.enlace, generando: false, error } })),
}));
