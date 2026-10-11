// Nombre de cada público (C44): el mismo valor que el Editor anterior (BaseLabelsField), texto `clave=Título` por
// línea, con una caja por base del estudio. Lo vacío no se escribe: conserva el nombre técnico.

import { formatBaseLabels, parseBaseLabels } from "../../BaseLabelsField";

export { parseBaseLabels };

/** Parche de args tras editar el nombre de `clave`; el orden de las líneas es el de las bases del estudio. */
export function patchNombreDeBase(
  argName: string,
  valorActual: unknown,
  bases: readonly string[],
  clave: string,
  texto: string,
): Record<string, string> {
  return { [argName]: formatBaseLabels({ ...parseBaseLabels(valorActual), [clave]: texto }, [...bases]) };
}
