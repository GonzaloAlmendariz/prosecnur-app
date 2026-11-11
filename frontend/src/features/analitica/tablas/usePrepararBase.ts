// Preparar la base de Analítica desde la vista previa, cuando el servicio
// responde que no hay base preparada (409 E_NO_RP_DATA).
//
// Es la misma llamada que hace AnaliticaPage al entrar (`POST
// /api/analitica/preparar`). La vista previa ya intenta preparar por su cuenta
// y se calla el error; esta llamada sí lo devuelve, así que si falla se puede
// decir por qué.

import { useCallback, useState } from "react";

import { apiAnaliticaPreparar } from "../../../api/analitica";
import { ApiError } from "../../../api/core";
import { splitErrorDetail } from "../../../components/errorPresentation";
import { useSession } from "../../../lib/SessionContext";

export type PrepararBase = {
  preparando: boolean;
  /** Por qué no se pudo preparar; vacío si no se intentó o salió bien. */
  causa: string;
  preparar: () => void;
};

export function usePrepararBase(alTerminar: () => void): PrepararBase {
  const { refresh } = useSession();
  const [preparando, setPreparando] = useState(false);
  const [causa, setCausa] = useState("");
  const preparar = useCallback(() => {
    setPreparando(true);
    setCausa("");
    apiAnaliticaPreparar()
      .then(async () => {
        await refresh();
        alTerminar();
      })
      .catch((e: unknown) => {
        const mensaje = e instanceof Error ? e.message : String(e);
        setCausa(e instanceof ApiError ? splitErrorDetail(mensaje).message : mensaje);
      })
      .finally(() => setPreparando(false));
  }, [alTerminar, refresh]);
  return { preparando, causa, preparar };
}
