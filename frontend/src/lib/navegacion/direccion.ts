// Dirección canónica de una vista de Prosecnur.
//
// La jerarquía de navegación del producto es, en este orden y sin excepciones:
//
//   Módulo → [Modo] → Sección → Pestaña → Panel
//
// - **Módulo**: familia de trabajo con homepage y paleta propia (Monitoreo,
//   Procesamiento, Hojas de ruta…). Vive en el `pathname`.
// - **Modo**: variante del módulo que reescribe su juego de secciones. Solo
//   algunos módulos tienen modos, y el modo lo determina el estudio del
//   proyecto, no un click del usuario (Monitoreo: acreditación / territorial /
//   cursos-horario / telefónico; Cálculo de muestra: la mesa del estudio).
// - **Sección**: el recorrido del módulo, la top bar (Carga, Validación…).
// - **Pestaña**: subdivisión dentro de una sección.
// - **Panel**: superficie superpuesta direccionable — popover, sideover,
//   drawer, diálogo o inspector. Es el quinto nivel y también se enlaza.
//
// `foco` es opcional y ortogonal: identifica la entidad seleccionada dentro
// del nodo (una variable, un actor, una manzana). No es un nivel de la
// jerarquía; es "qué está seleccionado ahí adentro".
//
// Esta es la ÚNICA gramática de direcciones de la app. Los nombres antiguos
// (`tab`, `stage`, `mesa`, `desk`, `step`…) se siguen leyendo como alias por
// compatibilidad con enlaces guardados, pero jamás se escriben.
//
// Contrato completo: docs/adrs/0044-jerarquia-y-direcciones-de-navegacion.md

import {
  PROSECNUR_MODULES,
  type ProsecnurModuleSlug,
  type ProsecnurModuleMeta,
} from "../modules";

/** Los cinco niveles direccionables, en orden jerárquico. */
export const NIVELES_DIRECCION = [
  "modulo",
  "modo",
  "seccion",
  "pestana",
  "panel",
] as const;

export type NivelDireccion = (typeof NIVELES_DIRECCION)[number];

/** Nombres canónicos de los query params. `pestana` va sin eñe a propósito. */
export const PARAMS_DIRECCION = {
  modo: "modo",
  seccion: "seccion",
  pestana: "pestana",
  panel: "panel",
  foco: "foco",
} as const;

/** Param de dev que abre un `.pulso` saltándose el BootGate. */
export const PARAM_PROYECTO = "pulso";

const PARAMS_CANONICOS: readonly string[] = [
  ...Object.values(PARAMS_DIRECCION),
];

export type DireccionProsecnur = {
  modulo: ProsecnurModuleSlug;
  modo?: string;
  seccion?: string;
  pestana?: string;
  panel?: string;
  foco?: string;
  /** Ruta absoluta al `.pulso`. Solo se honra en build de dev. */
  proyecto?: string;
  /** Params ajenos a la gramática que la dirección no debe perder. */
  extra?: Readonly<Record<string, string>>;
};

// ---------------------------------------------------------------------------
// Alias legacy, por módulo
// ---------------------------------------------------------------------------
//
// `tab` es ambiguo entre módulos y por eso no puede resolverse globalmente: en
// Monitoreo y Bitácora nombraba una SECCIÓN, mientras que en Hojas de ruta
// nombraba una PESTAÑA. Resolverlo sin saber el módulo era exactamente la
// fuente del desorden que este archivo cierra.

type AliasPorNivel = Partial<Record<"modo" | "seccion" | "pestana", readonly string[]>>;

const ALIAS_LEGACY: Partial<Record<ProsecnurModuleSlug, AliasPorNivel>> = {
  monitoreo: {
    modo: ["perfil", "family", "camino", "ruta"],
    seccion: ["tab", "vista", "view"],
  },
  "diseno-estudio": {
    seccion: ["tab"],
  },
  "hojas-ruta": {
    seccion: ["stage", "etapa"],
    pestana: ["tab"],
  },
  "calc-muestra": {
    modo: ["mesa", "desk", "tipo"],
  },
  procesamiento: {
    pestana: ["step", "paso", "reporte"],
  },
};

const PARAMS_RESERVADOS = new Set<string>([
  ...PARAMS_CANONICOS,
  PARAM_PROYECTO,
  "devPulso",
  "devProject",
  ...Object.values(ALIAS_LEGACY).flatMap((porNivel) =>
    porNivel
      ? Object.values(porNivel).flatMap((aliases) => aliases ?? [])
      : [],
  ),
]);

// ---------------------------------------------------------------------------
// Tabla de rutas, derivada del manifiesto de módulos
// ---------------------------------------------------------------------------

type NodoRuta = {
  modulo: ProsecnurModuleSlug;
  /** Sección implícita en el pathname, si la ruta la nombra por sí sola. */
  seccion?: string;
};

