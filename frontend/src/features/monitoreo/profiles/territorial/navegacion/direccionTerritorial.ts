/**
 * Dirección pública del modo Territorial y la vista que se monta para cada una.
 *
 * El revamp de Monitoreo (2026-10-23) reordenó el modo en el esqueleto común
 * de cuatro secciones —Insumos, Modelo, Control y Avance— con las 19 pestañas
 * de `docs/qa/revamp-monitoreo/territorial.md` §1. La página guarda como estado
 * la dirección PÚBLICA; esta tabla dice qué monta cada una:
 *
 * - una pestaña con contenido propio (`propia`), que la página monta con su
 *   componente nuevo;
 * - o, mientras no lo tiene, la vista heredada que absorbe (`interna`, la
 *   columna «Absorbe de hoy»). Si absorbe varias, las demás cuelgan de ella
 *   como sub-vista con `panel`, igual que en Telefónico.
 *
 * `interna` también decide qué corte del motor pide la pestaña (el scope de
 * `reportScopesForTerritorialView`), así que las propias la declaran igual.
 *
 * Las direcciones de la arquitectura anterior se LEEN como alias (§1, «Alias de
 * lectura») y nunca se escriben: quien navega recibe siempre la forma pública.
 */

export type SeccionTerritorial = "insumos" | "modelo" | "control" | "avance";

export type SeccionInternaTerritorial = "fuentes" | "modelo" | "calidad" | "consultas" | "avance" | "ocurrencias";

export type VistaInternaTerritorial = {
  seccion: SeccionInternaTerritorial;
  pestana: string;
};

export type DireccionTerritorial = {
  seccion: SeccionTerritorial;
  pestana: string;
  /** Sub-vista de una pestaña que absorbe varias; `null` es la principal. */
  panel: string | null;
};

/** Lo que la URL pide, ya normalizado; cualquiera de los tres puede faltar. */
export type DireccionTerritorialPedida = {
  seccion: string | null;
  pestana: string | null;
  panel: string | null;
};

type Entrada = {
  publica: DireccionTerritorial;
  interna: VistaInternaTerritorial;
  /** La pestaña ya tiene su componente nuevo: `interna` sólo decide el corte. */
  propia?: boolean;
  /**
   * Vista cuyo corte pide una pestaña propia cuando no es el de `interna`.
   * Faltante por UMP regresa a Validación › Cuotas, pero necesita el corte de
   * Avance: `validation_summary` no trae las subsanaciones del motor. Resumen,
   * al revés: `advance_summary` omite las respuestas una a una.
   */
  corte?: VistaInternaTerritorial;
  /** Rótulo de la sub-vista, sólo cuando la pestaña tiene más de una. */
  vista?: string;
  /**
   * Una vista heredada montada en dos pestañas sólo vuelve a UNA cuando un
   * enlace interno la pide por su clave vieja. `false` la saca de ese regreso.
   */
  regreso?: false;
};

function entrada(
  seccion: SeccionTerritorial,
  pestana: string,
  panel: string | null,
  interna: VistaInternaTerritorial,
  extra: Omit<Entrada, "publica" | "interna"> = {},
): Entrada {
  return { publica: { seccion, pestana, panel }, interna, ...extra };
}

const v = (seccion: SeccionInternaTerritorial, pestana: string): VistaInternaTerritorial => ({ seccion, pestana });

/**
 * La tabla, en el orden del catálogo (`MONITOREO_PESTANAS.territorial`). Dentro
 * de una pestaña, la primera entrada es la principal.
 */
