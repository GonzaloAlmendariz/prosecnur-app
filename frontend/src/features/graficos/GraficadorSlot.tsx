import { useState } from "react";
import { Plus, Replace, X } from "lucide-react";
import { GraficadorRef } from "../../api/client";
import { usePlanStore } from "./store";
import GraficadorPicker, { GraficadorMeta } from "./GraficadorPicker";
import GraficadorForm from "./GraficadorForm";

type Props = {
  slideId: string;
  slotName: string;
  value: GraficadorRef | null | undefined;
};

export default function GraficadorSlot({ slideId, slotName, value }: Props) {
  const setSlot = usePlanStore((s) => s.setSlot);
  const updateArgs = usePlanStore((s) => s.updateSlotArgs);
  const [pickerOpen, setPickerOpen] = useState(false);

  function onPick(meta: GraficadorMeta) {
    setSlot(slideId, slotName, { graficador: meta.name, args: { ...meta.defaultArgs } });
    setPickerOpen(false);
  }

  if (!value || !value.graficador) {
    return (
      <div style={{
        marginBottom: 10, padding: 10, border: "1px dashed var(--pulso-border)", borderRadius: 6,
        background: "var(--pulso-surface-2)", fontSize: 13,
      }}>
        <div style={{ color: "var(--pulso-text-soft)", marginBottom: 6 }}>
          <strong>Slot: {slotName}</strong> · sin graficador
        </div>
        <button className="pulso-ghost" onClick={() => setPickerOpen(true)}
          style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={13} /> Agregar graficador
        </button>
        {pickerOpen && <GraficadorPicker onPick={onPick} onCancel={() => setPickerOpen(false)} />}
      </div>
    );
  }

  return (
    <div style={{
      marginBottom: 10, padding: 10, border: "1px solid var(--pulso-primary-border)", borderRadius: 6,
      background: "rgba(0,36,87,0.03)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <strong style={{ fontSize: 13, color: "var(--pulso-primary)" }}>Slot: {slotName}</strong>{" "}
          <code style={{ fontSize: 11, background: "#fff", border: "1px solid var(--pulso-primary-border)", padding: "2px 6px", borderRadius: 3, color: "var(--pulso-primary)" }}>{value.graficador}</code>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setPickerOpen(true)}
            style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Replace size={12} /> Cambiar
          </button>
          <button onClick={() => setSlot(slideId, slotName, null)}
            className="pulso-icon pulso-icon-danger" title="Quitar graficador">
            <X size={13} />
          </button>
        </div>
      </div>
      <GraficadorForm graf={value} onArgs={(patch) => updateArgs(slideId, slotName, patch)} />
      {pickerOpen && (
        <GraficadorPicker
          onPick={(meta) => { setSlot(slideId, slotName, { graficador: meta.name, args: { ...meta.defaultArgs } }); setPickerOpen(false); }}
          onCancel={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
