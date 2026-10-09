import { useEffect, useState } from "react";

import { apiCalcMuestraMarcoInspeccionarArchivo } from "../../../api/calcMuestra";
import type { CalcMuestraGeneralMarco } from "../../../api/calcMuestraGeneral";

type Columnas = { fileId: string; hoja: string; columnas: string[] };

/**
 * Columnas del archivo declarado, para «ordenar por» del sistemático. El marco
 * guarda sólo las tres columnas con rol; las demás se leen de la inspección
 * del mismo archivo, y sólo cuando hacen falta.
 */
export function useColumnasDelMarco(marco: CalcMuestraGeneralMarco | null, activo: boolean): string[] {
  const [leidas, setLeidas] = useState<Columnas | null>(null);
  const fileId = marco?.file_id ?? "";
  const hoja = marco?.hoja ?? "";
  const vigentes = leidas && leidas.fileId === fileId && leidas.hoja === hoja;

  useEffect(() => {
    if (!activo || !fileId || vigentes) return;
    let vivo = true;
    apiCalcMuestraMarcoInspeccionarArchivo(fileId)
      .then((res) => {
        if (!vivo) return;
        const hojas = res.inspection.sheets ?? [];
        const elegida = hojas.find((s) => s.name === hoja) ?? hojas[0];
        setLeidas({ fileId, hoja, columnas: (elegida?.columns_sample ?? []).filter(Boolean) });
      })
      // Sin columnas se ordena por id, que es el orden por defecto del motor.
      .catch(() => {
        if (vivo) setLeidas({ fileId, hoja, columnas: [] });
      });
    return () => {
      vivo = false;
    };
  }, [activo, fileId, hoja, vigentes]);

  return vigentes && leidas ? leidas.columnas : [];
}
