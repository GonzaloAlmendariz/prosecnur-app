/**
 * Embudo vivo: el gráfico héroe de los capítulos de población y marco.
 * Cada peldaño es un filtro aplicado — la barra muestra cuánto queda, la
 * arista cuánto se va y por qué. Clic en un peldaño → su explicación.
 */
import { useState } from "react";
import { ArrowDown } from "lucide-react";
import { fmtInt, fmtPct } from "../../sharedCore";
import type { EmbudoPaso } from "../../dominio";
import { Sello } from "./Sello";

export function EmbudoVivo({
  pasos,
  unidad,
  resultado,
}: {
  pasos: EmbudoPaso[];
  /** Nombre de la unidad contada ("alumnos", "aulas"). */
  unidad: string;
  /** Etiqueta del peldaño final (ej. "POBLACIÓN OBJETIVO"). */
  resultado: string;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  if (pasos.length === 0) return null;
  const max = pasos[0].conteo || 1;

  return (
    <div className="rec-embudo" role="list" aria-label={`Embudo de ${unidad}`}>
      {pasos.map((paso, i) => {
        const anterior = i > 0 ? pasos[i - 1] : null;
        const merma = anterior ? anterior.conteo - paso.conteo : 0;
        const esFinal = i === pasos.length - 1;
        const open = abierto === paso.id;
        return (
          <div key={paso.id} className="rec-embudo-fila" role="listitem">
            {anterior && (
              <div className="rec-embudo-merma" aria-label={`Se excluyen ${fmtInt(merma)} ${unidad}`}>
                <ArrowDown size={12} aria-hidden="true" />
                <span>−{fmtInt(merma)} {unidad}</span>
              </div>
            )}
            <button
              type="button"
              className="rec-embudo-paso"
              data-final={esFinal || undefined}
              data-open={open || undefined}
              aria-expanded={open}
              onClick={() => setAbierto(open ? null : paso.id)}
            >
              <span className="rec-embudo-copy">
                <span className="rec-embudo-label">
                  {paso.label}
                  {esFinal && <em className="rec-embudo-resultado">{resultado}</em>}
                </span>
                <span className="rec-embudo-cifra">
                  {fmtInt(paso.conteo)}
                  <small>{fmtPct(paso.conteo / max)} del punto de partida</small>
                </span>
              </span>
              <span className="rec-embudo-barra" aria-hidden="true">
                <span className="rec-embudo-barra-fill" style={{ width: `${(paso.conteo / max) * 100}%` }} />
              </span>
            </button>
            {open && (
              <div className="rec-embudo-porque">
                <p>{paso.porQue}</p>
                {paso.sello && <Sello tipo={paso.sello} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
