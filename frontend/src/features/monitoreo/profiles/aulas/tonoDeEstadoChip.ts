import type { ChromeStatusTone } from "../../../../components/ModuleCommandBar";

/**
 * El vocabulario de tono de los modelos de aulas («ok», «aviso», «riesgo»…)
 * traducido al tono del `EstadoChip` del kit (P6 de la pasada de formato). El
 * modelo sigue hablando su idioma —lo usan barras, lecturas y filas—; sólo el
 * chip de estado lo traduce, y por el color que ya pintaba: verde → success,
 * ámbar → warn, rojo → danger, azul → info, gris → neutral.
 */
export type TonoDeAulas = "ok" | "aviso" | "riesgo" | "falla" | "info" | "neutro";

const TONO: Record<TonoDeAulas, ChromeStatusTone> = {
  ok: "success",
  aviso: "warn",
  riesgo: "danger",
  falla: "danger",
  info: "info",
  neutro: "neutral",
};

export function tonoDeEstadoChip(tono: TonoDeAulas): ChromeStatusTone {
  return TONO[tono];
}