const TABLA: readonly Entrada[] = [
  // Insumos: la vista principal es propia; las acciones que aún no se rehicieron
  // (releer ficha, cambiar formulario, editar el mapeo, reemplazar el padrón)
  // siguen en la vista heredada, como sub-vista.
  entrada("insumos", "conexiones", null, v("fuentes", "form"), { vista: "Fuentes", propia: true }),
  entrada("insumos", "conexiones", "consola", v("fuentes", "form"), { vista: "Administrar fuentes" }),
  entrada("insumos", "mapeo", null, v("modelo", "variables"), { vista: "Resumen", propia: true }),
  entrada("insumos", "mapeo", "editar", v("modelo", "variables"), { vista: "Editar el mapeo" }),
  entrada("insumos", "mapeo", "filtro", v("fuentes", "filter"), { vista: "Filtro y distritos" }),
  entrada("insumos", "padron", null, v("fuentes", "roster"), { vista: "Padrón", propia: true }),
  entrada("insumos", "padron", "archivo", v("fuentes", "roster"), { vista: "Reemplazar padrón" }),
  entrada("insumos", "historial", null, v("fuentes", "history"), { propia: true }),
  entrada("modelo", "metas", null, v("modelo", "resumen"), { vista: "Cobertura", propia: true }),
  entrada("modelo", "metas", "manzanas", v("modelo", "tabla"), { vista: "Manzanas" }),
  entrada("modelo", "cuotas", null, v("calidad", "cuotas"), { regreso: false, propia: true }),
  entrada("control", "bandeja", null, v("consultas", "registro"), { vista: "Registro", propia: true }),
  entrada("control", "bandeja", "gps", v("consultas", "gps"), { vista: "GPS" }),
  entrada("control", "bandeja", "duracion", v("consultas", "duracion"), { vista: "Duración" }),
  entrada("control", "senales", null, v("calidad", "geolocalizacion"), { vista: "GPS", propia: true }),
  entrada("control", "senales", "duracion", v("calidad", "duracion"), { vista: "Duración" }),
  // Recorrido lee `response_audit` (GPS efectivo y distancia por formulario):
  // la vista interna es la de Validación › Geolocalización, como Señales.
  entrada("control", "recorrido", null, v("calidad", "geolocalizacion"), { propia: true, regreso: false }),
  entrada("control", "equipo", null, v("consultas", "responsable"), { propia: true }),
  entrada("control", "ocurrencias", null, v("ocurrencias", "states"), { vista: "Resumen", propia: true }),
  entrada("control", "ocurrencias", "distritos", v("ocurrencias", "distritos"), { vista: "Distritos", propia: true }),
  entrada("control", "ocurrencias", "ritmo", v("ocurrencias", "rhythm"), { vista: "Ritmo", propia: true }),
  entrada("control", "reportes", null, v("ocurrencias", "registro"), { vista: "Reporte por UMP", propia: true }),
  entrada("control", "reportes", "ump", v("ocurrencias", "ump"), { vista: "UMP" }),
  entrada("control", "reportes", "alertas", v("ocurrencias", "alerts"), { vista: "Alertas" }),
  entrada("control", "subsanaciones", null, v("consultas", "subsanaciones"), { propia: true }),
  entrada("control", "anulaciones", null, v("calidad", "anulacion"), { propia: true }),
  // Conciliación pide el corte de Validación, que trae el cruce de códigos y la
  // UMP declarada; regresa a Fuente › Reconciliación para los enlaces viejos.
  entrada("control", "conciliacion", null, v("fuentes", "reconciliation"), { vista: "Códigos", propia: true, corte: v("calidad", "geolocalizacion") }),
  entrada("control", "conciliacion", "espacial", v("calidad", "reconciliacion"), { vista: "Sospechas espaciales" }),
  // Faltante por UMP reemplaza a Validación › Cuotas (§3.17): la vista vieja
  // vuelve aquí cuando un enlace interno la pide.
  entrada("avance", "faltante", null, v("calidad", "cuotas"), { propia: true, corte: v("avance", "faltante") }),
  // Resumen cuenta los motivos de observación caso por caso: pide el corte de
  // Validación, el único con `response_audit` además de `advance`.
  entrada("avance", "resumen", null, v("avance", "resumen"), { vista: "Resumen", propia: true, corte: v("calidad", "geolocalizacion") }),
  entrada("avance", "resumen", "distritos", v("avance", "distritos"), { vista: "Distritos" }),
  entrada("avance", "resumen", "ritmo", v("avance", "ritmo"), { vista: "Ritmo diario" }),
  entrada("avance", "mapa", null, v("avance", "ump"), { propia: true, corte: v("avance", "mapa") }),
  entrada("avance", "umps", null, v("modelo", "tabla"), { regreso: false, propia: true, corte: v("avance", "umps") }),
  entrada("avance", "salidas", null, v("avance", "salidas")),
];

/**
 * Alias de lectura de las direcciones anteriores (§1). La clave es
 * `seccion/pestana` de la arquitectura de seis secciones; el valor, la dirección
 * pública que la reemplaza. No coincide siempre con la vista que se monta: el
 * diseño decide a dónde va cada enlace viejo.
 */
