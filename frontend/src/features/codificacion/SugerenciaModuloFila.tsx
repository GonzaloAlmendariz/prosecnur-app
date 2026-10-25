// Los módulos sugeridos de UNA respuesta, al lado de su texto (TXT-3). Cada chip es una propuesta: un clic la confirma
// (la respuesta entra al grupo del módulo) y otro la quita. El «por qué» son las palabras que comparte con el módulo, en
// el tooltip y en la descripción accesible. Una respuesta sin vocabulario en común se marca «sin módulo claro»; una no
// respuesta no trae nada.

import { useId } from "react";
import { Check, Plus } from "lucide-react";
import type { Grupo, PropuestaModulo } from "../../api/codificacion";
import { estaConfirmada, rotuloModulo, type EntradaSugerida } from "./sugerenciasModulo";

type Props = {
  entrada: EntradaSugerida | undefined;
  grupos: readonly Grupo[];
  onConfirmar: (propuesta: PropuestaModulo) => void;
  onQuitar: (propuesta: PropuestaModulo) => void;
};

export function SugerenciaModuloFila({ entrada, grupos, onConfirmar, onQuitar }: Props) {
  const base = useId();
  if (!entrada) return null;
  if (entrada.candidatoOtro) {
    return (
      <span className="pulso-cv2-modsug-sin" title="No comparte palabras con ningún módulo del formulario">
        Sin módulo claro
      </span>
    );
  }
  if (!entrada.propuestas.length) return null;
  return (
    // C1: los chips de una respuesta (uno por módulo; multicode trae dos o tres) miden lo que su texto pide.
    <span className="pulso-cv2-modsug" role="group" aria-label="Módulo sugerido" data-qa-geometry-group="codificacion/sugerencia-respuesta" data-qa-geometry-contract="intrinsic">
      <span className="pulso-cv2-modsug-eyebrow" aria-hidden="true">Sugerido</span>
      {entrada.propuestas.map((p, i) => {
        const r = rotuloModulo(p.etiqueta);
        const ok = estaConfirmada(grupos, p.codigo, entrada.clave);
        const porque = p.palabras.length ? `Coincide en: ${p.palabras.join(", ")}` : "Coincide con el vocabulario del módulo";
        const idPorque = `${base}-${i}`;
        return (
          <span key={p.codigo} className="pulso-cv2-modsug-item">
            <button
              type="button"
              className={`pulso-cv2-modsug-chip${ok ? " is-confirmada" : ""}`}
              aria-pressed={ok}
              aria-label={ok ? `Quitar ${r.corto} de esta respuesta` : `Confirmar ${r.corto} para esta respuesta`}
              aria-describedby={idPorque}
              title={`${porque}${ok ? " · Confirmado: clic para quitar" : " · Clic para confirmar"}`}
              onClick={() => (ok ? onQuitar(p) : onConfirmar(p))}
            >
              {ok ? <Check size={11} aria-hidden="true" /> : <Plus size={11} aria-hidden="true" />}
              <span className="pulso-cv2-modsug-chip-texto">{r.corto}</span>
            </button>
            <span id={idPorque} className="pulso-sr-only">{porque}</span>
          </span>
        );
      })}
    </span>
  );
}
