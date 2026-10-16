// Codificación › Adaptar: las preguntas que quedan fuera de la adaptación, cada
// una con su motivo en llano y, cuando se puede resolver aquí, la acción.
//
// Caso real (HSyVbG 2026, 2026-10-16): P29_10 se emparejó por error con su
// texto «Otro», se le armaron grupos, y al deshacer el emparejamiento los grupos
// quedaron huérfanos. El aviso decía «ajuste no reconocido» y no había cómo
// destrabarlo. Ahora dice qué pasó y ofrece descartar esos grupos o volver a
// emparejar; una pregunta con texto pero sin modo ofrece elegirlo.

import { useState } from "react";
import type { PlanPregunta } from "../../api/dashboard";
import { apiCodifGrupos, apiCodifPareja } from "../../api/codificacion";
import { Alert } from "../../components/Alert";
import { PulsoButton } from "../../components/PulsoButton";
import { formatoConteoDe } from "../../lib/formatoNumero";
import { textoPlano } from "../../lib/textoPlano";
import { motivoNoSoportado } from "./planAdaptacionModel";
import "./AdaptarOmitidas.css";

export function AdaptarOmitidas({
  preguntas,
  onCambio,
  onIrAPreguntas,
}: {
  preguntas: readonly PlanPregunta[];
  /** Tras una acción: recargar el plan. */
  onCambio: () => void;
  onIrAPreguntas: () => void;
}) {
  if (!preguntas.length) return null;
  return (
    <Alert kind="warn">
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {preguntas.length} {preguntas.length === 1 ? "pregunta quedará" : "preguntas quedarán"} fuera de la adaptación
      </div>
      <div style={{ fontSize: 12 }}>Tienen grupos codificados que todavía no se pueden aplicar:</div>
      <ul className="pulso-codif-omitidas">
        {preguntas.map((p) => (
          <OmitidaFila key={p.parent} p={p} onCambio={onCambio} onIrAPreguntas={onIrAPreguntas} />
        ))}
      </ul>
    </Alert>
  );
}

function OmitidaFila({ p, onCambio, onIrAPreguntas }: { p: PlanPregunta; onCambio: () => void; onIrAPreguntas: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState("");
  const correr = async (accion: () => Promise<unknown>) => {
    setOcupado(true);
    setError("");
    try {
      await accion();
      onCambio();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };
  const grupos = formatoConteoDe(p.n_grupos, "grupo", "grupos");
  return (
    <li>
      <div>
        <code>{p.parent}</code> — {textoPlano(p.parent_label)}
      </div>
      <div className="pulso-codif-omitida-motivo">{motivoNoSoportado(p)}</div>
      {p.motivo_codigo === "sin_texto_emparejado" && (
        <div className="pulso-codif-omitida-acciones">
          {confirmando ? (
            <>
              <span>¿Descartar los {grupos} de {p.parent}? Los textos siguen en su propia pregunta.</span>
              <PulsoButton variant="danger" size="sm" disabled={ocupado} onClick={() => void correr(() => apiCodifGrupos(p.parent, []))}>
                Descartar
              </PulsoButton>
              <PulsoButton variant="ghost" size="sm" onClick={() => setConfirmando(false)}>Cancelar</PulsoButton>
            </>
          ) : (
            <>
              <PulsoButton variant="secondary" size="sm" onClick={() => setConfirmando(true)}>
                Descartar los {grupos}
              </PulsoButton>
              <PulsoButton variant="ghost" size="sm" onClick={onIrAPreguntas}>Volver a emparejar</PulsoButton>
            </>
          )}
        </div>
      )}
      {p.motivo_codigo === "sin_modo" && p.text_col && (
        <div className="pulso-codif-omitida-acciones">
          <span>¿Qué hacen los grupos de {p.text_col}?</span>
          <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={() => void correr(() => apiCodifPareja(p.parent, p.text_col, "padre"))}>
            Corrigen la respuesta de {p.parent}
          </PulsoButton>
          <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={() => void correr(() => apiCodifPareja(p.parent, p.text_col, "hijo"))}>
            Van en una variable aparte
          </PulsoButton>
        </div>
      )}
      {error && <div className="pulso-armon-error" role="alert">{error}</div>}
    </li>
  );
}
