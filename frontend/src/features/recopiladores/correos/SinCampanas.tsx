// Cero campañas de correo (E1h, C3/C5): el vacío es legítimo —el proyecto
// todavía no tiene correos— y se llena desde aquí mismo con una de las dos
// plantillas reales o en blanco. Cada opción crea la campaña de un clic con su
// nombre por defecto; se renombra después en «Gestionar campañas».

import { useId, useState } from "react";

import { MAIL_PLATFORMS, type MailPlatform, type MailPreset } from "../../../api/materialMail";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { FileCode2, FilePlus2, Loader2, Mail } from "../../../vendor/lucide-react";
import { NOMBRE_DE_PLATAFORMA } from "./dialectos";
import { ORIGEN_EN_BLANCO } from "./modeloCampanas";
import { origenDePreset } from "./modeloCorreo";
import "./correosEnvios.css";
import "./correosGuia.css";

type Props = {
  presets: readonly MailPreset[];
  miniaturas: Record<string, string | null>;
  /** Qué opción se está creando, para su indicador; `null` si ninguna. */
  creando: string | null;
  aviso: string | null;
  onCrear: (origen: string, nombre: string, platform: MailPlatform) => void;
  /** «Desde un correo existente…»: abre el diálogo de importar. */
  onImportar: () => void;
};

function Miniatura({ html, titulo }: { html: string | null | undefined; titulo: string }) {
  return (
    <span className="rec-camp-mini" aria-hidden>
      {html ? (
        <iframe title={`Miniatura de ${titulo}`} tabIndex={-1} sandbox="allow-same-origin" srcDoc={html} scrolling="no" />
      ) : null}
    </span>
  );
}

export function SinCampanas({ presets, miniaturas, creando, aviso, onCrear, onImportar }: Props) {
  const ocupado = creando !== null;
  const ids = useId();
  const [plataforma, setPlataforma] = useState<MailPlatform>("mailchimp");
  return (
    <div className="rec-camp-vacio" data-qa-geometry-capacity="owned">
      <EstadoVacio
        tamano="normal"
        icono={<Mail size={18} />}
        titulo="Todavía no hay campañas de correo"
        descripcion="Cada campaña es un correo para un grupo: elige una plantilla real para empezar, parte en blanco o trae un correo que ya tienes."
        accion={(
          <div className="rec-camp-vacio-accion">
          <ol className="rec-guia-pasos" aria-label="Cómo se arma un correo">
            <li><span><b>Elige una plantilla</b> o importa tu HTML</span></li>
            <li><span><b>Edita</b> sobre el correo</span></li>
            <li><span><b>Exporta</b> para tu plataforma</span></li>
          </ol>
          <fieldset className="rec-camp-vacio-plataforma">
            <legend>Sale por</legend>
            {MAIL_PLATFORMS.map((p) => (
              <label key={p} className={plataforma === p ? "is-on" : undefined}>
                <input type="radio" name={`${ids}-plataforma`} value={p} checked={plataforma === p} onChange={() => setPlataforma(p)} />
                {NOMBRE_DE_PLATAFORMA[p]}
              </label>
            ))}
          </fieldset>
          <ul
            className="rec-camp-vacio-opciones"
            data-qa-geometry-group="material-campo/catalogo/correos-campanas"
            data-qa-geometry-contract="equal"
            aria-label="Cómo empezar la primera campaña"
          >
            {presets.map((p) => (
              <li key={p.preset_id} data-qa-geometry-member>
                <button
                  type="button"
                  className="rec-camp-vacio-op"
                  disabled={ocupado}
                  aria-busy={creando === p.preset_id}
                  onClick={() => onCrear(p.preset_id, p.title, plataforma)}
                >
                  <Miniatura html={miniaturas[p.preset_id]} titulo={p.title} />
                  <span className="rec-camp-vacio-op-texto">
                    <b>{p.title}</b>
                    {origenDePreset(p.preset_id) ? <small>Plantilla real · {origenDePreset(p.preset_id)}</small> : null}
                  </span>
                  {creando === p.preset_id ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : null}
                </button>
              </li>
            ))}
            <li data-qa-geometry-member>
              <button
                type="button"
                className="rec-camp-vacio-op is-blanco"
                disabled={ocupado}
                aria-busy={creando === ORIGEN_EN_BLANCO}
                onClick={() => onCrear(ORIGEN_EN_BLANCO, "Correo nuevo", plataforma)}
              >
                <span className="rec-camp-mini is-blanco" aria-hidden><FilePlus2 size={26} /></span>
                <span className="rec-camp-vacio-op-texto">
                  <b>Empezar en blanco</b>
                  <small>Saludo, un párrafo, firma y pie</small>
                </span>
                {creando === ORIGEN_EN_BLANCO ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : null}
              </button>
            </li>
            <li data-qa-geometry-member>
              <button type="button" className="rec-camp-vacio-op is-blanco" disabled={ocupado} onClick={onImportar}>
                <span className="rec-camp-mini is-blanco" aria-hidden><FileCode2 size={26} /></span>
                <span className="rec-camp-vacio-op-texto">
                  <b>Desde un correo existente…</b>
                  <small>Un HTML de Mailchimp o SurveyMonkey</small>
                </span>
              </button>
            </li>
          </ul>
          </div>
        )}
      />
      {aviso ? <p className="rec-camp-mensaje is-error rec-camp-vacio-aviso" role="alert">{aviso}</p> : null}
    </div>
  );
}
