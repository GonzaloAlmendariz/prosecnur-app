import { useCallback, useEffect, useState } from "react";
import { apiXlsformSmSugerenciasLogica, type SmSugerenciaLogica } from "../../../api/xlsformSmSugerencias";
import { claveSugerencia } from "./smImportModel";
import { AVISO_LOGICA_SM, type EstadoSugerenciasSm } from "./SmLogicaSugerencias";

/**
 * Pide las sugerencias de lógica de la encuesta cargada y recuerda cuáles se
 * descartaron. Una respuesta tardía de otra encuesta se ignora. Un fallo no
 * bloquea la importación: queda el aviso honesto, sin tarjetas.
 */
export function useSmSugerenciasLogica(surveyId: string | null) {
  const [estado, setEstado] = useState<EstadoSugerenciasSm>({ fase: "inactivo" });
  const [descartadas, setDescartadas] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    setDescartadas(new Set());
    if (!surveyId) {
      setEstado({ fase: "inactivo" });
      return;
    }
    let vigente = true;
    setEstado({ fase: "cargando" });
    apiXlsformSmSugerenciasLogica(surveyId)
      .then((r) => {
        if (vigente) setEstado({ fase: "listo", aviso: r.aviso, sugerencias: r.sugerencias });
      })
      .catch(() => {
        if (vigente) setEstado({ fase: "error", aviso: AVISO_LOGICA_SM });
      });
    return () => {
      vigente = false;
    };
  }, [surveyId]);

  const descartar = useCallback((sugerencia: SmSugerenciaLogica) => {
    setDescartadas((prev) => new Set(prev).add(claveSugerencia(sugerencia)));
  }, []);

  const pendientes = estado.fase === "listo"
    ? estado.sugerencias.filter((s) => !descartadas.has(claveSugerencia(s)))
    : [];

  return { estado, descartadas, descartar, pendientes };
}
