import { useId } from "react";

import { Alert } from "../../../../components/Alert";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PulsoButton } from "../../../../components/PulsoButton";
import { Loader2, Mail, PlugZap, RefreshCw } from "../../../../vendor/lucide-react";
import { AvanceCorreoEnvios } from "./AvanceCorreoEnvios";
import { AvanceCorreoInvalidos } from "./AvanceCorreoInvalidos";
import { AvanceCorreoPublicos } from "./AvanceCorreoPublicos";
import {
  cifra,
  type EstadoCorreo,
  faseCorreo,
  marcaReadiness,
  nombreAudiencia,
  porcentaje,
} from "./avanceCorreoModelo";
import { formatDate } from "./formato";
import "./AvanceCorreo.css";

// Presentación de Avance › Correo: pinta el estado que le da `AvanceCorreo`
// (contenedor con la carga y el job). Sin efectos, para poder probar cada fase
// con un render estático.

export type AvanceCorreoVistaProps = {
  s: EstadoCorreo;
  elegida: string;
  cambiando: boolean;
  onElegir: (listId: string) => void;
  onGuardarAudiencia: () => void;
  onCambiar: () => void;
  onCancelarCambio: () => void;
  onActualizar: () => void;
  onReintentar: () => void;
};

export function AvanceCorreoVista({
  s,
  elegida,
  cambiando,
  onElegir,
  onGuardarAudiencia,
  onCambiar,
  onCancelarCambio,
  onActualizar,
  onReintentar,
}: AvanceCorreoVistaProps) {
  const ids = useId();
  const estado = s.estado;
  const fase = faseCorreo({ estado, cargando: s.cargando, error: s.error });
  const leyendo = s.lectura !== null;
  const ocupado = leyendo || s.guardandoAudiencia;
  const listId = estado?.list_id ?? "";
  const eligiendo = Boolean(estado?.conectado) && (!listId || cambiando);
  const valorSelector = elegida || (cambiando ? listId : "");

  const envios = estado?.envios ?? [];
  const entregados = envios.reduce((n, e) => n + (e.entregados ?? 0), 0);
  const respuestas = envios.reduce((n, e) => n + (e.respuestas ?? 0), 0);
  const recordatorios = envios.filter((e) => e.tipo === "recordatorio").length;

  return (
    <section
      className="pulso-panel mon-fill-panel mon-advance-panel mon-correo"
      aria-labelledby={`${ids}-titulo`}
      aria-busy={fase === "cargando" || leyendo}
    >
      <span hidden data-audit-ready={marcaReadiness(fase)} />
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Avance</span>
          <h2 className="pulso-panel-title" id={`${ids}-titulo`}>
            <span className="mon-title-icon"><Mail size={16} aria-hidden /> Correo</span>
          </h2>
          <p className="pulso-panel-hint">Envíos de Mailchimp cruzados con el universo de Monitoreo, por público y por envío.</p>
        </div>
      </header>

      {estado?.conectado ? (
        <div className="mon-correo-barra" role="group" aria-label="Lectura de Mailchimp">
          <div className="mon-correo-audiencia">
            {eligiendo ? (
              <>
                <label className="mon-correo-filtro">
                  <span>Audiencia de Mailchimp</span>
                  <select value={valorSelector} disabled={ocupado} onChange={(e) => onElegir(e.target.value)}>
                    <option value="">Elige la audiencia</option>
                    {s.audiencias.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name || a.id}{a.member_count != null ? ` · ${cifra(a.member_count)} contactos` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <PulsoButton variant="secondary" size="sm" disabled={ocupado || !elegida || elegida === listId} onClick={onGuardarAudiencia}>
                  {s.guardandoAudiencia ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : null}
                  Usar esta audiencia
                </PulsoButton>
                {cambiando ? (
                  <PulsoButton variant="ghost" size="sm" disabled={ocupado} onClick={onCancelarCambio}>
                    Cancelar
                  </PulsoButton>
                ) : null}
              </>
            ) : (
              <>
                <span className="mon-correo-audiencia-rotulo">Audiencia</span>
                <strong>{nombreAudiencia(listId, s.audiencias)}</strong>
                <PulsoButton variant="ghost" size="sm" disabled={ocupado} onClick={onCambiar}>
                  Cambiar
                </PulsoButton>
              </>
            )}
          </div>
          <div className="mon-correo-barra-accion">
            {listId ? (
              <span className="mon-correo-leido">{estado.leido_at ? `Leído el ${formatDate(estado.leido_at)}` : "Sin lecturas aún"}</span>
            ) : null}
            <PulsoButton variant="primary" size="sm" disabled={ocupado || !listId} onClick={onActualizar}>
              {leyendo ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <RefreshCw size={14} aria-hidden />}
              Actualizar desde Mailchimp
            </PulsoButton>
          </div>
        </div>
      ) : null}

      {s.lectura ? (
        <div className="mon-correo-progreso" role="status">
          <span>
            Leyendo Mailchimp{s.lectura.message ? ` — ${s.lectura.message}` : "…"}
            {s.lectura.percent != null ? ` · ${porcentaje(s.lectura.percent / 100)}` : ""}
          </span>
          <div
            className="mon-correo-progreso-barra"
            role="progressbar"
            aria-label="Avance de la lectura de Mailchimp"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={s.lectura.percent ?? undefined}
          >
            <i style={{ inlineSize: `${Math.max(4, s.lectura.percent ?? 4)}%` }} />
          </div>
        </div>
      ) : null}
      {s.aviso ? <p className="mon-correo-confirmacion" role="status">{s.aviso}</p> : null}
      {s.error && estado ? <Alert kind="error">{s.error}</Alert> : null}
      {estado && estado.avisos.length > 0 && (fase === "listo" || fase === "sin-envios") ? (
        <Alert kind="warn">
          <ul className="mon-correo-avisos">{estado.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
        </Alert>
      ) : null}

      {fase === "cargando" ? (
        <p className="mon-correo-cargando" role="status"><Loader2 size={14} className="pulso-spin" aria-hidden /> Leyendo el estado de Mailchimp…</p>
      ) : null}
      {fase === "error" ? (
        <EstadoVacio
          icono={<Mail size={16} />}
          titulo="No se pudo leer el estado de Mailchimp"
          descripcion={s.error}
          accion={<PulsoButton variant="secondary" size="sm" onClick={onReintentar}>Reintentar</PulsoButton>}
        />
      ) : null}
      {fase === "sin-conexion" ? (
        <EstadoVacio
          tamano="normal"
          icono={<PlugZap size={18} />}
          titulo="Falta conectar Mailchimp"
          descripcion="Agrega la clave de Mailchimp en Configuración › Conexiones y vuelve a esta pestaña."
        />
      ) : null}
      {fase === "sin-audiencia" ? (
        <EstadoVacio
          tamano="normal"
          icono={<Mail size={18} />}
          titulo="Elige la audiencia del estudio"
          descripcion="Es la lista de Mailchimp desde la que salen las invitaciones; elígela arriba."
        />
      ) : null}
      {fase === "sin-lecturas" ? (
        <EstadoVacio
          tamano="normal"
          icono={<RefreshCw size={18} />}
          titulo="Todavía no hay lecturas"
          descripcion="Actualiza desde Mailchimp para traer los envíos."
        />
      ) : null}

      {(fase === "listo" || fase === "sin-envios") && estado ? (
        <>
          <div className="mon-advance-hero mon-correo-hero">
            <div className="mon-advance-hero-copy">
              <span>Correo</span>
              <strong>{cifra(respuestas)} respuestas atribuidas a {cifra(envios.length)} envíos</strong>
              <p>Una respuesta se atribuye al envío donde la persona hizo clic por primera vez; sin clic, al último correo que recibió antes de responder.</p>
            </div>
            <div
              className="mon-advance-hero-kpis"
              data-qa-geometry-group="monitoreo/acreditacion/avance/correo/kpis"
              data-qa-geometry-contract="equal"
            >
              <span className="mon-advance-metric is-base">
                <em>Envíos</em>
                <strong>{cifra(envios.length)}</strong>
                <small>{cifra(envios.length - recordatorios)} invitaciones · {cifra(recordatorios)} recordatorios</small>
              </span>
              <span className="mon-advance-metric is-ready">
                <em>Entregados</em>
                <strong>{cifra(entregados)}</strong>
                <small>suma de todos los envíos</small>
              </span>
              <span className={`mon-advance-metric ${estado.invalidos.total ? "is-warning" : "is-base"}`}>
                <em>Correos inválidos</em>
                <strong>{cifra(estado.invalidos.total ?? estado.invalidos.filas.length)}</strong>
                <small>salen de la base alcanzable</small>
              </span>
              <span className="mon-advance-metric is-target">
                <em>Respuestas atribuidas</em>
                <strong>{cifra(respuestas)}</strong>
                <small>{porcentaje(entregados ? respuestas / entregados : null)} de los entregados</small>
              </span>
            </div>
          </div>
          <div
            className="mon-correo-cuerpo"
            data-qa-geometry-group="monitoreo/acreditacion/avance/correo"
            data-qa-geometry-contract="intrinsic"
          >
            <AvanceCorreoPublicos publicos={estado.publicos} umbrales={estado.umbrales} />
            <AvanceCorreoEnvios envios={envios} />
            <AvanceCorreoInvalidos invalidos={estado.invalidos} envios={envios} />
          </div>
        </>
      ) : null}
    </section>
  );
}
