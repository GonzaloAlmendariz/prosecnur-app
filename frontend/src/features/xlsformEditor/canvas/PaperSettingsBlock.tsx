// =============================================================================
// canvas/PaperSettingsBlock.tsx — «Ajustes de papel» de la pestaña Datos
// =============================================================================
// Columnas `paper_*` de la fila: sólo cambian el PDF/Word impreso, no Kobo.
// Plegado por defecto; abierto si la fila ya trae algún ajuste. El padre lo
// monta con `key` por fila para que el plegado se recalcule al cambiar de nodo.
// Cada input toma su nombre accesible del rótulo de `InspectorField`.
// =============================================================================

import { useState } from "react";
import type { BuilderNode } from "../types";
import { InspectorBlock, InspectorField } from "../inspector/InspectorPrimitives";
import { TechTerm } from "../helpers/TechTerm";
import { hasPaperOverrides } from "./paperSettings";
import { opcionesLayoutImpreso } from "./paperLayout";

export function PaperSettingsBlock({
  node,
  onFieldChange,
}: {
  node: BuilderNode;
  onFieldChange: (field: string, value: string) => void;
}) {
  const [open, setOpen] = useState(() => hasPaperOverrides(node));

  return (
    <InspectorBlock>
      <details
        className="pulso-focus-disclosure"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>Ajustes de papel</summary>
        <InspectorField
          label={<>Número visible <TechTerm t="paper_number" /></>}
          hint="Vacío = el PDF lo numera solo."
        >
          {(campo) => (
            <input
              id={campo.id}
              aria-describedby={campo.hintId}
              type="text"
              value={node.paperNumber ?? ""}
              onChange={(event) => onFieldChange("paper_number", event.target.value)}
              placeholder="Ej. 108"
            />
          )}
        </InspectorField>
        <InspectorField
          label={<>Texto alternativo <TechTerm t="paper_label" /></>}
          hint="Reemplaza el texto sólo en la versión impresa."
        >
          {(campo) => (
            <input
              id={campo.id}
              aria-describedby={campo.hintId}
              type="text"
              value={node.paperLabel ?? ""}
              onChange={(event) => onFieldChange("paper_label", event.target.value)}
              placeholder="Etiqueta para el PDF"
            />
          )}
        </InspectorField>
        <InspectorField
          label={<>Salto impreso manual <TechTerm t="paper_skip" /></>}
          hint="Prima sobre el salto inferido desde Reglas."
        >
          {(campo) => (
            <input
              id={campo.id}
              aria-describedby={campo.hintId}
              type="text"
              value={node.paperSkip ?? ""}
              onChange={(event) => onFieldChange("paper_skip", event.target.value)}
              placeholder="Ej. IR A LA PREGUNTA 117"
            />
          )}
        </InspectorField>
        <InspectorField
          label={<>Agrupación impresa <TechTerm t="paper_group" /></>}
          hint="Mismo valor en varias filas = una matriz o bloque común."
        >
          {(campo) => (
            <input
              id={campo.id}
              aria-describedby={campo.hintId}
              type="text"
              value={node.paperGroup ?? ""}
              onChange={(event) => onFieldChange("paper_group", event.target.value)}
              placeholder="Ej. p104_servicios"
            />
          )}
        </InspectorField>
        <InspectorField
          label={<>Subsección impresa <TechTerm t="paper_subgroup" /></>}
          hint="Banda de segundo nivel bajo la sección. Un valor nuevo abre otra subsección."
        >
          {(campo) => (
            <input
              id={campo.id}
              aria-describedby={campo.hintId}
              type="text"
              value={node.paperSubgroup ?? ""}
              onChange={(event) => onFieldChange("paper_subgroup", event.target.value)}
              placeholder="Ej. D.4. Sobre el apoyo de tu familia"
            />
          )}
        </InspectorField>
        <InspectorField
          label={<>Letra impresa <TechTerm t="paper_subletter" /></>}
          hint="En una matriz, a, b, c… en vez de número. «@» marca el enunciado madre."
        >
          {(campo) => (
            <input
              id={campo.id}
              aria-describedby={campo.hintId}
              type="text"
              value={node.paperSubletter ?? ""}
              onChange={(event) => onFieldChange("paper_subletter", event.target.value)}
              placeholder="Ej. a"
              spellCheck={false}
            />
          )}
        </InspectorField>
        <InspectorField
          label={<>Layout impreso <TechTerm t="paper_layout" /></>}
          hint="Cuánto ancho ocupa en la página impresa."
        >
          {(campo) => (
            <select
              id={campo.id}
              aria-describedby={campo.hintId}
              value={(node.paperLayout ?? "").trim()}
              onChange={(event) => onFieldChange("paper_layout", event.target.value)}
            >
              {opcionesLayoutImpreso(node.paperLayout).map((opcion) => (
                <option key={opcion.valor || "auto"} value={opcion.valor}>{opcion.rotulo}</option>
              ))}
            </select>
          )}
        </InspectorField>
      </details>
    </InspectorBlock>
  );
}
