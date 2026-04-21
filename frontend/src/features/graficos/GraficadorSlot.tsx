import { useState } from "react";
import * as Lucide from "lucide-react";
import { Plus, Replace, X } from "lucide-react";
import { GraficadorMetadata, GraficadorRef } from "../../api/client";
import { usePlanStore } from "./store";
import { useGraficosRegistry } from "./useGraficosRegistry";
import GraficadorPicker from "./GraficadorPicker";
import GraficadorForm from "./GraficadorForm";

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
