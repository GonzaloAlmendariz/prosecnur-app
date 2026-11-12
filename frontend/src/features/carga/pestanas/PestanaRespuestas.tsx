import type { ContextoDeCarga } from "./contextoDeCarga";
import { MesaDeRespuestas } from "./respuestas/MesaDeRespuestas";

/**
 * Respuestas (ADR 0142, P4b R6): la hoja de la base elegida, con la cabecera
 * del prototipo "carga-respuestas" (`MesaDeRespuestas`).
 */
export function PestanaRespuestas({ contexto }: { contexto: ContextoDeCarga }) {
  return <MesaDeRespuestas contexto={contexto} />;
}
