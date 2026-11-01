import { memo, useMemo, useState, type ReactNode } from "react";

import type { MonitoreoAulasDashboard, MonitoreoAulasPlanRow } from "../../../../../api/monitoreo";
import { AulasBrechasDelCorte } from "../AulasBrechasDelCorte";
import { AulasRefuerzosPedidos } from "../AulasRefuerzosPedidos";
import { AulasTresCaminos } from "../AulasTresCaminos";
import { fmt } from "../kpisDeAulas";
import { PopoverDeRelevo } from "../PopoversDeCaso";
import { useMarcarRefuerzo } from "../useMarcarRefuerzo";
import "../insumos/insumos.css";

export const MARCA_BRECHAS_AULAS = "monitoreo-aulas-control-brechas";
export function readinessDeBrechas(cargando: boolean, dashboard: MonitoreoAulasDashboard | null): string {
  if (cargando) return "false";
  return dashboard ? MARCA_BRECHAS_AULAS : "vacio:sin-tablero";
}

/** Las brechas del motor con su fila del plan detrás: la de brechas manda en `brecha` y `respuestas_validas`. */
export function brechasConPlan(dashboard: MonitoreoAulasDashboard): MonitoreoAulasPlanRow[] {
  const plan = new Map<string, Record<string, unknown>>();
  for (const f of (dashboard.agenda ?? []) as Array<Record<string, unknown>>) {
    const c = String(f.operational_code ?? f.classroom_id ?? "").trim();
    if (c) plan.set(c, f);
  }
  return ((dashboard.brechas ?? []) as Array<Record<string, unknown>>).map((b) => {
    const suya = plan.get(String(b.operational_code ?? b.classroom_id ?? "").trim());
    return (suya ? { ...suya, ...b } : b) as unknown as MonitoreoAulasPlanRow;
  });
}

/**
 * Control › Brechas (ficha Ctl7, grupo Casos). ¿Qué pasó y por dónde se sale?
 * A la izquierda, los tres caminos (reemplazo A, complemento B, refuerzo C) y
 * los cursos-horario con brecha, cada uno con su relevo; a la derecha, los
 * refuerzos pedidos y en qué punto está su gestión. Los popovers son los
 * mismos que abre Consultas (PopoversDeCaso.tsx).
 */
function BrechasAulasImpl({ dashboard, cargando, vacioSinTablero, onGuardado }: {
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  vacioSinTablero: ReactNode;
  onGuardado?: () => void;
}) {
  const [relevoDe, setRelevoDe] = useState("");
  const marca = useMarcarRefuerzo(onGuardado);
  const brechas = useMemo(() => (dashboard ? brechasConPlan(dashboard) : []), [dashboard]);
  const readiness = readinessDeBrechas(cargando, dashboard);
  if (cargando) return <section className="aulas-ins aulas-ins--silueta" aria-label="Brechas" aria-busy="true" data-audit-ready={readiness} />;
  if (!dashboard) return <section className="aulas-ins" aria-label="Brechas" data-audit-ready={readiness}>{vacioSinTablero}</section>;
  const plan = (dashboard.agenda ?? []) as unknown as MonitoreoAulasPlanRow[];

  return (
    <section
      className="aulas-ins aulas-ins--apl"
      aria-label="Brechas"
      data-audit-ready={readiness}
      data-qa-geometry-group="aulas-control-brechas"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="aulas-ins-izquierda" data-qa-geometry-member="izquierda" data-qa-geometry-group="aulas-control-brechas-izquierda" data-qa-geometry-contract="intrinsic">
        <section className="aulas-ins-panel" aria-labelledby="aulas-br-caminos" data-qa-geometry-member="caminos">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-br-caminos">Los tres caminos</h3>
            <span className="aulas-ins-sub">reemplazo (A), complemento (B), refuerzo (C)</span>
          </header>
          <AulasTresCaminos filas={plan} porTipo={(dashboard.reemplazos_por_tipo ?? null) as Record<string, unknown> | null} />
        </section>
        <section className="aulas-ins-panel" aria-labelledby="aulas-br-brechas" data-qa-geometry-member="brechas">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-br-brechas">Cursos-horario con brecha</h3>
            <span className="aulas-ins-sub">{fmt(brechas.length)} · el diagnóstico decide si toca B o C</span>
          </header>
          <AulasBrechasDelCorte filas={brechas} onRelevo={(codigo) => setRelevoDe(codigo)} />
        </section>
      </div>
      <section className="aulas-ins-panel" aria-labelledby="aulas-br-pedidos" data-qa-geometry-member="pedidos">
        <header className="aulas-ins-cabecera">
          <h3 id="aulas-br-pedidos">Refuerzos pedidos</h3>
          <span className="aulas-ins-sub">a dónde fue lo marcado</span>
        </header>
        <AulasRefuerzosPedidos plan={plan} onGuardado={onGuardado} />
      </section>
      {marca.aviso || marca.fallos.length ? (
        <p className="aulas-ins-pie" role="status">
          {marca.aviso}{marca.fallos.length ? ` No se pudo marcar ${marca.fallos.map((f) => f.codigo).join(", ")}: ${marca.fallos[0]?.motivo}` : ""}
        </p>
      ) : null}
      {relevoDe ? (
        <PopoverDeRelevo dashboard={dashboard} codigo={relevoDe} marcar={marca.marcar} onCerrar={() => setRelevoDe("")} />
      ) : null}
    </section>
  );
}

export const BrechasAulas = memo(BrechasAulasImpl);
