import { BarChart3, Calculator, Loader2 } from "lucide-react";

import type { CalcMuestraComponente, CalcMuestraWorkspaceProducto } from "../../../api/calcMuestra";
import { EmptyState } from "../../../components/States";
import { presentResultadoPrecision } from "../resultadoPrecision";
import { fmtInt } from "../sharedCore";
import { SwapValor } from "../universidad/calculo/calculoUi";
import { AvisoModulo } from "../universidad/shared/AvisoModulo";
import { ajusteDeResultado, veredictoResultados, type VeredictoResultados } from "./bandaDisenoModelo";
import { productoLabel, tecnicaCalculadaLabel, tecnicaProducto } from "./catalogos";
import { avisosDelResultado, precisionEnPalabras } from "./modeloParametros";
import { filasDesdeActores, filasDesdeResultado } from "./repartoEstratos";
import { RepartoEstratosGrafico } from "./RepartoEstratosGrafico";
import { hayResultado, vacioDeResultados, type ModoMesa } from "./secciones";
import { useDesbordaHorizontal } from "./useDesbordaHorizontal";
import { useMuestraGeneralStore } from "./store";
import { useIrASeccionGeneral } from "./useMuestraGeneral";
import "../universidad/ui/ui.css";
import "./general.css";
import "./mesa.css";

export function ProductBadge({ producto }: { producto: CalcMuestraWorkspaceProducto }) {
  return <span className={`cmv2-product cmv2-product--${producto}`}>{productoLabel(producto)}</span>;
}

/**
 * Resultados de Muestra general y Acreditación: el n de cada componente, su
 * precisión, su ajuste y el reparto dibujado. Sin cálculo, el panel conserva
 * su caja, mide lo que su contenido y dice qué falta y por qué el reporte aún
 * no se puede generar (C3, G6).
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
  // Las corridas y marcos que la mesa ya hidrató (useDisenoVigente): el mismo
  // conteo de sorteos que la banda.
  const corridas = useMuestraGeneralStore((s) => s.corridas);
  const marcos = useMuestraGeneralStore((s) => s.marcos);
  const cargado = useMuestraGeneralStore((s) => s.cargado);
  const veredicto = vacio ? null : veredictoResultados({ modo, componentes, corridas, marcos, cargado });

  return (
    <section className="cmv2-panel cmv2-output cmg-resultados" aria-labelledby="cmg-resultados-titulo" data-vacio={vacio ? "true" : undefined} data-qa-geometry-member>
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Tabla de salida</span>
          <h3 id="cmg-resultados-titulo" className="cmg-panel-titulo">{titulo}</h3>
        </div>
      </div>
      {veredicto && <VeredictoFranja veredicto={veredicto} />}
      {/* Región viva persistente: los avisos que llegan con un cálculo nuevo
          se anuncian sin robar el foco. */}
      <div className="cmg-avisos-vivos" aria-live="polite">
        {!vacio && avisos.length > 0 && (
          <AvisoModulo tone="warn" role="note" title="Parámetros corregidos por el motor">
            <ul className="cmg-avisos-lista">
              {avisos.map(({ comp, aviso }) => (
                <li key={`${comp.id}-${aviso.param}`}>
                  {componentes.length > 1 ? <strong>{comp.actor}: </strong> : null}
                  {aviso.texto}
                </li>
              ))}
            </ul>
          </AvisoModulo>
        )}
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
            <button type="button" className="cmv2-primary" onClick={() => onCalcular()} disabled={calculando}>
              {calculando ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <Calculator size={14} aria-hidden="true" />}
              {vacio.accion.etiqueta}
            </button>
          )}
        />
      ) : (
        <>
          <div
            ref={ref}
            className="cmv2-table-wrap cmg-tabla-desplazable"
            data-desborda={desborda ? "true" : "false"}
            tabIndex={desborda ? 0 : undefined}
            aria-label={desborda ? "Tabla de resultados, desplazable" : undefined}
            role={desborda ? "region" : undefined}
          >
            <table className="cmv2-table cmg-resultados-tabla">
              <caption className="pulso-sr-only">n calculado por componente</caption>
              <thead>
                <tr>
                  <th scope="col">Componente</th>
                  <th scope="col">Producto</th>
                  <th scope="col" className="cmg-col-num">Marco</th>
                  <th scope="col" className="cmg-col-num">n objetivo</th>
                  <th scope="col" className="cmg-col-num">Operativo</th>
                  <th scope="col" className="cmg-col-num">Precisión</th>
                  <th scope="col">Ajuste</th>
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
                  const ajuste = ajusteDeResultado(comp, modo);
                  return (
                    <tr key={comp.id}>
                      <th scope="row">
                        <strong>{comp.actor}</strong>
                        <small>{tecnicaCalculadaLabel(comp)}</small>
                      </th>
                      <td><ProductBadge producto={tecnicaProducto(comp)} /></td>
                      <td className="cmg-col-num">{fmtInt(comp.marco.marco_validado)}</td>
                      {/* Recalcular cruza los n con el swap de aulas (E16 · M5):
                          sólo entre dos cifras reales, nunca «—» → cifra. */}
                      <td className="cmg-col-num"><SwapValor firma={fmtInt(r?.n_objetivo)}>{fmtInt(r?.n_objetivo)}</SwapValor></td>
                      <td className="cmg-col-num"><SwapValor firma={fmtInt(r?.n_operativo)}>{fmtInt(r?.n_operativo)}</SwapValor></td>
                      <td className="cmg-col-num">
                        {precisionEnPalabras(comp, precision.value)}
                        {precision.note && <small>{precision.note}</small>}
                      </td>
                      <td className="cmv2-note-cell">
                        {ajuste.texto}
                        {ajuste.nota && <small>{ajuste.nota}</small>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <SalidasAnidadas modo={modo} componentes={componentes} />
        </>
      )}
    </section>
  );
}

