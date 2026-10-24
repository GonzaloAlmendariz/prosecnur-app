import { useMemo } from "react";
import { Alert } from "../../../../../../components/Alert";
import type { MonitoreoInternalQueries } from "../../../../../../api/client";
import { usePanelDireccionable, type PanelDeclarado } from "../../../../../../lib/navegacion/paneles";
import { useFocoMonitoreo } from "../../../../useMonitoreoDireccion";
import { fmt } from "../../formato";
import { fechaCorta } from "../../avance/graficosDeAvance";
import { casosDelCorte, type GrupoDeCaso } from "./tiposDeCaso";
import { filasDeCola, filtrarCola, tipoInicial } from "./porResolverModelo";
import type { PayloadDeDecision } from "./porResolverModelo";
import { PanelCaso, type EstadoDeGuardado } from "./PanelCaso";
import { useFiltrosPorResolver } from "./porResolverStore";
import "../../avance/avance.css";
import "./porResolver.css";
import { CabeceraDeTarjeta } from "../../navegacion/rotuloDePestana";

/** El caso elegido es un panel direccionable: `panel=caso&foco=<response_id>`. */
export const PANEL_CASO: PanelDeclarado = { id: "caso", label: "Caso por resolver", clase: "inspector" };

const GRUPOS: Array<{ grupo: GrupoDeCaso; titulo: string }> = [
  { grupo: "espera", titulo: "Esperan decisión" },
  { grupo: "decidido", titulo: "Decididos por el supervisor" },
  { grupo: "regla", titulo: "Resueltos por regla" },
];

const ROTULO_DE_DECISION = { asignada: "Asignada", descartada: "Descartada" } as const;

/**
 * Control › Por resolver (ficha Ctl5): las respuestas que esperan una
 * decisión del supervisor. A la izquierda los tipos de caso con su cifra (la
 * misma de Avance › Resumen y de la insignia de Control) y el público; al
 * centro la cola del tipo elegido; a la derecha el caso, con la asignación a
 * una persona del padrón y la decisión auditada de siempre.
 */
