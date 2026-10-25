import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Search, X, XCircle } from "lucide-react";
import { Alert } from "../../../../../../components/Alert";
import { Switch } from "../../../../../../components/Switch";
import type { MonitoreoInternalQueryCase } from "../../../../../../api/client";
import { motivoDeNoCruce } from "../../../../core/motivoDeNoCruce";
import { internalCaseCrossingValue, internalCaseResponseStateLabel, internalCaseResponseStateValue } from "../../../../internalQueries";
import { fechaCorta } from "../../avance/graficosDeAvance";
import { assistedCandidateEvidenceLabel, assistedCandidateEvidenceLevel, assistedCandidateId } from "./revisionAsistida";
import { modeloDeDecision, payloadDeDecision, type FilaDeCola, type PayloadDeDecision } from "./porResolverModelo";

export type EstadoDeGuardado = { tone: "success" | "error" | "info"; message: string } | null;

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="acr-pr-dato">
      <dt>{etiqueta}</dt>
      <dd>{valor || "—"}</dd>
    </div>
  );
}

function nombreDe(candidato: { person_label?: string; base_record?: string }) {
  return candidato.person_label || candidato.base_record || "Persona del padrón";
}

/**
 * Panel del caso (Ctl5): datos, lo que pasó, la llave por canal, lo que el
 * motor encontró y la decisión. El supervisor busca a la persona del padrón y
 * asigna, o descarta; la decisión queda auditada con su nota, como hoy.
 */