const TONO_VEREDICTO = { ok: "success", alerta: "warn", neutral: "neutral" } as const;

/**
 * La conclusión de Resultados antes que la tabla (patrón de aulas,
 * `CoberturaObjetivoStrip`). El tono lo dicen también el título y el ícono,
 * no sólo el color; `status` porque informa, no interrumpe.
 */
function VeredictoFranja({ veredicto }: { veredicto: VeredictoResultados }) {
  return (
    // Reusa la pila de avisos de la mesa (`cmg-avisos-vivos`: columna y
    // margen inferior) sin su aria-live: el `status` ya anuncia.
    <div className="cmg-avisos-vivos cmg-veredicto" data-tono={veredicto.tono}>
      <AvisoModulo tone={TONO_VEREDICTO[veredicto.tono]} role="status" title={veredicto.titulo}>
        <span>{veredicto.detalle}</span>
        {veredicto.falta && <> <strong>{veredicto.falta}</strong></>}
      </AvisoModulo>
    </div>
  );
}

function SalidasAnidadas({ modo, componentes }: { modo: ModoMesa; componentes: CalcMuestraComponente[] }) {
  const cuotas = componentes.flatMap((comp) => (comp.resultado?.cuotas_matriz ?? []).map((row) => ({ comp, row })));
  const conEstratos = componentes.filter((comp) => (comp.resultado?.distribucion_estratos?.length ?? 0) > 0);
  const actores = modo === "acreditacion" ? filasDesdeActores(componentes) : [];
  if (cuotas.length === 0 && conEstratos.length === 0 && actores.length === 0) return null;

  return (
    <div
      className="cmv2-nested-output cmg-salidas"
      data-qa-geometry-group="calc-muestra/general-salidas"
      data-qa-geometry-contract="intrinsic"
    >
      {actores.length > 0 && (
        <RepartoEstratosGrafico titulo="Meta y marco por actor" filas={actores} origen="actores" />
      )}
      {conEstratos.map((comp) => {
        const porFacultad = comp.actor_categoria === "estudiantes" && comp.canal_recojo === "aula_qr";
        const base = porFacultad ? "Distribución por facultad" : "Distribución por estrato";
        return (
          <RepartoEstratosGrafico
            key={comp.id}
            titulo={componentes.length > 1 ? `${base} · ${comp.actor}` : base}
            filas={filasDesdeResultado(comp.resultado?.distribucion_estratos ?? [])}
            origen="resultado"
          />
        );
      })}
      {cuotas.length > 0 && (
        <div>
          <h4 className="cmg-subtitulo">Matriz de cuotas</h4>
          <div className="cmv2-mini-table">
            {cuotas.map(({ comp, row }, i) => (
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
