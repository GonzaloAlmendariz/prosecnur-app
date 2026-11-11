// Pide al motor el efecto de la ponderación cada vez que cambia su config o la
// base sobre la que se pondera (base activa, fuente, universo de análisis), con
// una espera de 500 ms entre cambios. La config se persiste por el autosave de
// Analítica; aquí solo se previsualiza y nada se guarda.

import { useCallback, useEffect, useState } from "react";

import { apiAnaliticaPonderacionPreview } from "../../../api/analitica";
import type { PonderacionConfig } from "../store";
import { type CalculoDePonderacion, ultimoResultado } from "./calculoDePonderacion";

const ESPERA_MS = 500;

export function usePreviewDePonderacion(
  pond: PonderacionConfig,
  /** Falso con la ponderación apagada o con el peso tomado de una columna. */
  activo: boolean,
  /**
   * Lo que cambia la base del cálculo sin cambiar `pond` (useBaseDelCalculo.ts).
   * Al cambiar, el resultado que hay deja de ser vigente y se pide otro.
   */
  base = "",
): { calculo: CalculoDePonderacion; reintentar: () => void } {
  const [calculo, setCalculo] = useState<CalculoDePonderacion>({ fase: "inactivo" });
  const [intento, setIntento] = useState(0);
  const clave = JSON.stringify(pond);

  useEffect(() => {
    if (!activo) {
      setCalculo({ fase: "inactivo" });
      return;
    }
    // Una respuesta que llega después de otro cambio ya no describe la config vigente.
    let vigente = true;
    setCalculo((anterior) => ({ fase: "calculando", previo: ultimoResultado(anterior) }));
    const reloj = setTimeout(() => {
      apiAnaliticaPonderacionPreview(JSON.parse(clave) as PonderacionConfig).then(
        (preview) => {
          if (vigente) setCalculo({ fase: "listo", preview });
        },
        (e: unknown) => {
          if (vigente) setCalculo({ fase: "error", mensaje: e instanceof Error ? e.message : String(e) });
        },
      );
    }, ESPERA_MS);
    return () => {
      vigente = false;
      clearTimeout(reloj);
    };
  }, [activo, clave, base, intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);
  return { calculo, reintentar };
}