export function PorResolver({
  consultas,
  ocupadoId,
  estado,
  onDecision,
}: {
  consultas: MonitoreoInternalQueries;
  ocupadoId?: string;
  estado?: EstadoDeGuardado;
  onDecision?: (payload: PayloadDeDecision) => void;
}) {
  const filtros = useFiltrosPorResolver();
  const panel = usePanelDireccionable(PANEL_CASO);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const casos = consultas.cases.length ? consultas.cases : consultas.case_rollup ?? [];
  const filas = useMemo(() => filasDeCola(consultas.issues, casos), [consultas.issues, casos]);
  const resumen = useMemo(() => casosDelCorte(consultas.issues, filtros.publico ? (actor) => actor === filtros.publico : undefined), [consultas.issues, filtros.publico]);
  const publicos = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const fila of filas) if (fila.grupo === "espera" && !fila.decision) cuenta.set(fila.publico, (cuenta.get(fila.publico) ?? 0) + 1);
    return [...new Set(filas.map((fila) => fila.publico))]
      .map((publico) => ({ publico, esperan: cuenta.get(publico) ?? 0 }))
      .sort((a, b) => b.esperan - a.esperan || a.publico.localeCompare(b.publico, "es"));
  }, [filas]);
  const tipo = filtros.tipo ?? tipoInicial(filas);
  const cola = useMemo(() => filtrarCola(filas, { tipo, publico: filtros.publico }), [filas, tipo, filtros.publico]);
  const elegida = panel.abierto && foco ? filas.find((fila) => fila.responseId === foco) ?? null : null;
  const enPanel = elegida ?? cola[0] ?? null;
  const tipoActual = resumen.porTipo.find((item) => item.tipo === tipo);

  if (!filas.length) {
    return (
      <div className="acr-pr is-vacio" data-vacio>
        <Alert kind="info">Nada espera tu decisión: el corte no marca casos para revisar.</Alert>
      </div>
    );
  }

  return (
    <div className="acr-pr" data-qa-geometry-group="acreditacion-control-resolver" data-qa-geometry-contract="intrinsic">
      <nav className="acr-av-panel acr-pr-filtros" aria-label="Tipos de caso">
        <div className="acr-pr-filtros-cuerpo" data-qa-geometry-capacity="owned">
          {GRUPOS.map(({ grupo, titulo }) => {
            const tipos = resumen.porTipo.filter((item) => item.grupo === grupo);
            if (!tipos.length) return null;
            const total = tipos.reduce((suma, item) => suma + item.casos, 0);
            return (
              <section key={grupo} className="acr-pr-grupo">
                <h3 className="acr-av-antetitulo">{titulo} <span className="acr-av-num">{fmt(total)}</span></h3>
                <ul>
                  {tipos.map((item) => (
                    <li key={item.tipo}>
                      <button
                        type="button"
                        className={item.tipo === tipo ? "is-activo" : undefined}
                        aria-pressed={item.tipo === tipo}
                        onClick={() => { filtros.elegirTipo(item.tipo); escribirFoco(null, { panel: null }); }}
                      >
                        {grupo === "espera" ? <span className="acr-res-punto" aria-hidden="true" /> : null}
                        <span>{item.etiqueta}</span>
                        <b className="acr-av-num">{fmt(item.casos)}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          <section className="acr-pr-grupo">
            <h3 className="acr-av-antetitulo">Público</h3>
            <ul>
              <li>
                <button type="button" className={!filtros.publico ? "is-activo" : undefined} aria-pressed={!filtros.publico} onClick={() => filtros.elegirPublico(null)}>
                  <span>Todos los públicos</span>
                </button>
              </li>
              {publicos.map((item) => (
                <li key={item.publico}>
                  <button
                    type="button"
                    className={filtros.publico === item.publico ? "is-activo" : undefined}
                    aria-pressed={filtros.publico === item.publico}
                    onClick={() => filtros.elegirPublico(item.publico)}
                  >
                    <span>{item.publico}</span>
                    {item.esperan ? <b className="acr-av-num">{fmt(item.esperan)}</b> : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </nav>

      <section className="acr-av-panel acr-pr-cola" aria-label="Cola del tipo elegido">
        <CabeceraDeTarjeta primera>
          <h3>
            {tipoActual?.etiqueta ?? "Casos"}
            <span className="acr-av-tenue">
              {cola.length === (tipoActual?.casos ?? cola.length)
                ? `${fmt(cola.length)} ${cola.length === 1 ? "caso" : "casos"}`
                : `${fmt(cola.length)} ${cola.length === 1 ? "respuesta" : "respuestas"} con ${fmt(tipoActual?.casos ?? 0)} casos`}
            </span>
          </h3>
        </CabeceraDeTarjeta>
        <div className="acr-pr-cola-marco" data-qa-geometry-capacity="owned">
          {cola.length ? (
            <table className="acr-pub-tabla acr-pr-tabla">
              <thead>
                <tr>
                  <th scope="col">Respuesta</th>
                  <th scope="col">Público</th>
                  <th scope="col">Canal</th>
                  <th scope="col">Llave</th>
                  <th scope="col" className="is-num">Respondido</th>
                  <th scope="col" className="is-num">Recibida</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cola.map((fila) => {
                  const activa = enPanel?.clave === fila.clave;
                  return (
                    <tr key={fila.clave} className={activa ? "is-activa" : undefined} aria-selected={activa}>
                      <th scope="row">
                        <button
                          type="button"
                          className="acr-pub-nombre acr-av-num"
                          onClick={() => escribirFoco(fila.responseId || null, { panel: fila.responseId ? PANEL_CASO.id : null })}
                        >
                          {fila.responseId || "Sin identificador"}
                        </button>
                      </th>
                      <td>{fila.publico}</td>
                      <td>{fila.canal}</td>
                      <td className="acr-av-num">{fila.llave}</td>
                      <td className="is-num">{fila.completitud}</td>
                      <td className="is-num">{fila.fecha ? fechaCorta(fila.fecha) : "—"}</td>
                      <td>
                        {fila.decision
                          ? <span className={`acr-av-chip${fila.decision === "asignada" ? " is-cumple" : ""}`}>{ROTULO_DE_DECISION[fila.decision]}</span>
                          : fila.grupo === "espera"
                            ? <span className="acr-av-chip is-falta">Espera</span>
                            : <span className="acr-av-chip">Por regla</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="acr-pr-cola-vacia" data-vacio>
              <Alert kind="info">Este público no tiene casos de este tipo.</Alert>
            </div>
          )}
        </div>
      </section>

      {enPanel ? (
        <PanelCaso
          fila={enPanel}
          elegido={Boolean(elegida)}
          ocupado={Boolean(ocupadoId) && ocupadoId === enPanel.responseId}
          estado={estado ?? null}
          onDecision={onDecision}
          onCerrar={() => escribirFoco(null, { panel: null })}
        />
      ) : null}
    </div>
  );
}
