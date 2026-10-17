// Lo que hay dentro de una sección, en la vista de trabajo del Constructor (M4, 2026-10-17). Con una sección elegida,
// la vista mostraba sólo «Dentro del bloque: 2 elementos» y dejaba unos 250 px vacíos debajo: la sección es un
// contenedor de preguntas y no se veía cuáles. Ahora cada elemento directo con su tipo, número, texto y marcas de
// obligatoria y de condición; elegir uno lo abre en el Constructor.

import { Eye } from "../../../vendor/lucide-react";
import type { BuilderNode, BuilderStructure } from "../types";
import { stripMarkdown } from "../helpers/markdown";
import { TypeIcon } from "../kit";
import "./contenidoSeccion.css";

/** Elementos directos de la sección (sus subsecciones cuentan como uno). */
export function elementosDeSeccion(structure: BuilderStructure | null, filaSeccion: number): BuilderNode[] {
  if (!structure) return [];
  const id = `section-${filaSeccion}`;
  return structure.outline.filter((n) => n.rowIndex !== filaSeccion && structure.rowToSectionId.get(n.rowIndex) === id);
}

/** Número de cada pregunta en todo el formulario, como la Vista del cuestionario: notas y secciones van sin él. */
export function numerosDePregunta(structure: BuilderStructure | null): Map<number, string> {
  let n = 0;
  return new Map((structure?.outline ?? []).map((e) => [e.rowIndex, e.kind === "question" ? String(++n) : ""]));
}

export function ContenidoSeccion({ structure, filaSeccion, onSelectRow }: {
  structure: BuilderStructure | null;
  filaSeccion: number;
  onSelectRow: (rowIndex: number) => void;
}) {
  const elementos = elementosDeSeccion(structure, filaSeccion);
  const numero = numerosDePregunta(structure);
  return (
    <section className="xfcs" aria-label="Contenido de la sección">
      <header className="xfcs__cab">
        <span className="xfcs__tit">Contenido</span>
        <span className="xfcs__n">{elementos.length} {elementos.length === 1 ? "elemento" : "elementos"}</span>
      </header>
      {elementos.length ? (
        <ol className="xfcs__lista" data-qa-geometry-group="xlsform/seccion-contenido" data-qa-geometry-contract="intrinsic">
          {elementos.map((n) => {
            const esSeccion = n.kind === "section" || n.kind === "repeat";
            return (
              <li key={n.rowIndex} data-qa-geometry-member="">
                <button type="button" className="xfcs__fila" onClick={() => onSelectRow(n.rowIndex)}>
                  <TypeIcon baseType={esSeccion ? "begin_group" : n.typeInfo.base} size={14} />
                  <span className="xfcs__num">{n.paperNumber || numero.get(n.rowIndex)}</span>
                  <span className="xfcs__txt" title={stripMarkdown(n.label || n.name)}>{stripMarkdown(n.label || n.name) || n.name}</span>
                  <span className="xfcs__marcas">
                    {n.relevant.trim() ? <span className="xfcs__cond" title="Aparece sólo si se cumple su condición"><Eye size={12} aria-hidden="true" /></span> : null}
                    {n.required ? <span className="xfcs__obl" title="Obligatoria">*</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="xfcs__vacio">La sección está vacía. Agrega preguntas con el botón + del esquema o incluye la siguiente.</p>
      )}
    </section>
  );
}
