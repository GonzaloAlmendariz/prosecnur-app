import type { HojasRutaIntegratedConfig, HojasRutaRouteSnapshot } from "../../api/hojasRuta";
import { aplicarSorteo, parametrosDeSorteo } from "./mapa/manzanas/sorteo";

export { firmasDeMuestra } from "./mapa/manzanas/sorteo";

/**
 * «Usar ruteo» en la página clásica con la semántica del lienzo (docs/qa/propuesta-route-history-2026-10-30.md):
 * sólo los parámetros del sorteo del ruteo sobre la configuración vigente. N, rangos y territorio siguen
 * siendo los de hoy; antes se reponía la config entera del ruteo y pisaba en silencio lo editado después.
 * Sin configuración vigente (no cargó aún) se usa la del ruteo.
 */
export function configDeRestauracion(vigente: HojasRutaIntegratedConfig | null, snapshot: HojasRutaRouteSnapshot): HojasRutaIntegratedConfig {
  return vigente ? aplicarSorteo(vigente, parametrosDeSorteo(snapshot.config)) : snapshot.config;
}
