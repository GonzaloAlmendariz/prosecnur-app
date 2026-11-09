// Experimento de respaldo (endorsement) como bloque del editor (checklist elección por pares C15, 2026-11-07). Mide
// el apoyo a un actor sin preguntar por él: cada encuestado lee las mismas políticas, al grupo de control sin
// respaldo y a los demás con el respaldo de un actor sorteado; la diferencia en el apoyo a las políticas es el efecto
// del actor. A cada encuestado le toca un grupo para todas las políticas.
//   - `<p>_r` = once(random()), `<p>_brazo` ('1' sin respaldo, '2'… un actor cada uno) y `<p>_actor` (su nombre);
//   - por política, una página con su texto (`<p>_p<j>`), la frase que le toca (`<p>_p<j>_texto`, armada con concat()
//     desde la frase de control o la de respaldo), una nota que la muestra y la pregunta de apoyo en escala.

import { formulaNivel, formulaTexto, literal, ref } from "./modeloConjoint";
import type { EscalaVinetas } from "./modeloVinetas";

export type DisenoRespaldo = {
  prefijo: string;
  /** Quién respalda; el grupo de control no ve ninguno. */
  actores: string[];
  politicas: string[];
  /** Frase sin respaldo, con `{politica}`. */
  fraseControl: string;
  /** Frase con respaldo, con `{actor}` y `{politica}`. */
  fraseRespaldo: string;
  pregunta: string;
  escala: EscalaVinetas;
};

const NOMBRE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const HUECO = /\{(actor|politica)\}/g;

export const nombresRespaldo = (p: string) => ({
  azar: `${p}_r`,
  brazo: `${p}_brazo`,
  actor: `${p}_actor`,
  lista: `${p}_apoyo`,
  pagina: (j: number) => `${p}_politica${j}`,
  politica: (j: number) => `${p}_p${j}`,
  texto: (j: number) => `${p}_p${j}_texto`,
  frase: (j: number) => `${p}_p${j}_frase`,
  apoyo: (j: number) => `${p}_apoyo${j}`,
});

/** Los niveles del sorteo: '1' sin respaldo y uno por actor, todos con la misma probabilidad. */
export const nivelesRespaldo = (d: DisenoRespaldo) => [
  { codigo: "1", texto: "" },
  ...d.actores.map((a, i) => ({ codigo: String(i + 2), texto: a.trim() })),
];

/** concat() de una frase: sus tramos de texto como literales y los huecos como referencias. */
function concatDe(frase: string, actor: string, politica: string): string {
  const partes: string[] = [];
  let desde = 0;
  for (const m of frase.matchAll(HUECO)) {
    const i = m.index ?? 0;
    if (i > desde) partes.push(literal(frase.slice(desde, i)));
    partes.push(ref(m[1] === "actor" ? actor : politica));
    desde = i + m[0].length;
  }
  if (desde < frase.length) partes.push(literal(frase.slice(desde)));
  return `concat(${partes.join(", ")})`;
}

export function validarRespaldo(d: DisenoRespaldo): string[] {
  const out: string[] = [];
  if (!NOMBRE.test(d.prefijo)) out.push(`El prefijo "${d.prefijo}" no sirve como nombre de variable: usa letras, números y _.`);
  if (!d.actores.length || d.actores.length > 5) out.push("Van de uno a cinco actores.");
  d.actores.forEach((a, i) => { if (!a.trim()) out.push(`El actor ${i + 1} no tiene nombre.`); });
  if (new Set(d.actores.map((a) => a.trim())).size !== d.actores.length) out.push("Dos actores se llaman igual.");
  if (!d.politicas.length || d.politicas.length > 6) out.push("Van de una a seis políticas.");
  d.politicas.forEach((p, i) => { if (!p.trim()) out.push(`La política ${i + 1} no tiene texto.`); });
  const control = [...d.fraseControl.matchAll(HUECO)].map((m) => m[1]);
  const respaldo = [...d.fraseRespaldo.matchAll(HUECO)].map((m) => m[1]);
  if (!control.includes("politica")) out.push("La frase sin respaldo necesita {politica}.");
  if (control.includes("actor")) out.push("La frase sin respaldo no lleva {actor}.");
  if (!respaldo.includes("politica") || !respaldo.includes("actor")) out.push("La frase con respaldo necesita {actor} y {politica}.");
  if (!d.pregunta.trim()) out.push("Falta la pregunta de apoyo.");
  const { min, max } = d.escala;
  if (!Number.isInteger(min) || !Number.isInteger(max) || min >= max) out.push("La escala va de un número entero a otro mayor.");
  else if (max - min > 10) out.push("La escala tiene a lo más 11 puntos.");
  return out;
}

