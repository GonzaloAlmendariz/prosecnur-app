// Con varias bases, cada una lleva su propia palabra después del número («Base: 172 estudiantes», «Base: 40 docentes»).
// Sin palabra propia, la base muestra su nombre. Cada campo se confirma al salir o con Enter.

import { useId, useState } from "react";
import { ejemploTextoBase, N_EJEMPLO } from "./modeloEstiloInforme";

/** Lo que escribe el motor sin palabra propia: el nombre de la base sin guiones bajos (`.base_sufijo_de_fuente`). */
export function palabraPorDefecto(base: string): string {
  return base.trim().replace(/_+/g, " ");
}

function FilaBase({ base, palabra, formato, onCambiar }: { base: string; palabra: string; formato: string; onCambiar: (palabra: string) => void }) {
  const id = useId();
  const [borrador, setBorrador] = useState(palabra);
  const confirmar = () => {
    if (borrador.trim() !== palabra) onCambiar(borrador);
  };
  return (
    <li className="pulso-f6-sufijo-base" data-qa-geometry-member>
      <label htmlFor={id} className="pulso-f6-sufijo-base-nombre">{base}</label>
      <input
        id={id}
        className="pulso-f6-informe-input"
        type="text"
        value={borrador}
        placeholder={palabraPorDefecto(base)}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirmar();
          if (e.key === "Escape") setBorrador(palabra);
        }}
      />
      <output className="pulso-f6-sufijo-base-ejemplo">{ejemploTextoBase(formato, borrador.trim() || palabraPorDefecto(base), N_EJEMPLO)}</output>
    </li>
  );
}

export function SufijosPorBase({
  bases,
  sufijos,
  formato,
  onCambiar,
}: {
  bases: readonly string[];
  sufijos: Record<string, string>;
  formato: string;
  onCambiar: (base: string, palabra: string) => void;
}) {
  return (
    <div className="pulso-f6-informe-campo" data-qa-geometry-member>
      <div className="pulso-f6-informe-campo-cabecera">
        <span className="pulso-f6-informe-campo-etiqueta">Después del número, en cada base</span>
      </div>
      {/* C1 (QA del Informe, 2026-10-15): una fila por base, de alto propio. */}
      <ul className="pulso-f6-sufijos-base" data-qa-geometry-group="graficos/f6-sufijos-base" data-qa-geometry-contract="intrinsic">
        {bases.map((b) => (
          <FilaBase key={`${b}:${sufijos[b] ?? ""}`} base={b} palabra={sufijos[b] ?? ""} formato={formato} onCambiar={(p) => onCambiar(b, p)} />
        ))}
      </ul>
      <p className="pulso-f6-informe-ayuda">Vacío, va el nombre de la base sin guiones bajos.</p>
    </div>
  );
}