export function PanelCaso({
  fila,
  elegido,
  ocupado,
  estado,
  onDecision,
  onCerrar,
}: {
  fila: FilaDeCola;
  elegido: boolean;
  ocupado: boolean;
  estado: EstadoDeGuardado;
  onDecision?: (payload: PayloadDeDecision) => void;
  onCerrar: () => void;
}) {
  const caso: MonitoreoInternalQueryCase | null = fila.caso;
  const [seleccion, setSeleccion] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [nota, setNota] = useState("");
  const [busqueda, setBusqueda] = useState("");
  useEffect(() => {
    setSeleccion("");
    setConfirmado(false);
    setNota("");
    setBusqueda("");
  }, [fila.clave]);

  const modelo = useMemo(
    () => (caso ? modeloDeDecision(caso, { seleccion, confirmado, nota, busqueda }) : null),
    [caso, seleccion, confirmado, nota, busqueda],
  );
  const manual = caso?.assisted_review?.manual_decision ?? null;
  const respuesta = caso ? internalCaseResponseStateValue(caso) : "";
  const motivo = caso ? motivoDeNoCruce(caso, respuesta, internalCaseCrossingValue(caso)) : null;
  const review = caso?.assisted_review;
  const enviar = (accion: PayloadDeDecision["action"]) => {
    if (!caso || !modelo || !onDecision) return;
    const payload = payloadDeDecision(caso, accion, modelo, nota);
    if (payload) onDecision(payload);
  };

  return (
    <aside className="acr-av-panel acr-pr-panel" aria-label={`Caso ${fila.responseId || fila.llave}`} data-pulso-panel={elegido ? "caso" : undefined}>
      <header className="acr-av-panel-cabecera">
        <h3><span className="acr-av-antetitulo">Caso</span> <span className="acr-av-num">{fila.responseId || fila.llave}</span></h3>
        <span className="acr-pr-cabecera-derecha">
          <span className={`acr-av-chip${fila.grupo === "espera" && !fila.decision ? " is-falta" : ""}`}>{fila.etiquetaDeTipo}</span>
          {elegido ? (
            <button type="button" className="acr-av-icono" onClick={onCerrar} aria-label="Cerrar el caso">
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
        </span>
      </header>
      <div className="acr-pr-panel-cuerpo">
        {estado ? <Alert kind={estado.tone === "error" ? "error" : "info"}>{estado.message}</Alert> : null}
        <dl className="acr-pr-datos">
          <Dato etiqueta="Público" valor={fila.publico} />
          <Dato etiqueta="Canal" valor={fila.canal} />
          <Dato etiqueta="Recibida" valor={fila.fecha ? fechaCorta(fila.fecha) : ""} />
          <Dato etiqueta="Respondido" valor={fila.completitud} />
          <Dato etiqueta="Llave" valor={fila.llave} />
          <Dato etiqueta="Encuesta" valor={caso?.source_label ?? ""} />
        </dl>

        <section className="acr-pr-bloque" aria-label="Lo que pasó">
          <span className="acr-av-antetitulo">Lo que pasó</span>
          <ol className="acr-pr-linea">
            <li>
              <b>Respondió</b>
              <span>{caso ? `${internalCaseResponseStateLabel(respuesta)} por ${fila.canal}` : fila.detalle || "Sin respuesta asociada en el corte"}</span>
            </li>
            <li>
              <b>Cruce con el padrón</b>
              <span>{motivo?.etiqueta ?? fila.detalle}</span>
            </li>
            <li className={manual ? "is-hecho" : "is-pendiente"}>
              <b>Decisión</b>
              <span>
                {manual
                  ? manual.action === "include_with_caveat"
                    ? `Asignada a ${[manual.assigned_person_label, manual.assigned_case_key].filter(Boolean).join(", ") || "una persona del padrón"}`
                    : "Descartada, fuera del avance"
                  : "Sin decisión"}
              </span>
            </li>
          </ol>
          {manual?.note ? <Alert kind="info">{`Nota registrada: ${manual.note}`}</Alert> : null}
        </section>

        {caso ? (
          <section className="acr-pr-bloque" aria-label="Llave por canal">
            <span className="acr-av-antetitulo">Llave por canal</span>
            <dl className="acr-pr-datos is-llave">
              <Dato etiqueta="Cómo llega la llave" valor={caso.channel_key_strategy_label || "Sin estrategia declarada"} />
              <Dato etiqueta={caso.primary_identity_label || "Llave principal"} valor={caso.primary_identity_value || "Vacía"} />
              <Dato etiqueta={caso.secondary_identity_label || "Dato auxiliar"} valor={caso.secondary_identity_value || "Vacío"} />
              <Dato etiqueta="Código escrito" valor={review?.declared_code || "Vacío"} />
              <Dato etiqueta="Correo declarado" valor={review?.declared_email || "Vacío"} />
            </dl>
            {modelo?.avisos.map((aviso) => <Alert key={aviso} kind="warn">{aviso}</Alert>)}
            {motivo && !manual ? <Alert kind="info">{motivo.queHacer}</Alert> : null}
          </section>
        ) : null}

        {caso && modelo ? (
          <section className="acr-pr-bloque" aria-label="Lo que encontró el motor">
            <span className="acr-av-antetitulo">Lo que encontró el motor</span>
            {modelo.evidencia.length ? (
              <ul className="acr-pr-evidencia">
                {modelo.evidencia.slice(0, 5).map((candidato) => (
                  <li key={assistedCandidateId(candidato)}>
                    <span>
                      <b>{nombreDe(candidato)}</b>
                      <small>{candidato.case_key || "Sin código"}</small>
                    </span>
                    <span className={`acr-av-chip is-${assistedCandidateEvidenceLevel(candidato)}`}>{assistedCandidateEvidenceLabel(candidato)}</span>
                  </li>
                ))}
              </ul>
            ) : <Alert kind="info">No hay coincidencia por código, correo ni nombre.</Alert>}
          </section>
        ) : null}

        {caso && modelo && onDecision ? (
          <section className="acr-pr-bloque acr-pr-asignar" aria-label="Asignar a una persona del padrón">
            <span className="acr-av-antetitulo">Asignar a una persona del padrón</span>
            <label className="acr-pr-buscador">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Nombre, código o correo"
                aria-label="Buscar en el padrón"
              />
            </label>
            {modelo.opciones.length ? (
              <ul className="acr-pr-personas" data-qa-geometry-capacity="owned">
                {modelo.opciones.map((candidato) => {
                  const id = assistedCandidateId(candidato);
                  const activa = id === seleccion;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className={activa ? "is-activa" : undefined}
                        aria-pressed={activa}
                        onClick={() => { setSeleccion(id); setConfirmado(false); }}
                      >
                        <span>
                          <b>{nombreDe(candidato)}</b>
                          <small>{[candidato.case_key || "Sin código", candidato.current_status || candidato.base_status].filter(Boolean).join(", ")}</small>
                        </span>
                        <span className={`acr-av-chip is-${assistedCandidateEvidenceLevel(candidato)}`}>{assistedCandidateEvidenceLabel(candidato)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Alert kind="info">{busqueda ? "Nadie del padrón sin efectiva coincide con la búsqueda." : "Este público no tiene personas sin efectiva para asignar."}</Alert>
            )}
            {modelo.yaAsignadas.length ? (
              <Alert kind="warn">{`${modelo.yaAsignadas.map(nombreDe).join(", ")} ya ${modelo.yaAsignadas.length === 1 ? "tiene" : "tienen"} una efectiva y no se ${modelo.yaAsignadas.length === 1 ? "asigna" : "asignan"} de nuevo.`}</Alert>
            ) : null}
            {modelo.notas.map((item) => (
              <Alert key={`${item.title}-${item.detail}`} kind={item.tone === "warning" ? "warn" : "info"}>
                <b>{item.title}.</b> {item.detail}
              </Alert>
            ))}
            {modelo.seleccionada ? (
              <div className="acr-pr-confirmar">
                <Switch
                  checked={confirmado}
                  onToggle={() => setConfirmado((valor) => !valor)}
                  ariaLabel={`Confirmo la asignación a ${nombreDe(modelo.seleccionada)}`}
                  id="acr-pr-confirmo"
                />
                <span>Confirmo la asignación a <b>{nombreDe(modelo.seleccionada)}</b></span>
              </div>
            ) : null}
            <label className="acr-pr-nota">
              <span>Motivo{modelo.notaRequerida ? " (obligatorio para asignar)" : ""}</span>
              <textarea value={nota} onChange={(event) => setNota(event.target.value)} rows={2} />
            </label>
            {modelo.motivoParaNoAsignar ? <Alert kind="info">{modelo.motivoParaNoAsignar}</Alert> : null}
            <div className="acr-pr-acciones">
              <button type="button" className="acr-av-boton" disabled={ocupado || !modelo.puedeDescartar} onClick={() => enviar("keep_excluded")}>
                {ocupado ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
                Descartar
              </button>
              <button type="button" className="acr-av-boton is-primario" disabled={ocupado || !modelo.puedeAsignar} onClick={() => enviar("include_with_caveat")}>
                {ocupado ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
                Asignar a esta persona
              </button>
            </div>
          </section>
        ) : null}
        {!caso ? <Alert kind="info">Esta fila del corte no trae una respuesta asociada: no hay nada que asignar.</Alert> : null}
      </div>
    </aside>
  );
}
