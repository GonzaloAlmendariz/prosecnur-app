import { memo, type ReactNode } from "react";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { AulasCadenaDeFiltros } from "../AulasCadenaDeFiltros";
import { AulasUmbralDeDuracion } from "../AulasUmbralDeDuracion";
import { fmt } from "../kpisDeAulas";
import type { ContextoDeInsumos } from "./contextoDeInsumos";
import { construirReglas, readinessDeReglas } from "./reglasModelo";
import "./insumos.css";

function Panel({ id, titulo, sub, children }: { id: string; titulo: string; sub?: string; children: ReactNode }) {
  return (
    <section className="aulas-ins-panel" aria-labelledby={id} data-qa-geometry-member={id}>
      <header className="aulas-ins-cabecera">
        <h3 id={id}>{titulo}</h3>
        {sub ? <span className="aulas-ins-sub">{sub}</span> : null}
      </header>
      {children}
    </section>
  );
}

/**
 * Insumos › Reglas (ficha I2). Tres columnas: qué cuenta como efectiva y lo que
 * no cuenta por grupo; el eje de la cuota y cómo se mide; la duración
 * sospechosa y cuándo un curso-horario se da por aplicado. Los paneles que
 * guardan los construye la página; esta vista los ordena.
 */
function ReglasAulasImpl({ dashboard, cargando, vacioSinTablero, contexto }: {
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  vacioSinTablero: ReactNode;
  contexto: ContextoDeInsumos;
}) {
  const readiness = readinessDeReglas(cargando, dashboard);
  if (cargando) return <section className="aulas-ins aulas-ins--silueta" aria-label="Reglas" aria-busy="true" data-audit-ready={readiness} />;
  if (!dashboard) return <section className="aulas-ins" aria-label="Reglas" data-audit-ready={readiness}>{vacioSinTablero}</section>;
  const m = construirReglas(dashboard);

  return (
    <section
      className="aulas-ins aulas-ins--tres"
      aria-label="Reglas"
      data-audit-ready={readiness}
      data-qa-geometry-group="aulas-insumos-reglas"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="aulas-ins-columna" data-qa-geometry-member="efectiva">
        <Panel id="aulas-ins-efectiva" titulo="Qué cuenta como encuesta efectiva" sub="se cumplen todas las condiciones">
          <AulasCadenaDeFiltros bloque={dashboard.cadena_filtros} />
          {contexto.criterioDeEfectiva ?? (
            <p className="aulas-ins-nota" data-qa-geometry-empty="legitimo">
              Sin variables en la base todavía: el criterio se declara cuando llegan las primeras respuestas.
            </p>
          )}
        </Panel>
        {m.noCuenta ? (
          <Panel id="aulas-ins-nocuenta" titulo={m.noCuenta.titulo} sub="lo que más se pierde, arriba">
            <div className="aulas-ins-tabla-marco" data-qa-geometry-capacity="owned">
              <table className="aulas-ins-tabla" aria-labelledby="aulas-ins-nocuenta">
                <thead>
                  <tr>
                    <th scope="col">Grupo</th>
                    <th scope="col" className="is-num">Leídas</th>
                    <th scope="col" className="is-num">Efectivas</th>
                    <th scope="col" className="is-num" title="No pasan el criterio de efectiva">No pasan</th>
                    <th scope="col" className="is-num">Fuera</th>
                  </tr>
                </thead>
                <tbody>
                  {m.noCuenta.filas.map((f) => (
                    <tr key={f.grupo}>
                      <th scope="row">{f.grupo}</th>
                      <td className="is-num">{fmt(f.leidas)}</td>
                      <td className="is-num">{fmt(f.efectivas)}</td>
                      <td className="is-num">{fmt(f.noPasan)}</td>
                      <td className="is-num">{fmt(f.fuera)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">{m.noCuenta.total.grupo}</th>
                    <td className="is-num">{fmt(m.noCuenta.total.leidas)}</td>
                    <td className="is-num">{fmt(m.noCuenta.total.efectivas)}</td>
                    <td className="is-num">{fmt(m.noCuenta.total.noPasan)}</td>
                    <td className="is-num">{fmt(m.noCuenta.total.fuera)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>
        ) : null}
      </div>

      <div className="aulas-ins-columna" data-qa-geometry-member="eje">
        <Panel id="aulas-ins-eje" titulo="Eje de la cuota y cómo se mide" sub="de qué son los grupos y desde cuándo es campo">
          {contexto.comoMide ?? (
            <p className="aulas-ins-nota" data-qa-geometry-empty="legitimo">El eje se declara cuando el plan está importado.</p>
          )}
        </Panel>
      </div>

      <div className="aulas-ins-columna" data-qa-geometry-member="duracion">
        <Panel id="aulas-ins-duracion" titulo="Duración sospechosa" sub={m.duracion.resumen}>
          {contexto.onDeclararUmbralDeDuracion ? (
            <AulasUmbralDeDuracion
              declarado={m.duracion.declarado}
              minutos={m.duracion.minutos}
              onDeclarar={contexto.onDeclararUmbralDeDuracion}
              leyenda={m.duracion.declarado
                ? `Ahora se marcan las de menos de ${m.duracion.minutos} min.`
                : "Cuánto tiene que durar una respuesta para contar."}
            />
          ) : (
            <p className="aulas-ins-nota" data-qa-geometry-empty="legitimo">El umbral se declara cuando el estudio se puede guardar.</p>
          )}
        </Panel>
        <Panel id="aulas-ins-aplicado" titulo="Cuándo un curso-horario se da por aplicado">
          {contexto.criterioDeAula ?? (
            <p className="aulas-ins-nota" data-qa-geometry-empty="legitimo">Sin plan importado todavía.</p>
          )}
        </Panel>
      </div>
    </section>
  );
}

export const ReglasAulas = memo(ReglasAulasImpl);
