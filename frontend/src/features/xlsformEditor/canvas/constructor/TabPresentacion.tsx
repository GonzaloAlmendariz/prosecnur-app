// Pestaña «Presentación» del Constructor: apariencia, medios y guía por tipo.
// Extraída de canvas/FocusedWorkspace.tsx — refactor puro, revamp 2026-10-16.

import { ImagePlus, Info, Mic, Paintbrush, Video } from "lucide-react";
import type { BuilderNode } from "../../types";
import { typeLabel } from "../../parsing/parseType";
import { InspectorBlock, InspectorField } from "../../inspector/InspectorPrimitives";
import { AppearancePicker } from "../../inspector/AppearancePicker";
import { shouldOfferPresentationTab } from "../constructor/compartido";

export function PresentationTab({
  node,
  onFieldChange,
}: {
  node: BuilderNode;
  onFieldChange: (field: string, value: string) => void;
}) {
  if (!shouldOfferPresentationTab(node)) {
    return (
      <div className="pulso-focus-tab-panel">
        <div className="pulso-focus-soft-empty">
          <Paintbrush size={15} />
          <span>Este tipo no necesita ajustes de presentación en el flujo guiado.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pulso-focus-tab-panel">
      <InspectorBlock>
        <InspectorField
          label="Apariencia del control"
          hint="Opciones de renderizado aplicables para este tipo en Collect. Déjalo vacío para usar el comportamiento estándar."
        >
          <AppearancePicker
            baseType={node.typeInfo.base}
            value={node.appearance}
            onChange={(next) => onFieldChange("appearance", next)}
          />
        </InspectorField>
      </InspectorBlock>
      <MediaAttachmentPanel node={node} onFieldChange={onFieldChange} />
      <PresentationGuidance node={node} />
    </div>
  );
}

export function MediaAttachmentPanel({
  node,
  onFieldChange,
}: {
  node: BuilderNode;
  onFieldChange: (field: string, value: string) => void;
}) {
  const fields = [
    {
      key: "media::image",
      value: node.mediaImage ?? "",
      label: "Imagen de apoyo",
      placeholder: "Ej. referencia.png",
      icon: ImagePlus,
      hint: "Aparece junto al texto de la pregunta o nota.",
      examples: ["referencia.png", "mapa_sector.png", "ejemplo_respuesta.png"],
    },
    {
      key: "media::audio",
      value: node.mediaAudio ?? "",
      label: "Audio de consigna",
      placeholder: "Ej. instruccion.mp3",
      icon: Mic,
      hint: "Útil para idiomas, pronunciación o instrucciones de campo.",
      examples: ["instruccion.mp3", "lectura_consentimiento.mp3"],
    },
    {
      key: "media::video",
      value: node.mediaVideo ?? "",
      label: "Video de referencia",
      placeholder: "Ej. demostracion.mp4",
      icon: Video,
      hint: "Material breve para explicar un procedimiento.",
      examples: ["demostracion.mp4", "ejemplo_visita.mp4"],
    },
  ];
  const active = fields.filter((field) => field.value.trim().length > 0);

  return (
    <InspectorBlock>
      <div className="pulso-focus-media-panel">
        <div className="pulso-focus-media-head">
          <span className="pulso-focus-media-icon" aria-hidden="true">
            <ImagePlus size={14} />
          </span>
          <div>
            <span className="pulso-section-eyebrow">Material de consigna</span>
            <strong>{active.length ? `${active.length} adjunto${active.length === 1 ? "" : "s"} vinculado${active.length === 1 ? "" : "s"}` : "Sin multimedia adjunta"}</strong>
            <p>Usa archivos que ya estarán en la carpeta media del XLSForm. No reemplaza preguntas de evidencia como foto, audio o video.</p>
          </div>
        </div>

        <div className="pulso-focus-media-grid">
          {fields.map((field) => {
            const Icon = field.icon;
            const hasValue = field.value.trim().length > 0;
            return (
              <div key={field.key} className={`pulso-focus-media-field ${hasValue ? "is-active" : ""}`}>
                <div className="pulso-focus-media-field-head">
                  <span aria-hidden="true">
                    <Icon size={13} />
                  </span>
                  <div>
                    <strong>{field.label}</strong>
                    <small>{field.hint}</small>
                  </div>
                </div>
                <input
                  type="text"
                  value={field.value}
                  onChange={(event) => onFieldChange(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  spellCheck={false}
                />
                <div className="pulso-focus-media-examples" aria-label={`Atajos para ${field.label}`}>
                  {field.examples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => onFieldChange(field.key, example)}
                    >
                      {example}
                    </button>
                  ))}
                  {hasValue && (
                    <button
                      type="button"
                      className="is-clear"
                      onClick={() => onFieldChange(field.key, "")}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </InspectorBlock>
  );
}

export function PresentationGuidance({ node }: { node: BuilderNode }) {
  const base = node.typeInfo.base;
  const guide = presentationGuideFor(base);

  return (
    <div className="pulso-focus-presentation-guide">
      <div className="pulso-focus-presentation-guide-icon" aria-hidden="true">
        <Info size={14} />
      </div>
      <div>
        <span className="pulso-section-eyebrow">{guide.kicker}</span>
        <strong>{guide.title}</strong>
        <p>{guide.body}</p>
        {guide.badges.length > 0 && (
          <div className="pulso-focus-presentation-badges">
            {guide.badges.map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function presentationGuideFor(baseType: string): {
  kicker: string;
  title: string;
  body: string;
  badges: string[];
} {
  switch (baseType) {
    case "image":
      return {
        kicker: "Evidencia de campo",
        title: "Foto, dibujo o anotación",
        body: "Usa la apariencia para pedir foto normal, dibujo o anotación sobre imagen. La respuesta se guarda como adjunto del envío.",
        badges: ["image", "draw", "annotate"],
      };
    case "audio":
      return {
        kicker: "Evidencia de campo",
        title: "Registro de audio",
        body: "Este control captura una grabación o archivo de audio. El texto de la pregunta debe explicar qué evidencia se espera.",
        badges: ["audio", "media"],
      };
    case "video":
      return {
        kicker: "Evidencia de campo",
        title: "Registro de video",
        body: "Este control captura video como adjunto. Mantén la consigna breve para que el encuestador sepa qué registrar.",
        badges: ["video", "media"],
      };
    case "file":
      return {
        kicker: "Evidencia de campo",
        title: "Archivo adjunto",
        body: "Sirve para solicitar un documento u otro respaldo. Si el XLSForm trae columnas media::, Prosecnur las conserva al exportar.",
        badges: ["file", "media"],
      };
    case "barcode":
      return {
        kicker: "Captura rápida",
        title: "Código de barras o QR",
        body: "El encuestador escanea un código y Kobo guarda el valor leído. Es útil para formularios con identificadores físicos.",
        badges: ["barcode", "qr"],
      };
    case "geopoint":
      return {
        kicker: "Ubicación",
        title: "Punto GPS",
        body: "Captura una coordenada puntual. Para recorridos o áreas, cambia el tipo a geotrace o geoshape desde el selector de tipo.",
        badges: ["geopoint", "gps"],
      };
    case "geotrace":
      return {
        kicker: "Ubicación",
        title: "Recorrido GPS",
        body: "Captura una línea o recorrido. Úsalo cuando el levantamiento necesita trazar desplazamientos, no solo un punto.",
        badges: ["geotrace", "gps"],
      };
    case "geoshape":
      return {
        kicker: "Ubicación",
        title: "Área GPS",
        body: "Captura un polígono o área. Es adecuado para delimitar zonas, parcelas o coberturas en campo.",
        badges: ["geoshape", "gps"],
      };
    default:
      return {
        kicker: "Presentación",
        title: `${typeLabel(baseType)} en Collect`,
        body: "La apariencia ajusta cómo se muestra el control sin cambiar la columna de datos. Si el XLSX trae multimedia asociada, Prosecnur la conserva al exportar.",
        badges: baseType ? [baseType] : [],
      };
  }
}
