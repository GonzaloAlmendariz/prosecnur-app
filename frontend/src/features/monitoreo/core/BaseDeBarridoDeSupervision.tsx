// La tarjeta «Base de barrido de supervisión» de Control › Supervisión, la
// misma en telefónico y acreditación (antes copiada en las dos páginas, con su
// propio `downloadRowsAsCsv`). El CSV se arma con lo que ya se ve y se entrega
// por el kit (ADR 0133, fase 5): el contenedor va en bloque bajo la cabecera.
// La tabla la pone cada perfil (`children`): cada página tiene la suya.

import type { ReactNode } from "react";

import { archivoCsv, csvDeFilas } from "../../../components/entregables/archivoLocal";
import { formatoConteo } from "../../../lib/formatoNumero";
import { Download } from "../../../vendor/lucide-react";
import { EntregaEnBloque } from "../entregas/EntregaEnBloque";
import { useEntrega } from "../entregas/useEntrega";

/** Lo que la tarjeta lee del plan de supervisión de cada perfil. */
export type PlanDeBarridoDeSupervision = {
  hasReadBase: boolean;
  rows: readonly unknown[];
  exportRows: Array<Record<string, unknown>>;
  targetTotal: number;
  selectedTotal: number;
  gapTotal: number;
};

/** «base-barrido-supervision-leida-2026-11-10.csv»: dice si es la base leída o la propuesta, y el día. */
export function nombreDeLaBaseDeBarrido(leida: boolean, hoy: Date = new Date()): string {
  return `base-barrido-supervision-${leida ? "leida" : "propuesta"}-${hoy.toISOString().slice(0, 10)}.csv`;
}

export function BaseDeBarridoDeSupervision({ plan, children }: { plan: PlanDeBarridoDeSupervision; children: ReactNode }) {
  const csv = useEntrega("Base de barrido de supervisión", { formato: "csv", articulo: "la" });
  const exportar = () => {
    void csv.ejecutar(async () => archivoCsv(csvDeFilas(plan.exportRows), nombreDeLaBaseDeBarrido(plan.hasReadBase)));
  };
  return (
    <section className="mon-phone-supervision-plan" aria-label="Base de barrido de supervisión">
      <header className="mon-phone-ops-head">
        <div>
          <span>Base de barrido de supervisión</span>
          <strong>{plan.hasReadBase ? "Lectura de base cargada" : "Propuesta 30% por responsable"}</strong>
        </div>
        <button type="button" className="mon-phone-supervision-export" onClick={exportar} disabled={!plan.exportRows.length || csv.enCurso}>
          <Download size={13} aria-hidden="true" />
          Exportar CSV
        </button>
      </header>
      <EntregaEnBloque entrega={csv} />
      <div className="mon-phone-supervision-plan-strip" aria-label="Resumen de muestra de supervisión">
        <span><em>Responsables</em><strong>{formatoConteo(plan.rows.length)}</strong></span>
        <span><em>Objetivo</em><strong>{formatoConteo(plan.targetTotal)}</strong></span>
        <span><em>{plan.hasReadBase ? "Leídos" : "Propuestos"}</em><strong>{formatoConteo(plan.selectedTotal)}</strong></span>
        <span className={plan.gapTotal ? "is-warning" : "is-ready"}><em>{plan.hasReadBase ? "Brecha" : "Por generar"}</em><strong>{formatoConteo(plan.gapTotal)}</strong></span>
      </div>
      {children}
    </section>
  );
}
