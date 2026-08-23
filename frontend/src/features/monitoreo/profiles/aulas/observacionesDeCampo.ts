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

/** Para agrupar: mismo mensaje escrito con otra caja o espacios es el mismo. */
const clave = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[.;,]+$/, "").trim();

export type ObservacionDeCampo = {
  /** El texto tal como lo escribió quien estuvo en el aula. */
  texto: string;
  aulas: number;
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

  for (const p of [...partes, ...registros]) {
    const texto = txt(p.field_note);
    if (!texto) continue;
    // **Sólo se deduplica lo que se puede identificar.** Sin `operational_code`
    // no hay forma de saber si dos notas iguales son la misma aula por dos
    // caminos o dos aulas distintas que reportaron lo mismo —que es justo el
    // patrón que este panel existe para enseñar—. Ante la duda cuentan las dos:
    // fundir dos incidencias reales en una borra la mitad del hallazgo.
    const codigo = txt(p.operational_code);
    if (codigo) {
      const huella = `${codigo}\u0000${clave(texto)}`;
      if (vistos.has(huella)) continue;
      vistos.add(huella);
    }
    conNota += 1;
    const k = clave(texto);
    const g = grupos.get(k) ?? {
      texto, aulas: 0, codigos: [], aplicadores: [], facultades: [], ultima: "",
      porAplicador: new Map<string, number>(),
    };
    g.aulas += 1;
    if (codigo && !g.codigos.includes(codigo)) g.codigos.push(codigo);
    const quien = txt(p.applied_by);
    if (quien) g.porAplicador.set(quien, (g.porAplicador.get(quien) ?? 0) + 1);
    const facultad = txt(p.faculty);
    if (facultad && !g.facultades.includes(facultad)) g.facultades.push(facultad);
    const fecha = txt(p.applied_date);
    if (fecha > g.ultima) g.ultima = fecha;
    grupos.set(k, g);
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
  const universo = new Set<string>();
  for (const p of [...partes, ...registros]) {
    const codigo = txt(p.operational_code);
    if (codigo) universo.add(codigo);
  }
  return { observaciones, conNota, partes: universo.size || partes.length };
}
