/**
 * Traducción entre la dirección pública del modo Telefónico y las vistas que
 * la página monta por dentro.
 *
 * Por qué existe. El revamp de Monitoreo (2026-10-23) reordenó el modo en el
 * esqueleto común de cuatro secciones —Insumos, Modelo, Control y Avance— con
 * las pestañas de `docs/qa/revamp-monitoreo/telefonico.md` §1. La página
 * (`TelefonicoMonitoreoPage.tsx`) está congelada a crecimiento y sabe montar
 * las vistas por su clave histórica (`fuentes/activas`, `telefonico/incidencia`,
 * `consultas/cruces`…). Mientras cada pestaña nueva no tenga su contenido
 * propio, monta la vista que absorbe (columna «Absorbe» de §1): así la
 * navegación cambia sin perder ninguna capacidad.
 *
 * La traducción es una tabla y no una cadena de `if`: cada vista interna tiene
 * exactamente una dirección pública, y cada dirección pública una vista. Cuando
 * una pestaña absorbe más de una vista, las demás cuelgan de ella como
 * `panel` (Respuestas › Salvedades, Cuotas y calendario › Calendario), el mismo
 * recurso que el diseño usa en Equipo para «Estados por operador».
 *
 * Las claves históricas se LEEN como alias —hay enlaces guardados y corridas de
 * QA que las usan— y nunca se escriben: quien navega recibe siempre la forma
 * pública.
 */

export type SeccionTelefonica = "insumos" | "modelo" | "control" | "avance";

export type SeccionInterna = "fuentes" | "modelo" | "telefonico" | "consultas" | "avance";

export type VistaInterna = {
  seccion: SeccionInterna;
  pestana: string;
};

export type DireccionTelefonica = {
  seccion: SeccionTelefonica;
  pestana: string;
  /** Sub-vista de una pestaña que absorbe varias; `null` es la principal. */
  panel: string | null;
};

/** Lo que la URL pide, ya normalizado; cualquiera de los tres puede faltar. */
export type DireccionPedida = {
  seccion: string | null;
  pestana: string | null;
  panel: string | null;
};

type Entrada = {
  publica: DireccionTelefonica;
  interna: VistaInterna;
  /** Rótulo de la sub-vista, sólo cuando la pestaña tiene más de una. */
  vista?: string;
};

function entrada(
  seccion: SeccionTelefonica,
  pestana: string,
  panel: string | null,
  interna: VistaInterna,
  vista?: string,
): Entrada {
  return { publica: { seccion, pestana, panel }, interna, vista };
}

/**
 * La tabla. El orden de las secciones y pestañas es el del catálogo
 * (`MONITOREO_PESTANAS.telefonico`); dentro de una pestaña, la primera entrada
 * es la principal.
 */
const TABLA: readonly Entrada[] = [
  entrada("insumos", "fuentes", null, { seccion: "fuentes", pestana: "activas" }),
  entrada("insumos", "llave", null, { seccion: "fuentes", pestana: "survey" }),
  entrada("insumos", "estados", null, { seccion: "fuentes", pestana: "sheets" }),
  entrada("modelo", "cuotas", null, { seccion: "modelo", pestana: "estructura" }, "Cuotas"),
  entrada("modelo", "cuotas", "calendario", { seccion: "modelo", pestana: "estrategias" }, "Calendario"),
  entrada("control", "barrido", null, { seccion: "telefonico", pestana: "resumen" }),
  entrada("control", "insistencia", null, { seccion: "telefonico", pestana: "incidencia" }),
  entrada("control", "equipo", null, { seccion: "telefonico", pestana: "responsables" }),
  entrada("control", "discrepancias", null, { seccion: "consultas", pestana: "cruces" }),
  // Respuestas integra «Efectivas Kobo» y «Validación de tiempo» (T6); la
  // dirección vieja `panel=tiempos` se lee como la pestaña.
  entrada("control", "respuestas", null, { seccion: "consultas", pestana: "plataforma" }, "Efectivas"),
  entrada("control", "respuestas", "salvedades", { seccion: "consultas", pestana: "subsanacion" }, "Salvedades"),
  entrada("control", "supervision", null, { seccion: "telefonico", pestana: "supervision" }),
  entrada("control", "avisos", null, { seccion: "telefonico", pestana: "alertas" }),
  entrada("avance", "cuotas", null, { seccion: "avance", pestana: "actores" }),
  entrada("avance", "ritmo", null, { seccion: "avance", pestana: "resumen" }),
  entrada("avance", "entregas", null, { seccion: "avance", pestana: "salidas" }),
];

