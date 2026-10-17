import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { LogicScope } from "../logic";
import { rowToRecord } from "../parsing/sheetUtils";
import type { BuilderStructure, XlsformEditorSheet } from "../types";

// Lo que el riel de marcas necesita del formulario y que una fila sola no trae: la estructura (para saber qué
// sección la contiene y heredar su condición), el alcance del motor (etiquetas de preguntas y opciones) y el
// `required` crudo de cada fila (el nodo lo guarda como booleano y una expresión se pierde).
// Sin proveedor el riel funciona con lo que trae el nodo: sin condición heredada y con códigos en vez de etiquetas.

export type ContextoReglasValor = {
  structure: BuilderStructure | null;
  scope: LogicScope | null;
  requiredRaw: (rowIndex: number) => string | undefined;
};

const Contexto = createContext<ContextoReglasValor | null>(null);

export function ProveedorReglas({
  structure,
  scope,
  survey,
  children,
}: {
  structure: BuilderStructure | null;
  scope: LogicScope | null;
  survey?: XlsformEditorSheet | null;
  children: ReactNode;
}) {
  const valor = useMemo<ContextoReglasValor>(() => {
    const tieneRequired = !!survey?.columns.some((c) => c.trim().toLowerCase() === "required");
    return {
      structure,
      scope,
      requiredRaw: (rowIndex) => (survey && tieneRequired ? rowToRecord(survey, rowIndex).required ?? "" : undefined),
    };
  }, [structure, scope, survey]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useContextoReglas(): ContextoReglasValor | null {
  return useContext(Contexto);
}

/** Alcance mínimo cuando no hay proveedor: el motor lee igual y muestra los códigos en vez de las etiquetas. */
export const ALCANCE_VACIO: LogicScope = { variables: [], catalogsByListName: new Map(), allowCurrent: false };
