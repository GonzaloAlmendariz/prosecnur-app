// Cero campañas de correo (E1h, C3/C5): el vacío es legítimo —el proyecto
// todavía no tiene correos— y se llena desde aquí mismo con una de las dos
// plantillas reales o en blanco. Cada opción crea la campaña de un clic con su
// nombre por defecto; se renombra después en «Gestionar campañas».

import type { MailPreset } from "../../../api/materialMail";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { FilePlus2, Loader2, Mail } from "../../../vendor/lucide-react";
import { ORIGEN_EN_BLANCO } from "./modeloCampanas";
import { origenDePreset } from "./modeloCorreo";

type Props = {
  presets: readonly MailPreset[];
  miniaturas: Record<string, string | null>;
  /** Qué opción se está creando, para su indicador; `null` si ninguna. */
  creando: string | null;
  aviso: string | null;
  onCrear: (origen: string, nombre: string) => void;
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

export function SinCampanas({ presets, miniaturas, creando, aviso, onCrear }: Props) {
  const ocupado = creando !== null;
  return (
    <div className="rec-camp-vacio" data-qa-geometry-capacity="owned">
      <EstadoVacio
        tamano="normal"
        icono={<Mail size={18} />}
        titulo="Todavía no hay campañas de correo"
        descripcion="Cada campaña es un correo para un grupo: elige una plantilla real para empezar o parte en blanco."
        accion={(
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
                  onClick={() => onCrear(p.preset_id, p.title)}
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
                onClick={() => onCrear(ORIGEN_EN_BLANCO, "Correo nuevo")}
              >
                <span className="rec-camp-mini is-blanco" aria-hidden><FilePlus2 size={26} /></span>
                <span className="rec-camp-vacio-op-texto">
                  <b>Empezar en blanco</b>
                  <small>Saludo, un párrafo, firma y pie</small>
                </span>
                {creando === ORIGEN_EN_BLANCO ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : null}
              </button>
            </li>
          </ul>
        )}
      />
      {aviso ? <p className="rec-camp-mensaje is-error rec-camp-vacio-aviso" role="alert">{aviso}</p> : null}
    </div>
  );
}
