// Lectura de una regla en piezas (contrato en piezas.ts). El motor vive en reglas/motor/: parsea en modo lectura,
// normaliza (today() >= . se lee como . <= today()) y redacta con el vocabulario del tipo de cada pregunta.
// Nunca hay frases escritas por expresión exacta: lo que no se reconoce queda `tecnica` con su `depende`.

import type { BuilderNode } from "../types";
import type { LogicScope } from "../logic";
import type { ColumnaRegla, LecturaRegla } from "./piezas";
import { leerConContexto } from "./motor";
import { LECTURA_FILA_ROTA, esRellenoDeFilaRota } from "./motor/filaRota";

export function leerRegla(columna: ColumnaRegla, raw: string, nodo: BuilderNode, scope: LogicScope): LecturaRegla {
  // Una fila rota no tiene reglas: lo que hay en la columna es su propio nombre repetido. Se dice eso, sin
  // dependencias inventadas, en todas las vistas por igual.
  if (esRellenoDeFilaRota(nodo, raw)) {
    return { columna, raw: raw.trim(), piezas: [{ tipo: "texto", texto: LECTURA_FILA_ROTA }], tecnica: false, depende: [], lista: columna === "choice_filter" ? nodo.typeInfo?.listName || undefined : undefined };
  }
  return leerConContexto(
    columna,
    raw,
    { columna, scope, actual: { name: nodo.name ?? "", base: nodo.typeInfo?.base ?? "", lista: nodo.typeInfo?.listName ?? "" } },
    nodo.typeInfo?.listName || undefined,
  );
}
