// ¿El graficador admite `universos_no_confiables` (ADR 0135 §6)? Sólo entonces el padrón de un grupo con «Padrón
// confiable» apagado se guarda; si el registro de esta sesión todavía no lo declara, apagar lo quita y el motor nunca
// recibe un arg que no conoce.

import { useGraficosRegistry } from "../../useGraficosRegistry";

export function useGuardaNoConfiables(graficador: string): boolean {
  const { graficadoresById } = useGraficosRegistry();
  return (graficadoresById[graficador]?.args ?? []).some((a) => a.name === "universos_no_confiables");
}
