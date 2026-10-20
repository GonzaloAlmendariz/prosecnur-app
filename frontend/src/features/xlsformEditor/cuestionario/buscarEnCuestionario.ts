// Buscador del índice del cuestionario (E6, 2026-10-20): filtra secciones y preguntas por texto o código.

import { stripMarkdown } from "../helpers/markdown";
import type { PreguntaDoc, SeccionDoc } from "./modeloCuestionario";

export type HallazgoPregunta = { seccion: string; name: string; numero: number; texto: string };
export type ResultadoBusqueda = { secciones: Set<string>; preguntas: HallazgoPregunta[] };

const plano = (s: string) => stripMarkdown(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function preguntasDe(s: SeccionDoc): PreguntaDoc[] {
  return s.bloques.flatMap((b) => (b.tipo === "pregunta" ? [b.pregunta] : b.tipo === "matriz" ? b.filas : []));
}

/** null si la búsqueda está vacía. Una sección entra si su título casa o si casa alguna de sus preguntas. */
export function buscarEnCuestionario(secciones: readonly SeccionDoc[], consulta: string): ResultadoBusqueda | null {
  const q = plano(consulta).trim();
  if (!q) return null;
  const out: ResultadoBusqueda = { secciones: new Set(), preguntas: [] };
  for (const s of secciones) {
    if (plano(s.rotulo).includes(q) || plano(s.name).includes(q)) out.secciones.add(s.clave);
    for (const p of preguntasDe(s)) {
      const { name, label } = p.nodo;
      if (plano(label).includes(q) || plano(name).includes(q) || String(p.numero) === q) {
        out.secciones.add(s.clave);
        out.preguntas.push({ seccion: s.clave, name, numero: p.numero, texto: stripMarkdown(label || name).replace(/\s+/g, " ").trim() });
      }
    }
  }
  return out;
}
