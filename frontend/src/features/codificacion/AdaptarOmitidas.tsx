// Codificación, Aplicar: las preguntas con códigos que todavía no se pueden
// aplicar, cada una con su causa en llano y, cuando se resuelve aquí, la acción.
// Van en el mismo panel que la lista, debajo, con las mismas columnas.
//
// Caso real (HSyVbG 2026, 2026-10-16): P29_10 se emparejó por error con su
// texto "Otro", se le armaron grupos, y al deshacer el emparejamiento los grupos
// quedaron huérfanos. El aviso decía "ajuste no reconocido" y no había cómo
// destrabarlo. Ahora dice qué pasó y ofrece descartar esos grupos o volver a
// emparejar; una pregunta con texto pero sin modo ofrece elegirlo.

import { useId, useState } from "react";
import type { PlanPregunta } from "../../api/dashboard";
import { apiCodifGrupos, apiCodifPareja } from "../../api/codificacion";
import { PulsoButton } from "../../components/PulsoButton";
import { formatoConteoDe } from "../../lib/formatoNumero";
import { FichaDePlan } from "./aplicar/FichaDePlan";
import { etiquetaDePregunta, tipoDeFicha } from "./aplicar/modeloAplicar";
import { motivoNoSoportado } from "./planAdaptacionModel";
import "./aplicar/aplicar.css";
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
  const idTitulo = useId();
  if (!preguntas.length) return null;
  return (
    <div className="pulso-aplicar-fuera" role="group" aria-labelledby={idTitulo} data-testid="codificacion-aplicar-fuera">
      <h4 id={idTitulo} className="pulso-aplicar-fuera-titulo">
        <span className="pulso-aplicar-fuera-punto" aria-hidden="true" />
        {/* El grupo del prototipo, "No entran todavía"; cuántas y por qué, en sus filas y en la franja. */}
        No entran todavía
        <span className="pulso-sr-only">: {preguntas.length === 1 ? "1 pregunta no se puede aplicar" : `${preguntas.length} preguntas no se pueden aplicar`}</span>
      </h4>
      <ul
        className="pulso-aplicar-fuera-lista"
        data-qa-geometry-group="codificacion/aplicar-fuera"
        data-qa-geometry-contract="intrinsic"
      >
        {preguntas.map((p) => (
          <OmitidaFila key={p.parent} p={p} onCambio={onCambio} onIrAPreguntas={onIrAPreguntas} />
        ))}
      </ul>
    </div>
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
  // "el código" con uno; "los 3 códigos" con varios.
  const losCodigos = Number(p.n_grupos) === 1 ? "el código" : `los ${formatoConteoDe(p.n_grupos, "código", "códigos")}`;
  return (
    <li className="pulso-aplicar-fuera-fila">
      <div className="pulso-aplicar-fuera-pregunta">
        <FichaDePlan tipo={tipoDeFicha(p.tipo)} codigo={p.parent} etiqueta={etiquetaDePregunta(p)} />
      </div>
      <div className="pulso-aplicar-fuera-causa">
        <p className="pulso-aplicar-fuera-motivo">{motivoNoSoportado(p)}</p>
        {p.motivo_codigo === "sin_texto_emparejado" && (
          <div className="pulso-aplicar-fuera-acciones">
            {confirmando ? (
              <>
                <span>¿Descartar {losCodigos} de {p.parent}? Los textos siguen en su propia pregunta.</span>
                <PulsoButton variant="danger" size="sm" disabled={ocupado} onClick={() => void correr(() => apiCodifGrupos(p.parent, []))}>
                  Descartar
                </PulsoButton>
                <PulsoButton variant="ghost" size="sm" onClick={() => setConfirmando(false)}>Cancelar</PulsoButton>
              </>
            ) : (
              <>
                <PulsoButton variant="secondary" size="sm" onClick={() => setConfirmando(true)}>
                  Descartar {losCodigos}
                </PulsoButton>
                <PulsoButton variant="ghost" size="sm" onClick={onIrAPreguntas}>Volver a emparejar</PulsoButton>
              </>
            )}
          </div>
        )}
        {p.motivo_codigo === "sin_modo" && p.text_col && (
          <div className="pulso-aplicar-fuera-acciones">
            <span>¿Qué hacen los códigos de {p.text_col}?</span>
            <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={() => void correr(() => apiCodifPareja(p.parent, p.text_col, "padre"))}>
              Corrigen la respuesta de {p.parent}
            </PulsoButton>
            <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={() => void correr(() => apiCodifPareja(p.parent, p.text_col, "hijo"))}>
              Van en una variable aparte
            </PulsoButton>
          </div>
        )}
        {error && <div className="pulso-armon-error" role="alert">{error}</div>}
      </div>
    </li>
  );
}
