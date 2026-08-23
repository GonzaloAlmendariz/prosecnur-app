import type { CollectionPlan, CollectionUnit } from "../../api/recopiladores";

/**
 * El código con el que el equipo llama a un aula: `CH 1`, `R 1.2`, `EXTRA 7`.
 *
 * Las pantallas enseñaban el nombre académico del aula —«1ges08_0601»— o el
 * `unit_id`, que es un hash de infraestructura —«unit-aulas-aula-1-5524e6773d»—.
 * Ninguno de los dos es el código con el que se habla del aula en campo, en el
 * libro de agendación o en las fichas QR, y el operativo entero se coordina con
 * ese código.
 *
 * Está desde el principio en `dimensions.legacy_ref`: es el `operational_code`
 * que `.collection_legacy_unit()` usa como `source_key` para derivar el
 * `unit_id`. Llegaba y no se pintaba.
 *
 * Vive aquí y no dentro de una pantalla porque lo necesitan varias —el plan, la
 * vinculación de accesos, los materiales— y dos copias de esta regla acabarían
 * discrepando el día que el backend le dé nombre propio al campo.
 */
export function codigoOperativoDe(unit: Pick<CollectionUnit, "dimensions"> | null | undefined): string {
  const ref = unit?.dimensions?.legacy_ref;
  return typeof ref === "string" ? ref.trim() : "";
}

/**
 * De `unit_id` al código operativo, para las pantallas que sólo tienen el id.
 *
 * La tabla de vinculación de Accesos guarda `binding.unit_id` y no la unidad
 * entera, así que enseñaba el hash. El plan sí tiene las dos cosas.
 */
export function mapaDeCodigosDelPlan(plan: Pick<CollectionPlan, "units"> | null | undefined): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const unit of plan?.units ?? []) {
    const codigo = codigoOperativoDe(unit);
    if (codigo) mapa.set(unit.unit_id, codigo);
  }
  return mapa;
}

/** Cuántas aulas del plan son visitas —titulares—, que es lo que hay que cubrir. */
export function titularesDelPlan(plan: Pick<CollectionPlan, "units"> | null | undefined): number {
  return (plan?.units ?? []).filter(
    (u) => (u.role ?? "").toLowerCase().replace(/[ -]+/g, "_") === "titular",
  ).length;
}
