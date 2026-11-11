// El nombre que ve el usuario de una base, por su identificador: el alias o el
// título de su fuente, como el selector de bases. Solo se lee el estudio cuando
// hay más de una base; con una, el identificador no se muestra en ningún lado.

import { useCallback } from "react";

import { apiEstudioGet } from "../../../api/estudio";
import { useSession } from "../../../lib/SessionContext";
import { claveDeLaBase } from "../ponderacion/useBaseDelCalculo";
import { useLecturaPorBase } from "./useLecturaPorBase";

const leerEstudio = () => apiEstudioGet();

export function useEtiquetaDeBase(nBases: number): (base: string) => string {
  const sesion = useSession().state;
  const estudio = useLecturaPorBase(leerEstudio, nBases > 1 ? claveDeLaBase(sesion?.active_base, sesion?.analitica_fuente, 0) : null);
  return useCallback((base: string) => {
    const b = estudio.datos?.bases?.[base];
    return b?.source_alias?.trim() || b?.source_title?.trim() || base;
  }, [estudio.datos]);
}
