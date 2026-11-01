/**
 * Dirección pública del modo Cursos-horario y la vista que se monta para cada una.
 *
 * El revamp de Monitoreo (2026-10-23) reordenó el modo en el esqueleto común
 * de cuatro secciones —Insumos, Modelo, Control y Avance— con las 18 pestañas
 * de `docs/qa/revamp-monitoreo/aulas.md` §1. La página guarda como estado la
 * dirección PÚBLICA; esta tabla dice qué vista heredada monta cada una (la
 * columna «Absorbe de hoy»). Si una pestaña absorbe varias, la primera es la
 * principal y las demás cuelgan de ella como sub-vista con `panel`, igual que
 * en Territorial y Telefónico.
 *
 * Las pestañas que ya tienen contenido propio llevan `propia`, como en
 * `direccionTerritorial.ts`: la página monta su componente nuevo y `interna`
 * sigue decidiendo qué corte del motor se pide. Las demás montan la vista
 * heredada.
 *
 * Las direcciones de la arquitectura anterior (Fuentes, Agenda, Validación,
 * Consultas y Avance) se LEEN como alias y nunca se escriben: quien navega
 * recibe siempre la forma pública.
 */

export type SeccionAulas = "insumos" | "modelo" | "control" | "avance";

export type SeccionInternaAulas = "fuentes" | "modelo" | "calidad" | "consultas" | "avance";

export type VistaInternaAulas = {
  seccion: SeccionInternaAulas;
  /** `""` en Fuentes, que es una hoja sin pestañas. */
  pestana: string;
};

export type DireccionAulas = {
  seccion: SeccionAulas;
  pestana: string;
  /** Sub-vista de una pestaña que absorbe varias; `null` es la principal. */
  panel: string | null;
};

/** Lo que la URL pide, ya normalizado; cualquiera de los tres puede faltar. */
export type DireccionAulasPedida = {
  seccion: string | null;
  pestana: string | null;
  panel: string | null;
};

type Entrada = {
  publica: DireccionAulas;
  interna: VistaInternaAulas;
  /** Rótulo de la sub-vista, sólo cuando la pestaña tiene más de una. */
  vista?: string;
  /**
   * Una vista heredada montada en dos pestañas sólo vuelve a UNA cuando un
   * enlace interno la pide por su clave vieja. `false` la saca de ese regreso.
   */
  regreso?: false;
  /** La pestaña tiene contenido propio (revamp, lote 2 en adelante). */
  propia?: boolean;
};

function entrada(
  seccion: SeccionAulas,
  pestana: string,
  panel: string | null,
  interna: VistaInternaAulas,
  extra: Omit<Entrada, "publica" | "interna"> = {},
): Entrada {
  return { publica: { seccion, pestana, panel }, interna, ...extra };
}

const v = (seccion: SeccionInternaAulas, pestana: string): VistaInternaAulas => ({ seccion, pestana });

/**
 * La tabla, en el orden del catálogo (`MONITOREO_PESTANAS.aulas`). Dentro de
 * una pestaña, la primera entrada es la principal.
 */
