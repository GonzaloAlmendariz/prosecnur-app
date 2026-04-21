import { useMemo, useState } from "react";
import * as Lucide from "lucide-react";
import { Plus, Replace, X, Wand2, Check } from "lucide-react";
import { GraficadorMetadata, GraficadorRef } from "../../api/client";
import { usePlanStore } from "./store";
import { useGraficosRegistry } from "./useGraficosRegistry";
import GraficadorPicker from "./GraficadorPicker";
import GraficadorForm from "./GraficadorForm";
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

type Props = {
  slideId: string;
  slotName: string;
  value: GraficadorRef | null | undefined;
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

export default function GraficadorSlot({ slideId, slotName, value }: Props) {
  const setSlot = usePlanStore((s) => s.setSlot);
  const updateArgs = usePlanStore((s) => s.updateSlotArgs);
  const { graficadoresById } = useGraficosRegistry();
  const [pickerOpen, setPickerOpen] = useState(false);

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

  // --- Slot vacío ---
  if (!value || !value.graficador) {
    return (
      <div
        style={{
          marginBottom: 12, padding: "18px 14px",
          border: "1px dashed var(--pulso-border)",
          borderRadius: 8,
          background: "var(--pulso-surface)",
          display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
        }}
      >
        <SlotLabel text={slotLabel} slotName={slotName} />
        <button
          type="button"
          className="pulso-primary"
          onClick={() => setPickerOpen(true)}
          style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
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

        <OverrideDropdown
          slideId={slideId}
          slotName={slotName}
          value={value}
        />
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 9px" }}
          title="Cambiar graficador"
        >
          <Replace size={11} /> Cambiar
        </button>
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
      </div>

      {/* Body: args agrupados */}
      <div style={{ padding: 12 }}>
        <GraficadorForm graf={value} onArgs={(patch) => updateArgs(slideId, slotName, patch)} />
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

// Dropdown para aplicar un override reutilizable al slot. Solo muestra
// overrides compatibles con el tipo del graficador actual (mapeo en
// graficadorPresetMap.ts). Al aplicar, copia los args del override al
// campo `overrides` del GraficadorRef, pisando al preset global.
//
// Visualmente:
//   - Si no hay overrides aplicables: no renderiza el botón.
//   - Si hay: botón "Estilo" que abre un popover con la lista.
//   - El override actualmente aplicado aparece con check.
//   - Opción "Sin override" para quitar.
//
// Nota: este dropdown NO cambia el `value.args` completo, solo escribe
// a `value.args.overrides`. Así los datos (var, cruces, etc.) se
// mantienen intactos cuando el analista cambia de estilo.
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
  const updateArgs = usePlanStore((s) => s.updateSlotArgs);
  const [open, setOpen] = useState(false);

  const presetType = graficadorToPresetType(value.graficador);
  const aplicables = useMemo(
    () => (presetType ? allOverrides.filter((o) => o.tipo_preset === presetType) : []),
    [allOverrides, presetType]
  );

  if (!presetType || aplicables.length === 0) return null;

  // El override actualmente aplicado es el que coincide exacto con
  // value.args.overrides. Comparación por deep-equal simplificada:
  // si los args son iguales (mismo set de keys y valores), consideramos
  // que ese override está activo. Si el usuario editó los args después
  // de aplicar, ninguno coincide y el dropdown muestra "Custom".
  const currentOverrideArgs = (value.args?.overrides as Record<string, unknown>) ?? null;
  const activeOverride = currentOverrideArgs
    ? aplicables.find((o) => shallowEqualArgs(o.args, currentOverrideArgs))
    : null;
  const hasCustomOverride =
    currentOverrideArgs &&
    Object.keys(currentOverrideArgs).length > 0 &&
    !activeOverride;

  function applyOverride(args: Record<string, unknown> | null) {
    updateArgs(slideId, slotName, { overrides: args ?? {} });
    setOpen(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Aplicar un override reutilizable"
        style={{
          fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4,
          padding: "4px 9px",
          border: `1px solid ${activeOverride || hasCustomOverride ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
          background: activeOverride || hasCustomOverride ? "var(--pulso-primary-soft)" : "white",
          color: activeOverride || hasCustomOverride ? "var(--pulso-primary)" : "var(--pulso-text)",
          borderRadius: 5, cursor: "pointer",
        }}
      >
        <Wand2 size={11} />
        {activeOverride
          ? activeOverride.nombre
          : hasCustomOverride
            ? "Custom"
            : "Estilo"}
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 20 }}
          />
          <div
            style={{
              position: "absolute", top: "calc(100% + 4px)", right: 0,
              zIndex: 21,
              minWidth: 200,
              background: "white",
              border: "1px solid var(--pulso-border)",
              borderRadius: 7,
              boxShadow: "var(--pulso-shadow-med)",
              padding: 4,
              display: "flex", flexDirection: "column", gap: 1,
            }}
          >
            <DropdownOption
              label="Sin override"
              hint="Usa solo los defaults del preset global."
              active={!activeOverride && !hasCustomOverride}
              onClick={() => applyOverride(null)}
            />
            <div style={{ height: 1, background: "var(--pulso-border)", margin: "3px 0" }} />
            {aplicables.map((o) => (
              <DropdownOption
                key={o.id}
                label={o.nombre}
                hint={`${Object.keys(o.args).length} args custom`}
                active={activeOverride?.id === o.id}
                onClick={() => applyOverride({ ...o.args })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
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
