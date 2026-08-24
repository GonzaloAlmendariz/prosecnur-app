/**
 * Lo que el campo reportó, agrupado por lo que dice.
 *
 * `field_note` —«OBSERVACIONES SOBRE APLICACIONES» en el libro— tenía formulario
 * de entrada, rótulo y viaje al backend, y **cero superficies de lectura**: el
 * aplicador escribía y nadie lo veía nunca. En el corte hay 16 de 152 partes con
 * observación.
 *
 * **Se agrupa por texto, y ése es el hallazgo del diseño.** Las 16 del corte
 * dicen exactamente lo mismo —«el docente pidió empezar al final de la clase»—
 * entre dos equipos. Listadas una a una serían dieciséis incidencias sueltas;
 * agrupadas son **un patrón del operativo**, que es lo que un jefe de campo
 * puede accionar: si el docente pide empezar al final en ocho aulas, eso cambia
 * cómo se agenda, no cómo se aplica.
 *
 * **Dos fuentes, no una.** La misma observación puede llegar por dos caminos:
 * el parte del libro —que el jefe de campo transcribe desde la ficha de papel— o
 * el registro de esta app, que guarda su `field_note` en la fila del plan. El
 * panel leía sólo la primera, y su propio vacío decía «se escriben al registrar
 * un aula»: exactamente el camino que no miraba. Medido el 2026-08-23,
 * registrando un aula con observación sobre el estudio de 193 — la nota quedaba
 * en el plan, `aulas_aplicadas` subía a 1 y el panel seguía enseñando cero.
 *
 * Es media reparación del defecto que este archivo ya documenta arriba: se le
 * dio superficie de lectura a `field_note` del libro y se dejó sin ella al del
 * registro, que era el caso original.
 */

type Fila = Readonly<Record<string, unknown>>;

const txt = (v: unknown) => String(v ?? "").trim();

/**
 * Si esta unidad ya tuvo gestión, y por tanto pudo traer observación.
 *
 * **La observación la escribe quien agenda, no sólo quien aplica.** Gonzalo,
 * 2026-08-24: «la observación va a ser algo que el agendador siempre va a
 * escribir». Una llamada que no entra, un docente que pide otro día o un aula
 * que cambió de sitio se anotan al gestionar la cita, mucho antes de que nadie
 * pise el aula — así que exigir señal de campo dejaba fuera del denominador
 * justo el caso más común. Medido: dos notas escritas al agendar contra una
 * sola aula aplicada publicaban **«2 de 1»**.
 *
 * Cuentan cuatro señales, y la primera es la decisiva: **si trae nota, alguien
 * la escribió**, y una unidad no puede quedar fuera del denominador de su
 * propia observación. Las otras tres —cita fijada, paso por campo, cifra
 * declarada— se miran todas porque una fila corregida a mano en el Excel puede
 * traer los números sin el estado, o el estado sin la hora, y descartarla por
 * el campo que le falta borraría un aula que sí se gestionó.
 */
function tuvoGestion(fila: Fila): boolean {
  if (txt(fila.field_note) || txt(fila.replacement_note)) return true;
  if (txt(fila.scheduled_date) || txt(fila.scheduled_time)) return true;
  if (txt(fila.applied_at) || txt(fila.applied_date)) return true;
  const estado = txt(fila.operational_status).toLowerCase();
  if (estado === "aplicada" || estado === "aplicado") return true;
  for (const k of ["effective_surveys", "efectivas", "attendees", "asistentes"]) {
    const v = fila[k];
    if (v != null && v !== "" && Number(v) > 0) return true;
  }
  return false;
}

/** Para agrupar: mismo mensaje escrito con otra caja o espacios es el mismo. */
const clave = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[.;,]+$/, "").trim();

/**
 * De cuál de las dos columnas del libro salió la observación.
 *
 * **Son dos campos distintos en dos hojas distintas**, y hasta hoy el panel
 * leía uno solo:
 *
 * - `agenda` → hoja «Aulas Agendadas», columna «OBSERVACIONES (SOBRE AULAS
 *   AGENDADAS)». Viaja en `replacement_note` —el nombre es heredado y dice
 *   «nota de reemplazo», que es otra cosa—. La escribe quien gestiona la cita:
 *   por qué costó, qué pidió el docente, si cambió el aula.
 * - `aplicacion` → hoja «Aulas Aplicadas (Campo)», columna «OBSERVACIONES SOBRE
 *   APLICACIONES», en `field_note`. La escribe quien estuvo en el aula.
 *
 * La de agendación es la más abundante —en 2025 fueron 190, prácticamente una
 * por aula— y era justo la que no llegaba a este panel: se veía sólo como una
 * línea suelta dentro de la ruta del día, sin agruparse con ninguna otra. Un
 * patrón repetido en cuarenta aulas no se ve mirando cuarenta líneas sueltas.
 */
export type OrigenDeObservacion = "agenda" | "aplicacion";

export type ObservacionDeCampo = {
  /** El texto tal como lo escribió quien estuvo en el aula. */
  texto: string;
  aulas: number;
  /**
   * Las columnas de las que salió este texto. Casi siempre una; las dos cuando
   * lo mismo se anotó al agendar y al aplicar, que es información: el problema
   * se anticipó y volvió a pasar.
   */
  origenes: OrigenDeObservacion[];
  /** Códigos de las aulas, para poder ir a ellas. */
  codigos: string[];
  /** Quién lo reportó, de más a menos veces. */
  aplicadores: string[];
  facultades: string[];
  /** La más reciente de las fechas, para ordenar lo nuevo primero. */
  ultima: string;
};

