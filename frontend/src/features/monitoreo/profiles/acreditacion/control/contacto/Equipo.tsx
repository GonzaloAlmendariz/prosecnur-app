import { useMemo } from "react";
import { CheckCircle2, Users } from "lucide-react";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../../api/client";
import { fmt } from "../../formato";
import { marcasDeEje } from "../../avance/avanceModelo";
import { useTamano } from "../../avance/graficosDeAvance";
import type { FamiliaDelCliente } from "../../../telefonico/control/familiasDelCliente";
import { ROTULO_DE_FAMILIA } from "./barridoModelo";
import { construirEquipo, umbralesDelPerfil, type ModeloDeEquipo, type ResponsableDelEquipo } from "./equipoModelo";
import "../../avance/avance.css";
import "./contacto.css";
import { CabeceraDeTarjeta } from "../../navegacion/rotuloDePestana";
import { PestanaSinContenido, VacioDeBloque } from "../../piezas/AvisoDeTarjeta";

const FAMILIAS: FamiliaDelCliente[] = ["efectiva", "reintentable", "terminal", "rechazo", "parcial", "sin-llamar"];

function pctEntero(valor: number | null) {
  return valor == null ? "—" : `${fmt(Math.round(valor * 100))} %`;
}

/** Carga (asignados) frente a efectividad (efectivas sobre asignados); el tamaño dice los barridos. */
function CargaFrenteAEfectividad({ responsables }: { responsables: readonly ResponsableDelEquipo[] }) {
  const [ref, { ancho, alto }] = useTamano<HTMLDivElement>();
  const puntos = responsables.filter((item) => !item.sinAsignar && item.efectividad != null);
  const izquierda = 44;
  const derecha = 16;
  const arriba = 18;
  const abajo = 34;
  const w = Math.max(0, ancho - izquierda - derecha);
  const h = Math.max(0, alto - arriba - abajo);
  const marcasX = marcasDeEje(Math.max(1, ...puntos.map((item) => item.asignados)) * 1.05);
  const maxX = marcasX.at(-1) ?? 1;
  const maxBarridos = Math.max(1, ...puntos.map((item) => item.barridos));
  const x = (valor: number) => izquierda + (valor / maxX) * w;
  const y = (valor: number) => arriba + h - valor * h;
  const radio = (barridos: number) => 6 + Math.sqrt(barridos / maxBarridos) * 9;
  // Rótulos sin pisarse: de arriba abajo, cada uno al menos 15 px bajo el anterior.
  const rotulos = [...puntos].sort((a, b) => y(a.efectividad ?? 0) - y(b.efectividad ?? 0));
  const posicion = new Map<string, number>();
  let ultimo = -Infinity;
  rotulos.forEach((item) => {
    const deseado = y(item.efectividad ?? 0) + 4;
    const final = Math.max(deseado, ultimo + 15);
    posicion.set(item.nombre, final);
    ultimo = final;
  });
  return (
    <div ref={ref} className="acr-av-grafico" role="img" aria-label={puntos.map((item) => `${item.nombre}: ${fmt(item.asignados)} asignados, ${pctEntero(item.efectividad)} de efectividad`).join("; ")}>
      {ancho > 0 && alto > 0 && puntos.length ? (
        <svg width={ancho} height={alto} aria-hidden="true">
          <text className="acr-av-eje-titulo" x={0} y={10}>Efectivas sobre asignados</text>
          {[0, 0.25, 0.5, 0.75, 1].map((valor) => (
            <g key={valor}>
              <line className="acr-av-reticula" x1={izquierda} x2={izquierda + w} y1={y(valor)} y2={y(valor)} />
              <text className="acr-av-eje" x={izquierda - 6} y={y(valor) + 4} textAnchor="end">{`${valor * 100} %`}</text>
            </g>
          ))}
          {marcasX.map((valor) => (
            <text key={valor} className="acr-av-eje" x={x(valor)} y={arriba + h + 16} textAnchor="middle">{fmt(valor)}</text>
          ))}
          <text className="acr-av-eje" x={izquierda + w / 2} y={alto - 2} textAnchor="middle">Casos asignados</text>
          {puntos.map((item) => (
            <circle key={item.nombre} className="acr-ct-punto" cx={x(item.asignados)} cy={y(item.efectividad ?? 0)} r={radio(item.barridos)} />
          ))}
          {puntos.map((item) => {
            const cx = x(item.asignados);
            const ly = posicion.get(item.nombre) ?? 0;
            // Los círculos que cruzan la línea del rótulo lo empujan: el rótulo
            // empieza después del último (o termina antes del primero).
            const enLinea = puntos.filter((otro) => {
              const cy = y(otro.efectividad ?? 0);
              const r = radio(otro.barridos);
              return cy + r >= ly - 11 && cy - r <= ly + 3;
            });
            const derechaLibre = cx < izquierda + w * 0.62;
            const xDerecha = Math.max(cx + radio(item.barridos), ...enLinea.filter((otro) => x(otro.asignados) >= cx).map((otro) => x(otro.asignados) + radio(otro.barridos))) + 6;
            const xIzquierda = Math.min(cx - radio(item.barridos), ...enLinea.filter((otro) => x(otro.asignados) <= cx).map((otro) => x(otro.asignados) - radio(otro.barridos))) - 6;
            return (
              <text
                key={item.nombre}
                className="acr-ct-punto-rotulo"
                x={derechaLibre ? xDerecha : xIzquierda}
                y={ly}
                textAnchor={derechaLibre ? "start" : "end"}
              >
                {`${item.nombre}, ${pctEntero(item.efectividad)}`}
              </text>
            );
          })}
        </svg>
      ) : null}
    </div>
  );
}

