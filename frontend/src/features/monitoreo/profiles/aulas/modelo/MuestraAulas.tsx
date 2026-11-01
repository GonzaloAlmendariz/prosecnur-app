import { memo, type ReactNode } from "react";

import type { MonitoreoAulasDashboard, MonitoreoAulasPlanRow, MonitoreoRow } from "../../../../../api/monitoreo";
import { AulasAlcanceDelBanco } from "../AulasAlcanceDelBanco";
import { AulasColchonPorFacultad } from "../AulasColchonPorFacultad";
import { AulasHistoriaCadena } from "../AulasHistoriaCadena";
import { fmt } from "../kpisDeAulas";
import "../insumos/insumos.css";
import "./modelo.css";

export const MARCA_MUESTRA_AULAS = "monitoreo-aulas-modelo-muestra";
export function readinessDeMuestra(cargando: boolean, dashboard: MonitoreoAulasDashboard | null): string {
  if (cargando) return "false";
  return dashboard ? MARCA_MUESTRA_AULAS : "vacio:sin-tablero";
}

/** La franja de M2 con el reparto del motor: titulares, reservas en cadena y banco. */
export function franjaDeMuestra(dashboard: MonitoreoAulasDashboard) {
  const rol = dashboard.course_status_rol_y_estado;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return [
    { clave: "titulares", rotulo: "Titulares", valor: fmt(n(rol?.titulares?.total)), sub: `${fmt(n(rol?.titulares?.aplicado))} aplicados` },
    { clave: "reservas", rotulo: "Reservas en cadena", valor: fmt(n(rol?.reemplazos?.total)), sub: `${fmt(n(rol?.reemplazos?.utilizado))} usadas` },
    { clave: "banco", rotulo: "Banco de extras", valor: fmt(n(rol?.banco?.total)), sub: `${fmt(n(rol?.banco?.utilizado))} usados · ${fmt(n(rol?.banco?.disponible))} disponibles` },
  ];
}

/**
 * Modelo › Muestra (ficha M2). Arriba, la muestra que dejó el sorteo; a la
 * izquierda, dónde aguanta la reserva por grupo y la historia de cada cadena;
 * a la derecha, si el banco de extras alcanza para cerrar la cuota. Reutiliza
 * las piezas de Consultas: aquí sólo se ordenan.
 */
function MuestraAulasImpl({ dashboard, cargando, vacioSinTablero }: {
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  vacioSinTablero: ReactNode;
}) {
  const readiness = readinessDeMuestra(cargando, dashboard);
  if (cargando) return <section className="aulas-ins aulas-ins--silueta" aria-label="Muestra" aria-busy="true" data-audit-ready={readiness} />;
  if (!dashboard) return <section className="aulas-ins" aria-label="Muestra" data-audit-ready={readiness}>{vacioSinTablero}</section>;
  const filas = (dashboard.agenda ?? []) as MonitoreoAulasPlanRow[];
  const eje = (dashboard as { avance_cuota?: { eje?: Record<string, unknown> | null } }).avance_cuota?.eje;

  return (
    <section
      className="aulas-mm"
      aria-label="Muestra"
      data-audit-ready={readiness}
      data-qa-geometry-group="aulas-modelo-muestra"
      data-qa-geometry-contract="intrinsic"
    >
      <dl className="aulas-mm-franja aulas-mm-franja--tres" data-qa-geometry-member="franja" data-qa-geometry-group="aulas-modelo-muestra-franja" data-qa-geometry-contract="equal">
        {franjaDeMuestra(dashboard).map((c) => (
          <div key={c.clave} data-qa-geometry-member={c.clave}>
            <dt>{c.rotulo}</dt>
            <dd>{c.valor}</dd>
            <span>{c.sub}</span>
          </div>
        ))}
      </dl>
      <div className="aulas-mm-cuerpo aulas-mm-cuerpo--ancho" data-qa-geometry-member="cuerpo" data-qa-geometry-group="aulas-modelo-muestra-cuerpo" data-qa-geometry-contract="intrinsic">
        <div className="aulas-ins-columna" data-qa-geometry-member="reserva" data-qa-geometry-group="aulas-modelo-muestra-reserva" data-qa-geometry-contract="intrinsic">
          <section className="aulas-ins-panel" aria-labelledby="aulas-mm-colchon" data-qa-geometry-member="colchon">
            <header className="aulas-ins-cabecera">
              <h3 id="aulas-mm-colchon">Dónde aguanta la reserva</h3>
              <span className="aulas-ins-sub">reservas libres por grupo</span>
            </header>
            <AulasColchonPorFacultad filas={filas} eje={eje} />
          </section>
          <section className="aulas-ins-panel" aria-labelledby="aulas-mm-cadenas" data-qa-geometry-member="cadenas">
            <header className="aulas-ins-cabecera">
              <h3 id="aulas-mm-cadenas">Cadenas de reemplazo</h3>
              <span className="aulas-ins-sub">el titular, su reemplazo y cuál cerró</span>
            </header>
            <AulasHistoriaCadena filas={filas} />
          </section>
        </div>
        <section className="aulas-ins-panel" aria-labelledby="aulas-mm-banco" data-qa-geometry-member="banco">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-mm-banco">¿Alcanza el banco?</h3>
          </header>
          <AulasAlcanceDelBanco
            banco={dashboard.banco_extras ?? null}
            control={(dashboard.control_calidad ?? []) as Array<Record<string, unknown>>}
            quotas={(dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>}
            agenda={(dashboard.agenda ?? []) as MonitoreoRow[]}
            partes={(dashboard.partes_campo ?? []) as MonitoreoRow[]}
          />
        </section>
      </div>
    </section>
  );
}

export const MuestraAulas = memo(MuestraAulasImpl);
