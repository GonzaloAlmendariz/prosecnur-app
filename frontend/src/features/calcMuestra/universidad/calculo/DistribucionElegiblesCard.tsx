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
import { tip, tipAria, useTooltipGrafico } from "../shared/graficos/TooltipGrafico";
import { distribucionElegibles } from "./distribucionElegiblesModel";
import "./distribucionElegibles.css";

type FilaAula = Record<string, unknown>;

export type EstratoDimension = {
  estrato?: unknown;
  cuota?: unknown;
  aulas_base?: unknown;
  tau?: unknown;
};

export function DistribucionElegiblesCard({
  aulaFrame,
  estratos = null,
}: {
  aulaFrame: FilaAula[] | null;
  /** aulas_por_estrato del componente activo: habilita la aritmética viva
   *  del tooltip (cuota ÷ (P25 × τ) → aulas). Opcional: sin él, el tooltip
   *  muestra solo la distribución. */
  estratos?: EstratoDimension[] | null;
}) {
  const filas = distribucionElegibles(aulaFrame);
  const { manejadores, tooltip } = useTooltipGrafico();
  const porFacultad = new Map<string, { cuota: number; aulas: number; tau: number }>();
  for (const e of estratos ?? []) {
    const k = String(e.estrato ?? "").trim().toUpperCase();
    const cuota = Number(e.cuota);
    const aulas = Number(e.aulas_base);
    const tau = Number(e.tau);
    if (k && Number.isFinite(cuota) && Number.isFinite(aulas)) {
      porFacultad.set(k, { cuota, aulas, tau: Number.isFinite(tau) ? tau : NaN });
    }
  }
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
      <ul className="cmv2-distelig-lista" {...manejadores}>
        {filas.map((f) => {
          const dim = porFacultad.get(f.facultad.toUpperCase()) ?? null;
          const datosTip = {
            titulo: f.facultad,
            filas: [
              { label: "Aula más chica", valor: fmtInt(f.min) },
              { label: "P25 (dimensiona)", valor: fmtInt(Math.round(f.p25)) },
              { label: "Mediana", valor: fmtInt(Math.round(f.mediana)) },
              { label: "P75", valor: fmtInt(Math.round(f.p75)) },
              { label: "Aula más grande", valor: fmtInt(f.max) },
            ],
            // La aritmética viva del motor: la fórmula deja de ser abstracta.
            nota: dim
              ? `cuota ${fmtInt(dim.cuota)} ÷ (P25 ${fmtInt(Math.round(f.p25))}${Number.isFinite(dim.tau) ? ` × τ ${dim.tau.toFixed(2).replace(".", ",")}` : ""}) → ${fmtInt(dim.aulas)} aulas`
              : `${fmtInt(f.nAulas)} aulas en el marco`,
            tono: "efectiva",
          };
          return (
          <li key={f.clave} className="cmv2-distelig-fila">
            <span className="cmv2-distelig-nombre">
              {f.facultad}
              <small>{fmtInt(f.nAulas)} aulas</small>
            </span>
            <span className="cmv2-distelig-carril" role="img" {...tip(datosTip)}
              aria-label={tipAria(datosTip)}>
              <i className="cmv2-distelig-rango" style={{ left: x(f.min), width: ancho(f.min, f.max) }} />
              <i className="cmv2-distelig-caja" style={{ left: x(f.p25), width: ancho(f.p25, f.p75) }} />
              <i className="cmv2-distelig-mediana" style={{ left: x(f.mediana) }} />
              <i className="cmv2-distelig-p25" style={{ left: x(f.p25) }} />
              <b className="cmv2-distelig-valor" style={{ left: x(f.p25) }}>
                {fmtInt(Math.round(f.p25))}
              </b>
            </span>
          </li>
          );
        })}
      </ul>
      <p className="cmv2-distelig-leyenda">
        <i className="cmv2-distelig-leyenda-p25" /> P25 (dimensiona) ·{" "}
        <i className="cmv2-distelig-leyenda-mediana" /> mediana ·{" "}
        <i className="cmv2-distelig-leyenda-caja" /> del P25 al P75 ·{" "}
        <i className="cmv2-distelig-leyenda-rango" /> aula más chica → más grande. Referencial: el
        valor que rige es el sellado en cada estrato.
      </p>
      {tooltip}
    </section>
  );
}