const ALIAS: Record<string, DireccionTerritorial> = {
  "fuentes/form": d("insumos", "conexiones"),
  "fuentes/filter": d("insumos", "mapeo", "filtro"),
  "fuentes/roster": d("insumos", "padron"),
  "fuentes/history": d("insumos", "historial"),
  "fuentes/reconciliation": d("control", "conciliacion"),
  "modelo/variables": d("insumos", "mapeo"),
  "modelo/resumen": d("avance", "mapa"),
  "modelo/tabla": d("avance", "umps"),
  "calidad/geolocalizacion": d("control", "senales"),
  "calidad/duracion": d("control", "senales", "duracion"),
  "calidad/reconciliacion": d("control", "conciliacion", "espacial"),
  "calidad/cuotas": d("avance", "faltante"),
  "calidad/anulacion": d("control", "anulaciones"),
  "consultas/registro": d("control", "bandeja"),
  "consultas/gps": d("control", "bandeja", "gps"),
  "consultas/duracion": d("control", "bandeja", "duracion"),
  "consultas/responsable": d("control", "equipo"),
  "consultas/subsanaciones": d("control", "subsanaciones"),
  "avance/cuotas": d("avance", "faltante"),
  "avance/distritos": d("avance", "resumen"),
  "avance/ritmo": d("avance", "resumen"),
  "avance/ump": d("avance", "mapa"),
  "ocurrencias/states": d("control", "ocurrencias"),
  "ocurrencias/distritos": d("control", "ocurrencias"),
  "ocurrencias/rhythm": d("control", "ocurrencias"),
  "ocurrencias/registro": d("control", "reportes"),
  "ocurrencias/ump": d("control", "reportes"),
  "ocurrencias/alerts": d("control", "reportes"),
};

/** Sección vieja pedida sin pestaña: a dónde aterriza. */
const ALIAS_DE_SECCION: Record<string, DireccionTerritorial> = {
  fuentes: d("insumos", "conexiones"),
  calidad: d("control", "senales"),
  consultas: d("control", "bandeja"),
  ocurrencias: d("control", "ocurrencias"),
};

function d(seccion: SeccionTerritorial, pestana: string, panel: string | null = null): DireccionTerritorial {
  return { seccion, pestana, panel };
}

export const SECCIONES_TERRITORIALES: readonly SeccionTerritorial[] = ["insumos", "modelo", "control", "avance"];

/** Donde aterriza el modo: el faltante por UMP (procedimientos respondidos). */
export const ATERRIZAJE_TERRITORIAL: DireccionTerritorial = d("avance", "faltante");

/** Los `panel` que son sub-vistas de este modo, y no paneles superpuestos. */
export const PANELES_DE_SUBVISTA: readonly string[] = [
  ...new Set(TABLA.map((item) => item.publica.panel).filter((panel): panel is string => Boolean(panel))),
];

/**
 * Paneles superpuestos de cada pestaña (`usePanelDireccionable`). Vacío por
 * ahora: la ficha de UMP (P1) llega con Avance › Mapa.
 */
const PANELES_SUPERPUESTOS: Record<string, readonly string[]> = {
  // Ficha de una UMP al costado del mapa o de la tabla (`panel=ump&foco=<UMP>`).
  "avance/mapa": ["ump"],
  // Bandeja: diálogo de anular un caso. Equipo: inspector del código y anular
  // su producción (el `foco` dice cuál).
  "control/bandeja": ["anular"],
  "control/equipo": ["codigo", "anular"],
  "avance/umps": ["ump"],
};
const SIN_PANELES: readonly string[] = [];

export function panelesSuperpuestos(seccion: string, pestana: string): readonly string[] {
  return PANELES_SUPERPUESTOS[`${seccion}/${pestana}`] ?? SIN_PANELES;
}

/** Todo `panel` que el perfil territorial escribe: sub-vistas y superpuestos. */
export const PANELES_DEL_PERFIL: readonly string[] = [
  ...PANELES_DE_SUBVISTA,
  ...new Set(Object.values(PANELES_SUPERPUESTOS).flat()),
];

export function esSeccionTerritorial(valor: string | null | undefined): valor is SeccionTerritorial {
  return valor != null && (SECCIONES_TERRITORIALES as readonly string[]).includes(valor);
}

function mismaDireccion(a: DireccionTerritorial, b: DireccionTerritorial) {
  return a.seccion === b.seccion && a.pestana === b.pestana && (a.panel ?? null) === (b.panel ?? null);
}

function entradaDe(direccion: DireccionTerritorial): Entrada | undefined {
  return TABLA.find((item) => mismaDireccion(item.publica, direccion));
}

/** Pestañas públicas de una sección, en orden y sin repetir. */
export function pestanasDeSeccion(seccion: SeccionTerritorial): string[] {
  return [...new Set(TABLA.filter((item) => item.publica.seccion === seccion).map((item) => item.publica.pestana))];
}

/** La primera pestaña de una sección (la que abre su píldora). */
export function direccionDeSeccion(seccion: SeccionTerritorial): DireccionTerritorial {
  if (seccion === ATERRIZAJE_TERRITORIAL.seccion) return ATERRIZAJE_TERRITORIAL;
  return d(seccion, pestanasDeSeccion(seccion)[0] ?? "");
}

/** Vista heredada que una dirección monta (o cuyo corte pide, si es propia). */
export function vistaDeDireccion(direccion: DireccionTerritorial): VistaInternaTerritorial {
  const item = entradaDe(direccion) ?? entradaDe(d(direccion.seccion, direccion.pestana)) ?? entradaDe(ATERRIZAJE_TERRITORIAL)!;
  return item.corte ?? item.interna;
}