function partirTo(to: string): { pathname: string; params: URLSearchParams } {
  const [pathname, query = ""] = to.split("?");
  return { pathname, params: new URLSearchParams(query) };
}

/**
 * pathname → módulo (+ sección si el pathname la nombra).
 *
 * Procesamiento es el caso que obliga a esta tabla: sus secciones son rutas
 * hermanas (`/carga`, `/validacion`…) y no hijas de `/procesamiento`. La
 * dirección lógica las trata como secciones igual que en cualquier otro
 * módulo; el mapeo a URL es lo único que difiere.
 */
const TABLA_RUTAS: ReadonlyMap<string, NodoRuta> = (() => {
  const tabla = new Map<string, NodoRuta>();

  for (const modulo of PROSECNUR_MODULES) {
    if (modulo.to) {
      const { pathname } = partirTo(modulo.to);
      if (!tabla.has(pathname)) tabla.set(pathname, { modulo: modulo.slug });
    }
    // En un módulo con modos, el pathname NO alcanza para nombrar la sección:
    // el juego de secciones lo reescribe el modo activo, así que `/monitoreo`
    // significa "el módulo", no una sección concreta. La sección llega por
    // `?seccion=` o la resuelve el modo. Declarar aquí la sección placeholder
    // que el módulo lista para tener landing produciría una sección que no
    // existe en ningún modo.
    if (modulo.modos && modulo.modos.length > 0) continue;

    for (const seccion of modulo.sections) {
      const { pathname, params } = partirTo(seccion.to);
      // Solo las secciones sin query propio quedan nombradas por el pathname.
      if ([...params.keys()].length > 0) continue;
      const previo = tabla.get(pathname);
      if (previo && previo.seccion) continue;
      tabla.set(pathname, { modulo: modulo.slug, seccion: seccion.id });
    }
  }

  return tabla;
})();

function normalizarPathname(pathname: string): string {
  const limpio = pathname.replace(/\/+$/, "");
  return limpio === "" ? "/" : limpio;
}

export function moduloDesdePathname(
  pathname: string,
): ProsecnurModuleSlug | null {
  return TABLA_RUTAS.get(normalizarPathname(pathname))?.modulo ?? null;
}

