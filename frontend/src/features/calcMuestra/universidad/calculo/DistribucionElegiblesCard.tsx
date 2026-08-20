/**
 * «Cuántos elegibles carga cada aula» — la distribución que el P25 resume.
 *
 * El gráfico didáctico que faltaba en Cálculo: cada facultad como un carril
 * min–max con su banda P25–P75 y la marca del P25 — el divisor real del
 * dimensionamiento (cuota ÷ (P25 × τ)). Ordenado por P25 ascendente para que
 * la historia se lea sola: las facultades de aulas chicas arriba (necesitan
 * más aulas por alumno de cuota), las de aulas grandes abajo.
 */
import { fmtInt } from "../../sharedCore";
import { distribucionElegibles } from "./distribucionElegiblesModel";
import "./distribucionElegibles.css";

type FilaAula = Record<string, unknown>;

export function DistribucionElegiblesCard({
  aulaFrame,
}: {
  aulaFrame: FilaAula[] | null;
}) {
  const filas = distribucionElegibles(aulaFrame);
  if (!filas.length) return null;
  const escala = Math.max(1, ...filas.map((f) => f.max));
  const x = (v: number) => `${(v / escala) * 100}%`;
  const ancho = (a: number, b: number) => `${Math.max(0.5, ((b - a) / escala) * 100)}%`;

  return (
    <section className="cmv2-generales-card cmv2-distelig" aria-label="Cuántos elegibles carga cada aula">
      <header>
        <strong>Cuántos elegibles carga cada aula</strong>
        <span>
          cada carril va del aula más chica a la más grande de su facultad; la marca fuerte es el
          P25 — el divisor que dimensiona (cuota ÷ (P25 × τ))
        </span>
      </header>
      <ul className="cmv2-distelig-lista">
        {filas.map((f) => (
          <li key={f.clave} className="cmv2-distelig-fila">
            <span className="cmv2-distelig-nombre">
              {f.facultad}
              <small>{fmtInt(f.nAulas)} aulas</small>
            </span>
            <span className="cmv2-distelig-carril" role="img"
              aria-label={`${f.facultad}: de ${fmtInt(f.min)} a ${fmtInt(f.max)} elegibles por aula; P25 ${fmtInt(Math.round(f.p25))}, mediana ${fmtInt(Math.round(f.mediana))}`}>
              <i className="cmv2-distelig-rango" style={{ left: x(f.min), width: ancho(f.min, f.max) }} />
              <i className="cmv2-distelig-caja" style={{ left: x(f.p25), width: ancho(f.p25, f.p75) }} />
              <i className="cmv2-distelig-mediana" style={{ left: x(f.mediana) }} />
              <i className="cmv2-distelig-p25" style={{ left: x(f.p25) }} />
              <b className="cmv2-distelig-valor" style={{ left: x(f.p25) }}>
                {fmtInt(Math.round(f.p25))}
              </b>
            </span>
          </li>
        ))}
      </ul>
      <p className="cmv2-distelig-leyenda">
        <i className="cmv2-distelig-leyenda-p25" /> P25 (dimensiona) ·{" "}
        <i className="cmv2-distelig-leyenda-mediana" /> mediana ·{" "}
        <i className="cmv2-distelig-leyenda-caja" /> del P25 al P75 ·{" "}
        <i className="cmv2-distelig-leyenda-rango" /> aula más chica → más grande. Referencial: el
        valor que rige es el sellado en cada estrato.
      </p>
    </section>
  );
}
