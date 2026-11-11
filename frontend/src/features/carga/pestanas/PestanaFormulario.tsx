import type { ContextoDeCarga } from "./contextoDeCarga";
import { PestanaEstructura, type PestanaEstructuraProps } from "./PestanaEstructura";

export type PestanaFormularioProps = {
  contexto: ContextoDeCarga;
} & Pick<PestanaEstructuraProps, "hayEstructura" | "estructura" | "baseDelEsquema" | "onCambiarBaseDelEsquema">;

/**
 * Formulario (ADR 0142, antes Estructura): secciones, preguntas y lógica de la
 * base elegida. Por ahora envuelve la vista de Estructura con el contexto de
 * Carga; su selector de base propio se unifica en el rediseño de la pestaña.
 */
export function PestanaFormulario({ contexto, ...resto }: PestanaFormularioProps) {
  return (
    <PestanaEstructura
      {...resto}
      varias={contexto.esVarias}
      bases={contexto.estudio?.bases ?? null}
    />
  );
}
