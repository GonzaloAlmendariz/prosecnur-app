// Paso 1 de "Actualizar": la zona donde se suelta o se elige el archivo con la
// versión nueva de las respuestas. El input es real y enfocable (teclado).

import { useId, useState } from "react";
import { Upload } from "../../../vendor/lucide-react";

export function ElegirArchivo({ disabled, onElegir }: { disabled: boolean; onElegir: (archivo: File) => void }) {
  const id = useId();
  const [encima, setEncima] = useState(false);
  return (
    <label
      htmlFor={id}
      className="pulso-actualizar-zona"
      data-encima={encima ? "" : undefined}
      aria-disabled={disabled || undefined}
      data-qa-geometry-capacity="owned"
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setEncima(true); }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        const archivo = e.dataTransfer.files?.[0];
        if (archivo && !disabled) onElegir(archivo);
      }}
    >
      <Upload size={22} aria-hidden="true" />
      <strong>Archivo con la versión nueva</strong>
      <span>Arrastra el archivo aquí o haz clic para elegirlo. Excel, CSV o SAV.</span>
      <input
        id={id}
        type="file"
        accept=".xlsx,.xls,.csv,.sav"
        className="pulso-sr-only"
        disabled={disabled}
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = "";
          if (archivo) onElegir(archivo);
        }}
      />
    </label>
  );
}
