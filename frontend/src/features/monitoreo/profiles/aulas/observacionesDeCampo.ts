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

export function observacionesDeCampo(partes: ReadonlyArray<Fila>): ResumenDeObservaciones {
  const grupos = new Map<string, ObservacionDeCampo & { porAplicador: Map<string, number> }>();
  let conNota = 0;

  for (const p of partes) {
    const texto = txt(p.field_note);
    if (!texto) continue;
    conNota += 1;
    const k = clave(texto);
    const g = grupos.get(k) ?? {
      texto, aulas: 0, codigos: [], aplicadores: [], facultades: [], ultima: "",
      porAplicador: new Map<string, number>(),
    };
    g.aulas += 1;
    const codigo = txt(p.operational_code);
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

  return { observaciones, conNota, partes: partes.length };
}
