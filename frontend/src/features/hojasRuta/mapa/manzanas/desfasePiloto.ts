import type { HojasRutaPilotExclusionMode } from "../../../../api/hojasRuta";

/**
 * ¿La muestra vigente se sorteó con la otra regla del piloto? Con «evita» se espera que haya
 * excluido titulares del piloto; con «no evita», que no haya excluido ninguna. Sin muestra, o
 * con un piloto sin titulares, no hay desfase que avisar.
 */
export function reglaPilotoDesfasada(modo: HojasRutaPilotExclusionMode, titularesPiloto: number, excluidasEnLaMuestra: number | null): boolean {
  if (excluidasEnLaMuestra === null || titularesPiloto <= 0) return false;
  return modo === "exclude_titulars" ? excluidasEnLaMuestra === 0 : excluidasEnLaMuestra > 0;
}
