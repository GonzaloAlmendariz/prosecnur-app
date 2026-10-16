// Adaptación › lo que se entrega sin recodificar (ADR 0078, punto 5): las
// preguntas marcadas que siguen sin decidir. Cada una trae su salida: abrirla en
// Codificar o registrar por qué no se codifica, que es lo que la vuelve una
// decisión y no un olvido. Lo ya decidido va aparte y plegado.

import { useState } from "react";
import { useInRouterContext, useNavigate } from "react-router-dom";
import { apiCodifNoCategorizar, type CodifSinRecodificar } from "../../api/codificacion";
import { Alert } from "../../components/Alert";
import { PulsoButton } from "../../components/PulsoButton";
import { formatoConteoDe } from "../../lib/formatoNumero";
import { textoPlano } from "../../lib/textoPlano";
import { urlCodificarPregunta } from "./codificarDireccion";
import { DejarEnOtroBoton } from "./DejarEnOtroBoton";
import "./SinRecodificarAviso.css";

export function SinRecodificarAviso({ variables }: { variables: readonly CodifSinRecodificar[] }) {
  // Lo decidido aquí mismo, para no esperar otra adaptación.
  const [decididas, setDecididas] = useState<Record<string, string>>({});
  const filas = variables.map((v) => (decididas[v.parent] ? { ...v, deliberado: true, motivo: decididas[v.parent] } : v));
  const pendientes = filas.filter((v) => !v.deliberado);
  const yaDecididas = filas.filter((v) => v.deliberado);
  if (!filas.length) return null;

  return (
    <Alert kind={pendientes.length ? "warn" : "info"}>
      <div className="pulso-sinrecod" data-testid="codificacion-sin-recodificar">
        {pendientes.length ? (
          <>
            <strong>
              {pendientes.length === 1
                ? "1 pregunta marcada sigue sin decidir"
                : `${pendientes.length} preguntas marcadas siguen sin decidir`}
            </strong>
            <p>Se entregan tal como vienen. Codifícalas o registra por qué no se codifican.</p>
            <ul className="pulso-sinrecod-lista">
              {pendientes.map((v) => (
                <FilaPendiente key={v.parent} v={v} onDecidida={(motivo) => setDecididas((d) => ({ ...d, [v.parent]: motivo }))} />
              ))}
            </ul>
          </>
        ) : (
          <strong>Todas las preguntas marcadas tienen una decisión.</strong>
        )}
        {yaDecididas.length ? (
          <details className="pulso-sinrecod-decididas">
            <summary>
              {yaDecididas.length === 1 ? "1 se entrega sin recodificar por decisión" : `${yaDecididas.length} se entregan sin recodificar por decisión`}
            </summary>
            <ul>
              {yaDecididas.map((v) => (
                <li key={v.parent}><code>{v.parent}</code> — {v.motivo}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </Alert>
  );
}

export function BotonCodificar({ pregunta, texto = "Codificar" }: { pregunta: string; texto?: string }) {
  const navigate = useNavigate();
  return <PulsoButton variant="secondary" size="sm" onClick={() => navigate(urlCodificarPregunta(pregunta))}>{texto}</PulsoButton>;
}

function FilaPendiente({ v, onDecidida }: { v: CodifSinRecodificar; onDecidida: (motivo: string) => void }) {
  const conRouter = useInRouterContext();
  const [motivo, setMotivo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const guardar = async () => {
    const m = (motivo ?? "").trim();
    if (!m) return;
    setGuardando(true);
    setError("");
    try {
      await apiCodifNoCategorizar(v.parent, m);
      onDecidida(m);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };
  const etiqueta = textoPlano(v.parent_label);
  return (
    <li className="pulso-sinrecod-fila">
      <div className="pulso-sinrecod-pregunta">
        <code>{v.parent}</code>
        {etiqueta ? <span title={etiqueta}>{etiqueta}</span> : null}
        <small>{formatoConteoDe(v.n_respuestas, "respuesta")}</small>
      </div>
      {motivo === null ? (
        <div className="pulso-sinrecod-acciones">
          {conRouter ? <BotonCodificar pregunta={v.parent} /> : null}
          {v.con_texto_otro ? <DejarEnOtroBoton pregunta={v.parent} /> : null}
          <PulsoButton variant="ghost" size="sm" onClick={() => setMotivo("")}>No se codifica…</PulsoButton>
        </div>
      ) : (
        <form className="pulso-sinrecod-motivo" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
          <input
            value={motivo}
            autoFocus
            placeholder="Por qué no se codifica (p. ej., las opciones ya cubren las respuestas)"
            aria-label={`Motivo para no codificar ${v.parent}`}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <PulsoButton type="submit" variant="primary" size="sm" disabled={guardando || !motivo.trim()}>Guardar</PulsoButton>
          <PulsoButton type="button" variant="ghost" size="sm" onClick={() => { setMotivo(null); setError(""); }}>Cancelar</PulsoButton>
        </form>
      )}
      {error ? <span className="pulso-armon-error" role="alert">{error}</span> : null}
    </li>
  );
}
