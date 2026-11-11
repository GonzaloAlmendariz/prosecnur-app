// Con una base, la página no lee el estudio (solo lo hace con varias). Bases sí
// lo necesita para que la tarjeta diga de dónde viene la base y cuántas
// respuestas trae al reabrir el proyecto, cuando ya no queda la vista previa de
// la subida. Es una lectura de cortesía: si falla, la tarjeta se queda con lo
// que sabe la sesión.

import { useEffect, useState } from "react";
import { apiEstudioGet, type EstudioBase } from "../../../../api/estudio";
import { NOMBRE_BASE_UNICA } from "./basesModel";

export function useBaseUnicaRegistrada(activo: boolean, firma: string): EstudioBase | null {
  const [base, setBase] = useState<EstudioBase | null>(null);
  useEffect(() => {
    if (!activo) {
      setBase(null);
      return;
    }
    let vigente = true;
    apiEstudioGet()
      .then((estudio) => {
        if (!vigente) return;
        const bases = Object.values(estudio.bases ?? {});
        setBase(estudio.bases?.[NOMBRE_BASE_UNICA] ?? (bases.length === 1 ? bases[0] : null));
      })
      .catch(() => {
        if (vigente) setBase(null);
      });
    return () => {
      vigente = false;
    };
  }, [activo, firma]);
  return base;
}