export type ResumenDeObservaciones = {
  observaciones: ObservacionDeCampo[];
  /** Partes con observación, sobre el total. */
  conNota: number;
  partes: number;
};

export function observacionesDeCampo(
  partes: ReadonlyArray<Fila>,
  registros: ReadonlyArray<Fila> = [],
): ResumenDeObservaciones {
  const grupos = new Map<string, ObservacionDeCampo & { porAplicador: Map<string, number> }>();
  let conNota = 0;
  // Un aula puede traer la MISMA nota por los dos caminos —se registró en la app
  // y además se transcribió al libro—. Sin esta guarda contaría dos aulas donde
  // hay una, y «2 aulas» sobre un operativo de una sola es peor que no decirlo.
  // Si los textos difieren son dos observaciones distintas del mismo aula, y ahí
  // las dos cuentan: son dos cosas que alguien vio.
  const vistos = new Set<string>();

  // Cada unidad puede traer DOS observaciones, una por columna del libro, y son
  // dos cosas distintas: lo que costó agendarla y lo que pasó al aplicarla.
  const notasDe = (fila: Fila): Array<[OrigenDeObservacion, string]> => {
    const out: Array<[OrigenDeObservacion, string]> = [];
    const agenda = txt(fila.replacement_note);
    if (agenda) out.push(["agenda", agenda]);
    const aplicacion = txt(fila.field_note);
    if (aplicacion) out.push(["aplicacion", aplicacion]);
    return out;
  };

  for (const p of [...partes, ...registros]) {
    for (const [origen, texto] of notasDe(p)) {
      // **Sólo se deduplica lo que se puede identificar.** Sin `operational_code`
      // no hay forma de saber si dos notas iguales son la misma aula por dos
      // caminos o dos aulas distintas que reportaron lo mismo —que es justo el
      // patrón que este panel existe para enseñar—. Ante la duda cuentan las dos:
      // fundir dos incidencias reales en una borra la mitad del hallazgo.
      const codigo = txt(p.operational_code);
      if (codigo) {
        // La huella lleva el origen: la misma frase anotada al agendar y al
        // aplicar son dos hechos —se anticipó y volvió a pasar—, no una nota
        // repetida. Lo que se deduplica es la MISMA columna llegando dos veces,
        // que es lo que ocurre cuando el parte del libro y el registro de la app
        // dicen lo mismo.
        const huella = `${codigo}\u0000${origen}\u0000${clave(texto)}`;
        if (vistos.has(huella)) continue;
        vistos.add(huella);
      }
      conNota += 1;
      const k = clave(texto);
      const g = grupos.get(k) ?? {
        texto, aulas: 0, origenes: [] as OrigenDeObservacion[],
        codigos: [], aplicadores: [], facultades: [], ultima: "",
        porAplicador: new Map<string, number>(),
      };
      g.aulas += 1;
      if (!g.origenes.includes(origen)) g.origenes.push(origen);
      if (codigo && !g.codigos.includes(codigo)) g.codigos.push(codigo);
      const quien = txt(p.applied_by);
      if (quien) g.porAplicador.set(quien, (g.porAplicador.get(quien) ?? 0) + 1);
      const fecha = txt(p.applied_date) || txt(p.scheduled_date);
      const facultad = txt(p.faculty);
      if (facultad && !g.facultades.includes(facultad)) g.facultades.push(facultad);
      if (fecha > g.ultima) g.ultima = fecha;
      grupos.set(k, g);
    }
  }

  const observaciones = [...grupos.values()]
    .map(({ porAplicador, ...g }) => ({
      ...g,
      aplicadores: [...porAplicador.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
        .map(([quien]) => quien),
    }))
    // Lo repetido primero: es lo que puede ser un patrón. A igualdad, lo más
    // reciente, que es por donde mira un jefe de campo.
    .sort((a, b) => b.aulas - a.aulas || b.ultima.localeCompare(a.ultima));

  // El denominador son las unidades que PUDIERON traer observación por
  // cualquiera de los dos caminos, contadas una vez: sumar las dos listas daría
  // un total mayor que el operativo.
  //
  // **Y sólo las que ya tuvieron gestión.** El panel recibe como `registros` la
  // agenda entera —2.616 filas— porque ahí es donde esta app deja su
  // `field_note`, pero una fila que nadie ha tocado todavía no pudo observar
  // nada. Medido el 2026-08-24 sobre el proyecto simulado, con 3 partes en el
  // libro y 13 unidades gestionadas, el panel publicaba **«4 de 2.616 partes
  // traen observación»**. Las cuatro son las mismas; el denominador convertía
  // un tercio de la gestión en un residuo del 0,15 %, que es la diferencia
  // entre «el campo está reportando» y «el campo no reporta nada».
  const universo = new Set<string>();
  for (const p of partes) {
    const codigo = txt(p.operational_code);
    if (codigo) universo.add(codigo);
  }
  for (const p of registros) {
    if (!tuvoGestion(p)) continue;
    const codigo = txt(p.operational_code);
    if (codigo) universo.add(codigo);
  }
  return { observaciones, conNota, partes: universo.size || partes.length };
}
