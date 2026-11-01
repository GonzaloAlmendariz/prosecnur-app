import { memo, type ReactNode } from "react";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { AulasControlDelLibro, type ResumenDeControl } from "../AulasControlDelLibro";
import { AulasControles } from "../AulasControles";
import { AulasTextoAbierto } from "../AulasTextoAbierto";
import { AulasTiemposDeRespuesta } from "../AulasTiemposDeRespuesta";
import { summarizeAulasValidation } from "../aulasPresentation";
import "../insumos/insumos.css";
import "../modelo/modelo.css";

export const MARCA_CALIDAD_AULAS = "monitoreo-aulas-control-calidad";
export function readinessDeCalidad(cargando: boolean, dashboard: MonitoreoAulasDashboard | null): string {
  if (cargando) return "false";
  return dashboard ? MARCA_CALIDAD_AULAS : "vacio:sin-tablero";
}

/**
 * Control › Calidad (ficha Ctl6). ¿Qué señales deja el corte? A la izquierda,
 * las comprobaciones que deriva la app y la duración que se aparta del resto;
 * a la derecha, lo que el equipo calcula en la base de control de su libro y
 * las respuestas abiertas. Son dos medidas distintas del mismo operativo: la
 * app deriva, el libro declara. La facultad que declara el alumno vive en
 * Insumos › Reglas, junto al criterio de efectiva.
 */
function CalidadAulasImpl({ dashboard, cargando, vacioSinTablero, onDeclararUmbral }: {
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  vacioSinTablero: ReactNode;
  onDeclararUmbral?: ((minutos: number) => void | Promise<void>) | null;
}) {
  const readiness = readinessDeCalidad(cargando, dashboard);
  if (cargando) return <section className="aulas-ins aulas-ins--silueta" aria-label="Calidad" aria-busy="true" data-audit-ready={readiness} />;
  if (!dashboard) return <section className="aulas-ins" aria-label="Calidad" data-audit-ready={readiness}>{vacioSinTablero}</section>;
  const filas = (dashboard.validation ?? []) as Array<Record<string, unknown>>;
  const resumen = summarizeAulasValidation(filas);
  const control = (dashboard.control_calidad ?? []) as Array<Record<string, unknown>>;

  return (
    <section
      className="aulas-ins aulas-ins--apl"
      aria-label="Calidad"
      data-audit-ready={readiness}
      data-qa-geometry-group="aulas-control-calidad"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="aulas-ins-izquierda" data-qa-geometry-member="izquierda" data-qa-geometry-group="aulas-control-calidad-izquierda" data-qa-geometry-contract="intrinsic">
        <section className="aulas-ins-panel" aria-labelledby="aulas-cal-senales" data-qa-geometry-member="senales">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-cal-senales">Señales del corte</h3>
            <span className="aulas-ins-sub">{resumen.label} · lo que deriva la app</span>
          </header>
          <AulasControles filas={filas} plan={(dashboard.agenda ?? []) as Array<Record<string, unknown>>} />
        </section>
        <section className="aulas-ins-panel" aria-labelledby="aulas-cal-duracion" data-qa-geometry-member="duracion">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-cal-duracion">Duración que se aparta del resto</h3>
          </header>
          <AulasTiemposDeRespuesta tiempos={dashboard.tiempos} onDeclararUmbral={onDeclararUmbral ?? undefined} />
        </section>
      </div>
      <div className="aulas-ins-derecha" data-qa-geometry-member="derecha" data-qa-geometry-group="aulas-control-calidad-derecha" data-qa-geometry-contract="intrinsic">
        <section className="aulas-ins-panel" aria-labelledby="aulas-cal-libro" data-qa-geometry-member="libro">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-cal-libro">Base de control del libro</h3>
            <span className="aulas-ins-sub">lo que calcula el equipo</span>
          </header>
          {control.length ? (
            <AulasControlDelLibro
              filas={control}
              resumen={(dashboard.control_calidad_resumen ?? null) as ResumenDeControl | null}
              criterio={(dashboard.criterio_validez ?? null) as never}
              partes={(dashboard.partes_campo ?? []) as Array<Record<string, unknown>>}
            />
          ) : (
            <p className="aulas-ins-nota" data-qa-geometry-empty={dashboard.libro ? "legitimo" : "desconexion"}>
              {dashboard.libro
                ? "El libro todavía no trae filas en su base de control."
                : "Este estudio no importó el libro del operativo: la base de control sale de él."}
            </p>
          )}
        </section>
        <section className="aulas-ins-panel" aria-labelledby="aulas-cal-abiertas" data-qa-geometry-member="abiertas">
          <header className="aulas-ins-cabecera"><h3 id="aulas-cal-abiertas">Respuestas abiertas</h3></header>
          <AulasTextoAbierto bloque={dashboard.texto_abierto} />
        </section>
      </div>
    </section>
  );
}

export const CalidadAulas = memo(CalidadAulasImpl);
