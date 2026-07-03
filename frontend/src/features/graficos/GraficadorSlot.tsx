import { useMemo, useRef, useEffect, useState } from "react";
import { Plus, Shuffle, X, Wand2, Check, ImagePlus, Save, RotateCcw } from "lucide-react";
import { GraficadorMetadata, GraficadorRef } from "../../api/client";
import { usePlanStore } from "./store";
import { useGraficosRegistry } from "./useGraficosRegistry";
import GraficadorPicker from "./GraficadorPicker";
import GraficadorForm from "./GraficadorForm";
import MultiApiladasBuilder from "./MultiApiladasBuilder";
import { graficadorToPresetType } from "./graficadorPresetMap";
import { GraphSquareIcon, resolveGraphLucideIcon } from "./lucideRegistry";

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
export const SLOT_LABELS: Record<string, string> = {
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

export function getSlotLabel(slotName: string): string {
  return SLOT_LABELS[slotName] ?? slotName;
}

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
      <div className="pulso-gv2-slot-empty-note">
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
      <div className="pulso-gv2-slot-empty-card">
        <span className="pulso-gv2-slot-empty-icon" aria-hidden="true">
          <ImagePlus size={16} />
        </span>
        <div className="pulso-gv2-slot-empty-copy">
          <div className="pulso-gv2-slot-empty-title-row">
            <SlotLabel text={slotLabel} slotName={slotName} />
            <span className="pulso-gv2-slot-empty-title">
              Añade un gráfico a este slot
            </span>
          </div>
          <span className="pulso-gv2-slot-empty-hint">
            Elige un tipo del catálogo (barras, pie, radar, etc.) y configura sus args.
          </span>
        </div>
        <button
          type="button"
          className="pulso-primary pulso-gv2-pill-button"
          onClick={() => setPickerOpen(true)}
        >
          <Plus size={13} /> Elegir graficador
        </button>
        {pickerOpen && <GraficadorPicker onPick={onPick} onCancel={() => setPickerOpen(false)} />}
      </div>
    );
  }

  // --- Slot con graficador ---
  const meta = graficadoresById[value.graficador];
  const Icon = meta ? resolveGraphLucideIcon(meta.icono_ui, "BarChart") : GraphSquareIcon;
  const titulo = meta?.titulo_humano ?? value.graficador;

  return (
    <div className="pulso-gv2-slot-card">
      {/* Header */}
      <div className="pulso-gv2-slot-head">
        <SlotLabel text={slotLabel} slotName={slotName} />

        <span className="pulso-gv2-slot-title-cluster">
          <span className="pulso-gv2-slot-icon">
            <Icon size={14} />
          </span>
          <span className="pulso-gv2-slot-title-copy">
            <span className="pulso-gv2-slot-title">
              {titulo}
            </span>
            <code className="pulso-gv2-slot-code">
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
            className="pulso-gv2-pill-button pulso-gv2-slot-action"
            aria-label="Cambiar por otro tipo de gráfico"
          >
            <Shuffle size={11} /> Cambiar
          </button>
        )}
        {mode === "data" && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSlot(slideId, slotName, null);
            }}
            className="pulso-icon pulso-icon-danger pulso-gv2-slot-remove"
            aria-label="Quitar graficador"
            title="Quitar graficador"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Body: args agrupados, filtrados por modo */}
      <div className="pulso-gv2-slot-body">
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
      className="pulso-gv2-slot-label"
      aria-label={`Slot técnico: ${slotName}`}
    >
      {text}
    </span>
  );
}

