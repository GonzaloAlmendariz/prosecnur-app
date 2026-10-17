// Reglas internas de cada sección (M3, 2026-10-17). Con las secciones plegadas, una regla entre dos preguntas de la
// misma sección cae en un solo nodo y el layout la descarta: el mapa decía «0 conexiones» y «aún no tiene relaciones
// lógicas» con 18 reglas en el formulario (todas internas en el tipo 1). Aquí se cuenta, por sección, cuántas reglas
// viven adentro (en la sección más interna que contiene a las dos preguntas) y qué secciones hay que desplegar para verlas.

import type { GraphNode, LogicGraph } from "./buildGraph";

export type ReglasInternas = {
  /** id de la sección → reglas cuyas dos puntas están dentro de ella (y no en una subsección común). */
  porSeccion: Map<string, number>;
  /** Secciones a desplegar para que cada regla interna se vea: la sección común y sus ancestros. */
  aDesplegar: Set<string>;
  total: number;
};

export function reglasInternas(graph: Pick<LogicGraph, "rootNodes" | "edges">): ReglasInternas {
  const padre = new Map<string, GraphNode>();
  const indexar = (n: GraphNode) => { for (const h of n.children) { padre.set(h.id, n); indexar(h); } };
  graph.rootNodes.forEach(indexar);
  const cadena = (id: string): string[] => {
    const out: string[] = [];
    for (let p = padre.get(id); p; p = padre.get(p.id)) out.push(p.id);
    return out;
  };
  const porSeccion = new Map<string, number>();
  const aDesplegar = new Set<string>();
  let total = 0;
  const vistas = new Set<string>();
  for (const e of graph.edges) {
    const clave = `${e.source}->${e.target}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    const deOrigen = new Set(cadena(e.source));
    const comun = cadena(e.target).find((id) => deOrigen.has(id) || id === e.source);
    if (!comun || comun === e.source) continue;
    porSeccion.set(comun, (porSeccion.get(comun) ?? 0) + 1);
    aDesplegar.add(comun);
    cadena(comun).forEach((id) => aDesplegar.add(id));
    total += 1;
  }
  return { porSeccion, aDesplegar, total };
}
