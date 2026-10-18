// Columna derecha del Constructor (rediseño 2026-10-17, propuesta aprobada en dos columnas). Reemplaza al «workspace»
// con sus modos «En foco / Formulario completo» y sus cinco pestañas (C3, C9): una sola ficha según lo elegido en la
// Estructura. Pregunta, nota, cálculo y sección tienen ficha propia; los ajustes del formulario conservan la suya.

import "./ficha.css";

import { FolderMinus, Layers3 } from "../../../../vendor/lucide-react";
import { useContextoReglas } from "../../kit";
import { ALCANCE_VACIO } from "../../kit/ContextoReglas";
import type { BuilderDiagnostic, BuilderNode, BuilderSelection, BuilderStructure, CatalogSummary, ChoiceItem, XlsformEditorWorkbook } from "../../types";
import { FichaAjustes } from "./FichaAjustes";
import { FichaCalculo } from "./FichaCalculo";
import { FichaNota } from "./FichaNota";
import { FichaPregunta } from "./FichaPregunta";
import { FichaSeccion } from "./FichaSeccion";
import type { AccionesFicha, DatosFicha } from "./tiposFicha";

export type { AccionesFicha } from "./tiposFicha";

export type FichaConstructorProps = {
  workbook: XlsformEditorWorkbook | null;
  structure: BuilderStructure | null;
  selection: BuilderSelection | null;
  node: BuilderNode | null;
  settingsRecord: Record<string, string> | null;
  choices: ChoiceItem[];
  catalogs: CatalogSummary[];
  usosPorLista: ReadonlyMap<string, number>;
  diagnostics: readonly BuilderDiagnostic[];
  acciones: AccionesFicha;
};

export function FichaConstructor({ workbook, structure, selection, node, settingsRecord, choices, catalogs, usosPorLista, diagnostics, acciones }: FichaConstructorProps) {
  const contexto = useContextoReglas();
  let contenido;
  if (selection?.kind === "settings") {
    contenido = <FichaAjustes values={settingsRecord} onChange={acciones.ajuste} workbook={workbook} onEditar={acciones.editarFormulario} />;
  } else if (node) {
    const datos: DatosFicha = {
      node,
      structure,
      survey: workbook?.survey ?? null,
      scope: contexto?.scope ?? ALCANCE_VACIO,
      requiredRaw: contexto?.requiredRaw(node.rowIndex),
      choices,
      catalogs,
      usosPorLista,
      avisos: diagnostics.filter((d) => d.rowIndex === node.rowIndex),
      acciones,
    };
    contenido =
      node.kind === "section" || node.kind === "repeat" ? <FichaSeccion datos={datos} />
      : node.kind === "note" ? <FichaNota datos={datos} />
      : node.kind === "calculate" ? <FichaCalculo datos={datos} />
      : <FichaPregunta datos={datos} />;
  } else if (selection?.kind === "survey") {
    contenido = (
      <div className="xfh-vacia">
        <FolderMinus size={18} aria-hidden="true" />
        <strong>Cierre de sección</strong>
        <p>Esta fila marca dónde termina la sección.</p>
        <button type="button" className="xfh-boton is-peligro" onClick={acciones.eliminar}>Eliminar el cierre</button>
      </div>
    );
  } else {
    contenido = (
      <div className="xfh-vacia">
        <Layers3 size={18} aria-hidden="true" />
        <strong>Elige una pregunta o sección</strong>
        <p>Su ficha aparece aquí.</p>
      </div>
    );
  }
  const clave = selection?.kind === "survey" ? `f${selection.rowIndex}` : selection?.kind ?? "nada";
  return (
    <section className="pulso-focus-workspace xfh" aria-label="Ficha del elemento elegido">
      <div className="xfh-cuerpo" data-qa-scroll-owner="ficha">
        <div className="xfh-pila" key={clave}>
          {contenido}
        </div>
      </div>
    </section>
  );
}
