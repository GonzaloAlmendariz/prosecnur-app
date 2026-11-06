import type { UtilLienzo } from "./LienzoMapa";
import type { PiezaManzana } from "./piezas";

/**
 * P2 de la paridad con la página clásica: en Campo real con la regla «evita las del piloto», las
 * titulares que el piloto ya usó y el sorteo deja fuera. En gris y con trazo cortado, por debajo de
 * las titulares de campo, para que se vea dónde no puede caer el sorteo.
 */
export function dibujarExcluidasPiloto(ctx: CanvasRenderingContext2D, u: UtilLienzo, excluidas: readonly PiezaManzana[]) {
  for (const m of excluidas) {
    const trazo = u.trazo(m);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = u.colores.suave;
    ctx.fill(trazo);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = u.colores.texto;
    ctx.lineWidth = 1.4 * u.px;
    ctx.setLineDash([2 * u.px, 2 * u.px]);
    ctx.stroke(trazo);
    ctx.setLineDash([]);
  }
}
