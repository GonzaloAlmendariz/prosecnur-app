// «Papel por pregunta» de la pestaña «Impreso»: cuántas filas traen ajustes `paper_*` y un enlace a cada una en el
// Constructor (`?pestana=constructor&foco=<name>`), donde se editan en «Datos › Ajustes de papel».

import { ArrowRight } from "../../../vendor/lucide-react";
import type { FilaConPapel } from "./modeloImpreso";
import { TarjetaImpreso } from "./TarjetaImpreso";

function etiquetaCorta(fila: FilaConPapel): string {
  const texto = fila.label.replace(/[*_`#>~]/g, "").replace(/\s+/g, " ").trim() || fila.name;
  return texto.length > 90 ? `${texto.slice(0, 89)}…` : texto;
}

export function DetallePapel({ filas, onIrAPregunta }: {
  filas: readonly FilaConPapel[];
  onIrAPregunta: (name: string) => void;
}) {
  if (filas.length === 0) {
    return (
      <TarjetaImpreso
        id="imp-papel"
        titulo="Papel por pregunta"
        ayuda="Ninguna fila trae ajustes de papel: el impreso numera, rotula y agrupa solo. Para cambiar una pregunta, ábrela en el Constructor y usa «Datos › Ajustes de papel»."
      />
    );
  }
  return (
    <TarjetaImpreso
      id="imp-papel"
      titulo={`Papel por pregunta (${filas.length})`}
      ayuda="Filas con número, texto, salto, grupo, letra o layout propios del impreso. Se editan en «Datos › Ajustes de papel» del Constructor."
    >
      <ul className="pulso-xf-imp-papel" data-qa-geometry-group="xlsform/impreso-papel" data-qa-geometry-contract="equal">
        {filas.map((f) => (
          <li key={f.rowIndex} data-qa-geometry-member="">
            <button type="button" className="pulso-xf-imp-papel-fila" onClick={() => onIrAPregunta(f.name)}
              aria-label={`Abrir ${f.name} en el Constructor. Ajustes: ${f.columnas.join(", ")}`}>
              <span className="pulso-xf-imp-papel-texto">
                <code>{f.name}</code>
                <span title={etiquetaCorta(f)}>{etiquetaCorta(f)}</span>
              </span>
              <span className="pulso-xf-imp-papel-columnas" title={f.columnas.join(", ")}>{f.columnas.join(" · ")}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </TarjetaImpreso>
  );
}
