// «Quién ya respondió» en un recordatorio de Mailchimp (Envíos de la campaña).
// Mailchimp no sabe quién terminó la encuesta: este bloque lee las respuestas
// de SurveyMonkey, las cruza con los tokens de los destinatarios y etiqueta en
// Mailchimp a quien respondió. El recordatorio va al segmento sin esa etiqueta.
// Corre como job (1.2): se muestra el avance que publica el backend.
//
// Dos usos: suelto (tarjeta propia, con su audiencia y la guía manual) o como
// paso de la tarjeta «Mailchimp» (`MailchimpPorApi`), que le pasa conexiones y
// audiencia y no necesita la guía porque crea el borrador.
//
// Contrato de Superficie: C1 `material-campo/correo/envios/respondieron`,
// intrinsic; vive dentro del detalle del envío y no tiene scroll propio.

import { useCallback, useEffect, useId, useState } from "react";

import {
  apiOpcionesDeSincronizacion,
  apiRevisarVariable,
  apiSincronizarRespuestas,
  normalizeResultado,
  type OpcionesDeSincronizacion,
  type ResultadoDeSincronizacion,
  type RevisionDeVariable,
} from "../../../api/mailchimpSync";
import { PulsoButton } from "../../../components/PulsoButton";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "../../../vendor/lucide-react";
import { MailchimpAvance } from "./MailchimpAvance";
import { mensajeDeError } from "./mailchimpPorApiModel";
import { esperarTrabajo, type AvanceDeTrabajo } from "./mailchimpTrabajo";
import { PASOS_EN_MAILCHIMP, guardarEleccion, leerEleccion, puedeActualizar, resumenDeSincronizacion, segmentoEnMailchimp } from "./sincronizacionModel";
import "./correosSincronizacion.css";

type Props = {
  campana: string | null;
  /** Como paso de la tarjeta «Mailchimp»: conexiones y audiencia vienen de afuera. */
  incrustado?: { opciones: OpcionesDeSincronizacion; audiencia: string };
  /** Avisa la etiqueta vigente (el borrador la excluye). */
  onEtiqueta?: (tag: string) => void;
};

