// Enlace personal a la encuesta (ADR 0112 §2): se pega el enlace del
// recopilador de SurveyMonkey y la app arma uno propio para cada contacto
// efectivo. Generar de nuevo conserva el de quien ya lo tenía.

import type { FormEvent } from "react";

import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteoDe } from "../../../../lib/formatoNumero";
import { CheckCircle2, Link2, Loader2 } from "../../../../vendor/lucide-react";
import { textoDelResultado } from "./modeloContactos";
import { useContactosStore } from "./store";

type Props = {
  efectivos: number;
  conEnlace: number;
  onGenerar: () => void;
};

export function EnlaceDeEncuesta({ efectivos, conEnlace, onGenerar }: Props) {
  const enlace = useContactosStore((s) => s.enlace);
  const setUrl = useContactosStore((s) => s.setUrlDelEnlace);
  const sinEfectivos = efectivos === 0;
  const enviar = (event: FormEvent) => {
    event.preventDefault();
    onGenerar();
  };
  return (
    <section
      className="rec-contactos-enlace"
      aria-labelledby="rec-contactos-enlace-titulo"
      data-testid="contactos-enlace"
    >
      <h2 id="rec-contactos-enlace-titulo" className="rec-contactos-titulo">
        <Link2 size={16} aria-hidden />
        Enlace personal a la encuesta
      </h2>
      <p className="rec-contactos-nota">Cada persona recibe su propio enlace; así se sabe quién respondió.</p>
      <form className="rec-contactos-enlace-form" onSubmit={enviar}>
        <label htmlFor="rec-contactos-enlace-url" className="rec-contactos-etiqueta">
          Enlace del recopilador de SurveyMonkey
        </label>
        <div className="rec-contactos-enlace-fila">
          <input
            id="rec-contactos-enlace-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://es.surveymonkey.com/r/…"
            value={enlace.url}
            aria-invalid={enlace.error ? true : undefined}
            aria-describedby={enlace.error ? "rec-contactos-enlace-error" : undefined}
            onChange={(event) => setUrl(event.target.value)}
          />
          <PulsoButton type="submit" variant="primary" size="sm" disabled={enlace.generando || sinEfectivos}>
            {enlace.generando ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : null}
            {enlace.generando ? "Generando…" : "Generar enlaces"}
          </PulsoButton>
        </div>
      </form>
      {enlace.error ? (
        <p id="rec-contactos-enlace-error" className="rec-contactos-error" role="alert">{enlace.error}</p>
      ) : enlace.resultado ? (
        <p className="rec-contactos-listo" role="status">
          <CheckCircle2 size={14} aria-hidden />
          <span>
            {textoDelResultado(enlace.resultado)}. Úsalo en el botón del correo con el campo «Enlace a la encuesta».
          </span>
        </p>
      ) : null}
      {!enlace.error && enlace.resultado?.aviso ? (
        <p className="rec-contactos-aviso" role="status">{enlace.resultado.aviso}</p>
      ) : null}
      {enlace.error || enlace.resultado ? null : sinEfectivos ? (
        <p className="rec-contactos-enlace-estado">Sin contactos efectivos no hay a quién darle enlace.</p>
      ) : conEnlace > 0 ? (
        <p className="rec-contactos-enlace-estado" role="status">
          {formatoConteoDe(conEnlace, "contacto ya tiene", "contactos ya tienen")} su enlace. Generar de nuevo los conserva.
        </p>
      ) : null}
    </section>
  );
}
