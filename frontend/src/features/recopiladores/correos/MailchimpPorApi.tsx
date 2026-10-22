// Tarjeta «Mailchimp» del detalle de un envío (Material de campo › Correos ›
// Envíos), para cualquier envío de una campaña Mailchimp. Tres pasos en orden:
//   1. Cargar la audiencia (job con avance): contactos, campos y etiqueta del público.
//   2. Sólo en recordatorios: «Quién ya respondió» (job con avance).
//   3. Crear el borrador en Mailchimp (síncrono) y abrirlo allá.
// La app nunca envía: el botón Send se pulsa en Mailchimp (checklist 2.3).
//
// Contrato de Superficie: C1 `material-campo/correo/envios/mailchimp`,
// intrinsic; vive dentro del detalle del envío, sin scroll propio. Vacíos y
// errores se dicen dentro de la tarjeta.

import { useCallback, useEffect, useId, useState } from "react";

import {
  apiCargarAudiencia,
  apiCrearBorrador,
  apiOpcionesDeSincronizacion,
  normalizeResultadoDeAudiencia,
  type OpcionesDeSincronizacion,
  type ResultadoDeAudiencia,
  type ResultadoDeBorrador,
} from "../../../api/mailchimpSync";
import type { MailSend, MailTemplate } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { CheckCircle2, ExternalLink, FilePen, Loader2, Upload } from "../../../vendor/lucide-react";
import { MailchimpAvance } from "./MailchimpAvance";
import {
  etiquetaExcluida,
  faltaParaElBorrador,
  guardarEleccionMailchimp,
  guardarRemitente,
  leerEleccionMailchimp,
  leerRemitente,
  mensajeDeError,
  pasosDelEnvio,
  resumenDeAudiencia,
  resumenDeBorrador,
  type Remitente,
} from "./mailchimpPorApiModel";
import { esperarTrabajo, type AvanceDeTrabajo } from "./mailchimpTrabajo";
import { leerEleccion } from "./sincronizacionModel";
import { SincronizarRespuestas } from "./SincronizarRespuestas";
import "./correosSincronizacion.css";

type Props = {
  campana: string | null;
  envio: MailSend;
  plantilla: Pick<MailTemplate, "subject" | "preheader">;
  /** Hay cambios sin guardar: el borrador sale de lo guardado. */
  porGuardar?: boolean;
};

