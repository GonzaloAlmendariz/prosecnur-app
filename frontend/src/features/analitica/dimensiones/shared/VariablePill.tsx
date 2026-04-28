import { useDraggable } from "@dnd-kit/core";
import { Check, GripVertical, Pencil, Sigma, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { stripPrefijo } from "./displayVar";

// Pill compacto que representa una variable del instrumento o un
// indicador derivado (subcriterio promediado).
//
// Mental model preguntas-centric: el label humano es el protagonista
// visual. El código técnico va abajo en monospace pequeño SIN el
// prefijo interno `r100_` (que es ruido para el usuario).
//
// Soporta edición in-place del label (afordance: lápiz al hover sobre
// la pill cuando `editableLabel = true`). Click en el lápiz reemplaza
// el label por un input editable.
//
// Las pills "combinadas" (subcriterios) se distinguen visualmente con
// icono Σ y un acento púrpura para reforzar que son indicadores
// derivados, no preguntas crudas del XLSForm.

export type VariableMeta = {
  name: string;
  label: string;
  // Sección/grupo del instrumento al que pertenece (label humano).
  seccion?: string;
};

export function VariablePill({
  meta,
  asignada,
  fresh,
  faltante,
  esCombinado,
  editableLabel,
  prefijo = "r100_",
  onRemove,
  onLabelChange,
}: {
  meta: VariableMeta;
  asignada?: boolean;
  fresh?: boolean;
  faltante?: boolean; // ⚠ Esta variable vino del JSON pero no existe en rp_inst.
  esCombinado?: boolean; // Σ Subcriterio promediado (no var cruda)
  editableLabel?: boolean;
  prefijo?: string;
  onRemove?: () => void;
  onLabelChange?: (next: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `var-${meta.name}`,
    data: { kind: "variable", name: meta.name },
  });

  const [editingLabel, setEditingLabel] = useState(false);
  const [draftLabel, setDraftLabel] = useState(meta.label || "");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editingLabel && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingLabel]);

  const codigoVisible = stripPrefijo(meta.name, prefijo);
  const tieneLabelHumano = !!meta.label && meta.label !== meta.name && meta.label !== codigoVisible;

  // Tooltip nativo con info completa para inspección.
  const tooltipParts: string[] = [];
  if (tieneLabelHumano) tooltipParts.push(meta.label);
  tooltipParts.push(`Código: ${codigoVisible}`);
  if (meta.seccion) tooltipParts.push(`Sección: ${meta.seccion}`);
  if (esCombinado) tooltipParts.push("Indicador combinado (promedio)");
  const tooltip = tooltipParts.join("\n");

  function commitLabel() {
    if (onLabelChange) onLabelChange(draftLabel.trim());
    setEditingLabel(false);
  }
  function cancelLabel() {
    setDraftLabel(meta.label || "");
    setEditingLabel(false);
  }

  // Paleta visual:
  // - faltante (warn): amarillo
  // - combinado (subcriterio): púrpura
  // - asignado (en bloque): primary-soft
  // - default (en sidebar): blanco
  const palette = (() => {
    if (faltante) {
      return {
        bg: "var(--pulso-warn-bg, #fffbeb)",
        border: "var(--pulso-warn-border, #fcd34d)",
        fg: "var(--pulso-warn-fg, #b45309)",
      };
    }
    if (esCombinado) {
      return {
        bg: asignada ? "#ede9fe" : "#f5f3ff",
        border: "#a78bfa",
        fg: "#6d28d9",
      };
    }
    if (asignada) {
      return {
        bg: "var(--pulso-primary-soft)",
        border: "var(--pulso-primary)",
        fg: "var(--pulso-primary)",
      };
    }
    return {
      bg: "white",
      border: "var(--pulso-border)",
      fg: "var(--pulso-text)",
    };
  })();

  return (
    <div
      ref={setNodeRef}
      {...(editingLabel ? {} : listeners)}
      {...attributes}
      title={editingLabel ? undefined : tooltip}
      className={fresh ? "pulso-badge-fresh" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px 6px 8px",
        borderRadius: 8,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.fg,
        cursor: editingLabel ? "text" : isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.5 : 1,
        boxShadow: isDragging ? "var(--pulso-shadow-med)" : "none",
        userSelect: "none",
        transition:
          "background var(--anim-dur-short) var(--anim-ease-smooth), border-color var(--anim-dur-short) var(--anim-ease-smooth), box-shadow var(--anim-dur-short) var(--anim-ease-smooth)",
        maxWidth: "100%",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          color: palette.fg,
          opacity: 0.55,
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {esCombinado ? <Sigma size={12} /> : <GripVertical size={12} />}
      </span>
      {faltante && (
        <span style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }} aria-label="Variable no encontrada">
          ⚠
        </span>
      )}
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.3, flex: 1 }}>
        {editingLabel ? (
          <input
            ref={inputRef}
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitLabel();
              if (e.key === "Escape") cancelLabel();
            }}
            placeholder="Nombre humano…"
            style={{
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              outline: "none",
              background: "transparent",
              color: palette.fg,
              padding: 0,
              minWidth: 0,
              width: "100%",
            }}
          />
        ) : (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 220,
            }}
          >
            {tieneLabelHumano ? meta.label : codigoVisible}
          </span>
        )}
        {tieneLabelHumano && !editingLabel && (
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 10,
              color: palette.fg,
              opacity: 0.65,
            }}
          >
            {codigoVisible}
          </span>
        )}
      </div>
      {editableLabel && !editingLabel && (
        <button
          type="button"
          onPointerDown={(e) => {
            // Evitar que @dnd-kit inicie un drag al click en el lápiz.
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            setDraftLabel(tieneLabelHumano ? meta.label : "");
            setEditingLabel(true);
          }}
          aria-label={`Renombrar ${codigoVisible}`}
          title="Editar nombre humano"
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 2,
            color: palette.fg,
            opacity: 0.6,
          }}
        >
          <Pencil size={11} />
        </button>
      )}
      {editingLabel && (
        <>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              commitLabel();
            }}
            aria-label="Guardar"
            title="Guardar"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 2,
              color: "var(--pulso-success-fg, #15803d)",
            }}
          >
            <Check size={12} />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              cancelLabel();
            }}
            aria-label="Cancelar"
            title="Cancelar"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 2,
              color: "var(--pulso-text-soft)",
            }}
          >
            <X size={12} />
          </button>
        </>
      )}
      {onRemove && !editingLabel && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Quitar ${codigoVisible}`}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            marginLeft: 2,
            color: "inherit",
            opacity: 0.7,
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
