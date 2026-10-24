import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { Alert } from "../../../../../components/Alert";
import { Switch } from "../../../../../components/Switch";
import { apiMonitoreoCollectorsConfig, type MonitoreoInternalQueryTotal, type MonitoreoLinkCollector, type MonitoreoSource, type MonitoreoState } from "../../../../../api/client";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { enlaceDeFuente } from "../../../fuentes/enlacesDeFuente";
import { corteCorto } from "../../../core/barraComun";
import { fmt } from "../formato";
import { useResumenDelCorte } from "../navegacion/resumenDelCorte";
import type { AcreditacionCollectorRow } from "../AcreditacionSourcesModel";
import { canalDeFuente } from "./publicosModelo";
import { firmaDeRecopiladores, fuentesPorPublico, recopiladoresDeLaFuente, type FuenteDelMaestro } from "./fuentesModelo";
import "../avance/avance.css";
import "../control/casos/porResolver.css";
import "../control/casos/personas.css";
import "./insumos.css";

type PropsDeVista = {
  sources: readonly MonitoreoSource[];
  borrador: MonitoreoLinkCollector[];
  totales: readonly MonitoreoInternalQueryTotal[] | null;
  foco: string | null;
  onElegir: (id: string) => void;
  onIncluir: (fila: AcreditacionCollectorRow, incluido: boolean) => void;
  onGuardar: () => void;
  pendientes: boolean;
  guardando: boolean;
  mensaje?: { tono: "info" | "error"; texto: string } | null;
  /** Lo que se declara de cada encuesta (público y canal base), debajo. */
  declaracion?: ReactNode;
};