// Dropdown de "Modo" (concepto = override reusable). El usuario lo
// llama así: "modo compacto", "modo narrativo". Es un set de args que
// sobreescribe al preset global para este slot.
//
// Estados visuales:
//   - "Modo: por defecto"  → sin overrides (estilo base)
//   - "Modo: 'compacto'"   → un override reusable aplicado exacto
//   - "Modo + ajustes propios" → override aplicado + ajustes adicionales
//   - "Manual"             → ajustes propios, sin override base
//
// Acciones:
//   - Selección de modo predefinido (con confirmación si hay edits).
//   - "Crear modo nuevo" → guarda los args custom actuales como un
//     OverrideReusable nombrado.
//   - "Descartar cambios manuales" → vuelve al estilo base.
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

  // Estado actual: ¿está aplicado un modo exacto, modo+ajustes propios, o manual puro?
  const currentOverrideArgs = (value.args?.overrides as Record<string, unknown>) ?? {};
  const customCount = Object.keys(currentOverrideArgs).length;

  // Buscamos un modo cuyos args sean SUBSET de los actuales. Si los
  // matches son exactos → modo exacto. Si los args actuales tienen MÁS
  // keys que el modo → modo + edits.
  const exactMatch = aplicables.find((o) => shallowEqualArgs(o.args, currentOverrideArgs));
  const partialMatch = exactMatch
    ? null
    : aplicables.find((o) => isSubset(o.args, currentOverrideArgs));
  const isPureCustom = customCount > 0 && !exactMatch && !partialMatch;

  // Label del trigger
  let triggerLabel = "Modo: por defecto";
  if (exactMatch) triggerLabel = `Modo: ${exactMatch.nombre}`;
  else if (partialMatch) triggerLabel = `${partialMatch.nombre} + ajustes propios`;
  else if (isPureCustom) triggerLabel = "Manual";

  const isActive = exactMatch || partialMatch || isPureCustom;
  const modeStateClass = exactMatch
    ? "is-mode"
    : partialMatch
      ? "is-mixed"
      : isPureCustom
        ? "is-manual"
        : "is-default";

  function applyMode(args: Record<string, unknown> | null) {
    // Si hay edits custom y vamos a reemplazar, pedir confirmación.
    const willOverwriteCustom =
      customCount > 0 &&
      !shallowEqualArgs(currentOverrideArgs, args ?? {});
    if (willOverwriteCustom) {
      const ok = window.confirm(
        `Hay cambios manuales sin guardar en este gráfico. ` +
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
      window.alert("No hay cambios manuales para guardar como modo. Edita algún arg primero.");
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
    <div ref={rootRef} className="pulso-gv2-mode-menu">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={
          isPureCustom
            ? "Hay ajustes manuales sobre el estilo base"
            : "Cambiar modo de estilo"
        }
        className={`pulso-gv2-mode-trigger ${isActive ? "is-active" : ""} ${modeStateClass}`}
      >
        <Wand2 size={11} />
        {triggerLabel}
      </button>
      {open && (
        <div
          role="menu"
          className="pulso-gv2-mode-popover"
        >
          <div className="pulso-gv2-mode-popover-label">Modos disponibles</div>

          <DropdownOption
            label="Por defecto"
            hint="Solo el estilo base"
            active={customCount === 0}
            onClick={() => applyMode(null)}
          />
          {aplicables.map((o) => {
            return (
              <DropdownOption
                key={o.id}
                label={o.nombre}
                hint=""
                active={exactMatch?.id === o.id}
                onClick={() => applyMode({ ...o.args })}
              />
            );
          })}

          <div className="pulso-gv2-mode-popover-divider" />

          {customCount > 0 && (
            <button
              type="button"
              role="menuitem"
              onClick={createMode}
              className="pulso-gv2-mode-option pulso-gv2-mode-option--create"
            >
              <Save size={12} />
              <span className="pulso-gv2-mode-option-label">
                Crear modo "{partialMatch?.nombre ?? "personalizado"}"
              </span>
            </button>
          )}

          {customCount > 0 && (
            <button
              type="button"
              role="menuitem"
              onClick={() => applyMode(null)}
              className="pulso-gv2-mode-option pulso-gv2-mode-option--muted"
            >
            <RotateCcw size={11} />
              Descartar cambios manuales y volver al estilo base
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
      className={`pulso-gv2-mode-option ${active ? "is-active" : ""}`}
    >
      <span className="pulso-gv2-mode-option-label">
        {label}
      </span>
      {hint && (
        <span className="pulso-gv2-mode-option-hint">
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