/**
 * Vistas internas que la página conserva pero el modo telefónico no muestra:
 * se leen como la vista visible que las sustituye.
 */
const INTERNAS_OCULTAS: Record<string, VistaInterna> = {
  "fuentes/collectors": { seccion: "fuentes", pestana: "survey" },
  "modelo/resumen": { seccion: "modelo", pestana: "estructura" },
  "consultas/base": { seccion: "consultas", pestana: "plataforma" },
  "telefonico/consultados": { seccion: "consultas", pestana: "plataforma" },
  "telefonico/dia": { seccion: "avance", pestana: "resumen" },
  "telefonico/tiempos": { seccion: "consultas", pestana: "plataforma" },
  "avance/encuestas": { seccion: "avance", pestana: "actores" },
  "avance/detalle": { seccion: "avance", pestana: "actores" },
};

/** Vista de cada sección interna cuando la dirección vieja no trae pestaña. */
const INTERNA_POR_DEFECTO: Record<SeccionInterna, VistaInterna> = {
  fuentes: { seccion: "fuentes", pestana: "activas" },
  modelo: { seccion: "modelo", pestana: "estructura" },
  telefonico: { seccion: "telefonico", pestana: "resumen" },
  consultas: { seccion: "consultas", pestana: "plataforma" },
  avance: { seccion: "avance", pestana: "actores" },
};

export const SECCIONES_TELEFONICAS: readonly SeccionTelefonica[] = ["insumos", "modelo", "control", "avance"];

const SECCIONES_INTERNAS: readonly SeccionInterna[] = ["fuentes", "modelo", "telefonico", "consultas", "avance"];

/** Donde aterriza el modo: el faltante por cuota (procedimientos respondidos). */
export const ATERRIZAJE_TELEFONICO: VistaInterna = { seccion: "avance", pestana: "actores" };

/** Los `panel` que son sub-vistas de este modo, y no paneles superpuestos. */
export const PANELES_DE_SUBVISTA: readonly string[] = TABLA
  .map((item) => item.publica.panel)
  .filter((panel): panel is string => Boolean(panel));

export function esSeccionTelefonica(valor: string | null): valor is SeccionTelefonica {
  return valor != null && (SECCIONES_TELEFONICAS as readonly string[]).includes(valor);
}

function esSeccionInterna(valor: string | null): valor is SeccionInterna {
  return valor != null && (SECCIONES_INTERNAS as readonly string[]).includes(valor);
}

function mismaVista(a: { seccion: string; pestana: string }, b: { seccion: string; pestana: string }) {
  return a.seccion === b.seccion && a.pestana === b.pestana;
}

/** La dirección pública de una vista interna. Lo que no está en la tabla aterriza. */
export function direccionDeVista(vista: { seccion: string; pestana: string }): DireccionTelefonica {
  const directa = TABLA.find((item) => mismaVista(item.interna, vista));
  if (directa) return directa.publica;
  const oculta = INTERNAS_OCULTAS[`${vista.seccion}/${vista.pestana}`];
  const sustituta = oculta ? TABLA.find((item) => mismaVista(item.interna, oculta)) : null;
  if (sustituta) return sustituta.publica;
  return direccionDeVista(ATERRIZAJE_TELEFONICO);
}

/** Pestañas públicas de una sección, en orden y sin repetir. */
export function pestanasDeSeccion(seccion: SeccionTelefonica): string[] {
  return [...new Set(TABLA.filter((item) => item.publica.seccion === seccion).map((item) => item.publica.pestana))];
}

/** Vista principal (sin panel) de una pestaña pública. */
export function vistaPrincipal(seccion: SeccionTelefonica, pestana: string): VistaInterna | null {
  return TABLA.find((item) => item.publica.seccion === seccion
    && item.publica.pestana === pestana
    && item.publica.panel == null)?.interna ?? null;
}

/** Vista con que se abre una sección pública: su primera pestaña. */
export function vistaDeSeccion(seccion: SeccionTelefonica): VistaInterna {
  const primera = pestanasDeSeccion(seccion)[0];
  return (primera ? vistaPrincipal(seccion, primera) : null) ?? ATERRIZAJE_TELEFONICO;
}

/** Sub-vistas de una pestaña pública, con su rótulo. Vacío si tiene una sola. */
export function subvistasDePestana(seccion: SeccionTelefonica, pestana: string): Array<{
  panel: string | null;
  etiqueta: string;
  interna: VistaInterna;
}> {
  const propias = TABLA.filter((item) => item.publica.seccion === seccion && item.publica.pestana === pestana);
  if (propias.length < 2) return [];
  return propias.map((item) => ({
    panel: item.publica.panel,
    etiqueta: item.vista ?? item.publica.pestana,
    interna: item.interna,
  }));
}

