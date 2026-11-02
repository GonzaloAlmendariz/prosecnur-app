// Las columnas de una campaña de supervisión: se leen al abrir y se guardan con la revisión leída.

import { useCallback, useEffect, useState } from "react";

import { apiSupervisionColumnas, apiSupervisionGuardarColumnas, type ColumnasDeSupervision } from "../../../api/materialSupervision";

const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error ? e.message.replace(/ · E_[A-Z_]+$/, "") : porDefecto);

export function useColumnasSupervision(campaignId: string) {
  const [columnas, setColumnas] = useState<ColumnasDeSupervision | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      setColumnas(await apiSupervisionColumnas(campaignId));
      setError("");
    } catch (e) {
      setError(mensaje(e, "No se pudieron leer las columnas de la supervisión."));
    } finally {
      setCargando(false);
    }
  }, [campaignId]);
  useEffect(() => { void recargar(); }, [recargar]);
  const guardar = useCallback(async (elegidas: { barrido: string[]; resultados: string[] }) => {
    if (!columnas) return;
    setGuardando(true);
    try {
      setColumnas(await apiSupervisionGuardarColumnas(campaignId, elegidas, columnas.revision));
      setError("");
    } catch (e) {
      setError(mensaje(e, "No se pudieron guardar las columnas."));
    } finally {
      setGuardando(false);
    }
  }, [campaignId, columnas]);
  return { columnas, cargando, guardando, error, recargar, guardar };
}
