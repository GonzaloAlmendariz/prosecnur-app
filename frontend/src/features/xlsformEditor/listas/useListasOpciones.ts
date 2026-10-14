// Estado derivado + acciones de «Listas de opciones». El workbook es la única
// fuente: el análisis se recalcula de él y las acciones devuelven el workbook
// nuevo por `onWorkbookChange` (el editor decide cómo persistirlo).

import { useCallback, useMemo, useState } from "react";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import {
  analizarListas,
  renombrarLista,
  unificarListas,
  type AnalisisListas,
  type GrupoListasRepetidas,
} from "./listasModel";

export type ControlListasOpciones = {
  analisis: AnalisisListas;
  /** Cuántas escalas se repiten (para el rótulo del botón). */
  repetidas: number;
  /** Último cambio aplicado, dicho en una frase (región `aria-live`). */
  aviso: string | null;
  /** Devuelve el motivo si no se pudo; `null` si se aplicó. */
  unificar: (grupo: GrupoListasRepetidas, nombre: string) => string | null;
  renombrar: (lista: string, nombre: string) => string | null;
};

export function useListasOpciones(
  workbook: XlsformEditorWorkbook,
  onWorkbookChange: (next: XlsformEditorWorkbook) => void,
): ControlListasOpciones {
  const analisis = useMemo(() => analizarListas(workbook), [workbook]);
  const [aviso, setAviso] = useState<string | null>(null);

  const unificar = useCallback((grupo: GrupoListasRepetidas, nombre: string) => {
    const res = unificarListas(workbook, grupo.listas, nombre);
    if (!res.ok) return res.motivo;
    const limpio = nombre.trim();
    if (res.workbook !== workbook) onWorkbookChange(res.workbook);
    setAviso(`${grupo.listas.length} listas quedaron como una sola: «${limpio}», usada en ${grupo.preguntas.length} ${grupo.preguntas.length === 1 ? "pregunta" : "preguntas"}.`);
    return null;
  }, [onWorkbookChange, workbook]);

  const renombrar = useCallback((lista: string, nombre: string) => {
    const res = renombrarLista(workbook, lista, nombre);
    if (!res.ok) return res.motivo;
    if (res.workbook !== workbook) {
      onWorkbookChange(res.workbook);
      setAviso(`La lista «${lista}» ahora se llama «${nombre.trim()}».`);
    }
    return null;
  }, [onWorkbookChange, workbook]);

  return { analisis, repetidas: analisis.grupos.length, aviso, unificar, renombrar };
}
