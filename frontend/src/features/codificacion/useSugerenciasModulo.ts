// Pide una vez la propuesta de módulo de un texto abierto (TXT-3). Sólo para preguntas de texto: en una de opción con
// «Otros, especifique» el texto no habla de los módulos del formulario. Un formulario sin módulos (E_CODIF_SUGERIR_SIN_
// SECCIONES) es un vacío legítimo y no se avisa; cualquier otro error sí, con su causa.

import { useEffect, useState } from "react";
import { ApiError } from "../../api/core";
import { apiCodifSugerenciasSeccion, type CodifSugerenciasSeccion } from "../../api/codificacion";

export type EstadoSugerencias =
  | { fase: "apagado" }
  | { fase: "cargando" }
  | { fase: "lista"; datos: CodifSugerenciasSeccion }
  | { fase: "sin_modulos" }
  | { fase: "error"; mensaje: string };

export function useSugerenciasModulo(variable: string, habilitado: boolean): EstadoSugerencias {
  const [estado, setEstado] = useState<EstadoSugerencias>({ fase: "apagado" });
  useEffect(() => {
    if (!habilitado || !variable) { setEstado({ fase: "apagado" }); return; }
    let vivo = true;
    setEstado({ fase: "cargando" });
    apiCodifSugerenciasSeccion(variable)
      .then((datos) => { if (vivo) setEstado(datos.modulos.length ? { fase: "lista", datos } : { fase: "sin_modulos" }); })
      .catch((e: unknown) => {
        if (!vivo) return;
        if (e instanceof ApiError && e.code === "E_CODIF_SUGERIR_SIN_SECCIONES") { setEstado({ fase: "sin_modulos" }); return; }
        setEstado({ fase: "error", mensaje: e instanceof Error ? e.message : "No se pudo leer la propuesta." });
      });
    return () => { vivo = false; };
  }, [variable, habilitado]);
  return estado;
}
