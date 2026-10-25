import { memo, useMemo, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  apiMonitoreoTerritorialReconciliationBatch,
  type MonitoreoState,
  type MonitoreoTerritorialDashboard,
  type MonitoreoTerritorialPhase,
  type MonitoreoTerritorialReconciliationBatchChange,
} from "../../../../../api/client";
import { fmt } from "../rotulos";
import {
  cambioDeUmp,
  cambiosDeCodigo,
  construirConciliacion,
  type Conciliacion,
} from "./conciliacionModel";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import "./conciliacion.css";

type Aviso = { tono: "ok" | "error"; texto: string } | null;

/**
 * Control › Conciliación (territorial.md §3.13): dos paneles iguales, Códigos
 * y UMP declarada, cada uno con sus cifras, lo que falta conciliar con su
 * selector y las conciliaciones hechas. Al pie, las sospechas espaciales en
 * cola, que siguen en su sub-vista.
 */
function ConciliacionTabImpl({
  reports,
  state,
  phase,
  onStateChange,
  onEspacial,
}: {
  reports: MonitoreoTerritorialDashboard | null;
  state: MonitoreoState | null;
  phase: MonitoreoTerritorialPhase;
  onStateChange?: (state: MonitoreoState) => void;
  onEspacial: () => void;
}) {
  const modelo = useMemo(() => construirConciliacion(reports, state), [reports, state]);
  const [elecciones, setElecciones] = useState<Record<string, string>>({});
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const espaciales = reports?.spatial_reconciliation?.metrics?.in_queue ?? reports?.spatial_reconciliation?.metrics?.candidates ?? null;

  const enviar = async (clave: string, cambios: MonitoreoTerritorialReconciliationBatchChange[], exito: string) => {
    if (!cambios.length) return;
    setEnCurso(clave);
    setAviso(null);
    try {
      const resultado = await apiMonitoreoTerritorialReconciliationBatch(cambios);
      const fallidos = resultado.failed?.length ?? 0;
      if (resultado.state) onStateChange?.(resultado.state);
      setAviso(fallidos ? { tono: "error", texto: `${fmt(fallidos)} de ${fmt(cambios.length)} cambios no se aplicaron.` } : { tono: "ok", texto: exito });
    } catch (error) {
      setAviso({ tono: "error", texto: error instanceof Error ? error.message : String(error) });
    } finally {
      setEnCurso(null);
    }
  };

  return (
    <section
      className="mon-con"
      aria-label="Conciliación"
      data-audit-ready="monitoreo-territorial-control-conciliacion"
      data-qa-geometry-group="territorial-conciliacion"
      data-qa-geometry-contract="equal"
    >
      {aviso ? <p className={`mon-con-aviso is-${aviso.tono}`} role={aviso.tono === "error" ? "alert" : "status"}>{aviso.texto}</p> : null}

      <section className="mon-con-panel" aria-labelledby="mon-con-codigos" data-qa-geometry-member="codigos" data-qa-geometry-group="territorial-conciliacion-codigos" data-qa-geometry-contract="intrinsic">
        <header className="mon-con-cabecera">
          <RotuloDePestana />
          <h3 id="mon-con-codigos">Códigos</h3>
          {modelo.codigos.disponible ? (
            <span className="mon-con-base">
              {fmt(modelo.codigos.enBase)} en la base · {fmt(modelo.codigos.reconocidos)} reconocidos · {fmt(modelo.codigos.conciliados)} conciliados · {fmt(modelo.codigos.sinReconocer.length)} sin reconocer
            </span>
          ) : null}
        </header>
        {!modelo.codigos.disponible ? (
          <p className="mon-con-base">El corte no trae el cruce de códigos con el padrón.</p>
        ) : (
          <>
            <h4 className="mon-con-subtitulo">Sin reconocer</h4>
            {modelo.codigos.sinReconocer.length ? (
              <ul className="mon-con-pendientes">
                {modelo.codigos.sinReconocer.map((codigo) => {
                  const clave = `codigo:${codigo.normalizado}`;
                  const elegido = modelo.padron.find((opcion) => opcion.codigo === elecciones[clave]) ?? null;
                  return (
                    <li key={clave}>
                      <span className="mon-con-escrito">«{codigo.codigo}» <small>{fmt(codigo.casos)} {codigo.casos === 1 ? "caso" : "casos"}</small></span>
                      <label>
                        <span className="pulso-sr-only">Código del padrón para «{codigo.codigo}»</span>
                        <select value={elecciones[clave] ?? ""} onChange={(event) => { const valor = event.currentTarget.value; setElecciones((previas) => ({ ...previas, [clave]: valor })); }}>
                          <option value="">Elegir del padrón…</option>
                          {modelo.padron.map((opcion) => <option key={opcion.codigo} value={opcion.codigo}>{opcion.codigo} · {opcion.nombre}</option>)}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="mon-con-boton"
                        disabled={!elegido || !codigo.responseIds.length || enCurso != null}
                        title={!codigo.responseIds.length ? "El corte no trae las respuestas de este código" : undefined}
                        onClick={() => {
                          if (elegido) void enviar(clave, cambiosDeCodigo(codigo, elegido, phase), `«${codigo.codigo}» quedó conciliado con ${elegido.codigo}.`);
                        }}
                      >
                        {enCurso === clave ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : null}
                        Conciliar
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mon-con-base">Todos los códigos de la base están en el padrón.</p>
            )}
            <ListaDeConciliaciones titulo="Conciliados" conciliaciones={modelo.codigos.conciliaciones} />
          </>
        )}
      </section>

      <section className="mon-con-panel" aria-labelledby="mon-con-umps" data-qa-geometry-member="umps" data-qa-geometry-group="territorial-conciliacion-umps" data-qa-geometry-contract="intrinsic">
        <header className="mon-con-cabecera">
          <h3 id="mon-con-umps">UMP declarada</h3>
          {modelo.umps.disponible ? (
            <span className="mon-con-base">
              {fmt(modelo.umps.valores)} valores · {fmt(modelo.umps.cruzan)} cruzan · {fmt(modelo.umps.conciliados)} conciliados · {fmt(modelo.umps.sinCruce.length)} sin cruce
            </span>
          ) : null}
        </header>
        {!modelo.umps.disponible ? (
          <p className="mon-con-base">El corte no trae la UMP declarada por las respuestas.</p>
        ) : (
          <>
            <h4 className="mon-con-subtitulo">Sin cruce con la ruta</h4>
            {modelo.umps.sinCruce.length ? (
              <ul className="mon-con-pendientes">
                {modelo.umps.sinCruce.map((valor) => {
                  const clave = `ump:${valor.normalizado || valor.valor}`;
                  const destino = modelo.ruta.find((opcion) => opcion.idManzana === elecciones[clave]) ?? null;
                  return (
                    <li key={clave}>
                      <span className="mon-con-escrito">«{valor.valor}» <small>{fmt(valor.casos)} {valor.casos === 1 ? "caso" : "casos"}</small></span>
                      <label>
                        <span className="pulso-sr-only">UMP de la ruta para «{valor.valor}»</span>
                        <select value={elecciones[clave] ?? ""} onChange={(event) => { const v = event.currentTarget.value; setElecciones((previas) => ({ ...previas, [clave]: v })); }}>
                          <option value="">Elegir de la ruta…</option>
                          {modelo.ruta.map((opcion) => <option key={opcion.idManzana} value={opcion.idManzana}>{opcion.rotulo}</option>)}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="mon-con-boton"
                        disabled={!destino || enCurso != null}
                        onClick={() => {
                          if (destino) void enviar(clave, [cambioDeUmp(valor, destino, phase)], `«${valor.valor}» quedó conciliado con la UMP ${destino.ump}.`);
                        }}
                      >
                        {enCurso === clave ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : null}
                        Conciliar
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mon-con-base">Todas las UMP declaradas cruzan con la ruta.</p>
            )}
            <ListaDeConciliaciones titulo="Conciliados" conciliaciones={modelo.umps.conciliaciones} />
          </>
        )}
      </section>

      <footer className="mon-con-pie">
        <span>Sospechas espaciales · {espaciales == null ? "sin dato en este corte" : `${fmt(espaciales)} ${espaciales === 1 ? "candidata" : "candidatas"} en cola`}</span>
        <button type="button" className="mon-con-enlace" onClick={onEspacial}>Revisar sospechas espaciales</button>
      </footer>
    </section>
  );
}

function ListaDeConciliaciones({ titulo, conciliaciones }: { titulo: string; conciliaciones: readonly Conciliacion[] }) {
  if (!conciliaciones.length) return null;
  return (
    <>
      <h4 className="mon-con-subtitulo">{titulo} · {fmt(conciliaciones.length)}</h4>
      <ul className="mon-con-hechas" data-qa-geometry-capacity="owned">
        {conciliaciones.map((item, indice) => (
          <li key={`${item.escrito}-${indice}`}>
            <span>«{item.escrito}»</span>
            <ArrowRight size={13} aria-label="asignado a" />
            <span>{item.asignado}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export const ConciliacionTab = memo(ConciliacionTabImpl);
