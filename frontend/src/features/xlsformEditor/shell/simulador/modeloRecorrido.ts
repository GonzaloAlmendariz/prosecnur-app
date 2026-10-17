// Recorrido y respuestas de «Probar formulario» (M1, 2026-10-17). A 1440 px la hoja de prueba dejaba dos franjas
// muertas de unos 340 px; ahí van ahora el recorrido por secciones y lo respondido, que es lo que se necesita para
// probar la lógica: en qué sección estoy, cuáles se saltaron y por qué apareció o desapareció una pregunta.

import type { BuilderNode, ChoiceItem } from "../../types";

export type SimValue = string | string[];
export type EstadoSeccion = "actual" | "hecha" | "pendiente" | "omitida";

export type SeccionRecorrido = { id: string; titulo: string; estado: EstadoSeccion; respondidas: number; total: number; indiceVisible: number | null };
export type RespuestaDada = { name: string; numero: string; enunciado: string; baseType: string; texto: string };

type Pagina = { id: string; title: string; nodes: BuilderNode[] };

const tieneRespuesta = (v: SimValue | undefined) => (Array.isArray(v) ? v.length > 0 : !!v && v.trim() !== "");

export function seccionesDelRecorrido(
  paginas: readonly Pagina[],
  visibles: readonly { id: string }[],
  actualId: string | null,
  esRespondible: (n: BuilderNode) => boolean,
  esVisible: (n: BuilderNode) => boolean,
  respuestas: Readonly<Record<string, SimValue>>,
): SeccionRecorrido[] {
  const indice = new Map(visibles.map((p, i) => [p.id, i]));
  const posActual = actualId ? indice.get(actualId) ?? -1 : -1;
  return paginas.map((p) => {
    const preguntas = p.nodes.filter((n) => esRespondible(n) && esVisible(n));
    const respondidas = preguntas.filter((n) => tieneRespuesta(respuestas[n.name])).length;
    const i = indice.get(p.id);
    const estado: EstadoSeccion = i === undefined ? "omitida" : p.id === actualId ? "actual" : i < posActual ? "hecha" : "pendiente";
    return { id: p.id, titulo: p.title, estado, respondidas, total: preguntas.length, indiceVisible: i ?? null };
  });
}

/** Lo respondido, en el orden del formulario, con las etiquetas de las opciones en vez de sus códigos. */
export function respuestasDadas(
  paginas: readonly Pagina[],
  respuestas: Readonly<Record<string, SimValue>>,
  opcionesDe: (lista: string) => readonly ChoiceItem[],
): RespuestaDada[] {
  const out: RespuestaDada[] = [];
  for (const p of paginas) for (const n of p.nodes) {
    const v = respuestas[n.name];
    if (!n.name || !tieneRespuesta(v)) continue;
    const ops = n.typeInfo.listName ? opcionesDe(n.typeInfo.listName) : [];
    const etiqueta = (c: string) => ops.find((o) => o.name === c)?.label || c;
    const texto = Array.isArray(v) ? v.map(etiqueta).join(", ") : ops.length ? etiqueta(v) : v;
    out.push({ name: n.name, numero: n.paperNumber || n.name, enunciado: n.label || n.name, baseType: n.typeInfo.base, texto });
  }
  return out;
}
