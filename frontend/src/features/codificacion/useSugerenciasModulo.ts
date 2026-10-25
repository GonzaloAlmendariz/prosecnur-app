// Pide una vez la propuesta de módulo de un texto abierto (TXT-3). Sólo para preguntas de texto: en una de opción con
// «Otros, especifique» el texto no habla de los módulos del formulario. Un formulario sin módulos (E_CODIF_SUGERIR_SIN_
// SECCIONES) es un vacío legítimo y no se avisa; cualquier otro error sí, con su causa.

import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/core";
import { apiCodifSugerenciasSeccion, type CodifSugerenciasSeccion } from "../../api/codificacion";

export type EstadoSugerencias =
  | { fase: "apagado" }
  | { fase: "cargando" }
  | { fase: "lista"; datos: CodifSugerenciasSeccion }
  | { fase: "sin_modulos" }
  | { fase: "error"; mensaje: string };

/** `version` sube cuando cambia el diccionario de la pregunta (panel «Palabras»): la propuesta no se recalcula sola. */
export function useSugerenciasModulo(variable: string, habilitado: boolean, version = 0): EstadoSugerencias {
  const [estado, setEstado] = useState<EstadoSugerencias>({ fase: "apagado" });
  const ultimaVariable = useRef<string | null>(null);
  useEffect(() => {
    if (!habilitado || !variable) { ultimaVariable.current = null; setEstado({ fase: "apagado" }); return; }
    let vivo = true;
    // Recalcular la misma pregunta (subió `version`) conserva la propuesta anterior mientras llega la nueva: volver a
    // «cargando» desmontaría la vista entera, con el panel «Palabras» que pidió el recálculo.
    const misma = ultimaVariable.current === variable;
    ultimaVariable.current = variable;
    setEstado((prev) => (misma && prev.fase === "lista" ? prev : { fase: "cargando" }));
    apiCodifSugerenciasSeccion(variable)
      .then((datos) => { if (vivo) setEstado(datos.modulos.length ? { fase: "lista", datos } : { fase: "sin_modulos" }); })
      .catch((e: unknown) => {
        if (!vivo) return;
        if (e instanceof ApiError && e.code === "E_CODIF_SUGERIR_SIN_SECCIONES") { setEstado({ fase: "sin_modulos" }); return; }
        setEstado({ fase: "error", mensaje: e instanceof Error ? e.message : "No se pudo leer la propuesta." });
      });
    return () => { vivo = false; };
  }, [variable, habilitado, version]);
  return estado;
}