export function EquipoVista({ modelo }: { modelo: ModeloDeEquipo }) {
  return (
    <div className="acr-ct is-equipo" data-qa-geometry-group="acreditacion-control-equipo" data-qa-geometry-contract="intrinsic">
      <section className="acr-av-panel acr-ct-equipo-tabla" aria-label="Carga y resultado">
        <CabeceraDeTarjeta primera>
          <h3>Carga y resultado</h3>
        </CabeceraDeTarjeta>
        <div className="acr-pr-cola-marco" data-qa-geometry-capacity="owned">
          <table className="acr-pub-tabla">
            <thead>
              <tr>
                <th scope="col">Responsable</th>
                <th scope="col">Estado de sus casos</th>
                <th scope="col" className="is-num">Asignados</th>
                <th scope="col" className="is-num">Barridos</th>
                <th scope="col" className="is-num">Efectivas</th>
                <th scope="col" className="is-num">Conciliadas</th>
                <th scope="col" className="is-num">Sin barrer</th>
                <th scope="col" className="is-num">Sin efectiva</th>
              </tr>
            </thead>
            <tbody>
              {modelo.responsables.map((item) => (
                <tr key={item.nombre} className={item.sinAsignar ? "is-sin-asignar" : undefined}>
                  <th scope="row">{item.nombre}</th>
                  <td>
                    <span className="acr-ct-carga" style={{ width: `${Math.max(2, (item.asignados / modelo.maximaCarga) * 100)}%` }}>
                      <span className="acr-av-apilada" role="img" aria-label={FAMILIAS.filter((familia) => item.familias[familia]).map((familia) => `${ROTULO_DE_FAMILIA[familia]}: ${fmt(item.familias[familia])}`).join("; ") || `${fmt(item.asignados)} casos`}>
                        {FAMILIAS.map((familia) => (item.familias[familia] ? (
                          <span key={familia} className={`is-familia-${familia}`} style={{ flexGrow: item.familias[familia] }} />
                        ) : null))}
                      </span>
                    </span>
                  </td>
                  <td className="is-num">{fmt(item.asignados)}</td>
                  <td className="is-num">{fmt(item.barridos)}</td>
                  <td className="is-num"><b>{fmt(item.efectivas)}</b></td>
                  <td className="is-num">{item.conciliadas == null ? "—" : fmt(item.conciliadas)}</td>
                  <td className="is-num">
                    <span className={`acr-av-chip${!item.sinAsignar && (item.pctSinBarrer ?? 0) >= 0.2 ? " is-falta" : ""}`}>{pctEntero(item.pctSinBarrer)}</span>
                  </td>
                  <td className="is-num">{item.sinAsignar ? "—" : pctEntero(item.pctIncidencias)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <span className="acr-av-leyenda is-centrada" aria-label="Estado de sus casos">
          {FAMILIAS.filter((familia) => modelo.responsables.some((item) => item.familias[familia])).map((familia) => (
            <span key={familia}><i className={`acr-av-punto is-familia-${familia}`} aria-hidden="true" />{ROTULO_DE_FAMILIA[familia]}</span>
          ))}
        </span>
        <footer className="acr-ct-pie" data-qa-geometry-group="acreditacion-equipo-totales" data-qa-geometry-contract="equal">
          <div className="acr-res-kpi" data-qa-geometry-member><small>Asignados</small><b className="acr-av-num">{fmt(modelo.total.asignados)}</b></div>
          <div className="acr-res-kpi" data-qa-geometry-member><small>Barridos</small><b className="acr-av-num">{fmt(modelo.total.barridos)}</b></div>
          <div className="acr-res-kpi" data-qa-geometry-member><small>Efectivas al teléfono</small><b className="acr-av-num">{fmt(modelo.total.efectivas)}</b></div>
          <div className="acr-res-kpi" data-qa-geometry-member><small>Sin asignar</small><b className="acr-av-num">{fmt(modelo.total.sinAsignar)}</b></div>
        </footer>
      </section>
      <div className="acr-ct-columna is-equipo">
        <section className="acr-av-panel" aria-label="Carga frente a efectividad">
          <header className="acr-av-panel-cabecera">
            <h3>Carga frente a efectividad <span className="acr-av-tenue">El tamaño indica los barridos</span></h3>
          </header>
          <div className="acr-ct-grafico is-dispersion" data-qa-geometry-capacity="owned">
            <CargaFrenteAEfectividad responsables={modelo.responsables} />
          </div>
        </section>
        <section className="acr-av-panel" aria-label="Alertas del equipo">
          <header className="acr-av-panel-cabecera"><h3>Alertas del equipo</h3></header>
          {modelo.alertas.length ? (
            <ul className="acr-ct-alertas">
              {modelo.alertas.map((alerta) => (
                <li key={alerta.clave} className={`is-${alerta.tono}`}>
                  <span className="acr-res-punto" aria-hidden="true" />
                  <span>{alerta.texto}</span>
                  <b className="acr-av-num">{fmt(alerta.casos)}</b>
                </li>
              ))}
            </ul>
          ) : <VacioDeBloque icono={<CheckCircle2 size={15} />} titulo="Ningún responsable pasa los umbrales del perfil." descripcion="Los umbrales se editan en Insumos › Reglas." />}
        </section>
      </div>
    </div>
  );
}

/** Control › Equipo (ficha Ctl4): cómo rinde cada responsable del barrido. */
export function Equipo({ reports, state }: { reports: MonitoreoAcreditacionReports; state: MonitoreoState | null | undefined }) {
  const reglas = state?.config?.operational_model?.state_rules;
  const alertas = state?.config?.monitoreo_profile?.alerts;
  const modelo = useMemo(
    () => construirEquipo(reports, reglas ?? [], umbralesDelPerfil(alertas)),
    [reports, reglas, alertas],
  );
  if (!modelo.responsables.length) {
    return (
      <PestanaSinContenido titulo="Carga y resultado" icono={<Users size={18} />} motivo="El corte no trae responsables del barrido." descripcion="Se leen de la columna de responsable de la hoja de barrido al actualizar." />
    );
  }
  return <EquipoVista modelo={modelo} />;
}
