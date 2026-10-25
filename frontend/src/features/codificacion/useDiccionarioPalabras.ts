// Lee y guarda el diccionario de una pregunta abierta (TXT-6/7). El estado vive en `diccionarioPalabras.ts`; aquí sólo
// la red. Tras guardar se vuelve a leer (los conteos de cada grupo los calcula el servidor) y se avisa a quien abrió el
// panel, porque la sugerencia de módulo no se recalcula sola.

import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiError } from "../../api/core";
import { apiGuardarTextoAbiertoDiccionario, apiTextoAbiertoDiccionario } from "../../api/textoAbierto";
import {
  ESTADO_INICIAL_PALABRAS,
  mensajeGuardadoLlano,
  reducirPalabras,
  type AccionPalabras,
  type EstadoPalabras,
} from "./diccionarioPalabras";

export type ControlPalabras = {
  estado: EstadoPalabras;
  despachar: (a: AccionPalabras) => void;
  guardar: () => Promise<void>;
};

function mensajeLectura(e: unknown): string {
  if (e instanceof ApiError) return mensajeGuardadoLlano(e.code, e.message);
  return e instanceof Error ? e.message : "No se pudieron leer las palabras.";
}

export function useDiccionarioPalabras(variable: string, abierto: boolean, onGuardado: () => void): ControlPalabras {
  const [estado, despachar] = useReducer(reducirPalabras, ESTADO_INICIAL_PALABRAS);
  const vivo = useRef(true);
  // StrictMode monta, desmonta y vuelve a montar: el segundo montaje tiene que volver a encenderlo.
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  useEffect(() => {
    if (!abierto || !variable) return;
    let actual = true;
    despachar({ tipo: "cargando" });
    apiTextoAbiertoDiccionario(variable)
      .then((datos) => { if (actual) despachar({ tipo: "cargado", datos }); })
      .catch((e: unknown) => { if (actual) despachar({ tipo: "error-lectura", mensaje: mensajeLectura(e) }); });
    return () => { actual = false; };
  }, [variable, abierto]);

  const borrador = estado.borrador;
  const guardar = useCallback(async () => {
    despachar({ tipo: "guardando" });
    try {
      await apiGuardarTextoAbiertoDiccionario(variable, borrador);
      const datos = await apiTextoAbiertoDiccionario(variable);
      if (!vivo.current) return;
      despachar({ tipo: "guardado", datos });
      onGuardado();
    } catch (e: unknown) {
      if (!vivo.current) return;
      despachar({ tipo: "error-guardado", mensaje: e instanceof ApiError ? mensajeGuardadoLlano(e.code, e.message) : mensajeLectura(e) });
    }
  }, [variable, borrador, onGuardado]);

  return { estado, despachar, guardar };
}
