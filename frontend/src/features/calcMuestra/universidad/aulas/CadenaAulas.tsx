/**
 * Cadena B — de la muestra a las AULAS (el divisor por facultad), como hero
 * claro de la pestaña Objetivo. Hace explícito, en lenguaje llano, cómo se
 * llega al número de aulas a partir de los ESTUDIANTES ELEGIBLES POR AULA (el
 * divisor crítico: a menos elegibles por aula, más aulas):
 *
 *   Cuota de entrevistas → ÷ estudiantes por aula → Aulas titulares → + reservas
 *
 * Consume las filas VALIDADAS del motor (avg_conglomerado = estudiantes por
 * aula; tau = tasa de rendimiento) de TODAS las facultades — sus totales cuadran
 * con el objetivo del header. El rango del divisor deja ver que cada facultad
 * tiene su propio tamaño típico de aula, sin promedio universal.
 */
import type { CalcMuestraAulasEstrato } from "../../../../api/client";
import { fmtInt, safeNumber } from "../../sharedCore";
import { FlujoVertical, type FlujoEtapa } from "../ui";

export function CadenaAulas({
  rows,
  reemplazosPorTitular,
  extraOperativo,
}: {
  rows: CalcMuestraAulasEstrato[];
  reemplazosPorTitular?: number;
  extraOperativo?: number;
}) {
  const conDato = rows.filter((r) => safeNumber(r.cuota, 0) > 0 || safeNumber(r.aulas_base, 0) > 0);
  if (!conDato.length) return null;

  const sumCuota = conDato.reduce((acc, r) => acc + safeNumber(r.cuota, 0), 0);
  const sumTitulares = conDato.reduce((acc, r) => acc + safeNumber(r.aulas_base, 0), 0);
  const sumTotal = conDato.reduce((acc, r) => acc + safeNumber(r.aulas_total, 0), 0);
  const divisores = conDato.map((r) => safeNumber(r.avg_conglomerado, 0)).filter((v) => v > 0);
  const estMin = divisores.length ? Math.min(...divisores) : null;
  const estMax = divisores.length ? Math.max(...divisores) : null;
  const taus = conDato.map((r) => safeNumber(r.tau, 0)).filter((v) => v > 0);
  const tauProm = taus.length ? taus.reduce((a, b) => a + b, 0) / taus.length : null;

  const esRango = estMin != null && estMax != null && Math.round(estMin) !== Math.round(estMax);
  const rangoEst =
    estMin != null && estMax != null
      ? esRango
        ? `${Math.round(estMin)}–${Math.round(estMax)}`
        : String(Math.round(estMin))
      : "—";

  const etapas: FlujoEtapa[] = [
    {
      id: "cuota",
      label: "Cuota de entrevistas",
      valor: fmtInt(sumCuota),
      detalle: "meta a cubrir (viene de Cálculo)",
      estado: sumCuota > 0 ? "ready" : "pending",
    },
    {
      id: "divisor",
      label: "Estudiantes por curso-horario",
      valor: rangoEst,
      detalle: "elegibles por curso-horario, por facultad",
      estado: divisores.length ? "ready" : "pending",
    },
    {
      id: "titulares",
      label: "Cursos-horario titulares",
      valor: fmtInt(sumTitulares),
      detalle: "sobremuestra ÷ estudiantes por curso-horario",
      estado: sumTitulares > 0 ? "ready" : "pending",
    },
    {
      id: "total",
      label: "Cursos-horario a coordinar",
      valor: fmtInt(sumTotal),
      detalle: "titulares + reservas y extra",
      estado: sumTotal > 0 ? "ready" : "working",
    },
  ];

  return (
    <div className="cmv2-cadena-b">
      <FlujoVertical
        etapas={etapas}
        orientacion="adaptive"
        ariaLabel="De la cuota de entrevistas a los cursos-horario: estudiantes por curso-horario, titulares y reservas"
      />
      <p className="cmv2-cadena-b-nota">
        El divisor son <strong>estudiantes elegibles por curso-horario</strong> (no matriculados totales), calculado{" "}
        <strong>por facultad</strong>
        {esRango ? (
          <>: por eso va de {rangoEst} — cada facultad tiene su propio tamaño típico, sin promedio universal.</>
        ) : (
          <> ({rangoEst} elegibles por curso-horario en este marco).</>
        )}
        {tauProm != null && <> Cada curso-horario rinde alrededor del {Math.round(tauProm * 100)}% de sus elegibles.</>}
        {reemplazosPorTitular != null && reemplazosPorTitular > 0 && (
          <> Cada titular lleva R1–R{reemplazosPorTitular} reservas equivalentes</>
        )}
        {extraOperativo != null && extraOperativo > 0 && (
          <>{reemplazosPorTitular ? " y " : " Se añaden "}+{extraOperativo} cursos-horario de reserva operativa por facultad — no cambian la muestra.</>
        )}
      </p>
    </div>
  );
}
