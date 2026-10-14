import { useEffect, useState } from "react";
import { Check, Copy } from "../../../vendor/lucide-react";
import { truncarHuella, versionTraductorLegible } from "./smImportModel";

// Lo técnico de la importación, plegado: el analista no lo necesita para
// decidir, pero soporte sí. El identificador largo se trunca a la vista y se
// copia entero con un botón explícito (dirección creativa v3, Voz).

function CopiarValor({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  const [estado, setEstado] = useState<"listo" | "copiado" | "error">("listo");
  useEffect(() => {
    if (estado === "listo") return;
    const t = window.setTimeout(() => setEstado("listo"), 1800);
    return () => window.clearTimeout(t);
  }, [estado]);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setEstado("copiado");
    } catch {
      setEstado("error");
    }
  }
  return (
    <button
      type="button"
      className="pulso-xf-smi-copiar"
      onClick={() => void copiar()}
      aria-label={`Copiar ${etiqueta}`}
    >
      {estado === "copiado" ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
      <span aria-live="polite">
        {estado === "copiado" ? "Copiado" : estado === "error" ? "No se pudo copiar" : "Copiar"}
      </span>
    </button>
  );
}

export function SmDetallesTecnicos({
  surveyId,
  definitionSha256,
  translationProfile,
}: {
  surveyId: string;
  definitionSha256?: string | null;
  translationProfile?: string | null;
}) {
  const huella = (definitionSha256 ?? "").trim();
  const version = versionTraductorLegible(translationProfile);
  return (
    <details className="pulso-xf-smi-tecnico">
      <summary>Detalles técnicos</summary>
      <dl>
        <div>
          <dt>ID de la encuesta</dt>
          <dd>
            <code>{surveyId || "—"}</code>
            {surveyId ? <CopiarValor valor={surveyId} etiqueta="el ID de la encuesta" /> : null}
          </dd>
        </div>
        <div>
          <dt>Versión de la definición</dt>
          <dd>
            {huella ? (
              <>
                <code title="Identifica la definición exacta que se revisó; si cambia en SurveyMonkey, la importación se detiene.">
                  {truncarHuella(huella)}
                </code>
                <CopiarValor valor={huella} etiqueta="el identificador de la definición" />
              </>
            ) : (
              <span>No disponible</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Traductor</dt>
          <dd>{version || "No disponible"}</dd>
        </div>
      </dl>
    </details>
  );
}
