// «Quién ya respondió» en un recordatorio de Mailchimp (Envíos de la campaña).
// Mailchimp no sabe quién terminó la encuesta: este bloque lee las respuestas
// de SurveyMonkey, las cruza con los tokens de los destinatarios y etiqueta en
// Mailchimp a quien respondió. El recordatorio va al segmento sin esa etiqueta.
//
// Contrato de Superficie: C1 `material-campo/correo/envios/respondieron`,
// intrinsic; vive dentro del detalle del envío y no tiene scroll propio.

import { useCallback, useEffect, useId, useState } from "react";

import {
  apiOpcionesDeSincronizacion,
  apiSincronizarRespuestas,
  type OpcionesDeSincronizacion,
  type ResultadoDeSincronizacion,
} from "../../../api/mailchimpSync";
import { PulsoButton } from "../../../components/PulsoButton";
import { CheckCircle2, Loader2, RefreshCw } from "../../../vendor/lucide-react";
import { PASOS_EN_MAILCHIMP, guardarEleccion, leerEleccion, resumenDeSincronizacion, segmentoEnMailchimp } from "./sincronizacionModel";
import "./correosSincronizacion.css";

type Props = { campana: string | null };

export function SincronizarRespuestas({ campana }: Props) {
  const ids = useId();
  const recordada = leerEleccion(campana);
  const [opciones, setOpciones] = useState<OpcionesDeSincronizacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [encuesta, setEncuesta] = useState(recordada?.survey_id ?? "");
  const [audiencia, setAudiencia] = useState(recordada?.list_id ?? "");
  const [etiqueta, setEtiqueta] = useState(recordada?.tag || "Respondió");
  const [trabajando, setTrabajando] = useState<"sincronizando" | null>(null);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<ResultadoDeSincronizacion | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const o = await apiOpcionesDeSincronizacion();
      setOpciones(o);
      if (o.mailchimp.audiences.length === 1) setAudiencia((a) => a || o.mailchimp.audiences[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron leer las conexiones.");
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const sincronizar = async () => {
    setTrabajando("sincronizando"); setError(""); setResultado(null);
    try {
      const r = await apiSincronizarRespuestas({ campaign_id: campana, survey_id: encuesta, list_id: audiencia, tag: etiqueta.trim() || "Respondió" });
      setResultado(r);
      guardarEleccion(campana, { survey_id: encuesta, list_id: audiencia, tag: r.tag });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar.");
    } finally {
      setTrabajando(null);
    }
  };

  const mc = opciones?.mailchimp;
  const sm = opciones?.surveymonkey;
  const listo = !!mc?.connected && !mc.error && !!sm?.connected && !!encuesta && !!audiencia;
  const resumen = resultado ? resumenDeSincronizacion(resultado) : null;

  return (
    <section
      className="rec-sync"
      aria-labelledby={`${ids}-titulo`}
      data-qa-geometry-group="material-campo/correo/envios/respondieron"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="rec-sync-cabeza">
        <h5 id={`${ids}-titulo`} className="rec-sync-titulo">Quién ya respondió</h5>
        {!cargando && mc?.connected && !mc.error ? (
          <span className="rec-sync-chip" title={`Clave ${mc.masked}`}><CheckCircle2 size={12} aria-hidden /> Mailchimp conectado</span>
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

      {!cargando && mc && (!mc.connected || mc.error) ? (
        <p className="rec-mail-problema-linea" role="status">
          {mc.error ? "No se pudo leer Mailchimp con la clave guardada: revísala con «Verificar»" : "Falta conectar Mailchimp: agrégala"} en Configuración › Conexiones.
        </p>
      ) : null}

      {!cargando && mc?.connected && !mc.error ? (
        <>
          <label className="rec-env-campo">
            <span className="rec-mail-campo-rotulo"><span>Encuesta de SurveyMonkey</span></span>
            <select className="rec-mail-select" value={encuesta} onChange={(e) => setEncuesta(e.target.value)}>
              <option value="">Elige la encuesta</option>
              {(sm?.surveys ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}{s.response_count != null ? ` (${s.response_count.toLocaleString("es-PE")} respuestas)` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="rec-env-campo">
            <span className="rec-mail-campo-rotulo"><span>Audiencia de Mailchimp</span></span>
            <select className="rec-mail-select" value={audiencia} onChange={(e) => setAudiencia(e.target.value)}>
              <option value="">Elige la audiencia</option>
              {mc.audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.member_count != null ? ` (${a.member_count.toLocaleString("es-PE")} contactos)` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="rec-env-campo">
            <span className="rec-mail-campo-rotulo"><span>Etiqueta</span></span>
            <input className="rec-mail-input" value={etiqueta} maxLength={60} onChange={(e) => setEtiqueta(e.target.value)} />
          </label>
          <span className="rec-sync-accion">
            <PulsoButton variant="primary" size="sm" className="rec-sync-boton" disabled={!listo || trabajando !== null} onClick={() => void sincronizar()}>
              {trabajando === "sincronizando" ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <RefreshCw size={14} aria-hidden />}
              Actualizar quién respondió
            </PulsoButton>
          </span>
        </>
      ) : null}

      {error ? <p className="rec-mail-problema-linea" role="alert">{error}</p> : null}

      {resumen && resultado ? (
        <div className="rec-sync-resultado" role="status">
          <b>{resumen.titulo}</b>
          {resumen.lineas.map((l) => <span key={l}>{l}</span>)}
        </div>
      ) : null}

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

    </section>
  );
}