export function SincronizarRespuestas({ campana, incrustado, onEtiqueta }: Props) {
  const ids = useId();
  const recordada = leerEleccion(campana);
  const [propias, setPropias] = useState<OpcionesDeSincronizacion | null>(null);
  const [cargando, setCargando] = useState(!incrustado);
  const [encuesta, setEncuesta] = useState(recordada?.survey_id ?? "");
  const [audienciaPropia, setAudiencia] = useState(recordada?.list_id ?? "");
  const [etiqueta, setEtiqueta] = useState(recordada?.tag || "Respondió");
  const [avance, setAvance] = useState<AvanceDeTrabajo | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<ResultadoDeSincronizacion | null>(null);
  // La encuesta elegida, ¿recibe la variable del token? Se pregunta al elegirla.
  const [revision, setRevision] = useState<{ encuesta: string; r: RevisionDeVariable } | null>(null);
  const trabajando = avance !== undefined;
  const opciones = incrustado?.opciones ?? propias;
  const audiencia = incrustado?.audiencia ?? audienciaPropia;

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const o = await apiOpcionesDeSincronizacion();
      setPropias(o);
      if (o.mailchimp.audiences.length === 1) setAudiencia((a) => a || o.mailchimp.audiences[0].id);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudieron leer las conexiones."));
    } finally {
      setCargando(false);
    }
  }, []);
  const suelto = !incrustado;
  useEffect(() => { if (suelto) void cargar(); }, [cargar, suelto]);
  useEffect(() => { onEtiqueta?.(etiqueta.trim() || "Respondió"); }, [etiqueta, onEtiqueta]);

  const smConectado = !!(incrustado?.opciones ?? propias)?.surveymonkey.connected;
  useEffect(() => {
    if (!encuesta || !smConectado) return;
    let vigente = true;
    apiRevisarVariable({ campaign_id: campana, survey_id: encuesta })
      .then((r) => { if (vigente) setRevision({ encuesta, r }); })
      // Sin veredicto no se afirma nada: la sincronización vuelve a revisar y dice la causa.
      .catch(() => { if (vigente) setRevision(null); });
    return () => { vigente = false; };
  }, [campana, encuesta, smConectado]);
  const revisionVigente = revision && revision.encuesta === encuesta ? revision.r : null;

  const sincronizar = async () => {
    setAvance(null); setError(""); setResultado(null);
    try {
      const { job_id } = await apiSincronizarRespuestas({ campaign_id: campana, survey_id: encuesta, list_id: audiencia, tag: etiqueta.trim() || "Respondió" });
      const r = normalizeResultado(await esperarTrabajo(job_id, setAvance));
      setResultado(r);
      guardarEleccion(campana, { survey_id: encuesta, list_id: audiencia, tag: r.tag });
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo actualizar."));
    } finally {
      setAvance(undefined);
    }
  };

  const mc = opciones?.mailchimp;
  const sm = opciones?.surveymonkey;
  const mcListo = !!mc?.connected && !mc.error;
  const listo = puedeActualizar({
    mailchimpListo: mcListo,
    surveymonkeyConectado: !!sm?.connected,
    encuesta,
    audiencia,
    coincide: revisionVigente ? revisionVigente.coincide : null,
  });
  const resumen = resultado ? resumenDeSincronizacion(resultado) : null;
  const Titulo = incrustado ? "h6" : "h5";

  return (
    <section
      className={`rec-sync${incrustado ? " rec-sync--paso" : ""}`}
      aria-labelledby={`${ids}-titulo`}
      data-qa-geometry-group="material-campo/correo/envios/respondieron"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="rec-sync-cabeza">
        <Titulo id={`${ids}-titulo`} className="rec-sync-titulo">Quién ya respondió</Titulo>
        {!incrustado && !cargando && mcListo ? (
          <span className="rec-sync-chip" title={`Clave ${mc?.masked ?? ""}`}><CheckCircle2 size={12} aria-hidden /> Mailchimp conectado</span>
        ) : null}
      </header>
      <p className="rec-sync-intro">
        Trae de SurveyMonkey quién terminó la encuesta y le pone la etiqueta «{etiqueta || "Respondió"}» en Mailchimp.
      </p>

      {cargando ? (
        <p className="rec-sync-estado"><Loader2 size={14} className="pulso-spin" aria-hidden /> Revisando las conexiones…</p>
      ) : null}

      {!cargando && sm && !sm.connected ? (
        <p className="rec-mail-problema-linea" role="status">Falta la conexión con SurveyMonkey: agrégala en Configuración › Conexiones.</p>
      ) : null}

      {!incrustado && !cargando && mc && !mcListo ? (
        <p className="rec-mail-problema-linea" role="status">
          {mc.error ? "No se pudo leer Mailchimp con la clave guardada: revísala con «Verificar»" : "Falta conectar Mailchimp: agrégala"} en Configuración › Conexiones.
        </p>
      ) : null}

      {!cargando && mcListo ? (
        <>
          <label className="rec-env-campo">
            <span className="rec-mail-campo-rotulo"><span>Encuesta de SurveyMonkey</span></span>
            <select className="rec-mail-select" value={encuesta} disabled={trabajando} onChange={(e) => setEncuesta(e.target.value)}>
              <option value="">Elige la encuesta</option>
              {(sm?.surveys ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}{s.response_count != null ? ` (${s.response_count.toLocaleString("es-PE")} respuestas)` : ""}
                </option>
              ))}
            </select>
          </label>
          {!incrustado ? (
            <label className="rec-env-campo">
              <span className="rec-mail-campo-rotulo"><span>Audiencia de Mailchimp</span></span>
              <select className="rec-mail-select" value={audiencia} disabled={trabajando} onChange={(e) => setAudiencia(e.target.value)}>
                <option value="">Elige la audiencia</option>
                {(mc?.audiences ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.member_count != null ? ` (${a.member_count.toLocaleString("es-PE")} contactos)` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {revisionVigente ? (
            <p
              className={`rec-sync-variable${revisionVigente.coincide ? "" : " rec-sync-variable--falta"}`}
              role="status"
              data-testid="sync-variable"
            >
              {revisionVigente.coincide ? <CheckCircle2 size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />}
              <span>{revisionVigente.mensaje}</span>
            </p>
          ) : null}
          <label className="rec-env-campo">
            <span className="rec-mail-campo-rotulo"><span>Etiqueta</span></span>
            <input className="rec-mail-input" value={etiqueta} maxLength={60} disabled={trabajando} onChange={(e) => setEtiqueta(e.target.value)} />
          </label>
          <span className="rec-sync-accion">
            <PulsoButton variant="primary" size="sm" className="rec-sync-boton" disabled={!listo || trabajando} onClick={() => void sincronizar()}>
              {trabajando ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <RefreshCw size={14} aria-hidden />}
              Actualizar quién respondió
            </PulsoButton>
          </span>
        </>
      ) : null}

      {trabajando ? <MailchimpAvance avance={avance ?? null} rotulo="Cruzando respuestas" /> : null}

      {error ? <p className="rec-mail-problema-linea" role="alert">{error}</p> : null}

      {resumen && resultado ? (
        <div className="rec-sync-resultado" role="status">
          <b>{resumen.titulo}</b>
          {resumen.lineas.map((l) => <span key={l}>{l}</span>)}
        </div>
      ) : null}

      {!incrustado ? (
        <div className="rec-sync-guia">
          <span className="rec-sync-guia-titulo">Para enviar el recordatorio</span>
          <ol className="rec-sync-pasos" aria-label="Cómo sale el recordatorio en Mailchimp">
            {PASOS_EN_MAILCHIMP.map((p, i) => (
              <li key={p}>
                <span className="rec-sync-num" aria-hidden>{i + 1}</span>
                <span>
                  {i === 3 ? <>En To, elige el segmento <code className="rec-sync-segmento">{segmentoEnMailchimp(etiqueta.trim() || "Respondió")}</code> y envía con Send.</> : p}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
