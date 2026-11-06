import type { HojasRutaAgeRange, HojasRutaAgeRangeMode, HojasRutaAgeRangeScope, HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";

/** Lo que se guarda al aplicar los rangos de edad: los rangos a mano, o el modo de cortes y su base. */
export function payloadDeRangos(modo: HojasRutaAgeRangeMode, base: HojasRutaAgeRangeScope, rangos: readonly HojasRutaAgeRange[]): Partial<HojasRutaIntegratedConfig> {
  return modo === "manual" ? { age_ranges: [...rangos], age_range_mode: "manual", age_range_scope: base } : { age_range_mode: modo, age_range_scope: base };
}
