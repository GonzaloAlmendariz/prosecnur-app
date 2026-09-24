/**
 * Veredicto de «¿Este sorteo o otro?» (AD7-E15): la línea que abre la pestaña
 * y dice qué pasó con la muestra vigente, antes de explicar el método.
 */
import type { CalcMuestraAulasSelection } from "../../../../api/client";
import { fmtInt } from "../../sharedCore";
import type { AvisoTone } from "../shared/AvisoModulo";

export type CorridaRerandomizacion = NonNullable<CalcMuestraAulasSelection["rerandomizacion"]>;

export type VeredictoRerandomizacion = {
  tono: Extract<AvisoTone, "success" | "warn" | "info">;
  titulo: string;
};

export function veredictoRerandomizacion(
  corrida: CorridaRerandomizacion | null | undefined,
  { activa, hayCriterio }: { activa: boolean; hayCriterio: boolean },
): VeredictoRerandomizacion {
  if (corrida?.aplicada) {
    if (corrida.agotado) {
      return {
        tono: "warn",
        titulo: `Ninguno de los ${fmtInt(corrida.sorteos)} sorteos pasó el criterio: la muestra vigente es la mejor de las que no pasaron.`,
      };
    }
    const elegido = typeof corrida.sorteo_elegido === "number" && Number.isFinite(corrida.sorteo_elegido)
      ? ` en el sorteo ${fmtInt(corrida.sorteo_elegido)}`
      : "";
    return {
      tono: "success",
      titulo: `La muestra vigente pasó el criterio${elegido}: lo cumplieron ${fmtInt(corrida.aceptados)} de ${fmtInt(corrida.sorteos)} sorteos.`,
    };
  }
  if (activa && hayCriterio) {
    return {
      tono: "info",
      titulo: "La rerandomización está encendida, pero la muestra vigente se sorteó sin ella: vuelve a sortear para aplicarla.",
    };
  }
  return {
    tono: "info",
    titulo: "La muestra vigente es el primer sorteo: no se rerandomizó.",
  };
}
