import { useDroppable } from "@dnd-kit/core";
import { Hash, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { stripPrefijo } from "./displayVar";
import { VariableMeta, VariablePill } from "./VariablePill";

// Tarjeta de un bloque temático. Es un drop-target: aceptan drops de
// VariablePill. Tiene un nombre humano editable, contador de vars, y
// barra footer con las pills asignadas (cada una se puede arrastrar a
// otro bloque o quitar con la X).
//
// Cuando recibe un drop, el wizard marca el bloque como "fresh" — la
// tarjeta brilla 320ms con `pulso-card-glow` para feedback inmediato.
//
// El input de etiqueta tiene affordance clara (borde sutil + placeholder
// + lápiz en hover) para que el usuario armando desde cero vea de
// inmediato que tiene que ponerle nombre. Si el padre pasa
// `autoFocusEtiqueta`, el input se enfoca al montar — útil al agregar
// un bloque nuevo.

export function BloqueCard({
  nombre,
  etiqueta,
  vars,
  varsMeta,
  fresh,
  varsFaltantes,
  autoFocusEtiqueta,
  prefijo = "r100_",
  varsCombinadas,
  onRenameEtiqueta,
  onDelete,
  onRemoveVar,
  onLabelVarChange,
}: {
  nombre: string;
  etiqueta: string;
  vars: string[];
  // Mapa nombre → meta para resolver labels humanos.
  varsMeta: Record<string, VariableMeta>;
  fresh?: boolean;
  varsFaltantes?: Set<string>;
  autoFocusEtiqueta?: boolean;
  prefijo?: string;
  // Set de vars que son indicadores combinados (subcriterios). El BloqueCard
  // las pinta con la variante "esCombinado" (icono Σ + acento púrpura).
  varsCombinadas?: Set<string>;
  onRenameEtiqueta: (nuevo: string) => void;
  onDelete: () => void;
  onRemoveVar: (variable: string) => void;
  onLabelVarChange?: (variable: string, label: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `bloque-${nombre}`,
    data: { kind: "bloque", nombre },
  });

  // Auto-glow cuando llega un drop nuevo: el padre cambia `fresh`,
  // aplicamos la clase ~640ms y la quitamos.
  const [glowing, setGlowing] = useState(false);
  const lastFresh = useRef(fresh);
  useEffect(() => {
    if (fresh && fresh !== lastFresh.current) {
      setGlowing(true);
      const t = window.setTimeout(() => setGlowing(false), 640);
      lastFresh.current = fresh;
      return () => window.clearTimeout(t);
    }
    lastFresh.current = fresh;
  }, [fresh]);

  // Auto-focus + select del input al montar cuando el padre lo pide
  // (típicamente al agregar un bloque nuevo).
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocusEtiqueta && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [hoverInput, setHoverInput] = useState(false);
  const [focusInput, setFocusInput] = useState(false);
  const inputActivo = hoverInput || focusInput;

  return (
    <div
      ref={setNodeRef}
      className={glowing ? "pulso-card-glow" : undefined}
      style={{
        padding: 14,
        borderRadius: 12,
        border: `2px solid ${isOver ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
        background: isOver ? "var(--pulso-primary-soft)" : "white",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 140,
        transition:
          "background var(--anim-dur-short) var(--anim-ease-smooth), border-color var(--anim-dur-short) var(--anim-ease-smooth)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "var(--pulso-primary-soft)",
            color: "var(--pulso-primary)",
            fontSize: 11,
            fontWeight: 700,
            marginTop: 14,
          }}
        >
          <Hash size={14} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              color: "var(--pulso-text-soft)",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Pencil size={9} /> Nombre del bloque
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 2,
              padding: "4px 8px",
              borderRadius: 6,
              border: `1px solid ${focusInput ? "var(--pulso-primary)" : inputActivo ? "var(--pulso-border)" : "transparent"}`,
              background: focusInput ? "var(--pulso-primary-soft)" : inputActivo ? "var(--pulso-surface-2, #f4f5f9)" : "transparent",
              transition:
                "background var(--anim-dur-short) var(--anim-ease-smooth), border-color var(--anim-dur-short) var(--anim-ease-smooth)",
            }}
            onMouseEnter={() => setHoverInput(true)}
            onMouseLeave={() => setHoverInput(false)}
          >
            <input
              ref={inputRef}
              value={etiqueta}
              onChange={(e) => onRenameEtiqueta(e.target.value)}
              onFocus={() => setFocusInput(true)}
              onBlur={() => setFocusInput(false)}
              placeholder="ej. Trato, Tiempo, Información…"
              aria-label={`Nombre del bloque ${nombre}`}
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                fontSize: 14,
                fontWeight: 700,
                color: "var(--pulso-text)",
                padding: 0,
                minWidth: 0,
                outline: "none",
              }}
            />
          </div>
        </div>
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 22 }}>
          {vars.length} {vars.length === 1 ? "var" : "vars"}
        </span>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Eliminar bloque ${etiqueta}`}
          title="Eliminar bloque"
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 4,
            borderRadius: 4,
            color: "var(--pulso-text-soft)",
            marginTop: 18,
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          padding: vars.length === 0 ? 12 : 0,
          borderRadius: 8,
          border: vars.length === 0 ? "1px dashed var(--pulso-border)" : "none",
          background: vars.length === 0 ? "var(--pulso-surface-2, #f4f5f9)" : "transparent",
          minHeight: vars.length === 0 ? 60 : undefined,
          alignItems: vars.length === 0 ? "center" : "flex-start",
          justifyContent: vars.length === 0 ? "center" : "flex-start",
        }}
      >
        {vars.length === 0 ? (
          <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", textAlign: "center" }}>
            Arrastra variables aquí
          </span>
        ) : (
          vars.map((v) => {
            const meta = varsMeta[v] ?? {
              name: v,
              label: stripPrefijo(v, prefijo),
            };
            const esCombinado = varsCombinadas?.has(v);
            return (
              <VariablePill
                key={v}
                meta={meta}
                asignada
                esCombinado={esCombinado}
                prefijo={prefijo}
                faltante={varsFaltantes?.has(v)}
                editableLabel={!!onLabelVarChange}
                onRemove={() => onRemoveVar(v)}
                onLabelChange={
                  onLabelVarChange ? (next) => onLabelVarChange(v, next) : undefined
                }
              />
            );
          })
        )}
      </div>
    </div>
  );
}