export function generarRespaldo(d: DisenoRespaldo): { survey: Record<string, string>[]; choices: Record<string, string>[] } {
  const problemas = validarRespaldo(d);
  if (problemas.length) throw new Error(problemas.join(" "));
  const n = nombresRespaldo(d.prefijo);
  const niveles = nivelesRespaldo(d);
  const survey: Record<string, string>[] = [
    { type: "calculate", name: n.azar, calculation: "once(random())" },
    { type: "calculate", name: n.brazo, calculation: formulaNivel(n.azar, niveles) },
    { type: "calculate", name: n.actor, calculation: formulaTexto(n.brazo, niveles) },
  ];
  d.politicas.forEach((politica, k) => {
    const j = k + 1;
    survey.push(
      { type: "begin_group", name: n.pagina(j), label: "", appearance: "field-list" },
      { type: "calculate", name: n.politica(j), calculation: literal(politica.trim()) },
      { type: "calculate", name: n.texto(j), calculation: `if(${ref(n.brazo)} = '1', ${concatDe(d.fraseControl, n.actor, n.politica(j))}, ${concatDe(d.fraseRespaldo, n.actor, n.politica(j))})` },
      { type: "note", name: n.frase(j), label: ref(n.texto(j)) },
      { type: `select_one ${n.lista}`, name: n.apoyo(j), label: d.pregunta.trim(), required: "yes", appearance: "likert" },
      { type: "end_group", name: "" },
    );
  });
  const { min, max, etiquetaMin, etiquetaMax } = d.escala;
  const choices: Record<string, string>[] = [];
  for (let k = min; k <= max; k += 1) {
    const extremo = k === min ? etiquetaMin.trim() : k === max ? etiquetaMax.trim() : "";
    choices.push({ list_name: n.lista, name: String(k), label: extremo ? `${k} ${extremo}` : String(k) });
  }
  return { survey, choices };
}

/** La frase que leería un encuestado de un grupo (0 = sin respaldo) para una política. */
export function fraseDe(d: DisenoRespaldo, grupo: number, politica: string): string {
  const frase = grupo === 0 ? d.fraseControl : d.fraseRespaldo;
  return frase.replace(HUECO, (_m, h: string) => (h === "actor" ? d.actores[grupo - 1]?.trim() ?? "" : politica.trim()));
}

export function respaldoInicial(prefijo: string): DisenoRespaldo {
  return {
    prefijo,
    actores: ["las Fuerzas Armadas"],
    politicas: ["se amplíe el servicio militar voluntario", "se destine más presupuesto a la defensa de fronteras"],
    // El actor no va de sujeto: así la frase concuerda con cualquier actor («las Fuerzas Armadas», «el Congreso»).
    fraseControl: "Una propuesta plantea que {politica}.",
    fraseRespaldo: "Una propuesta de {actor} plantea que {politica}.",
    pregunta: "¿Qué tanto apoya esta propuesta?",
    escala: { min: 1, max: 5, etiquetaMin: "Nada", etiquetaMax: "Mucho" },
  };
}
