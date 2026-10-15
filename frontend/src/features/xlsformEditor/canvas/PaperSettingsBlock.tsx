// =============================================================================
// canvas/PaperSettingsBlock.tsx — «Ajustes de papel» de la pestaña Datos
// =============================================================================
// Columnas `paper_*` de la fila: sólo cambian el PDF/Word impreso, no Kobo.
// Plegado por defecto; abierto si la fila ya trae algún ajuste. El padre lo
// monta con `key` por fila para que el plegado se recalcule al cambiar de nodo.
// `InspectorField` no asocia su rótulo al control, así que cada input lleva su
// propio `aria-label`.
// =============================================================================

import { useState } from "react";
import type { BuilderNode } from "../types";
import { InspectorBlock, InspectorField } from "../inspector/InspectorPrimitives";
import { TechTerm } from "../helpers/TechTerm";
import { hasPaperOverrides } from "./paperSettings";

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
          <input
            type="text"
            value={node.paperNumber ?? ""}
            onChange={(event) => onFieldChange("paper_number", event.target.value)}
            aria-label="Número visible"
            placeholder="Ej. 108"
          />
        </InspectorField>
        <InspectorField
          label={<>Texto alternativo <TechTerm t="paper_label" /></>}
          hint="Reemplaza el texto sólo en la versión impresa."
        >
          <input
            type="text"
            value={node.paperLabel ?? ""}
            onChange={(event) => onFieldChange("paper_label", event.target.value)}
            aria-label="Texto alternativo"
            placeholder="Etiqueta para el PDF"
          />
        </InspectorField>
        <InspectorField
          label={<>Salto impreso manual <TechTerm t="paper_skip" /></>}
          hint="Prima sobre el salto inferido desde Reglas."
        >
          <input
            type="text"
            value={node.paperSkip ?? ""}
            onChange={(event) => onFieldChange("paper_skip", event.target.value)}
            aria-label="Salto impreso manual"
            placeholder="Ej. IR A LA PREGUNTA 117"
          />
        </InspectorField>
        <InspectorField
          label={<>Agrupación impresa <TechTerm t="paper_group" /></>}
          hint="Mismo valor en varias filas = una matriz o bloque común."
        >
          <input
            type="text"
            value={node.paperGroup ?? ""}
            onChange={(event) => onFieldChange("paper_group", event.target.value)}
            aria-label="Agrupación impresa"
            placeholder="Ej. p104_servicios"
          />
        </InspectorField>
        <InspectorField
          label={<>Subsección impresa <TechTerm t="paper_subgroup" /></>}
          hint="Banda de segundo nivel bajo la sección. Un valor nuevo abre otra subsección."
        >
          <input
            type="text"
            value={node.paperSubgroup ?? ""}
            onChange={(event) => onFieldChange("paper_subgroup", event.target.value)}
            aria-label="Subsección impresa"
            placeholder="Ej. D.4. Sobre el apoyo de tu familia"
          />
        </InspectorField>
        <InspectorField
          label={<>Letra impresa <TechTerm t="paper_subletter" /></>}
          hint="En una matriz, a, b, c… en vez de número. «@» marca el enunciado madre."
        >
          <input
            type="text"
            value={node.paperSubletter ?? ""}
            onChange={(event) => onFieldChange("paper_subletter", event.target.value)}
            aria-label="Letra impresa"
            placeholder="Ej. a"
            spellCheck={false}
          />
        </InspectorField>
        <InspectorField
          label={<>Layout impreso <TechTerm t="paper_layout" /></>}
          hint="full, wide, matrix o compact. Vacío = automático."
        >
          <input
            type="text"
            value={node.paperLayout ?? ""}
            onChange={(event) => onFieldChange("paper_layout", event.target.value)}
            aria-label="Layout impreso"
            placeholder="Automático"
            spellCheck={false}
          />
        </InspectorField>
      </details>
    </InspectorBlock>
  );
}
