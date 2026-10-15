// Resumen clicable del Informe (I3 del rediseño, 2026-10-14): cuántas láminas hay en cada estado y, al pulsar uno, el
// clasificador atenúa las demás. Un estado sin láminas queda deshabilitado en su sitio (C2: el marco no cambia).

import { FILTROS_INFORME, type FiltroInforme } from "./estadoTarjetas";

type Props = { conteos: Record<FiltroInforme, number>; filtro: FiltroInforme; onFiltro: (f: FiltroInforme) => void };

export function ResumenInforme({ conteos, filtro, onFiltro }: Props) {
  return (
    <div className="pulso-f6-vg-resumen" role="group" aria-label="Filtrar las láminas por estado">
      {FILTROS_INFORME.map(({ clave, rotulo }) => {
        const n = conteos[clave];
        const activo = filtro === clave;
        return (
          <button
            key={clave}
            type="button"
            className={`pulso-f6-vg-rs is-${clave}${activo ? " is-activo" : ""}`}
            aria-pressed={activo}
            disabled={clave !== "todas" && n === 0}
            onClick={() => onFiltro(activo && clave !== "todas" ? "todas" : clave)}
          >
            <strong>{n}</strong>
            <span>{rotulo}</span>
          </button>
        );
      })}
    </div>
  );
}