function metaDeModulo(slug: ProsecnurModuleSlug): ProsecnurModuleMeta | null {
  return PROSECNUR_MODULES.find((modulo) => modulo.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Parseo
// ---------------------------------------------------------------------------

function leerParam(
  params: URLSearchParams,
  canonico: string,
  alias: readonly string[] = [],
): string | undefined {
  for (const clave of [canonico, ...alias]) {
    const valor = params.get(clave)?.trim();
    if (valor) return valor;
  }
  return undefined;
}

function normalizarToken(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

/**
 * Convierte una URL de la app en dirección canónica.
 *
 * Devuelve `null` cuando el pathname no pertenece a ningún módulo (`/`,
 * `/enciclopedia`, rutas públicas). Eso no es un error: hay pantallas fuera de
 * la jerarquía de módulos y la gramática no pretende cubrirlas.
 */
export function parsearDireccion(
  pathname: string,
  search: string = "",
): DireccionProsecnur | null {
  const nodo = TABLA_RUTAS.get(normalizarPathname(pathname));
  if (!nodo) return null;

  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const alias = ALIAS_LEGACY[nodo.modulo] ?? {};

  const modo = leerParam(params, PARAMS_DIRECCION.modo, alias.modo);
  const seccion =
    leerParam(params, PARAMS_DIRECCION.seccion, alias.seccion) ?? nodo.seccion;
  const pestana = leerParam(params, PARAMS_DIRECCION.pestana, alias.pestana);
  const panel = leerParam(params, PARAMS_DIRECCION.panel);
  const foco = leerParam(params, PARAMS_DIRECCION.foco);
  const proyecto = leerParam(params, PARAM_PROYECTO, [
    "devPulso",
    "devProject",
  ]);

  const consumidos = new Set<string>([
    ...PARAMS_CANONICOS,
    PARAM_PROYECTO,
    "devPulso",
    "devProject",
    ...(alias.modo ?? []),
    ...(alias.seccion ?? []),
    ...(alias.pestana ?? []),
  ]);

  const extra: Record<string, string> = {};
  for (const [clave, valor] of params.entries()) {
    if (consumidos.has(clave)) continue;
    extra[clave] = valor;
  }

  return {
    modulo: nodo.modulo,
    ...(modo ? { modo: normalizarToken(modo) } : {}),
    ...(seccion ? { seccion: normalizarToken(seccion) } : {}),
    ...(pestana ? { pestana: normalizarToken(pestana) } : {}),
    ...(panel ? { panel: normalizarToken(panel) } : {}),
    ...(foco ? { foco } : {}),
    ...(proyecto ? { proyecto } : {}),
    ...(Object.keys(extra).length > 0 ? { extra } : {}),
  };
}

export function parsearDireccionDesdeHref(href: string): DireccionProsecnur | null {
  const url = new URL(href, "http://local.prosecnur");
  return parsearDireccion(url.pathname, url.search);
}

// ---------------------------------------------------------------------------
// Serialización
// ---------------------------------------------------------------------------

/**
 * Base de URL para un (módulo, sección): el `to` que declara el manifiesto.
 *
 * Se prefiere el `to` declarado antes que componer uno a mano para que la
 * dirección canónica y el enlace que pinta el chrome del módulo no puedan
 * divergir.
 */
function baseDeSeccion(
  meta: ProsecnurModuleMeta,
  seccion: string | undefined,
): { pathname: string; params: URLSearchParams } {
  if (seccion) {
    const directa = meta.sections.find((item) => item.id === seccion);
    if (directa) return partirTo(directa.to);

    for (const modo of meta.modos ?? []) {
      const enModo = modo.sections.find((item) => item.id === seccion);
      if (enModo) return partirTo(enModo.to);
    }
  }
  return partirTo(meta.to ?? meta.sections[0]?.to ?? "/");
}

/** Dirección canónica → href navegable por la app. */
export function serializarDireccion(direccion: DireccionProsecnur): string {
  const meta = metaDeModulo(direccion.modulo);
  if (!meta) return "/";

  const { pathname, params } = baseDeSeccion(meta, direccion.seccion);

  // La base puede traer el param legacy de su propio `to` (`?tab=`, `?stage=`).
  // Se reemplaza por el canónico: el manifiesto todavía declara los enlaces
  // viejos y no queremos propagarlos desde aquí.
  const nodoRuta = TABLA_RUTAS.get(normalizarPathname(pathname));
  const seccionImplicita = nodoRuta?.seccion === direccion.seccion;
  for (const clave of PARAMS_RESERVADOS) {
    params.delete(clave);
  }

  for (const [clave, valor] of Object.entries(direccion.extra ?? {})) {
    if (PARAMS_RESERVADOS.has(clave)) continue;
    params.set(clave, valor);
  }

  if (direccion.modo) params.set(PARAMS_DIRECCION.modo, direccion.modo);
  if (direccion.seccion && !seccionImplicita) {
    params.set(PARAMS_DIRECCION.seccion, direccion.seccion);
  }
  if (direccion.pestana) params.set(PARAMS_DIRECCION.pestana, direccion.pestana);
  if (direccion.panel) params.set(PARAMS_DIRECCION.panel, direccion.panel);
  if (direccion.foco) params.set(PARAMS_DIRECCION.foco, direccion.foco);
  if (direccion.proyecto) params.set(PARAM_PROYECTO, direccion.proyecto);

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

// ---------------------------------------------------------------------------
// Utilidades de edición
// ---------------------------------------------------------------------------

/**
 * Devuelve el `search` actual con un nivel reescrito, preservando todo lo
 * demás. Es lo que usan los chromes de módulo para reflejar en la URL la
 * sección/pestaña/panel activa sin pisar el resto del estado.
 */
export function conNivel(
  search: string,
  nivel: keyof typeof PARAMS_DIRECCION,
  valor: string | null,
): string {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const clave = PARAMS_DIRECCION[nivel];
  if (valor) params.set(clave, valor);
  else params.delete(clave);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** El param de proyecto y sus alias históricos. */
export const PARAMS_PROYECTO = [
  PARAM_PROYECTO,
  "devPulso",
  "devProject",
] as const;

/**
 * Quita el param de proyecto y conserva TODO lo demás.
 *
 * Es lo que corre justo después de abrir el `.pulso` por deep-link: el
 * `?pulso=` ya cumplió su trabajo y estorba en la barra de direcciones, pero
 * los niveles de la dirección tienen que sobrevivir intactos al warm start.
 * Borrarlos aquí es exactamente lo que dejaría al usuario —y al inspector— en
 * el landing del módulo en vez de la vista que pidió.
 */
export function hrefSinParamDeProyecto(href: string): string {
  const url = new URL(href, "http://local.prosecnur");
  for (const param of PARAMS_PROYECTO) url.searchParams.delete(param);
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}

/** Compara dos direcciones por sus cinco niveles (ignora `foco` y `extra`). */
export function mismaDireccion(
  a: DireccionProsecnur | null,
  b: DireccionProsecnur | null,
): boolean {
  if (!a || !b) return a === b;
  return (
    a.modulo === b.modulo &&
    a.modo === b.modo &&
    a.seccion === b.seccion &&
    a.pestana === b.pestana &&
    a.panel === b.panel
  );
}

/** Forma legible y estable para logs y evidencia de QA: `modulo/modo/seccion…`. */
export function describirDireccion(direccion: DireccionProsecnur): string {
  const camino = [
    direccion.modulo,
    direccion.modo,
    direccion.seccion,
    direccion.pestana,
  ]
    .filter(Boolean)
    .join("/");
  return direccion.panel ? `${camino}#${direccion.panel}` : camino;
}
