// El borrador de etiquetas de Analítica › Datos: lo que el analista teclea en el
// inspector queda aquí hasta "Confirmar etiquetas", que lo valida y lo escribe
// en la config (el autosave de Analítica lo guarda). La inclusión de variables
// y las secciones se escriben directo en la config: no pasan por el borrador.

import { useEffect, useMemo, useState } from "react";

import type { DataReviewVariable } from "../../../api/analitica";
import { useAnaliticaStore } from "../store";
import {
  buildDataReviewDraft,
  dataReviewDraftStatus,
  dataReviewEffectiveOptionLabel,
  dataReviewEffectiveVariableLabel,
  dataReviewHasEditableOptions,
  type DataReviewDraft,
} from "./borradorDeEtiquetas";

export type BorradorDeEtiquetas = {
  /** Lo que se ve en los campos. */
  borrador: DataReviewDraft;
  /** Lo que la config ya guarda. */
  guardado: DataReviewDraft;
  pendientes: number;
  vacias: number;
  /** Por qué no se pudo confirmar, si se intentó. */
  error: string;
  etiquetaDe: (variable: DataReviewVariable) => string;
  etiquetaDeOpcion: (variable: DataReviewVariable, code: string) => string;
  setEtiqueta: (name: string, label: string) => void;
  setEtiquetaDeOpcion: (name: string, code: string, label: string) => void;
  restaurar: (name: string) => void;
  confirmar: () => void;
};

export function useBorradorDeEtiquetas(variables: DataReviewVariable[]): BorradorDeEtiquetas {
  const variableLabels = useAnaliticaStore((s) => s.config.datos.variable_labels);
  const valueLabels = useAnaliticaStore((s) => s.config.datos.value_labels);
  const setDatosVariableLabel = useAnaliticaStore((s) => s.setDatosVariableLabel);
  const setDatosValueLabel = useAnaliticaStore((s) => s.setDatosValueLabel);
  const clearDatosVariable = useAnaliticaStore((s) => s.clearDatosVariable);
  const [borradorEditado, setBorradorEditado] = useState<DataReviewDraft>({ variableLabels: {}, valueLabels: {} });
  const [error, setError] = useState("");

  const guardado = useMemo(
    () => buildDataReviewDraft(variables, variableLabels, valueLabels),
    [variables, variableLabels, valueLabels],
  );
  // Al cambiar lo guardado (otra base, confirmación, autosave de otra pestaña) el borrador vuelve a lo guardado.
  useEffect(() => {
    setBorradorEditado(guardado);
    setError("");
  }, [guardado]);

  const listo = variables.every((v) => Object.prototype.hasOwnProperty.call(borradorEditado.variableLabels, v.name));
  const borrador = listo ? borradorEditado : guardado;
  const estado = useMemo(() => dataReviewDraftStatus(variables, borrador, guardado), [variables, borrador, guardado]);

  function editar(cambio: (previo: DataReviewDraft) => DataReviewDraft) {
    setBorradorEditado((previo) => cambio(previo));
    if (error) setError("");
  }

  function confirmar() {
    if (estado.emptyCount > 0) {
      setError(
        `${estado.emptyCount} etiqueta${estado.emptyCount === 1 ? "" : "s"} vacía${estado.emptyCount === 1 ? "" : "s"}. Completa esos campos antes de confirmar los cambios.`,
      );
      return;
    }
    if (estado.pendingCount === 0) return;
    for (const variable of variables) {
      const etiqueta = (borrador.variableLabels[variable.name] ?? "").trim();
      const original = dataReviewEffectiveVariableLabel(variable);
      const editables = dataReviewHasEditableOptions(variable);
      const cambioOpcion = editables && variable.opciones.some((o) =>
        (borrador.valueLabels[variable.name]?.[o.code] ?? "").trim() !== (guardado.valueLabels[variable.name]?.[o.code] ?? ""));
      if (etiqueta === (guardado.variableLabels[variable.name] ?? "") && !cambioOpcion) continue;
      clearDatosVariable(variable.name);
      if (etiqueta !== original) setDatosVariableLabel(variable.name, etiqueta);
      if (!editables) continue;
      for (const option of variable.opciones) {
        const etiquetaOpcion = (borrador.valueLabels[variable.name]?.[option.code] ?? "").trim();
        if (etiquetaOpcion !== dataReviewEffectiveOptionLabel(option)) setDatosValueLabel(variable.name, option.code, etiquetaOpcion);
      }
    }
    setError("");
  }

  return {
    borrador,
    guardado,
    pendientes: estado.pendingCount,
    vacias: estado.pendingCount > 0 ? estado.emptyCount : 0,
    error,
    etiquetaDe: (v) => borrador.variableLabels[v.name] ?? dataReviewEffectiveVariableLabel(v),
    etiquetaDeOpcion: (v, code) => {
      const option = v.opciones.find((o) => o.code === code);
      return borrador.valueLabels[v.name]?.[code] ?? (option ? dataReviewEffectiveOptionLabel(option) : "");
    },
    setEtiqueta: (name, label) => editar((p) => ({ ...p, variableLabels: { ...p.variableLabels, [name]: label } })),
    setEtiquetaDeOpcion: (name, code, label) => editar((p) => ({
      ...p,
      valueLabels: { ...p.valueLabels, [name]: { ...(p.valueLabels[name] ?? {}), [code]: label } },
    })),
    restaurar: (name) => {
      const variable = variables.find((v) => v.name === name);
      if (!variable) return;
      editar((p) => {
        const valores = { ...p.valueLabels };
        if (dataReviewHasEditableOptions(variable)) {
          valores[name] = Object.fromEntries(variable.opciones.map((o) => [o.code, dataReviewEffectiveOptionLabel(o)]));
        } else {
          delete valores[name];
        }
        return { variableLabels: { ...p.variableLabels, [name]: dataReviewEffectiveVariableLabel(variable) }, valueLabels: valores };
      });
    },
    confirmar,
  };
}
