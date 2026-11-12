// Lo que la vista de Dimensiones lee del motor: si hay puntajes calculados y su
// cobertura por columna, las listas de escala del formulario (para las
// preguntas que quedaron fuera de un bloque) y los nombres de las preguntas.
// "Volver a calcular" corre la construcción y relee la cobertura.

import { useCallback, useEffect, useState } from "react";

import { apiAnaliticaVariables, type VariableInstrumento } from "../../../api/analitica";
import {
  apiAnaliticaDimensionesBuild,
  apiAnaliticaDimensionesDetect,
  apiAnaliticaDimensionesPreview,
  apiAnaliticaDimensionesStatus,
  type DimensionesCobertura,
  type DimensionesEscalaDetectada,
} from "../../../api/dashboard";
import { useSession } from "../../../lib/SessionContext";

export type LecturaDeDimensiones =
  | { fase: "leyendo" }
  | { fase: "error"; mensaje: string }
  | {
      fase: "lista";
      calculadas: boolean;
      cobertura: DimensionesCobertura[];
      escalas: DimensionesEscalaDetectada[] | null;
      etiquetas: Map<string, string>;
    };

export function useDimensionesCalculadas() {
  const { refresh } = useSession();
  const [lectura, setLectura] = useState<LecturaDeDimensiones>({ fase: "leyendo" });
  const [intento, setIntento] = useState(0);
  const [calculando, setCalculando] = useState(false);
  const [errorDeCalculo, setErrorDeCalculo] = useState("");

  useEffect(() => {
    let cancelado = false;
    setLectura({ fase: "leyendo" });
    (async () => {
      try {
        const [estado, escalas, variables] = await Promise.all([
          apiAnaliticaDimensionesStatus(),
          // Sin listas de escala la vista sigue: solo pierde las preguntas sin bloque y la base de la cifra.
          apiAnaliticaDimensionesDetect().then((r) => r.escalas).catch(() => null),
          apiAnaliticaVariables().then((r) => r.variables).catch((): VariableInstrumento[] => []),
        ]);
        const calculadas = estado.built && estado.n_filas > 0 && (estado.n_idx > 0 || estado.n_sub > 0);
        const cobertura = calculadas ? (await apiAnaliticaDimensionesPreview()).preview.cobertura : [];
        if (cancelado) return;
        setLectura({
          fase: "lista",
          calculadas,
          cobertura,
          escalas,
          etiquetas: new Map(variables.map((v) => [v.name, v.label])),
        });
      } catch (e) {
        if (!cancelado) setLectura({ fase: "error", mensaje: (e as Error).message });
      }
    })();
    return () => { cancelado = true; };
  }, [intento]);

  const releer = useCallback(() => setIntento((n) => n + 1), []);

  const recalcular = useCallback(async () => {
    setCalculando(true);
    setErrorDeCalculo("");
    try {
      await apiAnaliticaDimensionesBuild();
      await refresh();
      window.dispatchEvent(new Event("pulso:project-status-changed"));
      setIntento((n) => n + 1);
    } catch (e) {
      setErrorDeCalculo((e as Error).message);
    } finally {
      setCalculando(false);
    }
  }, [refresh]);

  return { lectura, releer, recalcular, calculando, errorDeCalculo };
}
