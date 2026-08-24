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
/**
 * Cuántas fichas hay que hacer: TODAS las unidades del plan.
 *
 * No son las que se van a visitar. Una reserva encadenada necesita su ficha el
 * día que su titular cae —si no la tiene impresa, no entra— y un extra la
 * necesita cuando cierra una cuota. Por eso el paquete las reparte en tres
 * cajones por facultad: Titulares, Reemplazos y Adicionales.
 *
 * Medido el 2026-08-23 sobre el estudio de 193: la pantalla decía «Fichas 0 de
 * **193**» y el botón de al lado creaba **2.616**, porque manda
 * `plan.units.map(...)` entero. El rótulo prometía una cosa y la acción hacía
 * otra, que es la familia de «Libro de 2616 aulas» ya reparada en Monitoreo.
 */
export function unidadesDelPlan(plan: Pick<CollectionPlan, "units"> | null | undefined): number {
  return (plan?.units ?? []).length;
}

/** Desglose por rol, para que el total no sea un número sin composición. */
export function composicionDelPlan(plan: Pick<CollectionPlan, "units"> | null | undefined) {
  const rol = (u: { role?: string | null }) => (u.role ?? "").toLowerCase().replace(/[ -]+/g, "_");
  const units = plan?.units ?? [];
  return {
    titulares: units.filter((u) => rol(u) === "titular").length,
    reemplazos: units.filter((u) => rol(u) === "chain_reserve").length,
    adicionales: units.filter((u) => rol(u) === "extra_reserve_pool").length,
  };
}

export function titularesDelPlan(plan: Pick<CollectionPlan, "units"> | null | undefined): number {
  return (plan?.units ?? []).filter(
    (u) => (u.role ?? "").toLowerCase().replace(/[ -]+/g, "_") === "titular",
  ).length;
}
