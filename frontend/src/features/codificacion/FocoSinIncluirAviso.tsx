// TXT-10/16: Codificar abierto sobre una pregunta que no está en «Preguntas para codificar» (p. ej. un enlace
// `?foco=coment&panel=palabras`). En vez de caer mudo en la primera pregunta, lo dice y ofrece la misma acción que
// Preparar («Incluir en codificación», POST /api/codificacion/marcar). Nunca la incluye solo.
//
// C3: el aviso es el contenido de la superficie y contiene su propio vacío (`EstadoVacio` con borde, alto intrínseco).

import { EstadoVacio } from "../../components/EstadoVacio";
import { PulsoButton } from "../../components/PulsoButton";
import { ArrowLeft, ClipboardList, ListPlus, SearchX } from "../../vendor/lucide-react";
import type { FocoCodificar } from "./focoCodificar";
import "./focoSinIncluirAviso.css";

type Props = {
  resolucion: Extract<FocoCodificar, { tipo: "sin-incluir" | "no-existe" }>;
  incluyendo: boolean;
  error: string;
  onIncluir: () => void;
  onVolver: () => void;
};

export function FocoSinIncluirAviso({ resolucion, incluyendo, error, onIncluir, onVolver }: Props) {
  const volver = (
    <PulsoButton variant={resolucion.tipo === "sin-incluir" && resolucion.incluible ? "ghost" : "secondary"} size="sm" onClick={onVolver}>
      <ArrowLeft size={13} aria-hidden="true" /> Volver a organizar
    </PulsoButton>
  );
  let contenido;
  if (resolucion.tipo === "no-existe") {
    contenido = (
      <EstadoVacio
        tamano="normal"
        icono={<SearchX size={18} />}
        titulo={<>No hay una pregunta abierta «{resolucion.foco}» en esta base</>}
        descripcion="Elige una pregunta de la lista o vuelve a organizar."
        accion={volver}
      />
    );
  } else {
    const { pregunta, incluible } = resolucion;
    contenido = (
      <EstadoVacio
        tamano="normal"
        icono={<ClipboardList size={18} />}
        titulo={<>«{pregunta.parent}» no está en «Preguntas para codificar»</>}
        descripcion={incluible
          ? "Por eso aquí no se pueden codificar sus respuestas ni revisar sus palabras. Inclúyela para trabajarla."
          : "Por eso aquí no se pueden codificar sus respuestas. Esta pregunta se organiza en Preparar."}
        accion={
          <div className="pulso-cv2-foco-aviso-acciones">
            {incluible && (
              <PulsoButton variant="primary" size="sm" onClick={onIncluir} disabled={incluyendo}>
                <ListPlus size={13} aria-hidden="true" /> {incluyendo ? "Incluyendo…" : "Incluir en codificación"}
              </PulsoButton>
            )}
            {volver}
          </div>
        }
      />
    );
  }
  return (
    <div
      className="pulso-cv2-foco-aviso"
      data-audit-ready="codificacion-codificar"
      data-qa-geometry-group="codificacion/foco-sin-incluir"
      data-qa-geometry-contract="intrinsic"
      data-qa-geometry-capacity="owned"
    >
      {contenido}
      {error && <p className="pulso-cv2-foco-aviso-error" role="alert">{error}</p>}
    </div>
  );
}