function Dato({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div className="acr-pr-dato"><dt>{rotulo}</dt><dd>{children}</dd></div>;
}

function Cabecera({ elegida }: { elegida: FuenteDelMaestro }) {
  const { fuente } = elegida;
  const enlace = enlaceDeFuente(fuente);
  return (
    <dl className="acr-pr-datos acr-in-datos-fuente">
      <Dato rotulo="Servicio">{elegida.servicio}</Dato>
      <Dato rotulo="Público">{elegida.publico}</Dato>
      <Dato rotulo="Papel">{elegida.papelRotulo}</Dato>
      {elegida.papel === "respuestas" ? <Dato rotulo="Canal base">{canalDeFuente(fuente)}</Dato> : null}
      {elegida.papel === "respuestas" ? <Dato rotulo="Llave de la respuesta">{fuente.declared_person_code_label || fuente.declared_person_code_var || "La detecta el motor"}</Dato> : null}
      <Dato rotulo="Filas leídas"><span className="acr-av-num">{elegida.filas == null ? "—" : fmt(elegida.filas)}</span></Dato>
      <Dato rotulo="Última lectura">{elegida.ultimaLectura ? corteCorto(elegida.ultimaLectura) : "Sin leer"}</Dato>
      <Dato rotulo="En su servicio">
        {enlace.estado === "enlace"
          ? <a href={enlace.href} target="_blank" rel="noreferrer" title={enlace.titulo} className="acr-in-enlace">{enlace.texto} <ExternalLink size={12} aria-hidden="true" /></a>
          : <span className="acr-av-tenue">{enlace.mensaje}</span>}
      </Dato>
    </dl>
  );
}

export function FuentesVista({ sources, borrador, totales, foco, onElegir, onIncluir, onGuardar, pendientes, guardando, mensaje, declaracion }: PropsDeVista) {
  const grupos = useMemo(() => fuentesPorPublico(sources, borrador), [sources, borrador]);
  const todas = grupos.flatMap((grupo) => grupo.fuentes);
  const elegida = todas.find((item) => item.id === foco) ?? todas[0] ?? null;
  const recopiladores = elegida && elegida.papel === "respuestas" ? recopiladoresDeLaFuente(elegida.fuente, borrador, totales, sources) : [];
  const conRecopiladores = elegida?.fuente.kind === "surveymonkey";
  if (!todas.length) {
    return (
      <div className="acr-in-fuentes-vacio" data-vacio>
        <Alert kind="info">El estudio todavía no tiene fuentes conectadas.</Alert>
        {declaracion}
      </div>
    );
  }
  return (
    <div className="acr-in-fuentes">
      <div className="acr-ps is-fuentes" data-qa-geometry-group="acreditacion-insumos-fuentes" data-qa-geometry-contract="intrinsic">
        <nav className="acr-av-panel acr-pr-filtros" aria-label="Fuentes del estudio">
          <header className="acr-av-panel-cabecera"><h3>Fuentes <span className="acr-av-tenue acr-av-num">{fmt(todas.length)}</span></h3></header>
          <div className="acr-pr-filtros-cuerpo" data-qa-geometry-capacity="owned">
            {grupos.map((grupo) => (
              <section key={grupo.publico} className="acr-pr-grupo">
                <h3 className="acr-av-antetitulo">{grupo.publico}</h3>
                <ul>
                  {grupo.fuentes.map((item) => (
                    <li key={item.id}>
                      <button type="button" className={`acr-in-fuente${elegida?.id === item.id ? " is-activo" : ""}${item.activa ? "" : " is-inactiva"}`} aria-pressed={elegida?.id === item.id} onClick={() => onElegir(item.id)}>
                        <span className="acr-in-fuente-nombre">
                          <span>{item.nombre}</span>
                          <small className="acr-av-tenue">{`${item.servicio} · ${item.papelRotulo}${item.activa ? "" : " · Desactivada"}`}</small>
                        </span>
                        <b className="acr-av-num">{item.filas == null ? "—" : fmt(item.filas)}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </nav>
        {elegida ? (
          <section className="acr-av-panel acr-ps-tabla" aria-label={`Fuente ${elegida.nombre}`} data-qa-geometry-capacity="owned">
            <header className="acr-av-panel-cabecera">
              <h3>{elegida.nombre}</h3>
              {conRecopiladores ? (
                <button type="button" className="acr-av-boton is-primario" onClick={onGuardar} disabled={guardando || !pendientes}>
                  {guardando ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Guardar
                </button>
              ) : null}
            </header>
            <div className="acr-ct-cuerpo"><Cabecera elegida={elegida} /></div>
            {mensaje ? <div className="acr-ct-cuerpo"><Alert kind={mensaje.tono === "error" ? "error" : "info"}>{mensaje.texto}</Alert></div> : null}
            {conRecopiladores && recopiladores.length ? (
              <>
                {totales ? null : <div className="acr-ct-cuerpo"><Alert kind="info">Las respuestas y efectivas de cada recopilador llegan con el corte de Control.</Alert></div>}
                <div className="acr-pr-cola-marco" data-qa-geometry-capacity="owned">
                  <table className="acr-pub-tabla">
                    <thead>
                      <tr>
                        <th scope="col">Recopilador</th>
                        <th scope="col">Tipo</th>
                        <th scope="col" className="is-num">Respuestas</th>
                        <th scope="col" className="is-num">Efectivas</th>
                        <th scope="col">Canal</th>
                        <th scope="col">Incluir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recopiladores.map((item) => (
                        <tr key={item.fila.key} className={item.incluido ? undefined : "is-excluida"}>
                          <th scope="row">{item.nombre}</th>
                          <td>{item.tipo}</td>
                          <td className="is-num" title={item.ambiguo ? "Otra encuesta tiene un recopilador con el mismo nombre; el cruce no los distingue." : undefined}>{item.respuestas == null ? "—" : fmt(item.respuestas)}</td>
                          <td className="is-num">{item.efectivas == null ? "—" : fmt(item.efectivas)}</td>
                          <td>{item.canal}</td>
                          <td>
                            <Switch checked={item.incluido} onToggle={() => onIncluir(item.fila, !item.incluido)} ariaLabel={`Incluir ${item.nombre}`} disabled={guardando} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : conRecopiladores ? (
              <div className="acr-ct-cuerpo"><Alert kind="warn">Faltan los nombres de los recopiladores: actualiza la fuente para traerlos de SurveyMonkey.</Alert></div>
            ) : null}
          </section>
        ) : null}
      </div>
      {declaracion ? <section className="acr-av-panel acr-in-declaracion" aria-label="Declaración de las encuestas">{declaracion}</section> : null}
    </div>
  );
}

/**
 * Insumos › Fuentes (ficha I2): fuentes agrupadas por público a la izquierda y,
 * a la derecha, la fuente elegida (`foco=<fuente>`) con sus recopiladores, sus
 * cifras del cruce y el switch «Incluir». Se guarda con el mismo contrato de
 * siempre (`apiMonitoreoCollectorsConfig`); la declaración de cada encuesta
 * sigue debajo.
 */
export function Fuentes({
  sources,
  linkCollectors,
  configDeRecopilador,
  onStateChange,
  declaracion,
}: {
  sources: readonly MonitoreoSource[];
  linkCollectors: MonitoreoLinkCollector[];
  configDeRecopilador: (fila: AcreditacionCollectorRow, cambio: Partial<MonitoreoLinkCollector>) => MonitoreoLinkCollector;
  onStateChange?: (state: MonitoreoState) => void;
  declaracion?: ReactNode;
}) {
  const [foco, escribirFoco] = useFocoMonitoreo();
  const totales = useResumenDelCorte((estado) => estado.recopiladores);
  const [borrador, setBorrador] = useState<MonitoreoLinkCollector[]>(linkCollectors);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "info" | "error"; texto: string } | null>(null);
  const firmaGuardada = firmaDeRecopiladores(linkCollectors);
  // Lo guardado manda cuando cambia; la firma lo resume sin depender de identidades.
  const guardadosRef = useRef(linkCollectors);
  guardadosRef.current = linkCollectors;
  useEffect(() => {
    setBorrador(guardadosRef.current);
  }, [firmaGuardada]);

  function incluir(fila: AcreditacionCollectorRow, incluido: boolean) {
    const siguiente = configDeRecopilador(fila, { enabled: incluido });
    setMensaje(null);
    setBorrador((actual) => [
      ...actual.filter((item) => `${item.source_id}::${item.collector_id}` !== `${siguiente.source_id}::${siguiente.collector_id}`),
      siguiente,
    ]);
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    try {
      const result = await apiMonitoreoCollectorsConfig(borrador);
      onStateChange?.(result.state);
      setMensaje({ tono: "info", texto: "Recopiladores guardados." });
    } catch (e) {
      setMensaje({ tono: "error", texto: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <FuentesVista
      sources={sources}
      borrador={borrador}
      totales={totales}
      foco={foco}
      onElegir={(id) => escribirFoco(id)}
      onIncluir={incluir}
      onGuardar={() => { void guardar(); }}
      pendientes={firmaDeRecopiladores(borrador) !== firmaGuardada}
      guardando={guardando}
      mensaje={mensaje}
      declaracion={declaracion}
    />
  );
}
