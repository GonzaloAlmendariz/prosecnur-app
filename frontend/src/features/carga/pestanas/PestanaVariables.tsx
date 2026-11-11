import { useEffect } from "react";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { Inbox } from "../../../vendor/lucide-react";
import { useVariablesBase } from "../variablesBase/useVariablesBase";
import { VariablesBaseCuerpo } from "../variablesBase/VariablesBasePanel";
import "../ArmonizacionFilaEditor.css";
import "../variablesBase/variablesBase.css";
import "./pestanaVariables.css";
import type { ContextoDeCarga } from "./contextoDeCarga";
import { SelectorDeBaseCarga } from "./SelectorDeBaseCarga";

export type PestanaVariablesProps = {
  contexto: ContextoDeCarga;
  /** Nombres de las bases que se pueden elegir; con una base, vacío. */
  bases: readonly string[];
  /** El estudio tiene equivalencias, de donde sale hoy el catálogo de preguntas por base. */
  conCatalogo: boolean;
  /** La pestaña está leyendo la base: la página no publica readiness mientras tanto. */
  onLeyendo: (leyendo: boolean) => void;
};

/**
 * Variables (ADR 0142): lo que la base trae fuera del formulario y lo que se
 * calcula en ella. Era el panel lateral "Variables de la base"; ahora es una
 * pestaña que también existe con una sola base. Su rediseño es otra rebanada.
 */
export function PestanaVariables({ contexto, bases, conCatalogo, onLeyendo }: PestanaVariablesProps) {
  const base = contexto.baseElegida || null;
  const control = useVariablesBase(base, { conCatalogo });
  const leyendo = base !== null && control.estado.carga.tipo === "cargando";

  useEffect(() => {
    onLeyendo(leyendo);
  }, [leyendo, onLeyendo]);
  useEffect(() => () => onLeyendo(false), [onLeyendo]);

  return (
    <div
      className="pulso-carga-surface pulso-carga-variables"
      data-carga-surface="variables"
      data-qa-geometry-group="carga/variables"
      data-qa-geometry-contract="intrinsic"
    >
      <SelectorDeBaseCarga
        bases={bases}
        elegida={contexto.baseElegida}
        onCambiar={contexto.onCambiarBase}
        deshabilitado={Boolean(contexto.ocupado)}
      />
      {base ? (
        <VariablesBaseCuerpo key={base} control={control} />
      ) : (
        <div data-qa-geometry-capacity="owned">
          <EstadoVacio
            icono={<Inbox size={16} />}
            titulo="Todavía no hay respuestas cargadas"
            descripcion="Cárgalas en Bases para declarar columnas y variables calculadas."
          />
        </div>
      )}
    </div>
  );
}
