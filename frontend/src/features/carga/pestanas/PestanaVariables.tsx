import { useEffect } from "react";
import { useVariablesBase } from "../variablesBase/useVariablesBase";
import { etiquetaDeBase } from "./bases/basesModel";
import type { ContextoDeCarga } from "./contextoDeCarga";
import { MesaDeVariables } from "./variables/MesaDeVariables";

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
 * calcula en ella, con la mesa del prototipo "carga-variables"
 * (`variables/MesaDeVariables`). Existe también con una sola base. La base
 * elegida va en la dirección (`foco`, `useElegirBaseDeVariables`).
 */
export function PestanaVariables({ contexto, bases, conCatalogo, onLeyendo }: PestanaVariablesProps) {
  const base = contexto.baseElegida || null;
  const control = useVariablesBase(base, { conCatalogo });
  const leyendo = base !== null && control.estado.carga.tipo === "cargando";

  useEffect(() => {
    onLeyendo(leyendo);
  }, [leyendo, onLeyendo]);
  useEffect(() => () => onLeyendo(false), [onLeyendo]);

  const porNombre = new Map(contexto.basesTodas.map((b) => [b.nombre, b]));
  const etiquetas = Object.fromEntries(bases.map((nombre) => {
    const b = porNombre.get(nombre);
    return [nombre, b ? etiquetaDeBase(b) : nombre];
  }));

  return (
    <MesaDeVariables
      key={base ?? ""}
      control={control}
      base={base}
      bases={bases}
      etiquetas={etiquetas}
      onCambiarBase={contexto.onCambiarBase}
      cambiandoBase={Boolean(contexto.ocupado)}
    />
  );
}