/** Vista heredada que una dirección absorbe (columna «Absorbe de hoy» de §1). */
export function vistaQueAbsorbe(direccion: DireccionTerritorial): VistaInternaTerritorial {
  return (entradaDe(direccion) ?? entradaDe(d(direccion.seccion, direccion.pestana)) ?? entradaDe(ATERRIZAJE_TERRITORIAL)!).interna;
}

/**
 * ¿La dirección ya tiene su contenido propio? Se mira la sub-vista exacta: en
 * Avance › Resumen sólo la principal es propia y Distritos y Ritmo diario
 * siguen montando la vista heredada.
 */
export function esPestanaPropia(direccion: DireccionTerritorial): boolean {
  return Boolean((entradaDe(direccion) ?? entradaDe(d(direccion.seccion, direccion.pestana)))?.propia);
}

/**
 * La pestaña pinta su propio rótulo y la página no pone `CabeceraTerritorial`.
 * Son las pestañas propias más Avance › Salidas, cuyo workbench común lleva el
 * rótulo en su primera tarjeta. No es `esPestanaPropia`: esa también decide
 * qué cortes pide la pestaña, y Salidas no pide ninguno extra.
 */
export function llevaRotuloEnLaPestana(direccion: DireccionTerritorial): boolean {
  return esPestanaPropia(direccion) || (direccion.seccion === "avance" && direccion.pestana === "salidas");
}

/**
 * Dirección pública que corresponde a una vista heredada, para los enlaces
 * internos que todavía nombran la clave vieja (`onCambioPestana("duracion")`
 * desde Geolocalización). Las marcadas `regreso: false` no reciben ese
 * regreso; si nada la monta, se usa el alias del diseño.
 */
export function direccionDeVista(vista: VistaInternaTerritorial): DireccionTerritorial {
  const directa = TABLA.find((item) => item.regreso !== false
    && item.interna.seccion === vista.seccion
    && item.interna.pestana === vista.pestana);
  if (directa) return directa.publica;
  return ALIAS[`${vista.seccion}/${vista.pestana}`] ?? ATERRIZAJE_TERRITORIAL;
}

/** Sub-vistas de una pestaña pública con su rótulo. Vacío si tiene una sola. */
export function subvistasDePestana(seccion: SeccionTerritorial, pestana: string): Array<{
  panel: string | null;
  etiqueta: string;
}> {
  const propias = TABLA.filter((item) => item.publica.seccion === seccion && item.publica.pestana === pestana);
  if (propias.length < 2) return [];
  return propias.map((item) => ({ panel: item.publica.panel, etiqueta: item.vista ?? item.publica.pestana }));
}

/**
 * La dirección pública que pide una URL, aceptando la forma pública y los
 * alias. `null` cuando no pide nada de este modo: quien llama decide.
 */
export function direccionPedida(pedida: DireccionTerritorialPedida): DireccionTerritorial | null {
  const { seccion, pestana, panel } = pedida;
  if (!seccion) return null;
  if (esSeccionTerritorial(seccion)) {
    if (pestana) {
      const conPanel = panel && PANELES_DE_SUBVISTA.includes(panel) ? entradaDe(d(seccion, pestana, panel)) : undefined;
      if (conPanel) return conPanel.publica;
      const principal = entradaDe(d(seccion, pestana));
      if (principal) return principal.publica;
      // `modelo` y `avance` existen en las dos arquitecturas: su pestaña vieja
      // (`modelo/tabla`, `avance/ump`) se lee como alias.
      const alias = ALIAS[`${seccion}/${pestana}`];
      if (alias) return alias;
    }
    return direccionDeSeccion(seccion);
  }
  if (pestana) {
    const alias = ALIAS[`${seccion}/${pestana}`];
    if (alias) return alias;
  }
  return ALIAS_DE_SECCION[seccion] ?? null;
}

/** Dirección inicial: la que pide la URL o, si no pide nada, el aterrizaje. */
export function direccionInicial(pedida: DireccionTerritorialPedida): DireccionTerritorial {
  return direccionPedida(pedida) ?? ATERRIZAJE_TERRITORIAL;
}

/** ¿La URL pide algo distinto de lo que se ve? */
export function pideOtraDireccion(pedida: DireccionTerritorialPedida, activa: DireccionTerritorial): boolean {
  const destino = direccionPedida(pedida);
  return destino != null && !mismaDireccion(destino, activa);
}

/** Todas las direcciones públicas, para los contratos. */
export function direccionesPublicas(): DireccionTerritorial[] {
  return TABLA.map((item) => item.publica);
}

/** Todos los alias declarados, para los contratos. */
export function aliasDeLectura(): Record<string, DireccionTerritorial> {
  return { ...ALIAS };
}