export function MailchimpPorApi({ campana, envio, plantilla, porGuardar = false }: Props) {
  const ids = useId();
  const recordada = leerEleccionMailchimp(campana);
  const [opciones, setOpciones] = useState<OpcionesDeSincronizacion | null>(null);
  const [errorConexion, setErrorConexion] = useState("");
  const [audiencia, setAudiencia] = useState(recordada?.list_id || leerEleccion(campana)?.list_id || "");
  const [etiquetaPublico, setEtiquetaPublico] = useState(recordada?.tag ?? "");
  const [etiquetaRespondio, setEtiquetaRespondio] = useState("Respondió");
  const [remitente, setRemitente] = useState<Remitente>(leerRemitente);

  const [avanceCarga, setAvanceCarga] = useState<AvanceDeTrabajo | null | undefined>(undefined);
  const [errorCarga, setErrorCarga] = useState("");
  const [carga, setCarga] = useState<ResultadoDeAudiencia | null>(null);

  const [creando, setCreando] = useState(false);
  const [errorBorrador, setErrorBorrador] = useState("");
  const [borrador, setBorrador] = useState<ResultadoDeBorrador | null>(null);

  useEffect(() => {
    let vivo = true;
    apiOpcionesDeSincronizacion()
      .then((o) => {
        if (!vivo) return;
        setOpciones(o);
        if (o.mailchimp.audiences.length === 1) setAudiencia((a) => a || o.mailchimp.audiences[0].id);
      })
      .catch((e: unknown) => { if (vivo) setErrorConexion(mensajeDeError(e, "No se pudieron leer las conexiones.")); });
    return () => { vivo = false; };
  }, []);

  // Un borrador es de un envío: al cambiar de envío, su resultado ya no aplica.
  useEffect(() => { setBorrador(null); setErrorBorrador(""); }, [envio.send_id]);

  const recordar = (cambio: Partial<{ list_id: string; tag: string }>) =>
    guardarEleccionMailchimp(campana, { list_id: audiencia, tag: etiquetaPublico.trim(), ...cambio });

  const cargarAudiencia = async () => {
    setAvanceCarga(null); setErrorCarga(""); setCarga(null);
    try {
      const { job_id } = await apiCargarAudiencia({ campaign_id: campana, list_id: audiencia, tag: etiquetaPublico });
      const r = normalizeResultadoDeAudiencia(await esperarTrabajo(job_id, setAvanceCarga));
      setCarga(r);
      if (r.tag && !etiquetaPublico.trim()) setEtiquetaPublico(r.tag);
      recordar({ tag: etiquetaPublico.trim() || r.tag });
    } catch (e) {
      setErrorCarga(mensajeDeError(e, "No se pudo cargar la audiencia."));
    } finally {
      setAvanceCarga(undefined);
    }
  };

  const crearBorrador = async () => {
    setCreando(true); setErrorBorrador(""); setBorrador(null);
    try {
      const r = await apiCrearBorrador({
        campaign_id: campana,
        send_id: envio.send_id,
        list_id: audiencia,
        from_name: remitente.from_name,
        reply_to: remitente.reply_to,
        tag: etiquetaPublico,
        exclude_tag: etiquetaExcluida(envio.kind, etiquetaRespondio),
      });
      setBorrador(r);
      guardarRemitente(remitente);
    } catch (e) {
      setErrorBorrador(mensajeDeError(e, "No se pudo crear el borrador."));
    } finally {
      setCreando(false);
    }
  };

  const conEtiqueta = useCallback((tag: string) => setEtiquetaRespondio(tag), []);

  const mc = opciones?.mailchimp;
  const conectado = !!mc?.connected && !mc.error;
  const cargandoAudiencia = avanceCarga !== undefined;
  const ocupado = cargandoAudiencia || creando;
  const esRecordatorio = envio.kind === "recordatorio";
  const falta = faltaParaElBorrador(remitente, audiencia);
  const asunto = envio.subject?.trim() || plantilla.subject.trim();
  const resumenCarga = carga ? resumenDeAudiencia(carga) : null;
  const resumenBorrador = borrador ? resumenDeBorrador(borrador) : null;
  const pasos = pasosDelEnvio(envio.kind);
  const pasoBorrador = pasos.indexOf("borrador") + 1;

  return (
    <section
      className="rec-sync rec-mc"
      aria-labelledby={`${ids}-titulo`}
      data-qa-geometry-group="material-campo/correo/envios/mailchimp"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="rec-sync-cabeza">
        <h5 id={`${ids}-titulo`} className="rec-sync-titulo">Mailchimp</h5>
        {conectado ? (
          <span className="rec-sync-chip" title={`Clave ${mc?.masked ?? ""}`}><CheckCircle2 size={12} aria-hidden /> Conectado</span>
        ) : null}
      </header>

      {!opciones && !errorConexion ? (
        <p className="rec-sync-estado"><Loader2 size={14} className="pulso-spin" aria-hidden /> Revisando la conexión…</p>
      ) : null}
      {errorConexion ? <p className="rec-mail-problema-linea" role="alert">{errorConexion}</p> : null}
      {mc && !conectado ? (
        <p className="rec-mail-problema-linea" role="status">
          {mc.error ? "No se pudo leer Mailchimp con la clave guardada: revísala con «Verificar»" : "Falta conectar Mailchimp: agrega la clave"} en Configuración › Conexiones.
        </p>
      ) : null}

      {opciones && conectado && mc ? (
        <>
          <label className="rec-env-campo">
            <span className="rec-mail-campo-rotulo"><span>Audiencia de Mailchimp</span></span>
            <select
              className="rec-mail-select"
              value={audiencia}
              disabled={ocupado}
              onChange={(e) => { setAudiencia(e.target.value); recordar({ list_id: e.target.value }); }}
            >
              <option value="">Elige la audiencia</option>
              {mc.audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.member_count != null ? ` (${a.member_count.toLocaleString("es-PE")} contactos)` : ""}
                </option>
              ))}
            </select>
          </label>
          {mc.audiences.length === 0 ? (
            <p className="rec-sync-intro">Tu cuenta de Mailchimp no tiene audiencias: crea una allá y vuelve.</p>
          ) : null}

          <ol className="rec-mc-pasos" aria-label="Pasos en Mailchimp">
            <li className="rec-mc-paso">
              <span className="rec-sync-num" aria-hidden>1</span>
              <div className="rec-mc-paso-cuerpo">
                <h6 className="rec-sync-titulo">Cargar la audiencia</h6>
                <p className="rec-sync-intro">Sube los contactos de la campaña con sus campos y la etiqueta del público.</p>
                <label className="rec-env-campo">
                  <span className="rec-mail-campo-rotulo"><span>Etiqueta del público</span></span>
                  <input
                    className="rec-mail-input"
                    value={etiquetaPublico}
                    maxLength={60}
                    placeholder="La del público de la campaña"
                    disabled={ocupado}
                    onChange={(e) => setEtiquetaPublico(e.target.value)}
                  />
                </label>
                <span className="rec-sync-accion">
                  <PulsoButton variant="primary" size="sm" className="rec-sync-boton" disabled={!audiencia || ocupado} onClick={() => void cargarAudiencia()}>
                    {cargandoAudiencia ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
                    Cargar la audiencia
                  </PulsoButton>
                </span>
                {cargandoAudiencia ? <MailchimpAvance avance={avanceCarga ?? null} rotulo="Subiendo contactos" /> : null}
                {errorCarga ? <p className="rec-mail-problema-linea" role="alert">{errorCarga}</p> : null}
                {resumenCarga ? (
                  <div className="rec-sync-resultado" role="status">
                    <b>{resumenCarga.titulo}</b>
                    {resumenCarga.lineas.map((l) => <span key={l}>{l}</span>)}
                  </div>
                ) : null}
              </div>
            </li>

            {pasos.includes("respondieron") ? (
              <li className="rec-mc-paso">
                <span className="rec-sync-num" aria-hidden>2</span>
                <div className="rec-mc-paso-cuerpo">
                  <SincronizarRespuestas campana={campana} incrustado={{ opciones, audiencia }} onEtiqueta={conEtiqueta} />
                </div>
              </li>
            ) : null}

            <li className="rec-mc-paso">
              <span className="rec-sync-num" aria-hidden>{pasoBorrador}</span>
              <div className="rec-mc-paso-cuerpo">
                <h6 className="rec-sync-titulo">Crear el borrador en Mailchimp</h6>
                <p className="rec-sync-intro">
                  {esRecordatorio
                    ? <>Va a la etiqueta del público, sin quienes tienen «{etiquetaRespondio}».</>
                    : <>Va a todos los contactos con la etiqueta del público.</>}
                  {asunto ? <> Asunto: «{asunto}».</> : null}
                </p>
                <label className="rec-env-campo">
                  <span className="rec-mail-campo-rotulo"><span>Remitente</span></span>
                  <input
                    className="rec-mail-input"
                    value={remitente.from_name}
                    maxLength={100}
                    placeholder="PULSO PUCP"
                    autoComplete="organization"
                    disabled={ocupado}
                    onChange={(e) => setRemitente((r) => ({ ...r, from_name: e.target.value }))}
                  />
                </label>
                <label className="rec-env-campo">
                  <span className="rec-mail-campo-rotulo"><span>Correo de respuesta</span></span>
                  <input
                    className="rec-mail-input"
                    type="email"
                    value={remitente.reply_to}
                    maxLength={200}
                    placeholder="pulso@enviospulso.pucp.edu.pe"
                    autoComplete="email"
                    disabled={ocupado}
                    onChange={(e) => setRemitente((r) => ({ ...r, reply_to: e.target.value }))}
                  />
                </label>
                {porGuardar ? <p className="rec-mail-problema-linea" role="status">Guarda los cambios antes: el borrador sale de lo guardado.</p> : null}
                <span className="rec-sync-accion">
                  <PulsoButton
                    variant="primary"
                    size="sm"
                    className="rec-sync-boton"
                    disabled={!!falta || ocupado}
                    title={falta || undefined}
                    onClick={() => void crearBorrador()}
                  >
                    {creando ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <FilePen size={14} aria-hidden />}
                    Crear borrador en Mailchimp
                  </PulsoButton>
                </span>
                {creando ? <p className="rec-sync-estado" role="status"><Loader2 size={14} className="pulso-spin" aria-hidden /> Armando el borrador…</p> : null}
                {errorBorrador ? <p className="rec-mail-problema-linea" role="alert">{errorBorrador}</p> : null}
                {resumenBorrador && borrador ? (
                  <div className="rec-sync-resultado" role="status">
                    <b>{resumenBorrador.titulo}</b>
                    {resumenBorrador.lineas.map((l) => <span key={l}>{l}</span>)}
                    {borrador.edit_url ? (
                      <a className="rec-mc-abrir" href={borrador.edit_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={14} aria-hidden /> Abrir en Mailchimp
                      </a>
                    ) : null}
                  </div>
                ) : null}
                <p className="rec-mc-nota">La app no envía: revisa y envía con Send en Mailchimp.</p>
              </div>
            </li>
          </ol>
        </>
      ) : null}
    </section>
  );
}

