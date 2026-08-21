/**
 * «Cuántos elegibles carga cada aula» — la distribución que el P25 resume.
 *
 * El gráfico didáctico que faltaba en Cálculo: cada facultad como un carril
 * min–max con su banda P25–P75 y la marca del P25 — el divisor real del
 * dimensionamiento (cuota ÷ (P25 × tasa de la facultad)). Ordenado por P25 ascendente para que
 * la historia se lea sola: las facultades de aulas chicas arriba (necesitan
 * más aulas por alumno de cuota), las de aulas grandes abajo.
 */
import { fmtInt } from "../../sharedCore";
import { tip, tipAria, useTooltipGrafico } from "../shared/graficos/TooltipGrafico";
import { distribucionElegibles, ordenarPorDivisor } from "./distribucionElegiblesModel";
import "./distribucionElegibles.css";
import { estadisticoDelReparto, nombreEstadistico } from "./estadisticoAula";

type FilaAula = Record<string, unknown>;

export type EstratoDimension = {
  estrato?: unknown;
  cuota?: unknown;
  aulas_base?: unknown;
  tau?: unknown;
  avg_conglomerado?: unknown;
  estadistico_usado?: unknown;
};

const coma1 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ","));

export function DistribucionElegiblesCard({
  aulaFrame,
  estratos = null,
}: {
  aulaFrame: FilaAula[] | null;
  /** aulas_por_estrato del componente activo: habilita la aritmética viva
   *  del tooltip (cuota ÷ (P25 × tasa) → titulares). Opcional: sin él, el tooltip
   *  muestra solo la distribución. */
  estratos?: EstratoDimension[] | null;
}) {
  const filas = distribucionElegibles(aulaFrame);
  const { manejadores, tooltip } = useTooltipGrafico();
  const porFacultad = new Map<string, { cuota: number; aulas: number; tau: number; divisor: number }>();
  for (const e of estratos ?? []) {
    const k = String(e.estrato ?? "").trim().toUpperCase();
    const cuota = Number(e.cuota);
    const aulas = Number(e.aulas_base);
    const tau = Number(e.tau);
    const divisor = Number(e.avg_conglomerado);
    if (k && Number.isFinite(cuota) && Number.isFinite(aulas)) {
      porFacultad.set(k, {
        cuota,
        aulas,
        tau: Number.isFinite(tau) ? tau : NaN,
        divisor: Number.isFinite(divisor) ? divisor : NaN,
      });
    }
  }
  // Qué número divide de verdad. NO siempre es el P25: lo decide el analista en
  // Marco › Alumnos por CH y el motor declara cuál usó. Medido en un proyecto
  // con decisión `min_mediana_media`: esta tarjeta marcaba 25,0 en EE.GG.
  // Letras llamándolo «el divisor» mientras el motor dividía entre 49,5.
  const estadistico = estadisticoDelReparto(estratos);
  const nombreDivisor = nombreEstadistico(estadistico);
  const hayDivisorSellado = Array.from(porFacultad.values()).some((d) => Number.isFinite(d.divisor));
  if (!filas.length) return null;
  // El orden también obedece al criterio (Gonzalo: «todos los gráficos y las
  // visualizaciones de allí deberían hacerle caso a ese criterio»). El modelo
  // ordena por P25 porque es lo único que puede calcular sin el reparto; si el
  // reparto está, manda el divisor sellado. La historia que cuenta el carril
  // —«las facultades de aulas chicas necesitan más aulas para la misma
  // cuota»— sólo es cierta si ordena por el número que divide de verdad.
  const filasOrdenadas = hayDivisorSellado
    ? ordenarPorDivisor(filas, (facultad) => porFacultad.get(facultad.toUpperCase())?.divisor)
    : filas;
  const escala = Math.max(1, ...filas.map((f) => f.max));
  const x = (v: number) => `${(v / escala) * 100}%`;
  const ancho = (a: number, b: number) => `${Math.max(0.5, ((b - a) / escala) * 100)}%`;

  return (
    <section className="cmv2-generales-card cmv2-distelig" aria-label="Cuántos elegibles carga cada aula">
      <header>
        <strong>Cuántos elegibles carga cada aula</strong>
        <span>
          cada carril va del aula más chica a la más grande de su facultad; la marca fuerte es{" "}
          {hayDivisorSellado
            ? `la ${nombreDivisor} de alumnos por CH — el divisor que, junto a la tasa de efectividad de la facultad, convierte su cuota en titulares`
            : "el P25 de alumnos por CH; el divisor que dimensiona se sella al calcular"}
        </span>
      </header>
      <ul className="cmv2-distelig-lista" {...manejadores}>
        {filasOrdenadas.map((f) => {
          const dim = porFacultad.get(f.facultad.toUpperCase()) ?? null;
          const datosTip = {
            titulo: f.facultad,
            filas: [
              { label: "Aula más chica", valor: fmtInt(f.min) },
              { label: "P25", valor: fmtInt(Math.round(f.p25)) },
              { label: "Mediana", valor: fmtInt(Math.round(f.mediana)) },
              { label: "P75", valor: fmtInt(Math.round(f.p75)) },
              { label: "Aula más grande", valor: fmtInt(f.max) },
              ...(dim && Number.isFinite(dim.divisor)
                ? [{ label: `Divisor (${nombreDivisor})`, valor: coma1(dim.divisor) }]
                : []),
            ],
            // La aritmética viva del motor: la fórmula deja de ser abstracta.
            nota: dim
              ? `cuota ${fmtInt(dim.cuota)} ÷ (${Number.isFinite(dim.divisor) ? coma1(dim.divisor) : fmtInt(Math.round(f.p25))}${Number.isFinite(dim.tau) ? ` × tasa ${dim.tau.toFixed(2).replace(".", ",")}` : ""}) → ${fmtInt(dim.aulas)} titulares`
              : `${fmtInt(f.nAulas)} ${f.nAulas === 1 ? "aula" : "aulas"} en el marco`,
            tono: "efectiva",
          };
          return (
          <li key={f.clave} className="cmv2-distelig-fila">
            <span className="cmv2-distelig-nombre">
              {f.facultad}
              <small>{fmtInt(f.nAulas)} {f.nAulas === 1 ? "aula" : "aulas"}</small>
            </span>
            <span className="cmv2-distelig-carril" role="img" {...tip(datosTip)}
              aria-label={tipAria(datosTip)}>
              <i className="cmv2-distelig-rango" style={{ left: x(f.min), width: ancho(f.min, f.max) }} />
              <i className="cmv2-distelig-caja" style={{ left: x(f.p25), width: ancho(f.p25, f.p75) }} />
              <i className="cmv2-distelig-mediana" style={{ left: x(f.mediana) }} />
              {/* La marca fuerte señala el número que DIVIDE, no un cuantil
                  fijo: marcar el P25 cuando el motor divide entre otra cosa
                  señalaba un punto del carril que no dimensiona nada. */}
              <i
                className="cmv2-distelig-p25"
                style={{ left: x(dim && Number.isFinite(dim.divisor) ? dim.divisor : f.p25) }}
              />
              <b
                className="cmv2-distelig-valor"
                style={{ left: x(dim && Number.isFinite(dim.divisor) ? dim.divisor : f.p25) }}
              >
                {dim && Number.isFinite(dim.divisor) ? coma1(dim.divisor) : fmtInt(Math.round(f.p25))}
              </b>
            </span>
          </li>
          );
        })}
      </ul>
      <p className="cmv2-distelig-leyenda">
        <i className="cmv2-distelig-leyenda-p25" />{" "}
        {hayDivisorSellado ? `${nombreDivisor} (dimensiona)` : "P25"} ·{" "}
        <i className="cmv2-distelig-leyenda-mediana" /> mediana ·{" "}
        <i className="cmv2-distelig-leyenda-caja" /> del P25 al P75 ·{" "}
        <i className="cmv2-distelig-leyenda-rango" /> aula más chica → más grande. Referencial: el
        valor que rige es el sellado en cada estrato.
      </p>
      {tooltip}
    </section>
  );
}
