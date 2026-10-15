// Celda de una base en una fila compuesta de la tabla de equivalencias
// (ADR 0105). Se ve como la celda de una pregunta simple —«Alguna de 9
// preguntas» sobre «P28_2 … P28_10 · sí = 1», el detalle en `title`—, nunca la
// expresión `alguna(...)`, y reabre el editor de la fila.

import { Combine } from "../../vendor/lucide-react";
import type { EquivalenciaFila } from "../../api/equivalencias";
import { componentesDeBase, resumenCelda, textoComponentes } from "./indicadorCompuestoModel";
import "./PreguntaCombobox.css";
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
  const resumen = componentes ? resumenCelda(componentes) : null;
  return (
    <button
      type="button"
      className={`pulso-preg-disparador pulso-compuesto-celda${componentes ? "" : " is-vacio is-sin-declarar"}`}
      title={texto}
      disabled={!foco || !onEditar}
      data-compuesto-abrir={foco ?? undefined}
      aria-label={`${base} en ${contexto}: ${texto}. Editar el indicador compuesto`}
      onClick={() => foco && onEditar?.(foco)}
    >
      <Combine size={12} aria-hidden="true" />
      <span className="pulso-preg-disparador-texto">
        {resumen ? (
          <>
            <span className="pulso-preg-etiqueta">{resumen.etiqueta}</span>
            <code className="pulso-preg-codigo">{resumen.codigo}</code>
          </>
        ) : (
          <span className="pulso-preg-placeholder">Sin declarar</span>
        )}
      </span>
    </button>
  );
}
