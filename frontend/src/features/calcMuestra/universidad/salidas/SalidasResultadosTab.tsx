/**
 * Pestaña "Tablas" (id salidas-resultados) de la sección Salida. Primero el
 * gráfico de distribución por facultad y sexo (primer viewport visual, con la
 * distribución VALIDADA del motor); debajo las tablas de cierre por componente
 * (universidad / facultad) con su toggle "incluir en reporte" y un solo badge
 * de procedencia por tabla.
 */
import type {
  CalcMuestraComponente,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import { DistribucionFacultadSexo } from "../../didactica/DistribucionFacultadSexo";
import { BadgeMotor } from "../../didactica/PasoDidactico";
import { fmtInt, fmtPct } from "../../sharedCore";
import { ESCENARIOS_OPINION } from "../shared/constants";
import { hasUsefulResult, proposalShortLabel, universityDistributionRows } from "../shared/study";
import "../../didactica/didactica.css";
import "./salidas.css";

export function SalidasResultadosTab({
  componentes,
  workspace,
  onWorkspace,
}: {
  componentes: [CalcMuestraComponente, CalcMuestraComponente];
  workspace: CalcMuestraWorkspace;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
  const scenarios = workspace.escenarios.length ? workspace.escenarios : ESCENARIOS_OPINION;
  const activeScenario = scenarios.find((e) => e.activo);
  const chartComp =
    componentes.find((comp) => comp.id === activeScenario?.component_id && hasUsefulResult(comp)) ??
    componentes.find(hasUsefulResult) ??
    null;

  function toggleReporte(componentId: string, incluir: boolean) {
    onWorkspace({
      ...workspace,
      escenarios: scenarios.map((e) => (e.component_id === componentId ? { ...e, incluir_reporte: incluir } : e)),
    });
  }

  return (
    <div className="cmv2-sal-stack">
      {chartComp && <DistribucionFacultadSexo resultado={chartComp.resultado} />}

      <section className="cmv2-panel cmv2-sal-panel cmv2-university-results" aria-label="Tablas de cierre por componente">
        <div className="cmv2-panel-head">
          <div>
            <span className="cmv2-eyebrow">Resultados</span>
            <strong>Tablas de salida para el reporte</strong>
          </div>
        </div>
        <div className="cmv2-results-stack">
          {componentes.map((comp) => {
            const scenario = scenarios.find((e) => e.component_id === comp.id);
            const rows = universityDistributionRows(comp);
            const totals = rows.reduce(
              (acc, row) => ({
                N: acc.N + row.N,
                mujeres: acc.mujeres + row.mujeres,
                hombres: acc.hombres + row.hombres,
                n: acc.n + row.n,
              }),
              { N: 0, mujeres: 0, hombres: 0, n: 0 },
            );
            return (
              <article key={comp.id} className="cmv2-result-card">
                <div className="cmv2-result-head">
                  <div>
                    <span className="cmv2-eyebrow">{proposalShortLabel(comp)}</span>
                    <h3>{comp.actor}</h3>
                    {rows.length > 0 && <BadgeMotor estado="validado" />}
                  </div>
                  <label className="cmv2-report-check">
                    <input
                      type="checkbox"
                      checked={scenario?.incluir_reporte ?? false}
                      onChange={(e) => toggleReporte(comp.id, e.currentTarget.checked)}
                    />
                    Incluir en reporte
                  </label>
                </div>
                {rows.length === 0 ? (
                  <div className="cmv2-result-empty">Pendiente de cálculo</div>
                ) : (
                  <div className="cmv2-table-wrap">
                    <table className="cmv2-table cmv2-table--university">
                      <thead>
                        <tr>
                          <th>Facultad</th>
                          <th>Marco</th>
                          <th>Error usado</th>
                          <th>p usada</th>
                          <th>Mujeres</th>
                          <th>Hombres</th>
                          <th>Cuota total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.facultad}>
                            <td><strong>{row.facultad}</strong></td>
                            <td>{fmtInt(row.N)}</td>
                            <td>{fmtPct(row.error)}</td>
                            <td>{fmtPct(row.p)}</td>
                            <td>{fmtInt(row.mujeres)}</td>
                            <td>{fmtInt(row.hombres)}</td>
                            <td><strong>{fmtInt(row.n)}</strong></td>
                          </tr>
                        ))}
                        <tr className="cmv2-total-row">
                          <td><strong>Total</strong></td>
                          <td>{fmtInt(totals.N)}</td>
                          <td>—</td>
                          <td>—</td>
                          <td>{fmtInt(totals.mujeres)}</td>
                          <td>{fmtInt(totals.hombres)}</td>
                          <td><strong>{fmtInt(totals.n)}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
