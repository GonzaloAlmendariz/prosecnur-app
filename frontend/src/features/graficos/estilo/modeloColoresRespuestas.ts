// Identidad › Colores de las respuestas (P1–P7, aprobado por Gonzalo 2026-10-11): «en identidad se reconozcan las
// listas de categorías y se puedan definir sus paletas desde allí con una dinámica super amable para el usuario no
// técnico». Las listas salen del instrumento de CADA proyecto (nada fijo): las que tienen las mismas opciones forman un
// grupo y se pintan juntas, que es como el motor reparte una paleta (misma firma de opciones, ADR 0097).

import {
  coloresPorEtiqueta,
  etiquetaEquivalente,
  firmaOpciones,
  normalizarEtiquetaPaleta,
  resolverPaleta,
  type MapaPaletas,
  type VinculosPaletas,
} from "../paletasResolver";
import { LIKERT_RECETARIO, PULSO_PUCP_COLORS, SUGERIDAS_PALETAS } from "../paletasSugeridas";

export type ListaRespuestas = {
  list_name: string;
  choices: ReadonlyArray<{ name: string; label: string }>;
  fuentes?: readonly string[];
  variables?: readonly string[];
};

export type PreguntaDelGrupo = { ref: string; texto: string; base: string | null };

export type GrupoRespuestas = {
  id: string;
  opciones: string[];
  listas: string[];
  preguntas: PreguntaDelGrupo[];
  bases: string[];
  /** Color de cada opción (por su etiqueta en `opciones`); ausente = sin color. */
  colores: Record<string, string>;
  faltan: number;
};

/** Respuestas que no son una opción sustantiva: van en gris para no competir con las demás. */
const RESIDUAL = /^(no sabe|no responde|no precisa|no aplica|no corresponde|ns\s*\/?\s*nr|prefiero no|sin inf|otros?\b|otras?\b|ninguna de las anteriores)/;

export function esRespuestaResidual(etiqueta: string): boolean {
  return RESIDUAL.test(normalizarEtiquetaPaleta(etiqueta).replace(/^\(|\)$/g, ""));
}

function textoPregunta(ref: string, etiquetas: ReadonlyMap<string, string>): PreguntaDelGrupo {
  const [base, nombre] = ref.includes("$") ? (ref.split("$", 2) as [string, string]) : [null, ref];
  const texto = etiquetas.get(ref) ?? etiquetas.get(nombre) ?? nombre;
  return { ref, texto, base };
}

/**
 * Agrupa las listas por sus opciones y lee el color vigente de cada opción: el de la lista misma o, si no tiene, el
 * que el motor le daría por un vínculo o por otra lista con las mismas opciones.
 */
export function gruposDeRespuestas(
  listas: readonly ListaRespuestas[],
  paletas: MapaPaletas,
  vinculos: VinculosPaletas,
  etiquetasPregunta: ReadonlyMap<string, string>,
): GrupoRespuestas[] {
  const porFirma = new Map<string, GrupoRespuestas>();
  for (const lista of listas) {
    const opciones = lista.choices.map((c) => c.label).filter((l) => l.trim() !== "");
    const id = firmaOpciones(opciones);
    if (!id) continue;
    let g = porFirma.get(id);
    if (!g) {
      g = { id, opciones, listas: [], preguntas: [], bases: [], colores: {}, faltan: 0 };
      porFirma.set(id, g);
    }
    if (!g.listas.includes(lista.list_name)) g.listas.push(lista.list_name);
    for (const f of lista.fuentes ?? []) if (f && f !== "default" && !g.bases.includes(f)) g.bases.push(f);
    for (const ref of lista.variables ?? []) {
      // Columnas internas del importador («__district»): no son preguntas que alguien grafique.
      if ((ref.split("$").pop() ?? "").startsWith("_")) continue;
      if (!g.preguntas.some((p) => p.ref === ref)) g.preguntas.push(textoPregunta(ref, etiquetasPregunta));
    }
    const r = resolverPaleta(lista, paletas, vinculos);
    if (!r) continue;
    for (const { label, color } of coloresPorEtiqueta(paletas[r.clave] ?? {}, lista.choices)) {
      const propia = g.opciones.find((o) => normalizarEtiquetaPaleta(o) === normalizarEtiquetaPaleta(label));
      if (propia && !g.colores[propia]) g.colores[propia] = color;
    }
  }
  // Una lista que ninguna pregunta usa no pinta nada; se omite cuando el instrumento sí dice qué preguntas usan cada
  // lista (un backend viejo no lo manda y ahí se muestran todas).
  const todos = Array.from(porFirma.values());
  const grupos = todos.some((g) => g.preguntas.length) ? todos.filter((g) => g.preguntas.length) : todos;
  for (const g of grupos) g.faltan = g.opciones.filter((o) => !g.colores[o]).length;
  return grupos.sort((a, b) => b.preguntas.length - a.preguntas.length || a.opciones.length - b.opciones.length);
}

