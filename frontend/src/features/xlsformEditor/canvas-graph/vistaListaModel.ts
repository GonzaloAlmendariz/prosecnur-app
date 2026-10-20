// Lista minimalista de la lógica (E1, 2026-10-20): en orden del formulario y agrupada por sección, cada fila con la
// pregunta, la lectura del motor en una línea y de qué depende. Parte de `listaLogica` (mismo recorte de reglas que
// la lista lateral) y lee cada regla con `leerRegla`. Modelo puro.

import type { BuilderNode, BuilderStructure } from "../types";
import type { LogicScope } from "../logic";
import { leerRegla } from "../reglas/leerRegla";
import { lecturaPlana, textoPreguntaPlano, type LectorReferencias } from "../helpers/markdownPregunta";
import { textoDePiezas, type ColumnaRegla } from "../reglas/piezas";
import { dividirPorLogica, listaLogica, type TipoRegla } from "./listaLogicaModel";

export type LecturaFila = {
  tipo: TipoRegla;
  /** Frase del motor. Si el motor no la sabe leer, la expresión tal cual. */
  texto: string;
  tecnica: boolean;
  /** Etiquetas (o códigos) de las preguntas de las que depende, sin repetir. */
  depende: string[];
};

export type FilaVistaLista = {
  rowIndex: number;
  name: string;
  etiqueta: string;
  base: string;
  lecturas: LecturaFila[];
};

export type GrupoVistaLista = {
  id: string;
  letra: string;
  nombre: string;
  rowIndex: number | null;
  /** La regla de la sección entera, si la tiene. */
  regla: LecturaFila | null;
  filas: FilaVistaLista[];
};

export type VistaLista = { grupos: GrupoVistaLista[]; sinLogica: number; total: number };

function leer(columna: ColumnaRegla, tipo: TipoRegla, raw: string, nodo: BuilderNode, scope: LogicScope, lector: LectorReferencias): LecturaFila {
  const lectura = leerRegla(columna, raw, nodo, scope);
  const texto = lectura.tecnica ? raw.trim() : lecturaPlana(textoDePiezas(lectura.piezas), lector);
  const depende = [...new Set(lectura.depende.map((d) => textoPreguntaPlano(d.etiqueta, lector) || d.name))];
  return { tipo, texto, tecnica: lectura.tecnica, depende };
}

export function vistaListaLogica(structure: BuilderStructure | null, scope: LogicScope): VistaLista {
  const lista = listaLogica(structure);
  // Títulos con `${x}` y `<br>` se leen como en el Cuestionario, nunca crudos (E11b).
  const etiquetas = new Map((structure?.outline ?? []).map((n) => [n.name, n.label] as const));
  const lector = { etiquetaDe: (n: string) => etiquetas.get(n) };
  const plano = (t: string, respaldo: string) => textoPreguntaPlano(t, lector) || respaldo;
  const { conLogica, sinLogica } = dividirPorLogica(lista.secciones);
  const grupos = conLogica.map((s): GrupoVistaLista => {
    const nodoSeccion = s.rowIndex != null ? structure?.byRow.get(s.rowIndex) : undefined;
    return {
      id: s.id,
      letra: s.letra,
      nombre: plano(s.nombre, s.nombre),
      rowIndex: s.rowIndex,
      regla: s.regla && nodoSeccion ? leer("relevant", "aparece", s.regla, nodoSeccion, scope, lector) : null,
      filas: s.items.map(({ node }) => ({
        rowIndex: node.rowIndex,
        name: node.name,
        etiqueta: plano(node.label || node.name, node.name),
        base: node.typeInfo.base,
        lecturas: [
          ...(node.relevant.trim() ? [leer("relevant", "aparece", node.relevant, node, scope, lector)] : []),
          ...(node.choiceFilter.trim() ? [leer("choice_filter", "opciones", node.choiceFilter, node, scope, lector)] : []),
        ],
      })),
    };
  });
  return { grupos, sinLogica: sinLogica.length, total: lista.deSeccion + lista.dePregunta };
}
