// Pestaña «Contenido» del Constructor: texto, ayuda y notas.
// Extraída de canvas/FocusedWorkspace.tsx — refactor puro, revamp 2026-10-16.

import { CheckCircle2, FileText, ImagePlus } from "lucide-react";
import type { BuilderNode } from "../../types";
import { InspectorBlock, InspectorField } from "../../inspector/InspectorPrimitives";
import { MarkdownField } from "../../inspector/MarkdownField";

export function ContentTab({
  node,
  onFieldChange,
  onFieldsChange,
}: {
  node: BuilderNode;
  onFieldChange: (field: string, value: string) => void;
  onFieldsChange: (updates: Record<string, string>) => void;
}) {
  const isSection = node.kind === "section" || node.kind === "repeat";
  return (
    <div className="pulso-focus-tab-panel">
      <InspectorBlock>
        <InspectorField
          label={isSection ? "Título del bloque" : "Texto principal"}
          hint={
            isSection
              ? "Nombre visible de la sección o repetición."
              : node.kind === "note"
                ? "La nota o instrucción que verá el encuestador."
                : "La pregunta que verá el encuestado."
          }
        >
          {(campo) => (
            <MarkdownField
              id={campo.id}
              ariaLabelledBy={campo.labelId}
              ariaDescribedBy={campo.hintId}
              value={node.label}
              onChange={(next) => onFieldChange("label", next)}
              placeholder={isSection ? "Ej. Datos de la vivienda" : "Ej. ¿Cuál es tu edad?"}
              rows={2}
            />
          )}
        </InspectorField>

        {!isSection && (
          <InspectorField
            label="Pista de apoyo"
            hint="Aclaración breve debajo de la pregunta. Puede quedar vacía."
          >
            {(campo) => (
              <MarkdownField
                id={campo.id}
                ariaLabelledBy={campo.labelId}
                ariaDescribedBy={campo.hintId}
                value={node.hint}
                onChange={(next) => onFieldChange("hint", next)}
                placeholder="Ej. Indica años cumplidos."
                rows={2}
                compact
              />
            )}
          </InspectorField>
        )}
      </InspectorBlock>
      {node.kind === "note" && (
        <NoteAuthoringPanel onFieldsChange={onFieldsChange} />
      )}
    </div>
  );
}

export type NotePreset = {
  id: string;
  label: string;
  hint: string;
  title: string;
  body: string;
  mediaImage?: string;
};

export const NOTE_AUTHORING_PRESETS: NotePreset[] = [
  {
    id: "instruction",
    label: "Instrucción de campo",
    hint: "Indicación breve antes de una pregunta o bloque.",
    title: "Antes de continuar",
    body: "Lee esta indicación a la persona encuestada y confirma que quedó clara.",
  },
  {
    id: "chart",
    label: "Gráfico o imagen",
    hint: "Nota con imagen de apoyo vinculada por media::image.",
    title: "Revisa el gráfico de referencia",
    body: "Usa la imagen para explicar la siguiente pregunta. Si no se visualiza, continúa con la consigna escrita.",
    mediaImage: "grafico_referencia.png",
  },
  {
    id: "consent",
    label: "Recordatorio de consentimiento",
    hint: "Pauta ética sin pedir respuesta.",
    title: "Recordatorio importante",
    body: "La participación es voluntaria. La persona puede decidir no responder una pregunta si no se siente cómoda.",
  },
  {
    id: "separator",
    label: "Separador de tema",
    hint: "Transición clara dentro del formulario.",
    title: "Nueva sección",
    body: "Ahora revisaremos un tema distinto. Tómate un momento para confirmar que la persona está lista.",
  },
];

export function NoteAuthoringPanel({
  onFieldsChange,
}: {
  onFieldsChange: (updates: Record<string, string>) => void;
}) {
  return (
    <InspectorBlock>
      <div className="pulso-focus-note-authoring" aria-label="Atajos para nota">
        <div className="pulso-focus-note-authoring-head">
          <span className="pulso-focus-note-authoring-icon" aria-hidden="true">
            <FileText size={14} />
          </span>
          <div>
            <span className="pulso-section-eyebrow">Nota Kobo</span>
            <strong>Insertar texto de apoyo sin capturar respuesta</strong>
            <p>Úsala para instrucciones, consentimiento, separadores o gráficos de referencia.</p>
          </div>
        </div>
        <div className="pulso-focus-note-preset-grid">
          {NOTE_AUTHORING_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="pulso-focus-note-preset"
              onClick={() => {
                onFieldsChange({
                  label: preset.title,
                  hint: preset.body,
                  ...(preset.mediaImage ? { "media::image": preset.mediaImage } : {}),
                });
              }}
              title={preset.hint}
            >
              <span className="pulso-focus-note-preset-icon" aria-hidden="true">
                {preset.mediaImage ? <ImagePlus size={13} /> : <CheckCircle2 size={13} />}
              </span>
              <span className="pulso-focus-note-preset-copy">
                <strong>{preset.label}</strong>
                <small>{preset.hint}</small>
              </span>
              {preset.mediaImage && <code>media</code>}
            </button>
          ))}
        </div>
      </div>
    </InspectorBlock>
  );
}