export type EstadoGrupo = "completo" | "incompleto" | "sin-colores";

export function estadoGrupo(g: GrupoRespuestas): EstadoGrupo {
  if (g.faltan === 0) return "completo";
  return g.faltan === g.opciones.length ? "sin-colores" : "incompleto";
}

export type Combinacion = { nombre: string; colores: Record<string, string> };

/** Combinaciones de la marca para las opciones del grupo; las respuestas residuales van siempre en gris. */
export function combinacionesPara(opciones: readonly string[]): Combinacion[] {
  const sustantivas = opciones.filter((o) => !esRespuestaResidual(o));
  const conGris = (colores: readonly string[]): Record<string, string> => {
    const out: Record<string, string> = {};
    sustantivas.forEach((o, i) => { out[o] = colores[i % colores.length]; });
    for (const o of opciones) if (!out[o]) out[o] = PULSO_PUCP_COLORS.gris;
    return out;
  };
  const n = sustantivas.length;
  if (n === 0) return [{ nombre: "Gris", colores: conGris([PULSO_PUCP_COLORS.gris]) }];
  if (n === 1) return [{ nombre: "Azul institucional", colores: conGris([PULSO_PUCP_COLORS.azul]) }];
  const sugeridas = SUGERIDAS_PALETAS[n] ?? SUGERIDAS_PALETAS[7] ?? [];
  return sugeridas.map((s) => ({ nombre: s.label.replace(/^Pulso\s+/, "").replace(/^./, (c) => c.toUpperCase()), colores: conGris(s.colors) }));
}

/** Muestras de la marca para elegir un color a mano, en el orden en que se suelen usar. */
export const MUESTRAS_MARCA: ReadonlyArray<{ nombre: string; hex: string }> = [
  { nombre: "Azul institucional", hex: PULSO_PUCP_COLORS.azul },
  { nombre: "Azul claro", hex: PULSO_PUCP_COLORS.azulSecundario },
  { nombre: "Rojo", hex: PULSO_PUCP_COLORS.rojo },
  { nombre: "Naranja", hex: PULSO_PUCP_COLORS.naranja },
  { nombre: "Amarillo", hex: PULSO_PUCP_COLORS.amarillo },
  { nombre: "Verde", hex: PULSO_PUCP_COLORS.verde },
  { nombre: "Morado", hex: PULSO_PUCP_COLORS.morado },
  { nombre: "Desacuerdo fuerte", hex: LIKERT_RECETARIO.desacuerdoFuerte },
  { nombre: "Desacuerdo", hex: LIKERT_RECETARIO.desacuerdo },
  { nombre: "Acuerdo", hex: LIKERT_RECETARIO.acuerdo },
  { nombre: "Acuerdo fuerte", hex: LIKERT_RECETARIO.acuerdoFuerte },
  { nombre: "Gris", hex: PULSO_PUCP_COLORS.gris },
  { nombre: "Gris claro", hex: PULSO_PUCP_COLORS.grisSecundario },
];

/**
 * Pinta TODAS las listas del grupo con los colores dados (por etiqueta del grupo), cada una con su propia escritura de
 * la etiqueta. Un color `null` quita ese color. Devuelve un mapa nuevo; el original no se toca.
 */
export function conColoresDelGrupo(
  paletas: MapaPaletas,
  grupo: GrupoRespuestas,
  listas: readonly ListaRespuestas[],
  colores: Record<string, string | null>,
): MapaPaletas {
  const next: MapaPaletas = { ...paletas };
  for (const lista of listas) {
    if (!grupo.listas.includes(lista.list_name) || firmaOpciones(lista.choices.map((c) => c.label)) !== grupo.id) continue;
    const paleta = { ...(next[lista.list_name] ?? {}) };
    for (const [opcion, color] of Object.entries(colores)) {
      const etiqueta = etiquetaEquivalente(lista, opcion) ?? opcion;
      if (color) paleta[etiqueta] = color;
      else delete paleta[etiqueta];
    }
    if (Object.keys(paleta).length) next[lista.list_name] = paleta;
    else delete next[lista.list_name];
  }
  return next;
}

/** Busca por opción, pregunta o base, sin importar tildes ni mayúsculas. */
export function grupoCoincide(g: GrupoRespuestas, consulta: string): boolean {
  const q = normalizarEtiquetaPaleta(consulta);
  if (!q) return true;
  return [...g.opciones, ...g.preguntas.map((p) => p.texto), ...g.bases].some((t) => normalizarEtiquetaPaleta(t).includes(q));
}

/** Si el texto sobre un color va claro u oscuro (luminancia relativa, como la que usa el motor para las etiquetas). */
export function textoSobre(hex: string | undefined): "claro" | "oscuro" {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return "oscuro";
  const n = parseInt(m[1], 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return l < 0.4 ? "claro" : "oscuro";
}
