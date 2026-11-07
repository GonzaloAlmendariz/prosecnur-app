import { useEffect, useState } from "react";
import { apiPlannerEstado } from "../../api/planner";
import { EVENTO_ESTUDIO_DECLARADO } from "../estudio/useEstudioDeclarado";

/**
 * El nombre oficial del estudio, el que se declara en la Ficha (`estudio.nombre`, ADR 0124). `undefined`
 * mientras se lee; `""` si la Ficha no lo declara. El overview no lo distingue: su `project.name` cae al
 * nombre del archivo cuando no hay título, así que el Home no sabía si mostraba el nombre oficial o el del
 * .pulso (6 nov 2026, Gonzalo: «la ficha del estudio debería avisar cuando no hay nombre oficial»).
 * Se relee cuando la Ficha declara (EVENTO_ESTUDIO_DECLARADO).
 */
export function useNombreOficial(): string | undefined {
  const [nombre, setNombre] = useState<string | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    const leer = () => {
      apiPlannerEstado()
        .then((e) => { if (vivo) setNombre((e.planner?.estudio?.nombre ?? "").trim()); })
        // Sin la Ficha legible no se afirma que falte: no se avisa.
        .catch(() => { if (vivo) setNombre(undefined); });
    };
    leer();
    window.addEventListener(EVENTO_ESTUDIO_DECLARADO, leer);
    return () => { vivo = false; window.removeEventListener(EVENTO_ESTUDIO_DECLARADO, leer); };
  }, []);
  return nombre;
}
