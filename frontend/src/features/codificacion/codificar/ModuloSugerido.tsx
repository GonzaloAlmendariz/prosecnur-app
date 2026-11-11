import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo } from "../../../lib/formatoNumero";
import { ChevronDown } from "../../../vendor/lucide-react";
import type { Grupo } from "../../../api/codificacion";
import { estaConfirmada, type EntradaSugerida } from "../sugerenciasModulo";

/** Respuestas con una propuesta de módulo que todavía no se confirmó. */
export function propuestasPorConfirmar(mapa: ReadonlyMap<string, EntradaSugerida>, grupos: readonly Grupo[]): number {
  let n = 0;
  for (const entrada of mapa.values()) {
    if (entrada.propuestas.some((p) => !estaConfirmada(grupos, p.codigo, entrada.clave))) n += 1;
  }
  return n;
}

export type BotonModuloSugeridoProps = {
  abierto: boolean;
  /** Id de la fila que abre. */
  controla: string;
  porConfirmar: number;
  onAlternar: () => void;
};

/**
 * Abre y cierra la fila de "Módulo sugerido": la propuesta sigue completa, con sus confirmaciones por
 * módulo, pero ya no ocupa una banda fija sobre la lista.
 */
export function BotonModuloSugerido({ abierto, controla, porConfirmar, onAlternar }: BotonModuloSugeridoProps) {
  return (
    <PulsoButton variant="secondary" size="sm" aria-expanded={abierto} aria-controls={controla} onClick={onAlternar}>
      Módulo sugerido
      {porConfirmar > 0 ? (
        <span className="pulso-cc-cuenta" title={porConfirmar === 1 ? "1 respuesta con propuesta por confirmar" : `${formatoConteo(porConfirmar)} respuestas con propuesta por confirmar`}>
          {formatoConteo(porConfirmar)}
        </span>
      ) : null}
      <ChevronDown size={13} aria-hidden="true" className="pulso-cc-giro" data-abierto={abierto ? "" : undefined} />
    </PulsoButton>
  );
}
