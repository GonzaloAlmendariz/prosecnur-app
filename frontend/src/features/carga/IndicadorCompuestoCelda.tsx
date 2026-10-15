// Celda de una base en una fila compuesta de la tabla de equivalencias
// (ADR 0105). Muestra los componentes legibles —«Alguna de: P28_1, P28_2 ·
// código 1»—, nunca la expresión `alguna(...)`, y reabre el editor de la fila.

import { Combine } from "../../vendor/lucide-react";
import type { EquivalenciaFila } from "../../api/equivalencias";
import { componentesDeBase, textoComponentes } from "./indicadorCompuestoModel";
import "./IndicadorCompuestoEditor.css";

export function IndicadorCompuestoCelda({
  fila,
  base,
  foco,
  contexto,
  onEditar,
}: {
  fila: Pick<EquivalenciaFila, "derivada" | "variables">;
  base: string;
  /** Referencia de la fila guardada; sin ella todavía no hay qué editar. */
  foco: string | null;
  contexto: string;
  onEditar?: (foco: string) => void;
}) {
  const componentes = componentesDeBase(fila, base);
  const texto = componentes ? textoComponentes(componentes) : "Sin declarar";
  return (
    <button
      type="button"
      className={`pulso-compuesto-celda${componentes ? "" : " is-sin-declarar"}`}
      disabled={!foco || !onEditar}
      data-compuesto-abrir={foco ?? undefined}
      aria-label={`${base} en ${contexto}: ${texto}. Editar el indicador compuesto`}
      onClick={() => foco && onEditar?.(foco)}
    >
      <Combine size={12} aria-hidden="true" />
      <span>{texto}</span>
    </button>
  );
}
