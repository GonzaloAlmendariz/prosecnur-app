import { type CSSProperties, useMemo, useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Shuffle, X, Check, ImagePlus, Save, RotateCcw } from "lucide-react";
import { GraficadorRef } from "../../api/client";
import { IconModes } from "../../lib/icons";
import { usePlanStore } from "./store";
import { useGraficosRegistry } from "./useGraficosRegistry";
import GraficadorForm from "./GraficadorForm";
import MultiApiladasBuilder from "./MultiApiladasBuilder";
import { graficadorToPresetType } from "./graficadorPresetMap";
import { graficadorDisplayName, graficadorKindLabel } from "./graficadorDisplay";
import { GraphSquareIcon, resolveGraphLucideIcon } from "./lucideRegistry";
import { useGraficosLibraries } from "./GraficosLibrariesHost";

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
  /** Acción contextual para resolver un modelo pendiente desde tabs no-data. */
  onRequestDataTab?: () => void;
};

// `valores`, `tabla` y `semaforo` viven en «Estilo» y no en «Filtros».
//
// El tab de Filtros es un editor de REGLAS —condiciones sobre variables— y no
// monta el slot del graficador, asi que esos tres grupos no tenian donde salir:
// el registro los servia y la UI no los mostraba. `titulo_tabla` y
// `umbral_rojo_pct` de `p_tabla` llevaban asi desde que existen.
//
// Y ahi es donde se buscan: decidir si el porcentaje se escribe sobre la barra o
// con cuantos decimales es una decision de lectura, no un filtro. `filtro` se
// queda en su tab, que es el unico grupo que el editor de reglas si gobierna.
export const MODE_GROUPS: Record<GraficadorSlotMode, ArgGrupo[]> = {
  data:    ["datos"],
  style:   ["lectura", "leyenda", "espacio", "textos", "estilo", "canvas",
            "valores", "tabla", "semaforo"],
  filters: ["filtro"],
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

export default function GraficadorSlot({ slideId, slotName, value, mode = "data", onRequestDataTab }: Props) {
  const setSlot = usePlanStore((s) => s.setSlot);
  const updateArgs = usePlanStore((s) => s.updateSlotArgs);
  const { graficadoresById } = useGraficosRegistry();
  const { openGraficadoresLibrary } = useGraficosLibraries();
  const pickerTriggerRef = useRef<HTMLButtonElement>(null);
  const allowedGroups = MODE_GROUPS[mode];
  // El OverrideDropdown (wand) sólo vive en modo style — el override define
  // estilo, no datos ni filtros, así que duplicarlo en otros tabs sería
  // inconsistente.
  const showOverride = mode === "style";

  const slotLabel = SLOT_LABELS[slotName] ?? slotName;
  const openPicker = () => openGraficadoresLibrary({
    slideId,
    slotName,
    slotLabel,
    returnFocusRef: pickerTriggerRef,
  });
  const replaceGraficadorAction = mode === "data" ? openPicker : onRequestDataTab;
  const replaceGraficadorLabel = mode === "data" ? "Reemplazar modelo" : "Ir a Datos";

  // En modos style/filters NO mostramos el "slot vacío" porque la
  // selección de graficador es responsabilidad de Datos. Mostrar un
  // placeholder aquí tentaría al usuario a elegir gráficos desde Estilo
  // (rompiendo el flujo). En su lugar, pintamos un mensaje sutil.
  if ((!value || !value.graficador) && mode !== "data") {
    return (
      <div className="pulso-gv2-slot-empty-note">
        <SlotLabel text={slotLabel} slotName={slotName} />
        <span>Este espacio todavía no tiene gráfico. Elígelo en <strong>Datos</strong> primero.</span>
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
              Añade un gráfico a este espacio
            </span>
          </div>
          <span className="pulso-gv2-slot-empty-hint">
            Elige barras, circular, radar u otro tipo y ajusta sus datos.
          </span>
        </div>
        <button
          ref={pickerTriggerRef}
          type="button"
          className="pulso-primary pulso-gv2-pill-button"
          onClick={openPicker}
        >
          <Plus size={13} /> Elegir gráfico
        </button>
      </div>
    );
  }

  // --- Slot con graficador ---
  const meta = graficadoresById[value.graficador];
  const Icon = meta ? resolveGraphLucideIcon(meta.icono_ui, "BarChart") : GraphSquareIcon;
  const titulo = graficadorDisplayName(value.graficador, meta);
  const tipoVisible = graficadorKindLabel(value.graficador, meta);

  return (
    <div className="pulso-gv2-slot-card" data-graficador={value.graficador}>
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
            <span
              className="pulso-gv2-slot-code"
              aria-label={`Tipo de gráfico: ${tipoVisible}`}
            >
              {tipoVisible}
            </span>
          </span>
        </span>

        {showOverride && (
          <OverrideDropdown
            slideId={slideId}
            slotName={slotName}
            value={value}
            presetKey={meta?.preset_key}
          />
        )}
        {mode === "data" && (
          <button
            ref={pickerTriggerRef}
            type="button"
            onClick={openPicker}
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
            aria-label="Quitar gráfico"
            title="Quitar gráfico"
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
            slotLabel={slotLabel}
            onReplaceGraficador={replaceGraficadorAction}
            replaceGraficadorLabel={replaceGraficadorAction ? replaceGraficadorLabel : undefined}
          />
        )}
      </div>
    </div>
  );
}

function SlotLabel({ text, slotName }: { text: string; slotName: string }) {
  return (
    <span
      className="pulso-gv2-slot-label"
      data-slot-name={slotName}
      aria-label={`Ubicación del gráfico: ${text}`}
    >
      {text}
    </span>
  );
}

// Dropdown de estilo por gráfico. La UI evita términos internos como
// override/preset y expresa la herencia en tres capas: valor por defecto,
// estilo guardado y ajustes adicionales del gráfico.
//
// Estados visuales:
//   - "Valor por defecto"  → sin overrides (estilo base)
//   - "Estilo guardado"     → una variante reusable aplicada exacta
//   - "Estilo + ajustes"    → variante aplicada + ajustes adicionales
//   - "Ajustes adicionales" → ajustes propios, sin variante base
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
  presetKey,
}: {
  slideId: string;
  slotName: string;
  value: GraficadorRef;
  presetKey?: string;
}) {
  const allOverrides = usePlanStore((s) => s.overridesReusables);
  const addOverride = usePlanStore((s) => s.addOverrideReusable);
  const updateArgs = usePlanStore((s) => s.updateSlotArgs);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"up" | "down">("down");
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const presetType = graficadorToPresetType(value.graficador, presetKey);
  const aplicables = useMemo(
    () => (presetType ? allOverrides.filter((o) => o.tipo_preset === presetType) : []),
    [allOverrides, presetType]
  );

  // Click-outside + Escape cierran el popover.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
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

  useEffect(() => {
    if (!open) return;
    function onReposition() {
      updatePopoverPosition();
    }
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
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

  const modeState = exactMatch
    ? "mode"
    : partialMatch
      ? "mixed"
      : isPureCustom
        ? "manual"
        : "base";

  const isActive = modeState !== "base";
  const triggerLabel =
    modeState === "mode"
      ? "Estilo guardado"
      : modeState === "mixed"
        ? "Estilo + ajustes"
        : modeState === "manual"
          ? "Ajustes adicionales"
          : "Valor por defecto";
  const triggerHint =
    exactMatch?.nombre ??
    partialMatch?.nombre ??
    (isPureCustom ? `${customCount} ajuste${customCount === 1 ? "" : "s"}` : "sin cambios");
  const graphLabel = graficadorDisplayName(value.graficador);
  const currentDetail =
    modeState === "base"
      ? "Usa el valor por defecto del gráfico. No marca cambios."
      : modeState === "mode"
        ? "Aplica un estilo guardado sin ajustes adicionales."
        : modeState === "mixed"
          ? "Parte de un estilo guardado y suma ajustes adicionales."
          : "Solo este gráfico tiene ajustes adicionales.";
  const lineageModeLabel = exactMatch?.nombre ?? partialMatch?.nombre ?? "Sin estilo guardado";
  const lineageSlotLabel = customCount > 0
    ? `${customCount} ajuste${customCount === 1 ? "" : "s"} adicional${customCount === 1 ? "" : "es"}`
    : "Sin ajustes adicionales";
  const modeRail = [
    { key: "base", label: "Valor por defecto", active: true },
    { key: "mode", label: "Estilo guardado", active: Boolean(exactMatch || partialMatch) },
    { key: "manual", label: "Ajustes adicionales", active: customCount > 0 },
  ];

  function applyMode(args: Record<string, unknown> | null) {
    // Si hay edits custom y vamos a reemplazar, pedir confirmación.
    const willOverwriteCustom =
      customCount > 0 &&
      !shallowEqualArgs(currentOverrideArgs, args ?? {});
    if (willOverwriteCustom) {
      const ok = window.confirm(
        `Hay ajustes adicionales en este gráfico. ` +
        `Aplicar otro estilo guardado los reemplazará. ¿Continuar?\n\n` +
        `Consejo: cancela y guárdalos como estilo si quieres reutilizarlos.`
      );
      if (!ok) { setOpen(false); return; }
    }
    updateArgs(slideId, slotName, { overrides: args ?? {} });
    setOpen(false);
  }

  function createMode() {
    if (customCount === 0) {
      window.alert("No hay ajustes adicionales para guardar como estilo. Cambia algún control primero.");
      return;
    }
    const nombre = window.prompt(
      "Nombre del estilo guardado (ej. 'compacto', 'narrativo', 'minimal'):",
      "estilo personalizado"
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

  function updatePopoverPosition() {
    if (rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      const roomBelow = window.innerHeight - rect.bottom;
      const roomAbove = rect.top;
      const nextPlacement = roomBelow < 340 && roomAbove > roomBelow ? "up" : "down";
      const popoverWidth = 380;
      const gutter = 12;
      const left = Math.min(
        Math.max(gutter, rect.right - popoverWidth),
        Math.max(gutter, window.innerWidth - popoverWidth - gutter),
      );
      setPlacement(nextPlacement);
      setPopoverStyle(
        nextPlacement === "up"
          ? {
              position: "fixed",
              left,
              right: "auto",
              top: "auto",
              bottom: window.innerHeight - rect.top + 6,
              width: popoverWidth,
            }
          : {
              position: "fixed",
              left,
              right: "auto",
              top: rect.bottom + 6,
              bottom: "auto",
              width: popoverWidth,
            }
      );
    }
  }

  function toggleOpen() {
    if (!open) {
      updatePopoverPosition();
    }
    setOpen((o) => !o);
  }

  return (
    <div ref={rootRef} className="pulso-gv2-mode-menu">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${triggerLabel}: ${triggerHint}`}
        className={`pulso-gv2-mode-trigger ${isActive ? "is-active" : ""} is-${modeState}`}
        data-state={modeState}
      >
        <IconModes size={11} />
        <span className="pulso-gv2-mode-trigger-copy">
          <span>{triggerLabel}</span>
          <small>{triggerHint}</small>
        </span>
        <span className="pulso-gv2-mode-trigger-rail" aria-hidden="true">
          {modeRail.map((item) => (
            <i
              key={item.key}
              className={`is-${item.key}${item.active ? " is-on" : ""}`}
              title={item.label}
            />
          ))}
        </span>
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          role="menu"
          className="pulso-gv2-mode-popover"
          data-placement={placement}
          style={popoverStyle}
        >
          <div className="pulso-gv2-mode-current" data-state={modeState}>
            <span>Estilo actual</span>
            <strong>{triggerLabel}</strong>
            <small>{triggerHint}</small>
            <p className="pulso-gv2-mode-current-detail">{currentDetail}</p>
            <div className="pulso-gv2-mode-lineage" aria-label="Ruta visual aplicada">
              <span className="is-base"><Check size={11} /> Valor por defecto</span>
              <span className={exactMatch || partialMatch ? "is-mode" : "is-muted"}>
                {lineageModeLabel}
              </span>
              <span className={customCount > 0 ? "is-manual" : "is-muted"}>
                {lineageSlotLabel}
              </span>
            </div>
          </div>

          <div className="pulso-gv2-mode-popover-label">
            Estilos guardados para {graphLabel} · {aplicables.length}
          </div>

          <DropdownOption
            kind="base"
            label="Mantener valor por defecto"
            hint="No marca cambios"
            description="Apariencia base para este tipo de gráfico."
            active={customCount === 0}
            onClick={() => applyMode(null)}
          />
          {aplicables.map((o) => {
            return (
              <DropdownOption
                key={o.id}
                kind="mode"
                label={o.nombre}
                hint={`${Object.keys(o.args).length} ajuste${Object.keys(o.args).length === 1 ? "" : "s"}`}
                description="Reutiliza este estilo en el gráfico seleccionado."
                active={exactMatch?.id === o.id}
                onClick={() => applyMode({ ...o.args })}
              />
            );
          })}
          {aplicables.length === 0 && (
            <div className="pulso-gv2-mode-empty">
              Aún no hay estilos guardados para {graphLabel}. Ajusta un control y guárdalo como estilo cuando quieras reutilizarlo.
            </div>
          )}

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
                Guardar estilo reutilizable
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
              Volver al valor por defecto
            </button>
          )}
        </div>,
        document.body,
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
  label, hint, description, active, onClick, kind = "mode",
}: {
  label: string;
  hint?: string;
  description?: string;
  active: boolean;
  onClick: () => void;
  kind?: "base" | "mode";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`pulso-gv2-mode-option ${active ? "is-active" : ""}`}
      data-kind={kind}
    >
      <span className="pulso-gv2-mode-option-mark" aria-hidden="true" />
      <span className="pulso-gv2-mode-option-copy">
        <span className="pulso-gv2-mode-option-label">
          {label}
        </span>
        {description && (
          <span className="pulso-gv2-mode-option-description">
            {description}
          </span>
        )}
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
