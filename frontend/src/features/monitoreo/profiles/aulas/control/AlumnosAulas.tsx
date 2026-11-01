import { memo, type ReactNode } from "react";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { AulasCrucePorCarrera } from "../AulasCrucePorCarrera";
import { fmt } from "../kpisDeAulas";
import "../insumos/insumos.css";
import "../modelo/modelo.css";

export const MARCA_ALUMNOS_AULAS = "monitoreo-aulas-control-alumnos";
export function readinessDeAlumnos(cargando: boolean, dashboard: MonitoreoAulasDashboard | null): string {
  if (cargando) return "false";
  if (!dashboard) return "vacio:sin-tablero";
  return dashboard.cruce_por_carrera?.aplica === false ? "vacio:sin-codigo" : MARCA_ALUMNOS_AULAS;
}

/** La franja de Ctl8: respuestas con código, alumnos distintos, dos veces, sin cruce y cuánto cruza. */
export function franjaDeAlumnos(dashboard: MonitoreoAulasDashboard) {
  const t = dashboard.cruce_por_carrera?.total;
  if (!t) return [];
  return [
    { clave: "consideradas", rotulo: "Respuestas con código", valor: fmt(t.consideradas) },
    { clave: "personas", rotulo: "Alumnos distintos", valor: fmt(t.personas) },
    { clave: "duplicadas", rotulo: "Dos veces", valor: fmt(t.duplicadas) },
    { clave: "sin-cruce", rotulo: "Sin cruce con el padrón", valor: fmt(t.sin_cruce) },
    { clave: "tasa", rotulo: "Cruzan", valor: t.tasa == null ? "—" : `${(100 * (t.tasa > 1 ? t.tasa / 100 : t.tasa)).toFixed(1)} %` },
  ];
}

/**
 * Control › Alumnos (ficha Ctl8, sólo cuando el estudio pide código de alumno,
 * como CCSS). ¿Quién respondió y cruza con el padrón? Franja del cruce y, bajo
 * ella, la cobertura por carrera y la lista por código que ya existían.
 */
function AlumnosAulasImpl({ dashboard, cargando, vacioSinTablero }: {
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  vacioSinTablero: ReactNode;
}) {
  const readiness = readinessDeAlumnos(cargando, dashboard);
  if (cargando) return <section className="aulas-ins aulas-ins--silueta" aria-label="Alumnos" aria-busy="true" data-audit-ready={readiness} />;
  if (!dashboard) return <section className="aulas-ins" aria-label="Alumnos" data-audit-ready={readiness}>{vacioSinTablero}</section>;
  const cruce = dashboard.cruce_por_carrera;
  if (cruce?.aplica === false) {
    return (
      <section className="aulas-ins aulas-ins--una" aria-label="Alumnos" data-audit-ready={readiness}>
        <section className="aulas-ins-panel">
          <p className="aulas-ins-nota" data-qa-geometry-empty="legitimo">{cruce.motivo || "Este estudio no pide un código identificador: no hay alumnos que cruzar."}</p>
        </section>
      </section>
    );
  }
  const franja = franjaDeAlumnos(dashboard);

  return (
    <section
      className="aulas-mm"
      aria-label="Alumnos"
      data-audit-ready={readiness}
      data-qa-geometry-group="aulas-control-alumnos"
      data-qa-geometry-contract="intrinsic"
    >
      {franja.length ? (
        <dl className="aulas-mm-franja aulas-mm-franja--cinco" data-qa-geometry-member="franja" data-qa-geometry-group="aulas-control-alumnos-franja" data-qa-geometry-contract="equal">
          {franja.map((c) => (
            <div key={c.clave} data-qa-geometry-member={c.clave}>
              <dt>{c.rotulo}</dt>
              <dd>{c.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {cruce?.aviso_anonimato ? <p className="aulas-ins-chip aulas-mm-aviso" data-tono="aviso" role="status">{cruce.aviso_anonimato}</p> : null}
      <section className="aulas-ins-panel" aria-labelledby="aulas-al-cruce" data-qa-geometry-member="cruce">
        <header className="aulas-ins-cabecera">
          <h3 id="aulas-al-cruce">Cruce con el padrón, por carrera</h3>
        </header>
        <AulasCrucePorCarrera bloque={cruce as never} />
      </section>
    </section>
  );
}

export const AlumnosAulas = memo(AlumnosAulasImpl);