/**
 * La vista que pide una dirección, aceptando la forma pública y las claves
 * históricas. `null` cuando la dirección no pide nada de este modo (sin
 * sección o con una que no reconoce): quien llama decide si aterriza.
 */
export function vistaPedida(pedida: DireccionPedida): VistaInterna | null {
  const { seccion, pestana, panel } = pedida;
  if (!seccion) return null;

  if (esSeccionTelefonica(seccion)) {
    if (pestana) {
      const exacta = TABLA.find((item) => item.publica.seccion === seccion
        && item.publica.pestana === pestana
        && item.publica.panel === (panel && PANELES_DE_SUBVISTA.includes(panel) ? panel : null));
      if (exacta) return exacta.interna;
      const principal = vistaPrincipal(seccion, pestana);
      if (principal) return principal;
      // Sección nueva con una pestaña histórica (`seccion=control&pestana=incidencia`):
      // vale si esa vista vive en esta sección.
      const historica = TABLA.find((item) => item.publica.seccion === seccion && item.interna.pestana === pestana);
      if (historica) return historica.interna;
    }
    // `modelo` y `avance` existen en las dos arquitecturas: su pestaña histórica
    // se resuelve más abajo, como alias.
    if (!pestana || !esSeccionInterna(seccion)) return vistaDeSeccion(seccion);
  }

  if (esSeccionInterna(seccion)) {
    if (pestana) {
      const vista = { seccion, pestana };
      if (TABLA.some((item) => mismaVista(item.interna, vista))) return vista;
      const oculta = INTERNAS_OCULTAS[`${seccion}/${pestana}`];
      if (oculta) return oculta;
    }
    if (esSeccionTelefonica(seccion)) return vistaDeSeccion(seccion);
    return INTERNA_POR_DEFECTO[seccion];
  }

  return null;
}

/** Vista inicial: la que pide la dirección o, si no pide nada, el aterrizaje. */
export function vistaInicial(pedida: DireccionPedida): VistaInterna {
  return vistaPedida(pedida) ?? ATERRIZAJE_TELEFONICO;
}

/**
 * ¿La dirección pide algo distinto de lo que se ve? Una dirección que no pide
 * nada de este modo no es una petición.
 */
export function pideOtraVista(pedida: DireccionPedida, activa: { seccion: string; pestana: string }): boolean {
  const vista = vistaPedida(pedida);
  return vista != null && !mismaVista(vista, activa);
}

/** La vista con que se abre una sección pedida por su píldora. */
export function vistaDeSeccionPedida(seccion: string): VistaInterna {
  return esSeccionTelefonica(seccion) ? vistaDeSeccion(seccion) : ATERRIZAJE_TELEFONICO;
}

/**
 * La pestaña interna con que arranca una sección de la página: la de la vista
 * de entrada si es de esa sección, si no la que la sección trae por defecto.
 */
export function pestanaDeEntrada<T extends string>(entrada: VistaInterna, seccion: SeccionInterna, porDefecto: T): T {
  return entrada.seccion === seccion ? entrada.pestana as T : porDefecto;
}

/**
 * Paneles superpuestos de cada pestaña (`usePanelDireccionable`): la ficha de
 * un caso en Insistencia (`panel=caso&foco=<CodPulso>`).
 */
const PANELES_SUPERPUESTOS: Record<string, readonly string[]> = {
  "control/insistencia": ["caso"],
  // «Estados por operador» de Equipo: una vista con dirección, como la ficha.
  "control/equipo": ["estados"],
};

const SIN_PANELES: readonly string[] = [];

export function panelesSuperpuestos(seccion: string, pestana: string): readonly string[] {
  return PANELES_SUPERPUESTOS[`${seccion}/${pestana}`] ?? SIN_PANELES;
}

/** Todo `panel` que el perfil telefónico escribe: sub-vistas y superpuestos. */
export const PANELES_DEL_PERFIL: readonly string[] = [
  ...PANELES_DE_SUBVISTA,
  // Sub-vistas retiradas: se leen y la dirección se limpia al escribir.
  "tiempos",
  ...new Set(Object.values(PANELES_SUPERPUESTOS).flat()),
];

/** Vista interna de una dirección pública dicha como texto (los destinos de Avisos). */
export function vistaDeDestino(seccion: string, pestana: string): VistaInterna | null {
  return esSeccionTelefonica(seccion) ? vistaPrincipal(seccion, pestana) : null;
}