const TABLA: readonly Entrada[] = [
  // I1 Fuentes: la hoja Fuentes entera (operación del plan, los dos Sheets, de
  // dónde salen las respuestas). I2 Reglas lee la misma hoja —«Cómo mide el
  // estudio», «Qué cuenta como efectiva», el umbral de duración— y el criterio
  // de aula, que hoy vive en Validación › Controles.
  // I1 Fuentes: contenido propio (`insumos/FuentesAulas.tsx`). Sigue pidiendo
  // el corte de la hoja Fuentes heredada, de donde toma las operaciones.
  entrada("insumos", "fuentes", null, v("fuentes", ""), { propia: true }),
  // I2 Reglas: contenido propio (`insumos/ReglasAulas.tsx`) sobre el mismo
  // corte de Fuentes; «Criterio de aula» queda como sub-vista heredada.
  entrada("insumos", "reglas", null, v("fuentes", ""), { vista: "Cómo mide el estudio", regreso: false, propia: true }),
  entrada("insumos", "reglas", "criterio", v("calidad", "controles"), { vista: "Criterio de aula", regreso: false }),
  // I3 Aplicadores: la disponibilidad y los tramos viven hoy en Agenda › Carga,
  // que en la propuesta es Control › Distribución.
  // I3 Aplicadores: contenido propio (`insumos/AplicadoresAulas.tsx`), por
  // tramo y sobre el mecanismo real de la distribución semanal.
  entrada("insumos", "aplicadores", null, v("modelo", "carga"), { regreso: false, propia: true }),
  // M1 Metas: los mandos de Avance › Metas y la tasa del diseño de Efectividad.
  // Las dos vistas regresan a Avance (Por facultad y Rendimiento).
  // M1 Metas: contenido propio (`modelo/MetasAulas.tsx`), leído de la
  // representatividad declarada (F5 del ADR 0121).
  entrada("modelo", "metas", null, v("avance", "cuotas"), { vista: "Metas", regreso: false, propia: true }),
  entrada("modelo", "metas", "efectividad", v("avance", "efectividad"), { vista: "Tasa del diseño", regreso: false }),
  // M2 Muestra: la cadena de reemplazos y el alcance del banco de extras.
  // M2 Muestra: contenido propio (`modelo/MuestraAulas.tsx`); «Banco de
  // extras» queda como sub-vista heredada con el detalle.
  entrada("modelo", "muestra", null, v("consultas", "reemplazos"), { vista: "Reemplazos", propia: true }),
  entrada("modelo", "muestra", "banco", v("consultas", "extras"), { vista: "Banco de extras" }),
  // Control, grupo Agenda.
  // Ctl1 Agenda: contenido propio (`control/AgendaAulas.tsx`): franja, sin
  // cita, citas vencidas y la semana de 7:00 a 22:00. Sigue pidiendo el corte
  // de la Agenda heredada; «Por facultad» queda como sub-vista heredada.
  entrada("control", "agenda", null, v("modelo", "agenda"), { vista: "Agenda", propia: true }),
  entrada("control", "agenda", "facultad", v("modelo", "facultad"), { vista: "Por facultad" }),
  // Ctl2 Contacto: contenido propio (`control/ContactoAulas.tsx`).
  entrada("control", "contacto", null, v("modelo", "contacto"), { propia: true }),
  entrada("control", "distribucion", null, v("modelo", "carga")),
  // Control, grupo Campo.
  entrada("control", "registro", null, v("calidad", "registro")),
  // «Buscar por código» deja de ser pestaña: será el inspector del
  // curso-horario (`panel=aula&foco=<código>`), que todavía no existe. Mientras
  // tanto la ficha sigue alcanzable como sub-vista de Partes, la pestaña cuya
  // pregunta —qué dice el parte de UN aula— contesta.
  entrada("control", "partes", null, v("consultas", "parte"), { vista: "Partes" }),
  entrada("control", "partes", "codigo", v("consultas", "ficha"), { vista: "Buscar por código" }),
  entrada("control", "calidad", null, v("calidad", "controles"), { vista: "Controles" }),
  entrada("control", "calidad", "base", v("calidad", "base"), { vista: "Base de control" }),
  entrada("control", "calidad", "abiertas", v("calidad", "abiertas"), { vista: "Respuestas abiertas" }),
  // Control, grupo Casos.
  entrada("control", "brechas", null, v("consultas", "brechas"), { vista: "Brechas" }),
  entrada("control", "brechas", "refuerzos", v("consultas", "refuerzos"), { vista: "Refuerzos" }),
  entrada("control", "alumnos", null, v("calidad", "alumnos")),
  // Avance.
  // A1 Resumen: contenido propio (`avance/ResumenAulas.tsx`). Sigue pidiendo
  // el corte de Avance; Cursos-horario conserva la vista heredada de Resumen.
  entrada("avance", "resumen", null, v("avance", "resumen"), { propia: true }),
  // A2 Por facultad (Por nivel): contenido propio (`avance/PorFacultadAulas.tsx`).
  // Sigue pidiendo el corte de Avance › Metas; esa vista heredada queda en
  // Modelo › Metas con sus mandos de meta y de tasa.
  entrada("avance", "porfacultad", null, v("avance", "cuotas"), { propia: true }),
  // A3 Cursos-horario: contenido propio (`avance/CursosHorarioAulas.tsx`), que
  // absorbe «Cada curso-horario contra su propio margen» (la tabla), el estado
  // por rol (Titulares) y la cobertura. Sigue pidiendo el corte de Avance.
  // La sub-vista «Estado del campo» conserva la vista heredada de Resumen con
  // los paneles que A1–A3 todavía no reparten (agendación, cierre por agenda,
  // desenlaces, qué hacer hoy con sus códigos, alerta de anticipación…).
  // «Contra su margen» (Efectividad) deja de colgar de aquí: esa vista sigue
  // entera en Avance › Rendimiento › Efectividad y en Modelo › Metas.
  entrada("avance", "cursos", null, v("avance", "resumen"), { vista: "Contra su tasa", regreso: false, propia: true }),
  entrada("avance", "cursos", "campo", v("avance", "resumen"), { vista: "Estado del campo", regreso: false }),
  // A4 Rendimiento: contenido propio (`avance/RendimientoAulas.tsx`): por día,
  // por hora, la tasa del campo contra la del diseño, día de la semana y
  // aplicador. Sigue pidiendo el corte de Rendimiento. La vista heredada queda
  // como sub-vista «Día a día por facultad» con los paneles que A4 no reparte
  // (serie por facultad, franja horaria, pronóstico de cierre, consumo del
  // banco…).
  entrada("avance", "rendimiento", null, v("avance", "rendimiento"), { vista: "Rendimiento", propia: true }),
  entrada("avance", "rendimiento", "diario", v("avance", "rendimiento"), { vista: "Día a día por facultad", regreso: false }),
  entrada("avance", "rendimiento", "efectividad", v("avance", "efectividad"), { vista: "Efectividad" }),
  // A5 Salidas: contenido propio (`avance/SalidasAulas.tsx`): las salidas del
  // corte, la vista previa de «Avance de campo» y qué toca Publicar (P2). Los
  // flujos de PDF y del Sheets del cliente siguen en el banco de salidas
  // heredado, como sub-vista «PDF y cliente».
  entrada("avance", "salidas", null, v("avance", "salidas"), { vista: "Salidas", propia: true }),
  entrada("avance", "salidas", "herramientas", v("avance", "salidas"), { vista: "PDF y cliente", regreso: false }),
];

