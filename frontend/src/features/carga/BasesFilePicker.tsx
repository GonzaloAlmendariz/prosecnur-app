// Selector de archivo de las bases de Carga: compartido por el panel de bases y el asistente de fuentes
// independientes (sale de BasesPanel.tsx en L6).

import { useState } from "react";
import { Check, Upload } from "lucide-react";
import type { IconCmp } from "./surveymonkey/smBasesModel";

export function FilePicker({
  icon: Icon, title, accept, acceptLabel, file, onPick,
}: {
  icon: IconCmp;
  title: string;
  accept: string;
  acceptLabel: string;
  file: File | null;
  onPick: (f: File | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <label
      className={`pulso-base-file-picker${file ? " is-ready" : ""}${dragOver ? " is-dragging" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onPick(f);
      }}
    >
      {file ? (
        <Check size={18} />
      ) : (
        <Upload size={18} />
      )}
      <span className="pulso-base-file-picker-title">
        <Icon size={13} />
        {file ? file.name : title}
      </span>
      <span className="pulso-base-file-picker-accept">{acceptLabel}</span>
      <input
        type="file"
        accept={accept}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        style={{ display: "none" }}
      />
    </label>
  );
}
