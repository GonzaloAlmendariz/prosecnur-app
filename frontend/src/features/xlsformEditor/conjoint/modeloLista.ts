// Experimento de lista (técnica de conteo de ítems) como bloque del editor (checklist elección por pares C14,
// 2026-11-07). Sirve para medir algo sensible sin preguntarlo: a cada encuestado le toca al azar una lista de
// afirmaciones, con o sin la sensible, y sólo dice cuántas son ciertas para él. La diferencia de medias entre los dos
// grupos estima qué parte de la población respondería que sí a la sensible.
//   - `<p>_r` = once(random()) y `<p>_asignacion` ('1' control, '2' con la afirmación sensible);
//   - una página con la lista de cada grupo (cada una se muestra sólo a su grupo) y la pregunta de conteo;
//   - el conteo va de 0 al número de afirmaciones que vio ese encuestado.

import { formulaNivel, ref } from "./modeloConjoint";

export type DisenoLista = {
  prefijo: string;
  /** La instrucción: cuántas son ciertas, no cuáles. */
  pregunta: string;
  /** Las afirmaciones que ven los dos grupos. */
  controles: string[];
  /** La afirmación que sólo ve el grupo de tratamiento. */
  sensible: string;
  /** Lugar de la sensible en la lista del tratamiento (1 = primera). */
  posicion: number;
  /** Probabilidad de caer en el grupo con la afirmación sensible. */
  probTratamiento: number;
};

export type NombresLista = { azar: string; asignacion: string; pagina: string; control: string; tratamiento: string; conteo: string };

const NOMBRE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const nombresLista = (p: string): NombresLista => ({
  azar: `${p}_r`,
  asignacion: `${p}_asignacion`,
  pagina: `${p}_pagina`,
  control: `${p}_control`,
  tratamiento: `${p}_tratamiento`,
  conteo: `${p}_conteo`,
});

/** La lista del tratamiento: las de control con la sensible en su lugar. */
export const listaTratamiento = (d: DisenoLista): string[] => {
  const l = d.controles.map((c) => c.trim());
  l.splice(Math.min(Math.max(d.posicion, 1), l.length + 1) - 1, 0, d.sensible.trim());
  return l;
};

const enLista = (items: string[]) => items.map((t) => `- ${t.trim()}`).join("\n");
const redondear = (x: number) => Math.round(x * 1e6) / 1e6;

export function validarLista(d: DisenoLista): string[] {
  const out: string[] = [];
  if (!NOMBRE.test(d.prefijo)) out.push(`El prefijo «${d.prefijo}» no sirve como nombre de variable: usa letras, números y _.`);
  if (!d.pregunta.trim()) out.push("Falta la pregunta de conteo.");
  if (d.controles.length < 2) out.push("Hacen falta al menos dos afirmaciones de control.");
  if (d.controles.length > 8) out.push("Van a lo más ocho afirmaciones de control.");
  d.controles.forEach((c, i) => { if (!c.trim()) out.push(`La afirmación ${i + 1} no tiene texto.`); });
  if (!d.sensible.trim()) out.push("Falta la afirmación sensible.");
  const todas = [...d.controles, d.sensible].map((t) => t.trim()).filter(Boolean);
  if (new Set(todas).size !== todas.length) out.push("Dos afirmaciones dicen lo mismo.");
  if (!Number.isInteger(d.posicion) || d.posicion < 1 || d.posicion > d.controles.length + 1) out.push("El lugar de la afirmación sensible está fuera de la lista.");
  if (!(d.probTratamiento > 0 && d.probTratamiento < 1)) out.push("La parte de la muestra con la afirmación sensible va entre 1% y 99%.");
  return out;
}

export function generarLista(d: DisenoLista): Record<string, string>[] {
  const problemas = validarLista(d);
  if (problemas.length) throw new Error(problemas.join(" "));
  const n = nombresLista(d.prefijo);
  const pt = redondear(d.probTratamiento);
  const asignacion = formulaNivel(n.azar, [
    { codigo: "1", texto: "Control", peso: redondear(1 - pt) },
    { codigo: "2", texto: "Tratamiento", peso: pt },
  ]);
  const j = d.controles.length;
  return [
    { type: "calculate", name: n.azar, calculation: "once(random())" },
    { type: "calculate", name: n.asignacion, calculation: asignacion },
    { type: "begin_group", name: n.pagina, label: "", appearance: "field-list" },
    { type: "note", name: n.control, label: enLista(d.controles), relevant: `${ref(n.asignacion)} = '1'` },
    { type: "note", name: n.tratamiento, label: enLista(listaTratamiento(d)), relevant: `${ref(n.asignacion)} = '2'` },
    {
      type: "integer",
      name: n.conteo,
      label: d.pregunta.trim(),
      required: "yes",
      constraint: `. >= 0 and . <= if(${ref(n.asignacion)} = '2', ${j + 1}, ${j})`,
      constraint_message: "Va de 0 al número de afirmaciones de la lista.",
    },
    { type: "end_group", name: "" },
  ];
}

export function listaInicial(prefijo: string): DisenoLista {
  return {
    prefijo,
    pregunta: "¿Cuántas de estas afirmaciones son ciertas para usted? No me diga cuáles, sólo cuántas.",
    controles: ["He participado en una marcha.", "He firmado una petición.", "He contactado a una autoridad local."],
    sensible: "He recibido un regalo o dinero a cambio de mi voto.",
    posicion: 4,
    probTratamiento: 0.5,
  };
}
