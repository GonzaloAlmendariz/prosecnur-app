import { useMemo, useState, type ReactNode } from "react";
import { CalendarRange, ListChecks } from "lucide-react";
import type { MonitoreoStrategyPhase } from "../../../../../api/client";
import { usePanelDireccionable, type PanelDeclarado } from "../../../../../lib/navegacion/paneles";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { SuperficieFlotante } from "../../../core/superficieFlotante/SuperficieFlotante";
import { fmt } from "../formato";
import { BarrasApiladas, fechaCorta } from "./graficosDeAvance";
import { DiarioYAcumulado } from "./DiarioYAcumulado";
import { SelectorDeSubvistas } from "../../../core/selectorDeSubvistas/SelectorDeSubvistas";
import { mapaPorSemana } from "./mapaDeCalor";
import { fasesConFechas, nombresDePublicos, pulsoDelCampo, seriesApiladas } from "./ritmoModelo";
import { ritmoPorPublico } from "./ritmoPorPublicoModelo";
import { RitmoPorPublico } from "./RitmoPorPublico";
import { useResumenDelCorte } from "../navegacion/resumenDelCorte";
import "./avance.css";
import { CabeceraDeTarjeta } from "../navegacion/rotuloDePestana";
import { AvisoDeTarjeta, PestanaSinContenido } from "../piezas/AvisoDeTarjeta";
import { clasePublico, paletaDePublicos } from "../paletaPublicos";
import "../paletaPublicos.css";
import { useSubvistaEnFoco } from "../../../core/subvistaEnFoco";

const GRAFICOS_DE_RITMO = ["publico", "acumulado"] as const;

/** Con menos días el promedio por día de la semana es una o dos muestras por día: no se dibuja. */
const DIAS_PARA_LEER_LA_SEMANA = 14;

/** El desglose por fuente y recopilador: `panel=fuentes`. */
export const PANEL_FUENTES: PanelDeclarado = { id: "fuentes", label: "Por fuente y recopilador", clase: "sideover" };

const UNA_DECIMAL = (valor: number) => valor.toLocaleString("es-PE", { maximumFractionDigits: 1 });

type PropsDeVista = {
  actores: ReadonlyArray<Record<string, unknown>>;
  diarioGeneral: ReadonlyArray<Record<string, unknown>>;
  diarioPorPublico: ReadonlyArray<Record<string, unknown>>;
  fuentes: ReadonlyArray<Record<string, unknown>>;
  fases: readonly MonitoreoStrategyPhase[];
  onDeclararFases: () => void;
  onVerFuentes?: () => void;
  /** Fecha del corte: la serie llega hasta ahí aunque los últimos días no traigan efectivas. */
  fechaDelCorte?: string | null;
};

