import type { MonitoreoCuota } from "../../../../api/monitoreoCuotas";
import { formatoDecimal } from "../../../../lib/formatoNumero";
import { cifra, resumenCuota } from "./avanceCuotasModelo";
import { clasePublico, type PaletaDePublicos } from "./paletaPublicos";

// Resumen de Avance › Cuotas: una pieza-indicador por cuota, en una tira con
// filetes (no tarjetas dentro del panel). Cada pieza es el selector de la
// cuota que se detalla abajo: elegirla escribe `foco` en la dirección.

const RADIO = 19;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

function Anillo({ relleno, texto }: { relleno: number; texto: string }) {
  return (
    <span className="mon-cuotas-anillo" aria-hidden>
      <svg viewBox="0 0 44 44" focusable="false">
        <circle className="es-pista" cx="22" cy="22" r={RADIO} />
        <circle
          className="es-relleno"
          cx="22"
          cy="22"
          r={RADIO}
          strokeDasharray={`${(relleno * CIRCUNFERENCIA).toFixed(2)} ${CIRCUNFERENCIA.toFixed(2)}`}
        />
      </svg>
      <span>{texto}</span>
    </span>
  );
}

export function AvanceCuotasResumen({
  cuotas,
  elegida,
  paleta,
  onElegir,
}: {
  cuotas: MonitoreoCuota[];
  elegida: string;
  paleta: PaletaDePublicos;
  onElegir: (id: string) => void;
}) {
  return (
    <ul
      className="mon-cuotas-resumen"
      aria-label="Cuotas configuradas"
      data-qa-geometry-group="monitoreo/acreditacion/avance/cuotas/resumen"
      data-qa-geometry-contract="equal"
    >
      {cuotas.map((q) => {
        const r = resumenCuota(q);
        const activa = q.id === elegida;
        const pct = r.meta > 0 && r.avance != null ? `${formatoDecimal(r.avance * 100, 0)}\u202f%` : "—";
        return (
          <li key={q.id} className={`${clasePublico(paleta, q.actor)} es-${r.tono}`}>
            <button
              type="button"
              className="mon-cuotas-indicador"
              aria-pressed={activa}
              aria-label={`${r.actor} · ${r.variable}: ${r.avanceTexto}; ${r.cumplidas}`}
              onClick={() => onElegir(q.id)}
            >
              <Anillo relleno={r.relleno} texto={pct} />
              <span className="mon-cuotas-indicador-texto">
                <span className="mon-cuotas-indicador-titulo">
                  <i className="mon-publico-punto" aria-hidden />
                  <span>{r.actor}</span>
                </span>
                <strong>{r.variable}</strong>
                <span className="mon-cuotas-indicador-cifra">
                  <b>{r.meta > 0 ? cifra(r.efectivas) : "—"}</b>
                  {r.meta > 0 ? <small> / {cifra(r.meta)} efectivas</small> : null}
                </span>
                <small>{r.cumplidas}</small>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
