import type { Pregunta, Seccion } from "../../../api/client";
import type { ContextoDeCarga } from "./contextoDeCarga";
import { MesaDeFormulario } from "./formulario/MesaDeFormulario";

export type PestanaFormularioProps = {
  contexto: ContextoDeCarga;
  hayEstructura: boolean;
  estructura: { secciones: Seccion[]; preguntas: Pregunta[] } | null;
  baseDelEsquema: string;
  onCambiarBaseDelEsquema: (nombre: string) => void;
};

/**
 * Formulario (ADR 0142, P4b R6): secciones, preguntas y lógica de la base
 * elegida, con la mesa del prototipo "carga-formulario" (`MesaDeFormulario`).
 */
export function PestanaFormulario({ contexto, hayEstructura, estructura, baseDelEsquema, onCambiarBaseDelEsquema }: PestanaFormularioProps) {
  return (
    <MesaDeFormulario
      estructura={hayEstructura ? estructura : null}
      varias={contexto.esVarias}
      bases={contexto.estudio?.bases ?? null}
      baseDelEsquema={baseDelEsquema}
      onCambiarBaseDelEsquema={onCambiarBaseDelEsquema}
    />
  );
}
