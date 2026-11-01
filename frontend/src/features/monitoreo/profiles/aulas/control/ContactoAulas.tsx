import { memo, type ReactNode } from "react";

import type { MonitoreoAulasDashboard, MonitoreoAulasPlanRow } from "../../../../../api/monitoreo";
import { AulasColaDeContacto } from "../AulasColaDeContacto";
import { AulasMedioDeContacto } from "../AulasMedioDeContacto";
import { AulasRitmoDeAgendacion } from "../AulasRitmoDeAgendacion";
import "../insumos/insumos.css";

export const MARCA_CONTACTO_AULAS = "monitoreo-aulas-control-contacto";
export function readinessDeContacto(cargando: boolean, dashboard: MonitoreoAulasDashboard | null): string {
  if (cargando) return "false";
  return dashboard ? MARCA_CONTACTO_AULAS : "vacio:sin-tablero";
}

/**
 * Control › Contacto (ficha Ctl2). ¿A quién toca llamar? A la izquierda la
 * cola de contacto; a la derecha con qué medio y a qué ritmo se está
 * agendando. Las gestiones se anotan en la hoja de agenda: Monitoreo solo lee.
 *
 * `agenda` son las filas que la página ya arma para la agenda (titulares y
 * reservas despiertas, con lo que toca con cada una): la regla de quién se ve
 * vive en un solo lugar.
 */
function ContactoAulasImpl({ dashboard, cargando, vacioSinTablero, agenda }: {
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  vacioSinTablero: ReactNode;
  agenda: ReadonlyArray<MonitoreoAulasPlanRow>;
}) {
  const readiness = readinessDeContacto(cargando, dashboard);
  if (cargando) return <section className="aulas-ins aulas-ins--silueta" aria-label="Contacto" aria-busy="true" data-audit-ready={readiness} />;
  if (!dashboard) return <section className="aulas-ins" aria-label="Contacto" data-audit-ready={readiness}>{vacioSinTablero}</section>;
  const conReservas = ((dashboard.agenda ?? []) as unknown as MonitoreoAulasPlanRow[])
    .filter((f) => String((f as { sample_role?: unknown }).sample_role ?? "") !== "extra_reserve_pool");

  return (
    <section
      className="aulas-ins aulas-ins--apl"
      aria-label="Contacto"
      data-audit-ready={readiness}
      data-qa-geometry-group="aulas-control-contacto"
      data-qa-geometry-contract="intrinsic"
    >
      <section className="aulas-ins-panel" aria-labelledby="aulas-ct-cola" data-qa-geometry-member="cola">
        <header className="aulas-ins-cabecera">
          <h3 id="aulas-ct-cola">Cola de contacto</h3>
          <span className="aulas-ins-sub">a quién toca llamar</span>
        </header>
        <AulasColaDeContacto filas={agenda} conReservas={conReservas} />
        <p className="aulas-ins-pie">Las gestiones se anotan en la hoja de agenda; Monitoreo solo lee.</p>
      </section>
      <div className="aulas-ins-derecha" data-qa-geometry-member="derecha" data-qa-geometry-group="aulas-control-contacto-derecha" data-qa-geometry-contract="intrinsic">
        <section className="aulas-ins-panel" aria-labelledby="aulas-ct-medio" data-qa-geometry-member="medio">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-ct-medio">Con qué medio</h3>
          </header>
          <AulasMedioDeContacto filas={agenda} />
        </section>
        <section className="aulas-ins-panel" aria-labelledby="aulas-ct-ritmo" data-qa-geometry-member="ritmo">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-ct-ritmo">Ritmo de agendación</h3>
          </header>
          <AulasRitmoDeAgendacion filas={agenda} />
        </section>
      </div>
    </section>
  );
}

export const ContactoAulas = memo(ContactoAulasImpl);
