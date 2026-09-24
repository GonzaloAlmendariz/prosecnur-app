import { AlertTriangle, BarChart3, Calculator, Loader2 } from "lucide-react";

import type { CalcMuestraComponente, CalcMuestraWorkspaceProducto } from "../../../api/calcMuestra";
import { EmptyState } from "../../../components/States";
import { criterioSalida } from "../criterioSalida";
import { presentResultadoPrecision } from "../resultadoPrecision";
import { fmtInt } from "../sharedCore";
import { productoLabel, tecnicaCalculadaLabel, tecnicaProducto } from "./catalogos";
import { avisosDelResultado, precisionEnPalabras } from "./modeloParametros";
import { hayResultado, vacioDeResultados, type ModoMesa } from "./secciones";
import { useDesbordaHorizontal } from "./useDesbordaHorizontal";
import { useIrASeccionGeneral } from "./useMuestraGeneral";
import "./general.css";

export function ProductBadge({ producto }: { producto: CalcMuestraWorkspaceProducto }) {
  return <span className={`cmv2-product cmv2-product--${producto}`}>{productoLabel(producto)}</span>;
}

/**
 * Resultados de Muestra general y Acreditación: el n de cada componente, su
 * precisión y su criterio de salida. Sin cálculo, el panel conserva su caja y
 * dice qué falta y por qué el reporte aún no se puede generar (C3, G6).
 */
export function ResultadosComponentes({
  modo,
  componentes,
  calculando,
  onCalcular,
}: {
  modo: ModoMesa;
  componentes: CalcMuestraComponente[];
  calculando: boolean;
  onCalcular: () => void;
}) {
  const irASeccion = useIrASeccionGeneral();
  const { ref, desborda } = useDesbordaHorizontal<HTMLDivElement>();
  const productos = Array.from(new Set(componentes.map(tecnicaProducto)));
  const titulo = productos.length > 1 ? "Componentes mixtos calculables" : productoLabel(productos[0] ?? "muestra_probabilistica");
  const vacio = hayResultado(componentes) ? null : vacioDeResultados(modo, componentes);
  const avisos = componentes.flatMap((comp) => avisosDelResultado(comp).map((aviso) => ({ comp, aviso })));

  return (
    <section className="cmv2-panel cmv2-output" aria-labelledby="cmg-resultados-titulo">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Tabla de salida</span>
          <strong id="cmg-resultados-titulo">{titulo}</strong>
        </div>
      </div>
      {vacio ? (
        <EmptyState
          icon={<BarChart3 size={20} aria-hidden="true" />}
          title={vacio.titulo}
          hint={vacio.pista}
          cta={vacio.accion.seccion ? (
            <button type="button" className="cmv2-primary" onClick={() => irASeccion(vacio.accion.seccion ?? "")}>
              {vacio.accion.etiqueta}
            </button>
          ) : (
            <button type="button" className="cmv2-primary" onClick={onCalcular} disabled={calculando}>
              {calculando ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <Calculator size={14} aria-hidden="true" />}
              {vacio.accion.etiqueta}
            </button>
          )}
        />
      ) : (
        <>
          {avisos.length > 0 && (
            <ul className="cmg-avisos-resultado" aria-label="Parámetros corregidos por el motor">
              {avisos.map(({ comp, aviso }) => (
                <li key={`${comp.id}-${aviso.param}`}>
                  <AlertTriangle size={13} aria-hidden="true" />
                  <span>{componentes.length > 1 ? `${comp.actor}: ` : ""}{aviso.texto}</span>
                </li>
              ))}
            </ul>
          )}
          <div
            ref={ref}
            className="cmv2-table-wrap cmg-tabla-desplazable"
            data-desborda={desborda ? "true" : "false"}
            tabIndex={desborda ? 0 : undefined}
            aria-label={desborda ? "Tabla de resultados, desplazable" : undefined}
            role={desborda ? "region" : undefined}
          >
            <table className="cmv2-table">
              <thead>
                <tr>
                  <th>Componente</th>
                  <th>Producto</th>
                  <th>Marco</th>
                  <th>n objetivo</th>
                  <th>Operativo</th>
                  <th>Precisión</th>
                  <th>Ajuste</th>
                </tr>
              </thead>
              <tbody>
                {componentes.map((comp) => {
                  const r = comp.resultado;
                  const precision = presentResultadoPrecision({
                    naturaleza: comp.naturaleza,
                    precisionAlcanzada: r?.precision_alcanzada,
                    coberturaObjetivo: r?.cobertura_objetivo,
                  });
                  return (
                    <tr key={comp.id}>
                      <td>
                        <strong>{comp.actor}</strong>
                        <small>{tecnicaCalculadaLabel(comp)}</small>
                      </td>
                      <td><ProductBadge producto={tecnicaProducto(comp)} /></td>
                      <td>{fmtInt(comp.marco.marco_validado)}</td>
                      <td>{fmtInt(r?.n_objetivo)}</td>
                      <td>{fmtInt(r?.n_operativo)}</td>
                      <td>
                        {precisionEnPalabras(comp, precision.value)}
                        {precision.note && <small>{precision.note}</small>}
                      </td>
                      <td className="cmv2-note-cell">{criterioSalida(comp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <SalidasAnidadas componentes={componentes} />
        </>
      )}
    </section>
  );
}

function SalidasAnidadas({ componentes }: { componentes: CalcMuestraComponente[] }) {
  const rows = componentes.flatMap((comp) => (comp.resultado?.cuotas_matriz ?? []).map((row) => ({ comp, row })));
  const estratos = componentes.flatMap((comp) => (comp.resultado?.distribucion_estratos ?? []).map((row) => ({ comp, row })));
  if (rows.length === 0 && estratos.length === 0) return null;
  const estratosTitle = estratos.some(({ comp }) => comp.actor_categoria === "estudiantes" && comp.canal_recojo === "aula_qr")
    ? "Distribución por facultad"
    : "Distribución por estrato";
  return (
    <div className="cmv2-nested-output">
      {estratos.length > 0 && (
        <div>
          <h4>{estratosTitle}</h4>
          <div className="cmv2-mini-table" data-qa-geometry-group="calc-muestra/general-reparto" data-qa-geometry-contract="equal">
            {estratos.map(({ comp, row }, i) => (
              <span key={`${comp.id}-estrato-${i}`}>
                <strong>{row.estrato}</strong>
                <em>N {fmtInt(row.N)} · {fmtInt(row.n)} completas{row.n_campo != null ? ` · ${fmtInt(row.n_campo)} a campo` : ""}</em>
              </span>
            ))}
          </div>
        </div>
      )}
      {rows.length > 0 && (
        <div>
          <h4>Matriz de cuotas</h4>
          <div className="cmv2-mini-table">
            {rows.map(({ comp, row }, i) => (
              <span key={`${comp.id}-cuota-${i}`}>
                <strong>{row.territorio} · {row.servicio}</strong>
                <em>N {fmtInt(row.N)} · n {fmtInt(row.n)}</em>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
