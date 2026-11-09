// Experimento de viñetas (encuesta factorial) como bloque del editor (checklist elección por pares C10, 2026-11-07).
// Cada viñeta es un escenario escrito con huecos («{edad}») que se llenan con atributos sorteados; el encuestado lo
// califica en una escala. Comparte con la elección por pares los atributos, los niveles y el sorteo:
//   - un `once(random())` por atributo y viñeta, y su nivel y su texto, dentro del grupo de la viñeta;
//   - cada viñeta es una página (`field-list`) con el escenario y la pregunta de calificación;
//   - la escala es una lista de opciones numérica, con el rótulo de los extremos.

import {
  fila,
  formulaNivel,
  formulaTexto,
  literal,
  ref,
  validarAtributos,
  type AtributoConjoint,
  type FilaChoiceConjoint,
  type FilaSurveyConjoint,
} from "./modeloConjoint";

export type EscalaVinetas = { min: number; max: number; etiquetaMin: string; etiquetaMax: string };

export type DisenoVinetas = {
  prefijo: string;
  /** Viñetas por persona. */
  vinetas: number;
  /** El escenario, con un hueco `{clave}` por atributo. */
  texto: string;
  atributos: AtributoConjoint[];
  pregunta: string;
  escala: EscalaVinetas;
  intro?: string;
};

export type NombresVinetas = {
  azar: (vineta: number, clave: string) => string;
  nivel: (vineta: number, clave: string) => string;
  texto: (vineta: number, clave: string) => string;
  grupo: (vineta: number) => string;
  nota: (vineta: number) => string;
  calificacion: (vineta: number) => string;
  lista: string;
  intro: string;
};

const NOMBRE = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const HUECO = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

export function nombresVinetasDelEditor(prefijo: string): NombresVinetas {
  const v = (n: number, clave: string) => `${prefijo}_v${n}_${clave}`;
  return {
    azar: (n, clave) => `${v(n, clave)}_r`,
    nivel: v,
    texto: (n, clave) => `${v(n, clave)}_txt`,
    grupo: (n) => `${prefijo}_vineta${n}`,
    nota: (n) => `${prefijo}_v${n}_texto`,
    calificacion: (n) => `${prefijo}_v${n}_calificacion`,
    lista: `${prefijo}_escala`,
    intro: `${prefijo}_intro`,
  };
}

/** Problemas del diseño, en castellano. Vacío si se puede generar. */
export function validarVinetas(d: DisenoVinetas): string[] {
  const out: string[] = [];
  if (!NOMBRE.test(d.prefijo)) out.push(`El prefijo "${d.prefijo}" no sirve como nombre de variable: usa letras, números y _.`);
  if (!Number.isInteger(d.vinetas) || d.vinetas < 1 || d.vinetas > 20) out.push("El número de viñetas va de 1 a 20.");
  if (!d.atributos.length) out.push("La viñeta necesita al menos un atributo.");
  if (!d.texto.trim()) out.push("Falta el texto de la viñeta.");
  const huecos = new Set([...d.texto.matchAll(HUECO)].map((m) => m[1]!));
  for (const a of d.atributos) if (!huecos.has(a.clave)) out.push(`El texto no usa "${a.rotulo}": agrega {${a.clave}} donde va.`);
  for (const h of huecos) if (!d.atributos.some((a) => a.clave === h)) out.push(`El texto tiene {${h}}, que no es ningún atributo.`);
  if (!d.pregunta.trim()) out.push("Falta la pregunta de calificación.");
  const { min, max } = d.escala;
  if (!Number.isInteger(min) || !Number.isInteger(max) || min >= max) out.push("La escala va de un número entero a otro mayor.");
  else if (max - min > 10) out.push("La escala tiene a lo más 11 puntos.");
  return [...out, ...validarAtributos(d.atributos)];
}

export function generarVinetas(
  d: DisenoVinetas,
  nombres: NombresVinetas = nombresVinetasDelEditor(d.prefijo),
): { survey: FilaSurveyConjoint[]; choices: FilaChoiceConjoint[] } {
  const problemas = validarVinetas(d);
  if (problemas.length) throw new Error(problemas.join(" "));
  const survey: FilaSurveyConjoint[] = [];
  if (d.intro?.trim()) survey.push(fila({ type: "note", name: nombres.intro, label: d.intro.trim() }));
  for (let v = 1; v <= d.vinetas; v += 1) {
    survey.push(fila({ type: "begin_group", name: nombres.grupo(v), label: `Viñeta ${v} de ${d.vinetas}`, appearance: "field-list" }));
    for (const a of d.atributos) {
      const n = nombres.nivel(v, a.clave);
      const r = nombres.azar(v, a.clave);
      survey.push(fila({ type: "calculate", name: r, calculation: "once(random())" }));
      let calc = formulaNivel(r, a.niveles);
      if (a.soloSi) {
        const base = ref(nombres.nivel(v, a.soloSi.atributo));
        calc = `if(${a.soloSi.noEs.map((c) => `${base} = ${literal(c)}`).join(" or ")}, 'NA', ${calc})`;
      }
      survey.push(fila({ type: "calculate", name: n, calculation: calc }));
      survey.push(fila({ type: "calculate", name: nombres.texto(v, a.clave), calculation: formulaTexto(n, a.niveles) }));
    }
    const texto = d.texto.trim().replace(HUECO, (m, clave: string) => (d.atributos.some((a) => a.clave === clave) ? ref(nombres.texto(v, clave)) : m));
    survey.push(fila({ type: "note", name: nombres.nota(v), label: texto }));
    survey.push(fila({ type: `select_one ${nombres.lista}`, name: nombres.calificacion(v), label: d.pregunta.trim(), required: "yes", appearance: "likert" }));
    survey.push(fila({ type: "end_group", name: "" }));
  }
  const { min, max, etiquetaMin, etiquetaMax } = d.escala;
  const choices: FilaChoiceConjoint[] = [];
  for (let k = min; k <= max; k += 1) {
    const extremo = k === min ? etiquetaMin.trim() : k === max ? etiquetaMax.trim() : "";
    choices.push({ list_name: nombres.lista, name: String(k), label: extremo ? `${k} ${extremo}` : String(k) });
  }
  return { survey, choices };
}

/** Diseño de partida: genérico, para que se vea cómo funciona antes de escribir el propio. */
export function vinetasIniciales(prefijo: string): DisenoVinetas {
  return {
    prefijo,
    vinetas: 4,
    texto: "Una persona de {edad} pide un préstamo para {motivo}.",
    pregunta: "¿Qué tan justo le parecería que se lo nieguen?",
    escala: { min: 0, max: 10, etiquetaMin: "Nada justo", etiquetaMax: "Totalmente justo" },
    intro: "",
    atributos: [
      { clave: "edad", rotulo: "Edad", niveles: [{ codigo: "1", texto: "25 años" }, { codigo: "2", texto: "60 años" }] },
      { clave: "motivo", rotulo: "Motivo", niveles: [{ codigo: "1", texto: "abrir un negocio" }, { codigo: "2", texto: "pagar una deuda" }] },
    ],
  };
}
