import { useState } from "react";
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
        marginBottom: "0.75rem", padding: "0.75rem", border: "1px dashed #d1d5db", borderRadius: 6,
        background: "#fafafa", fontSize: 13,
      }}>
        <div style={{ color: "#6b7280", marginBottom: 6 }}>
          <strong>Slot: {slotName}</strong> · sin graficador
        </div>
        <button onClick={() => setPickerOpen(true)} style={{ fontSize: 13 }}>+ Agregar graficador</button>
        {pickerOpen && <GraficadorPicker onPick={onPick} onCancel={() => setPickerOpen(false)} />}
      </div>
    );
  }

  return (
    <div style={{
      marginBottom: "0.75rem", padding: "0.75rem", border: "1px solid #cbd5e1", borderRadius: 6,
      background: "#f8fafc",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <div>
          <strong style={{ fontSize: 13 }}>Slot: {slotName}</strong>{" "}
          <code style={{ fontSize: 12, background: "#e2e8f0", padding: "1px 6px", borderRadius: 3 }}>{value.graficador}</code>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setPickerOpen(true)} style={{ fontSize: 11 }}>Cambiar</button>
          <button onClick={() => setSlot(slideId, slotName, null)} style={{ fontSize: 11, color: "#c00" }}>Quitar</button>
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