/**
 * Alias de lectura de las direcciones anteriores (§1). La clave es
 * `seccion/pestana` de la arquitectura de cinco secciones; el valor, la
 * dirección pública que la reemplaza.
 */
const ALIAS: Record<string, DireccionAulas> = {
  // Agenda de cursos-horario (`modelo`).
  "modelo/agenda": d("control", "agenda"),
  "modelo/facultad": d("control", "agenda", "facultad"),
  "modelo/contacto": d("control", "contacto"),
  "modelo/carga": d("control", "distribucion"),
  // Validación (`calidad`).
  "calidad/registro": d("control", "registro"),
  "calidad/controles": d("control", "calidad"),
  "calidad/base": d("control", "calidad", "base"),
  "calidad/alumnos": d("control", "alumnos"),
  "calidad/abiertas": d("control", "calidad", "abiertas"),
  // Consultas.
  "consultas/ficha": d("control", "partes", "codigo"),
  "consultas/reemplazos": d("modelo", "muestra"),
  "consultas/brechas": d("control", "brechas"),
  "consultas/parte": d("control", "partes"),
  "consultas/extras": d("modelo", "muestra", "banco"),
  "consultas/refuerzos": d("control", "brechas", "refuerzos"),
  // Avance: `resumen`, `rendimiento` y `salidas` conservan su clave.
  "avance/cuotas": d("avance", "porfacultad"),
  "avance/efectividad": d("avance", "rendimiento", "efectividad"),
  // «Estratos» se retiró el 2026-09-09; un enlace guardado aterriza en Resumen.
  "avance/estratos": d("avance", "resumen"),
};

/**
 * Sección vieja pedida sin pestaña (o con una que no reconoce): a dónde
 * aterriza. Es el destino de la que era su primera pestaña.
 */
const ALIAS_DE_SECCION: Record<string, DireccionAulas> = {
  fuentes: d("insumos", "fuentes"),
  calidad: d("control", "registro"),
  consultas: d("control", "partes", "codigo"),
};

function d(seccion: SeccionAulas, pestana: string, panel: string | null = null): DireccionAulas {
  return { seccion, pestana, panel };
}

export const SECCIONES_AULAS: readonly SeccionAulas[] = ["insumos", "modelo", "control", "avance"];

/**
 * Donde aterriza el modo: Avance › Por facultad (P1 respondida: lo que falta
 * por facultad o nivel, como los demás modos).
 */
export const ATERRIZAJE_AULAS: DireccionAulas = d("avance", "porfacultad");

/** Los `panel` que son sub-vistas de este modo, y no paneles superpuestos. */
export const PANELES_DE_SUBVISTA_AULAS: readonly string[] = [
  ...new Set(TABLA.map((item) => item.publica.panel).filter((panel): panel is string => Boolean(panel))),
];

export function esSeccionAulas(valor: string | null | undefined): valor is SeccionAulas {
  return valor != null && (SECCIONES_AULAS as readonly string[]).includes(valor);
}

function mismaDireccion(a: DireccionAulas, b: DireccionAulas) {
  return a.seccion === b.seccion && a.pestana === b.pestana && (a.panel ?? null) === (b.panel ?? null);
}

function entradaDe(direccion: DireccionAulas): Entrada | undefined {
  return TABLA.find((item) => mismaDireccion(item.publica, direccion));
}

/** Pestañas públicas de una sección, en orden y sin repetir. */
export function pestanasDeSeccion(seccion: SeccionAulas): string[] {
  return [...new Set(TABLA.filter((item) => item.publica.seccion === seccion).map((item) => item.publica.pestana))];
}

