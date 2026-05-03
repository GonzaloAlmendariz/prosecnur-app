import { useMemo, useRef, useEffect, useState } from "react";
import * as Lucide from "lucide-react";
import { Plus, Shuffle, X, Wand2, Check, ImagePlus, Save, RotateCcw } from "lucide-react";
import { GraficadorMetadata, GraficadorRef } from "../../api/client";
import { usePlanStore } from "./store";
import { useGraficosRegistry } from "./useGraficosRegistry";
import GraficadorPicker from "./GraficadorPicker";
import GraficadorForm from "./GraficadorForm";
import MultiApiladasBuilder from "./MultiApiladasBuilder";
import { graficadorToPresetType } from "./graficadorPresetMap";

// Card que representa un slot de graficador dentro de un slide. Dos
// estados:
//   - Vacío: dashed border + botón "Elegir graficador" (abre picker).
//   - Con graficador: card con header (icono + nombre humano + nombre
//     técnico) + botón "Cambiar" / eliminar + body con ArgGroups.
//
// El slot name (izquierda, derecha, grafico, pic1, superior_izquierda...)
// viene de la definición del slide en prosecnur. Lo mostramos como pill
// arriba de la card para orientar al usuario.

import { ArgGrupo } from "../../api/client";

export type GraficadorSlotMode = "data" | "style" | "filters";

type Props = {
  slideId: string;
  slotName: string;
  value: GraficadorRef | null | undefined;
  /** Determina qué grupos de args se muestran y si el OverrideDropdown
   *  (botón "Estilo" con varita) está visible. Por defecto "data". */
  mode?: GraficadorSlotMode;
};

const MODE_GROUPS: Record<GraficadorSlotMode, ArgGrupo[]> = {
  data:    ["datos"],
  style:   ["lectura", "leyenda", "espacio", "textos", "estilo", "canvas"],
  filters: ["valores", "tabla", "filtro", "semaforo"],
};

// Slot names → label humano. Si no mapea, mostramos el name crudo.
const SLOT_LABELS: Record<string, string> = {
  grafico: "Gráfico",
  izquierda: "Izquierda",
  derecha: "Derecha",
  grafico_1: "Gráfico 1",
  grafico_2: "Gráfico 2",
  superior_izquierda: "Superior izquierda",
  superior_derecha: "Superior derecha",
  inferior_izquierda: "Inferior izquierda",
  inferior_derecha: "Inferior derecha",
  grafico_superior_1: "Superior 1",
  grafico_superior_2: "Superior 2",
  grafico_superior_3: "Superior 3",
  grafico_inferior_1: "Inferior 1",
  grafico_inferior_2: "Inferior 2",
  grafico_inferior_3: "Inferior 3",
};

