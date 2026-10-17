import type { LogicCatalog, LogicScope, LogicVariable } from "../logic";
import type { BuilderStructure } from "../types";

// Alcance de LECTURA del riel de marcas: todas las variables del formulario, sin depender de qué pregunta está
// elegida. El alcance del inspector excluye la pregunta seleccionada (no puede depender de sí misma) y cambia con
// cada selección; usarlo para leer haría que esa pregunta saliera como código y que todas las filas se repintaran.
// Mismo formato que el alcance del inspector: sin secciones ni repeticiones, que no producen valores comparables.

export function alcanceDeLectura(
  structure: BuilderStructure | null | undefined,
  catalogs: readonly LogicCatalog[],
): LogicScope {
  const variables: LogicVariable[] = (structure?.outline ?? [])
    .filter((n) => n.name && n.kind !== "section" && n.kind !== "repeat")
    .map((n) => ({
      rowIndex: n.rowIndex,
      name: n.name,
      label: n.label,
      baseType: n.typeInfo.base,
      listName: n.typeInfo.listName || undefined,
    }));
  const catalogsByListName = new Map<string, LogicCatalog>();
  for (const c of catalogs) catalogsByListName.set(c.listName, { listName: c.listName, items: c.items });
  return { variables, catalogsByListName, allowCurrent: false };
}