/** La primera pestaña de una sección (la que abre su píldora). */
export function direccionDeSeccion(seccion: SeccionAulas): DireccionAulas {
  if (seccion === ATERRIZAJE_AULAS.seccion) return ATERRIZAJE_AULAS;
  return d(seccion, pestanasDeSeccion(seccion)[0] ?? "");
}

/** Vista heredada que una dirección monta (columna «Absorbe de hoy» de §1). */
export function vistaDeDireccion(direccion: DireccionAulas): VistaInternaAulas {
  return (entradaDe(direccion) ?? entradaDe(d(direccion.seccion, direccion.pestana)) ?? entradaDe(ATERRIZAJE_AULAS)!).interna;
}

/**
 * Dirección pública que corresponde a una vista heredada, para los enlaces
 * internos que todavía nombran la clave vieja (`irAPestana("reemplazos")`
 * desde Brechas). Las marcadas `regreso: false` no reciben ese regreso; si
 * nada la monta, se usa el alias del diseño.
 */
export function direccionDeVista(vista: VistaInternaAulas): DireccionAulas {
  const directa = TABLA.find((item) => item.regreso !== false
    && item.interna.seccion === vista.seccion
    && item.interna.pestana === vista.pestana);
  if (directa) return directa.publica;
  return ALIAS[`${vista.seccion}/${vista.pestana}`] ?? ALIAS_DE_SECCION[vista.seccion] ?? ATERRIZAJE_AULAS;
}

/** Sub-vistas de una pestaña pública con su rótulo. Vacío si tiene una sola. */
export function subvistasDePestana(seccion: SeccionAulas, pestana: string): Array<{
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
export function direccionPedida(pedida: DireccionAulasPedida): DireccionAulas | null {
  const { seccion, pestana, panel } = pedida;
  if (!seccion) return null;
  if (esSeccionAulas(seccion)) {
    if (pestana) {
      const conPanel = panel && PANELES_DE_SUBVISTA_AULAS.includes(panel) ? entradaDe(d(seccion, pestana, panel)) : undefined;
      if (conPanel) return conPanel.publica;
      const principal = entradaDe(d(seccion, pestana));
      if (principal) return principal.publica;
      // `modelo` y `avance` existen en las dos arquitecturas: su pestaña vieja
      // (`modelo/agenda`, `avance/cuotas`) se lee como alias.
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
export function direccionInicial(pedida: DireccionAulasPedida): DireccionAulas {
  return direccionPedida(pedida) ?? ATERRIZAJE_AULAS;
}

/** ¿La URL pide algo distinto de lo que se ve? */
export function pideOtraDireccion(pedida: DireccionAulasPedida, activa: DireccionAulas): boolean {
  const destino = direccionPedida(pedida);
  return destino != null && !mismaDireccion(destino, activa);
}

/** Todas las direcciones públicas, para los contratos. */
export function direccionesPublicas(): DireccionAulas[] {
  return TABLA.map((item) => item.publica);
}

/** Todas las vistas heredadas que alguna dirección monta, para los contratos. */
export function vistasMontadas(): VistaInternaAulas[] {
  return TABLA.map((item) => item.interna);
}

/** Todos los alias declarados, para los contratos. */
export function aliasDeLectura(): Record<string, DireccionAulas> {
  return { ...ALIAS };
}

/**
 * ¿La dirección ya tiene su contenido propio? Se mira la sub-vista exacta, como
 * en Territorial.
 */
export function esPestanaPropia(direccion: DireccionAulas): boolean {
  return Boolean((entradaDe(direccion) ?? entradaDe(d(direccion.seccion, direccion.pestana)))?.propia);
}

/** ¿La pestaña tiene sub-vistas que elegir? */
export function tieneSubvistas(direccion: DireccionAulas): boolean {
  return subvistasDePestana(direccion.seccion, direccion.pestana).length > 1;
}

/**
 * Dónde se ve la ficha de un curso-horario: hoy, la sub-vista «Buscar por
 * código» de Control › Partes. Cuando exista el inspector (`panel=aula`), sólo
 * cambia esta dirección.
 */
export const FICHA_DE_AULA: DireccionAulas = d("control", "partes", "codigo");

/** La sub-vista de Salidas con los flujos de PDF y del Sheets del cliente. */
export const HREF_HERRAMIENTAS_DE_SALIDAS = "/monitoreo?modo=aulas&seccion=avance&pestana=salidas&panel=herramientas";

/** El enlace a la ficha de un curso-horario, con su código en el `foco`. */
export function hrefDeFichaDeAula(codigo: string): string {
  const { seccion, pestana, panel } = FICHA_DE_AULA;
  return `/monitoreo?modo=aulas&seccion=${seccion}&pestana=${pestana}&panel=${panel ?? ""}&foco=${encodeURIComponent(`aula:${codigo}`)}`;
}