export default function GraficadorSlot({ slideId, slotName, value, mode = "data" }: Props) {
  const setSlot = usePlanStore((s) => s.setSlot);
  const updateArgs = usePlanStore((s) => s.updateSlotArgs);
  const { graficadoresById } = useGraficosRegistry();
  const [pickerOpen, setPickerOpen] = useState(false);
  const allowedGroups = MODE_GROUPS[mode];
  // El OverrideDropdown (wand) sólo vive en modo style — el override define
  // estilo, no datos ni filtros, así que duplicarlo en otros tabs sería
  // inconsistente.
  const showOverride = mode === "style";

  function onPick(meta: GraficadorMetadata) {
    // Al elegir un graficador nuevo, construimos args con los defaults
    // del registry (los que tengan valor por defecto). Los args sin
    // default se dejan como undefined para que el usuario los llene.
    const args: Record<string, unknown> = {};
    // Preservar args existentes si es un "cambiar graficador" sobre slot ya
    // poblado y el arg nuevo tiene el mismo nombre.
    const prevArgs = value?.args ?? {};
    for (const a of meta.args) {
      if (prevArgs[a.name] !== undefined) {
        args[a.name] = prevArgs[a.name];
      }
    }
    setSlot(slideId, slotName, { graficador: meta.name, args });
    setPickerOpen(false);
  }

  const slotLabel = SLOT_LABELS[slotName] ?? slotName;

  // En modos style/filters NO mostramos el "slot vacío" porque la
  // selección de graficador es responsabilidad de Datos. Mostrar un
  // placeholder aquí tentaría al usuario a elegir gráficos desde Estilo
  // (rompiendo el flujo). En su lugar, pintamos un mensaje sutil.
  if ((!value || !value.graficador) && mode !== "data") {
    return (
      <div style={{
        marginBottom: 12, padding: "10px 14px",
        border: "1px dashed var(--pulso-border)",
        borderRadius: 8,
        background: "var(--pulso-surface-2)",
        fontSize: 11, color: "var(--pulso-text-soft)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <SlotLabel text={slotLabel} slotName={slotName} />
        <span>Slot vacío. Elige un gráfico en la pestaña <strong>Datos</strong> primero.</span>
      </div>
    );
  }

  // --- Slot vacío ---
  // Min-height se mantiene consistente con el slot con graficador para
  // evitar layout shift al poblar. Diseño más invitante: ícono
  // placeholder grande a la izquierda, copy guiado, CTA primario.
  if (!value || !value.graficador) {
    return (
      <div
        style={{
          marginBottom: 12, padding: "14px 16px",
          border: "1px dashed var(--pulso-border)",
          borderRadius: 8,
          background: "var(--pulso-surface)",
          display: "flex", alignItems: "center", gap: 14,
          minHeight: 66,
          transition: "border-color 120ms ease, background 120ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--pulso-primary-border)";
          e.currentTarget.style.background = "var(--pulso-primary-soft)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--pulso-border)";
          e.currentTarget.style.background = "var(--pulso-surface)";
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 38, height: 38, borderRadius: 8,
            background: "white",
            color: "var(--pulso-text-soft)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            border: "1px solid var(--pulso-border)",
            flexShrink: 0,
          }}
        >
          <ImagePlus size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SlotLabel text={slotLabel} slotName={slotName} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pulso-text)" }}>
              Añade un gráfico a este slot
            </span>
          </div>
          <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
            Elige un tipo del catálogo (barras, pie, radar, etc.) y configura sus args.
          </span>
        </div>
        <button
          type="button"
          className="pulso-primary"
          onClick={() => setPickerOpen(true)}
          style={{ fontSize: 12, padding: "7px 12px", display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
        >
          <Plus size={13} /> Elegir graficador
        </button>
        {pickerOpen && <GraficadorPicker onPick={onPick} onCancel={() => setPickerOpen(false)} />}
      </div>
    );
  }

  // --- Slot con graficador ---
  const meta = graficadoresById[value.graficador];
  const Icon = meta ? resolveLucide(meta.icono_ui) : Lucide.Square;
  const titulo = meta?.titulo_humano ?? value.graficador;

  return (
    <div
      style={{
        marginBottom: 12,
        border: "1px solid var(--pulso-border)",
        borderRadius: 8,
        background: "white",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 12px",
          background: "var(--pulso-surface)",
          borderBottom: "1px solid var(--pulso-border)",
          display: "flex", alignItems: "center", gap: 10,
        }}
      >
        <SlotLabel text={slotLabel} slotName={slotName} />

        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: 1 }}>
          <span
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: "var(--pulso-primary-soft)",
              color: "var(--pulso-primary)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Icon size={14} />
          </span>
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pulso-text)", lineHeight: 1.2 }}>
              {titulo}
            </span>
            <code style={{ fontSize: 10, color: "var(--pulso-text-soft)", fontFamily: "ui-monospace, monospace" }}>
              {value.graficador}
            </code>
          </span>
        </span>

        {showOverride && (
          <OverrideDropdown
            slideId={slideId}
            slotName={slotName}
            value={value}
          />
        )}
        {mode === "data" && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px" }}
            title="Cambiar por otro tipo de gráfico"
          >
            <Shuffle size={11} /> Cambiar
          </button>
        )}
        {mode === "data" && (
          <button
            type="button"
            onClick={() => setSlot(slideId, slotName, null)}
            className="pulso-icon pulso-icon-danger"
            aria-label="Quitar graficador"
            title="Quitar graficador"
            style={{ minWidth: 26, minHeight: 26 }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Body: args agrupados, filtrados por modo */}
      <div style={{ padding: 12 }}>
        {mode === "data" && value.graficador === "p_barras_multiapiladas" ? (
          <MultiApiladasBuilder
            graf={value}
            onArgs={(patch) => updateArgs(slideId, slotName, patch)}
          />
        ) : (
          <GraficadorForm
            graf={value}
            onArgs={(patch) => updateArgs(slideId, slotName, patch)}
            groupFilter={allowedGroups}
          />
        )}
      </div>

      {pickerOpen && <GraficadorPicker onPick={onPick} onCancel={() => setPickerOpen(false)} />}
    </div>
  );
}

function SlotLabel({ text, slotName }: { text: string; slotName: string }) {
  return (
    <span
      style={{
        fontSize: 9, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: 0.5,
        color: "var(--pulso-text-soft)",
        padding: "3px 7px", borderRadius: 999,
        background: "white",
        border: "1px solid var(--pulso-border)",
        whiteSpace: "nowrap",
      }}
      title={`Slot técnico: ${slotName}`}
    >
      {text}
    </span>
  );
}

type LucideIcon = (props: { size?: number; color?: string }) => JSX.Element;
function resolveLucide(name: string): LucideIcon {
  const registry = Lucide as unknown as Record<string, LucideIcon>;
  return registry[name] ?? registry["BarChart"] ?? registry["Square"];
}

// Dropdown de "Modo" (concepto = override reusable). El usuario lo
// llama así: "modo compacto", "modo narrativo". Es un set de args que
// sobreescribe al preset global para este slot.
//
// Estados visuales:
//   - "Modo: por defecto"  → sin overrides (preset puro)
//   - "Modo: 'compacto'"   → un override reusable aplicado exacto
//   - "'compacto' + N"     → override aplicado + edits encima
//   - "Modo custom (N)"    → solo edits, sin override base
//
// Acciones:
//   - Selección de modo predefinido (con confirmación si hay edits).
//   - "Crear modo nuevo" → guarda los args custom actuales como un
//     OverrideReusable nombrado.
//   - "Volver al preset" → limpia overrides del slot.
function OverrideDropdown({
  slideId,
  slotName,
  value,
}: {
  slideId: string;
  slotName: string;
  value: GraficadorRef;
}) {
  const allOverrides = usePlanStore((s) => s.overridesReusables);
  const addOverride = usePlanStore((s) => s.addOverrideReusable);
  const updateArgs = usePlanStore((s) => s.updateSlotArgs);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const presetType = graficadorToPresetType(value.graficador);
  const aplicables = useMemo(
    () => (presetType ? allOverrides.filter((o) => o.tipo_preset === presetType) : []),
    [allOverrides, presetType]
  );

  // Click-outside + Escape cierran el popover.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!presetType) return null;

  // Estado actual: ¿está aplicado un modo exacto, modo+edits, o custom puro?
  const currentOverrideArgs = (value.args?.overrides as Record<string, unknown>) ?? {};
  const customCount = Object.keys(currentOverrideArgs).length;

  // Buscamos un modo cuyos args sean SUBSET de los actuales. Si los
  // matches son exactos → modo exacto. Si los args actuales tienen MÁS
  // keys que el modo → modo + edits.
  const exactMatch = aplicables.find((o) => shallowEqualArgs(o.args, currentOverrideArgs));
  const partialMatch = exactMatch
    ? null
    : aplicables.find((o) => isSubset(o.args, currentOverrideArgs));
  const editsOverMatch = partialMatch
    ? Object.keys(currentOverrideArgs).length - Object.keys(partialMatch.args).length
    : 0;
  const isPureCustom = customCount > 0 && !exactMatch && !partialMatch;

  // Label del trigger
  let triggerLabel = "Modo: por defecto";
  if (exactMatch) triggerLabel = `Modo: ${exactMatch.nombre}`;
  else if (partialMatch) triggerLabel = `${partialMatch.nombre} + ${editsOverMatch}`;
  else if (isPureCustom) triggerLabel = `Custom (${customCount})`;

  const isActive = exactMatch || partialMatch || isPureCustom;

  function applyMode(args: Record<string, unknown> | null) {
    // Si hay edits custom y vamos a reemplazar, pedir confirmación.
    const willOverwriteCustom =
      customCount > 0 &&
      !shallowEqualArgs(currentOverrideArgs, args ?? {});
    if (willOverwriteCustom) {
      const ok = window.confirm(
        `Tienes ${customCount} cambio${customCount === 1 ? "" : "s"} sobre el preset. ` +
        `Aplicar otro modo los reemplaza. ¿Continuar?\n\n` +
        `Tip: cancela y usa "Crear modo" si quieres guardarlos antes.`
      );
      if (!ok) { setOpen(false); return; }
    }
    updateArgs(slideId, slotName, { overrides: args ?? {} });
    setOpen(false);
  }

  function createMode() {
    if (customCount === 0) {
      window.alert("No hay cambios custom para guardar como modo. Edita algún arg primero.");
      return;
    }
    const nombre = window.prompt(
      "Nombre del modo nuevo (ej. 'compacto', 'narrativo', 'minimal'):",
      "modo personalizado"
    );
    if (!nombre || !nombre.trim()) { setOpen(false); return; }
    const id = `ovr-${Math.random().toString(36).slice(2, 10)}`;
    addOverride({
      id,
      nombre: nombre.trim(),
      tipo_preset: presetType!,
      args: { ...currentOverrideArgs },
    });
    setOpen(false);
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={
          isPureCustom
            ? `${customCount} cambio${customCount === 1 ? "" : "s"} custom sobre el preset`
            : "Cambiar modo de estilo"
        }
        style={{
          fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4,
          padding: "5px 10px",
          border: `1px solid ${isActive ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
          background: isActive ? "var(--pulso-primary-soft)" : "white",
          color: isActive ? "var(--pulso-primary)" : "var(--pulso-text)",
          borderRadius: 5, cursor: "pointer",
          fontWeight: isActive ? 600 : 500,
        }}
      >
        <Wand2 size={11} />
        {triggerLabel}
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0,
            zIndex: 21,
            minWidth: 260,
            background: "white",
            border: "1px solid var(--pulso-border)",
            borderRadius: 7,
            boxShadow: "var(--pulso-shadow-med)",
            padding: 4,
            display: "flex", flexDirection: "column", gap: 1,
          }}
        >
          <div style={{
            fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
            color: "var(--pulso-text-soft)", padding: "6px 9px 4px",
          }}>Modos disponibles</div>

          <DropdownOption
            label="Por defecto"
            hint="Solo los valores del preset"
            active={customCount === 0}
            onClick={() => applyMode(null)}
          />
          {aplicables.map((o) => {
            const n = Object.keys(o.args).length;
            return (
              <DropdownOption
                key={o.id}
                label={o.nombre}
                hint={`${n} arg${n === 1 ? "" : "s"}`}
                active={exactMatch?.id === o.id}
                onClick={() => applyMode({ ...o.args })}
              />
            );
          })}

          <div style={{ height: 1, background: "var(--pulso-border)", margin: "6px 0 4px" }} />

          {customCount > 0 && (
            <button
              type="button"
              role="menuitem"
              onClick={createMode}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 9px", borderRadius: 5,
                border: "1px solid var(--pulso-primary)",
                background: "var(--pulso-primary-soft)",
                color: "var(--pulso-primary)",
                fontSize: 12, fontWeight: 600,
                textAlign: "left", cursor: "pointer", width: "100%",
              }}
            >
              <Save size={12} />
              <span style={{ flex: 1 }}>Crear modo "{partialMatch?.nombre ?? "personalizado"}"</span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>{customCount} cambio{customCount === 1 ? "" : "s"}</span>
            </button>
          )}

          {customCount > 0 && (
            <button
              type="button"
              role="menuitem"
              onClick={() => applyMode(null)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 9px", borderRadius: 5,
                border: "1px solid transparent",
                background: "transparent",
                color: "var(--pulso-text-soft)",
                fontSize: 11, fontWeight: 500,
                textAlign: "left", cursor: "pointer", width: "100%",
                marginTop: 2,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--pulso-surface)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <RotateCcw size={11} />
              Descartar todos los cambios y volver al preset
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Verifica que cada key de `subset` esté en `superset` con el mismo valor.
// `superset` puede tener keys adicionales (esos son edits encima del modo).
function isSubset(subset: Record<string, unknown>, superset: Record<string, unknown>): boolean {
  const keys = Object.keys(subset);
  if (keys.length === 0) return false; // un override vacío no es match
  for (const k of keys) {
    if (!(k in superset)) return false;
    if (subset[k] !== superset[k]) return false;
  }
  return true;
}

function DropdownOption({
  label, hint, active, onClick,
}: {
  label: string;
  hint?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 9px", borderRadius: 5,
        border: "1px solid transparent",
        background: active ? "var(--pulso-primary-soft)" : "transparent",
        color: active ? "var(--pulso-primary)" : "var(--pulso-text)",
        fontSize: 12, fontWeight: active ? 600 : 500,
        textAlign: "left", cursor: "pointer", width: "100%",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--pulso-surface)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {hint && (
        <span style={{ fontSize: 10, color: active ? "var(--pulso-primary)" : "var(--pulso-text-soft)" }}>
          {hint}
        </span>
      )}
      {active && <Check size={12} />}
    </button>
  );
}

function shallowEqualArgs(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}
