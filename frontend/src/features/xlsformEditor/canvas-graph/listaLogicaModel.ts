// Lista de la lógica del formulario (revamp 2026-10-16): cada sección con la regla que vale para TODA la
// sección (relevant del begin_group/begin_repeat) y, debajo, las preguntas con reglas propias. Distingue lo
// que la pregunta hereda de lo que decide ella (pedido de Gonzalo: «lógica aplicada a toda una sección /
// lógica aplicada a una pregunta en particular»). Modelo puro: no muta ni conoce React.

import type { BuilderNode, BuilderStructure } from "../types";

export type TipoRegla = "aparece" | "opciones";

export type ItemLogica = {
  node: BuilderNode;
  tipos: TipoRegla[];
};

export type SeccionLogica = {
  id: string;
  /** Letra correlativa (A, B, … AA) para ubicarse sin leer el nombre. */
  letra: string;
  nombre: string;
  /** Fila del begin_group (null para el nivel principal). */
  rowIndex: number | null;
  esRepeticion: boolean;
  preguntas: number;
  /** relevant de la sección: lo heredan todas sus preguntas. */
  regla: string;
  items: ItemLogica[];
};

export type ListaLogica = {
  secciones: SeccionLogica[];
  deSeccion: number;
  dePregunta: number;
};

function letra(i: number): string {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function listaLogica(structure: BuilderStructure | null): ListaLogica {
  if (!structure) return { secciones: [], deSeccion: 0, dePregunta: 0 };
  const porId = new Map<string, SeccionLogica>();
  const orden: string[] = [];
  const asegurar = (id: string): SeccionLogica => {
    const prev = porId.get(id);
    if (prev) return prev;
    const meta = structure.sections.get(id);
    const nodo = meta?.rowIndex != null ? structure.byRow.get(meta.rowIndex) : undefined;
    const sec: SeccionLogica = {
      id,
      letra: "",
      nombre: id === "root" || !meta ? "Nivel principal" : meta.label || meta.name || "Sección sin nombre",
      rowIndex: meta?.rowIndex ?? null,
      esRepeticion: meta?.kind === "repeat",
      preguntas: 0,
      regla: nodo?.relevant.trim() ?? "",
      items: [],
    };
    porId.set(id, sec);
    orden.push(id);
    return sec;
  };
  for (const node of structure.outline) {
    if (node.kind === "section" || node.kind === "repeat") {
      // La sección aparece en su lugar aunque todavía no tenga preguntas con lógica.
      const id = [...structure.sections.values()].find((m) => m.rowIndex === node.rowIndex)?.id;
      if (id) asegurar(id);
      continue;
    }
    const sec = asegurar(structure.rowToSectionId.get(node.rowIndex) ?? node.sectionId ?? "root");
    if (node.kind === "question" || node.kind === "note") sec.preguntas++;
    const tipos: TipoRegla[] = [];
    if (node.relevant.trim()) tipos.push("aparece");
    if (node.choiceFilter.trim()) tipos.push("opciones");
    if (tipos.length) sec.items.push({ node, tipos });
  }
  const secciones = orden
    .map((id) => porId.get(id)!)
    .filter((s) => s.regla || s.items.length || s.id !== "root")
    .map((s, i) => ({ ...s, letra: letra(i) }));
  return {
    secciones,
    deSeccion: secciones.filter((s) => s.regla).length,
    dePregunta: secciones.reduce((n, s) => n + s.items.length, 0),
  };
}

/** M2 (2026-10-17): las secciones sin regla propia ni preguntas con regla ocupaban una tarjeta cada una con «Ninguna
 * pregunta tiene lógica propia» (6 de 8 en pantalla en el tipo 1). Se separan para listarlas juntas, compactas. */
export function dividirPorLogica(secciones: readonly SeccionLogica[]): { conLogica: SeccionLogica[]; sinLogica: SeccionLogica[] } {
  const tiene = (s: SeccionLogica) => Boolean(s.regla) || s.items.length > 0;
  return { conLogica: secciones.filter(tiene), sinLogica: secciones.filter((s) => !tiene(s)) };
}
