import { memo, type ReactNode } from "react";

import type { MonitoreoAulasDashboard, MonitoreoRow } from "../../../../../api/monitoreo";
import { AulasCambioDeAula } from "../AulasCambioDeAula";
import { AulasEmbudoDelAula } from "../AulasEmbudoDelAula";
import { AulasPartesQueNoCuadran } from "../AulasPartesQueNoCuadran";
import { fmt } from "../kpisDeAulas";
import { parteDeCampo } from "../parteDeCampo";
import "../insumos/insumos.css";
import "../modelo/modelo.css";

export const MARCA_PARTES_AULAS = "monitoreo-aulas-control-partes";
export function readinessDePartes(cargando: boolean, dashboard: MonitoreoAulasDashboard | null): string {
  if (cargando) return "false";
  return dashboard ? MARCA_PARTES_AULAS : "vacio:sin-tablero";
}

/** La franja de Ctl5: partes leídos, cuántos cuadran, cuántos no y cuántos no se pueden comprobar. */
export function franjaDePartes(dashboard: MonitoreoAulasDashboard) {
  const partes = (dashboard.partes_campo ?? []) as MonitoreoRow[];
  const c = parteDeCampo(partes, (dashboard.agenda ?? []) as MonitoreoRow[]);
  const leidos = partes.length;
  const cuadran = Math.max(0, leidos - c.descuadrados - c.sinComprobar);
  return {
    cuadre: c,
    celdas: [
      { clave: "leidos", rotulo: "Partes leídos", valor: fmt(leidos), sub: "de la hoja «Aulas Aplicadas (Campo)»" },
      { clave: "cuadran", rotulo: "Cuadran", valor: fmt(cuadran), sub: "asistentes menos rechazos y duplicados" },
      { clave: "no-cuadran", rotulo: "No cuadran", valor: fmt(c.descuadrados), sub: "se ven abajo, de la mayor diferencia a la menor" },
      { clave: "sin-datos", rotulo: "Sin datos para cuadrar", valor: fmt(c.sinComprobar), sub: "al parte le falta una cifra" },
    ],
  };
}

/**
 * Control › Partes (ficha Ctl5). ¿Qué partes no cuadran y por cuánto? Lo que
 * anotó campo en el libro, leído: la cadena del aula (asistentes, rechazos, ya
 * habían respondido, aplicadas) contra lo que declara el parte. Monitoreo solo
 * lee; el parte se corrige en la hoja.
 */
function PartesAulasImpl({ dashboard, cargando, vacioSinTablero }: {
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  vacioSinTablero: ReactNode;
}) {
  const readiness = readinessDePartes(cargando, dashboard);
  if (cargando) return <section className="aulas-ins aulas-ins--silueta" aria-label="Partes" aria-busy="true" data-audit-ready={readiness} />;
  if (!dashboard) return <section className="aulas-ins" aria-label="Partes" data-audit-ready={readiness}>{vacioSinTablero}</section>;
  const { cuadre, celdas } = franjaDePartes(dashboard);
  const plan = (dashboard.agenda ?? []) as MonitoreoRow[];

  return (
    <section
      className="aulas-mm"
      aria-label="Partes"
      data-audit-ready={readiness}
      data-qa-geometry-group="aulas-control-partes"
      data-qa-geometry-contract="intrinsic"
    >
      <dl className="aulas-mm-franja" data-qa-geometry-member="franja" data-qa-geometry-group="aulas-control-partes-franja" data-qa-geometry-contract="equal">
        {celdas.map((c) => (
          <div key={c.clave} data-qa-geometry-member={c.clave}>
            <dt>{c.rotulo}</dt>
            <dd>{c.valor}</dd>
            <span>{c.sub}</span>
          </div>
        ))}
      </dl>
      <div className="aulas-mm-cuerpo aulas-mm-cuerpo--ancho" data-qa-geometry-member="cuerpo" data-qa-geometry-group="aulas-control-partes-cuerpo" data-qa-geometry-contract="intrinsic">
        <section className="aulas-ins-panel" aria-labelledby="aulas-pt-no" data-qa-geometry-member="no-cuadran">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-pt-no">Partes que no cuadran</h3>
            <span className="aulas-ins-sub">{cuadre.label}</span>
          </header>
          {cuadre.descuadrados ? (
            <AulasPartesQueNoCuadran filas={cuadre.filas as MonitoreoRow[]} />
          ) : (
            <p className="aulas-ins-nota" data-qa-geometry-empty="legitimo">Todos los partes con datos cuadran.</p>
          )}
          <p className="aulas-ins-pie">El parte se corrige en la hoja del libro; Monitoreo solo lee.</p>
        </section>
        <div className="aulas-ins-derecha" data-qa-geometry-member="derecha" data-qa-geometry-group="aulas-control-partes-derecha" data-qa-geometry-contract="intrinsic">
          <section className="aulas-ins-panel" aria-labelledby="aulas-pt-aula" data-qa-geometry-member="cambio">
            <header className="aulas-ins-cabecera"><h3 id="aulas-pt-aula">Cambiaron de aula</h3></header>
            <AulasCambioDeAula partes={cuadre.filas as MonitoreoRow[]} plan={plan} />
          </section>
          <section className="aulas-ins-panel" aria-labelledby="aulas-pt-embudo" data-qa-geometry-member="embudo">
            <header className="aulas-ins-cabecera"><h3 id="aulas-pt-embudo">Del aula a las efectivas</h3></header>
            <AulasEmbudoDelAula filas={(dashboard.partes_campo ?? []) as MonitoreoRow[]} plan={plan} />
          </section>
        </div>
      </div>
    </section>
  );
}

export const PartesAulas = memo(PartesAulasImpl);