export function RitmoVista({ actores, diarioGeneral, diarioPorPublico, fuentes, fases, onDeclararFases, onVerFuentes, fechaDelCorte }: PropsDeVista) {
  const serie = useMemo(
    () => seriesApiladas(diarioPorPublico, diarioGeneral, nombresDePublicos(actores), fechaDelCorte),
    [diarioPorPublico, diarioGeneral, actores, fechaDelCorte],
  );
  const plan = fasesConFechas(fases);
  const pulso = pulsoDelCampo(serie, fuentes, actores);
  const mapa = mapaPorSemana(serie);
  const maxSemana = Math.max(1, ...pulso.porDiaDeLaSemana.map((dia) => dia.promedio));
  const totalCanal = pulso.porCanal.reduce((suma, item) => suma + item.efectivas, 0);
  const porPublico = useMemo(() => ritmoPorPublico(serie, actores), [serie, actores]);
  // «Por público» (apilado) o «Diario y acumulado» (doble eje, con la meta del estudio).
  // Viaja en el foco (L19): `?foco=acumulado`; «Por público» no se escribe.
  const [grafico, setGrafico] = useSubvistaEnFoco(GRAFICOS_DE_RITMO, "publico");
  // Un público a la vez (Gonzalo, 30/10: «seleccionar un actor en específico y que
  // muestre sólo ese»): un clic en la leyenda lo aísla en los dos gráficos.
  const [solo, setSolo] = useState<string | null>(null);
  const capaSola = solo ? serie.capas.find((capa) => capa.publico === solo) ?? null : null;
  const metaDelEstudio = capaSola
    ? porPublico.find((item) => item.publico === capaSola.publico)?.meta ?? null
    : porPublico.reduce((suma, item) => suma + (item.meta ?? 0), 0) || null;
  const totalesVisibles = capaSola ? capaSola.valores : serie.totales;
  const fechasUltimas = new Set(pulso.ultimaPorPublico.map((item) => item.fecha ?? ""));
  const ultimaComun = pulso.ultimaPorPublico.length > 1 && fechasUltimas.size === 1 ? [...fechasUltimas][0] || null : null;
  // Cada público con el color que tiene en Resumen, Correo y Por cuota.
  const paleta = useMemo(() => paletaDePublicos([...nombresDePublicos(actores).values(), ...serie.capas.map((capa) => capa.publico)]), [actores, serie]);
  const clasesDeCapa = serie.capas.map((capa) => `con-publico ${clasePublico(paleta, capa.publico)}`);
  const indiceSolo = capaSola ? serie.capas.indexOf(capaSola) : -1;
  const capasVisibles = capaSola ? [capaSola] : serie.capas;
  const clasesVisibles = capaSola ? [clasesDeCapa[indiceSolo]] : clasesDeCapa;
  if (!serie.fechas.length) {
    return <PestanaSinContenido titulo="Efectivas por día" icono={<CalendarRange size={18} />} motivo="El corte todavía no trae efectivas con fecha." descripcion="Las efectivas por día aparecen cuando las encuestas conectadas devuelven respuestas completas." />;
  }
  return (
    <div className="acr-ri" data-qa-geometry-group="acreditacion-avance-ritmo" data-qa-geometry-contract="intrinsic">
      <div className="acr-ri-izquierda">
        <section className="acr-av-panel acr-ri-diario" aria-label="Efectivas por día">
          <CabeceraDeTarjeta primera>
            <h3>Efectivas por día <span className="acr-av-tenue">{`${serie.fechas.length === 1 ? fechaCorta(serie.fechas[0]) : `${fechaCorta(serie.fechas[0])} a ${fechaCorta(serie.fechas.at(-1) as string)}`}${capaSola ? `, ${capaSola.publico}` : grafico === "publico" ? ", por público" : ", con el acumulado"}`}</span></h3>
            <span className="acr-ri-acciones">
              <SelectorDeSubvistas
                opciones={[{ clave: "publico", etiqueta: "Por público", valor: "publico" as const }, { clave: "acumulado", etiqueta: "Diario y acumulado", valor: "acumulado" as const }]}
                esActiva={(valor) => valor === grafico}
                onElegir={setGrafico}
              />
              {onVerFuentes ? (
                <button type="button" className="acr-av-boton" onClick={onVerFuentes}>
                  <ListChecks size={14} aria-hidden="true" /> Por fuente y recopilador
                </button>
              ) : null}
            </span>
          </CabeceraDeTarjeta>
          {plan.length ? null : (
            <AvisoDeTarjeta accion={<button type="button" className="acr-av-boton" onClick={onDeclararFases}><CalendarRange size={14} aria-hidden="true" /> Declarar fases</button>}>
              El plan de campo no tiene fases con fechas.
            </AvisoDeTarjeta>
          )}
          {grafico === "publico" ? (
            <>
              <BarrasApiladas fechas={serie.fechas} capas={capasVisibles} totales={totalesVisibles} fases={plan} etiqueta={`Efectivas por día de ${fmt(serie.fechas.length)} días, ${capaSola ? capaSola.publico : "por público"}`} clasesDeCapa={clasesVisibles} />
            </>
          ) : (
            <>
              <DiarioYAcumulado fechas={serie.fechas} totales={totalesVisibles} meta={metaDelEstudio} etiqueta={`Efectivas por día y acumuladas de ${fmt(serie.fechas.length)} días`} />
              <ul className="acr-ri-leyenda" aria-label="Series">
                <li><i className="acr-av-capa-muestra is-dia" aria-hidden="true" />Efectivas del día <span className="acr-av-tenue">(eje izquierdo)</span></li>
                <li><i className="acr-av-capa-muestra is-acumulado" aria-hidden="true" />Acumulado <b className="acr-av-num">{fmt(totalesVisibles.reduce((a, b) => a + b, 0))}</b> <span className="acr-av-tenue">(eje derecho)</span></li>
                {metaDelEstudio ? <li><i className="acr-av-capa-muestra is-meta" aria-hidden="true" />{capaSola ? "Meta del público" : "Meta"} <b className="acr-av-num">{fmt(metaDelEstudio)}</b></li> : null}
              </ul>
            </>
          )}
          {/* La misma botonera en los dos gráficos: el público elegido sigue elegido al cambiar de vista. */}
          <div className="acr-ri-filtro" role="group" aria-label="Mostrar un público">
            <button type="button" className={`acr-ri-filtro-boton${capaSola ? "" : " is-activo"}`} aria-pressed={!capaSola} onClick={() => setSolo(null)}>
              Todos <b className="acr-av-num">{fmt(serie.totales.reduce((a, b) => a + b, 0))}</b>
            </button>
            {serie.capas.map((capa, indice) => (
              <button key={capa.publico} type="button" className={`acr-ri-filtro-boton${capaSola === capa ? " is-activo" : ""}`} aria-pressed={capaSola === capa} onClick={() => setSolo(capaSola === capa ? null : capa.publico)}>
                <i className={`acr-av-capa-muestra ${clasesDeCapa[indice]}`} aria-hidden="true" />{capa.publico} <b className="acr-av-num">{fmt(capa.total)}</b>
              </button>
            ))}
          </div>
        </section>
        <RitmoPorPublico publicos={porPublico} clase={(publico) => clasePublico(paleta, publico)} />
        <section className="acr-av-panel acr-ri-mapa" aria-label="Efectivas por semana">
          <header className="acr-av-panel-cabecera"><h3>Efectivas por semana <span className="acr-av-tenue">Semanas de lunes a domingo</span></h3></header>
          <div className="acr-pr-cola-marco" data-qa-geometry-capacity="owned">
            <table className="acr-pub-tabla acr-ri-calor">
              <thead>
                <tr>
                  <th scope="col">Público</th>
                  {mapa.semanas.map((semana) => <th key={semana} scope="col" className="is-num">{fechaCorta(semana)}</th>)}
                </tr>
              </thead>
              <tbody>
                {mapa.filas.map((fila) => (
                  <tr key={fila.publico}>
                    <th scope="row">{fila.publico}</th>
                    {fila.valores.map((valor, indice) => (
                      <td
                        key={mapa.semanas[indice]}
                        className={`is-num acr-ri-celda${valor ? "" : " is-cero"}`}
                        style={valor ? { background: `color-mix(in srgb, var(--acr-efectiva) ${Math.round(8 + 62 * (valor / Math.max(1, mapa.maximo)))}%, var(--pulso-surface))`, color: valor / Math.max(1, mapa.maximo) > 0.55 ? "var(--pulso-surface)" : undefined } : undefined}
                      >
                        {valor ? fmt(valor) : "·"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <aside className="acr-av-panel acr-ri-pulso" aria-label="Pulso del campo">
        <header className="acr-av-panel-cabecera"><h3>Pulso del campo</h3></header>
        <div className="acr-ri-pulso-cuerpo" data-qa-geometry-capacity="owned">
          {/* Una lista de datos, no cuatro recuadros (E3, 30/10): con un solo canal no
              se repite en una barra llena, y si todos los públicos tuvieron su última
              efectiva el mismo día se dice una vez. */}
          <dl className="acr-ri-datos">
            <div><dt>Promedio diario, últimos 7 días</dt><dd className="acr-av-num">{UNA_DECIMAL(pulso.promedio7)}</dd></div>
            <div><dt>Mejor día</dt><dd className="acr-av-num">{pulso.mejor ? `${fmt(pulso.mejor.efectivas)}, ${fechaCorta(pulso.mejor.fecha)}` : "—"}</dd></div>
            <div><dt>Días con efectivas</dt><dd className="acr-av-num">{`${fmt(pulso.diasConEfectivas)} de ${fmt(pulso.dias)}`}</dd></div>
            {pulso.porCanal.length === 1 ? (
              <div><dt>Canal</dt><dd>{pulso.porCanal[0].canal} <span className="acr-av-tenue acr-av-num">{fmt(pulso.porCanal[0].efectivas)}</span></dd></div>
            ) : null}
          </dl>
          {pulso.dias >= DIAS_PARA_LEER_LA_SEMANA ? <section aria-label="Promedio por día de la semana">
            <span className="acr-av-antetitulo">Promedio por día de la semana</span>
            <ul className="acr-ri-barras">
              {pulso.porDiaDeLaSemana.map((dia) => (
                <li key={dia.dia}>
                  <span>{dia.dia}</span>
                  <span className="acr-av-pista"><i style={{ width: `${(dia.promedio / maxSemana) * 100}%` }} /></span>
                  <b className="acr-av-num">{UNA_DECIMAL(dia.promedio)}</b>
                </li>
              ))}
            </ul>
          </section> : null}
          {pulso.porCanal.length > 1 ? (
            <section aria-label="Efectivas por canal">
              <span className="acr-av-antetitulo">Efectivas por canal</span>
              <ul className="acr-ri-barras">
                {pulso.porCanal.map((item) => (
                  <li key={item.canal}>
                    <span>{item.canal}</span>
                    <span className="acr-av-pista"><i style={{ width: `${totalCanal ? (item.efectivas / totalCanal) * 100 : 0}%` }} /></span>
                    <b className="acr-av-num">{fmt(item.efectivas)}</b>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section aria-label="Última efectiva por público">
            <span className="acr-av-antetitulo">Última efectiva por público</span>
            {ultimaComun ? (
              <p className="acr-ri-comun">{`Todos los públicos, ${fechaCorta(ultimaComun)}`}</p>
            ) : (
              <ul className="acr-ri-ultimas">
                {pulso.ultimaPorPublico.map((item) => (
                  <li key={item.publico}><span>{item.publico}</span><b className="acr-av-num">{item.fecha ? fechaCorta(item.fecha) : "Sin efectivas"}</b></li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

/**
 * Avance › Ritmo (ficha A4): a qué velocidad entra. Las fases se declaran en
 * Modelo › Ventana de campo; aquí solo se dibujan. El desglose de siempre por
 * fuente, canal y recopilador queda en un sideover (`panel=fuentes`).
 */
export function Ritmo({ detallePorFuente, ...props }: Omit<PropsDeVista, "onDeclararFases" | "onVerFuentes"> & { detallePorFuente?: ReactNode }) {
  const [, escribirFoco] = useFocoMonitoreo();
  const panel = usePanelDireccionable(PANEL_FUENTES);
  const fechaDelCorte = useResumenDelCorte((estado) => estado.fechaDelCorte);
  return (
    <>
      <RitmoVista
        {...props}
        fechaDelCorte={fechaDelCorte}
        onDeclararFases={() => escribirFoco(null, { seccion: "modelo", pestana: "ventana", panel: null })}
        onVerFuentes={detallePorFuente ? panel.abrir : undefined}
      />
      {panel.abierto && detallePorFuente ? (
        <SuperficieFlotante tipo="sideover" antetitulo="Ritmo" titulo="Por fuente y recopilador" onCerrar={panel.cerrar} panelId={PANEL_FUENTES.id} ancho={1240}>
          {detallePorFuente}
        </SuperficieFlotante>
      ) : null}
    </>
  );
}
