import { useCallback, useEffect, useState } from "react";

import { apiEstudioGet, type EstudioPayload } from "../../api/estudio";
import type { EstadoEstudioCarga } from "./cargaHidratacion";

/**
 * Lectura del estudio multibase de Carga. Antes vivía como efecto suelto en
 * `CargaPage` y tragaba el error: la página quedaba «preparando» para siempre
 * y no había forma de distinguir «leyendo» de «falló». Ahora el hook expone el
 * estado de la lectura para la hidratación honesta (L4).
 *
 * `firma` cambia cuando el backend añade, quita o renombra bases; el payload
 * anterior se conserva mientras llega el nuevo (no hay parpadeo a skeleton).
 */
export function useEstudioCarga(esMultiBase: boolean, firma: string) {
  const [estudio, setEstudio] = useState<EstudioPayload | null>(null);
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!esMultiBase) {
      setEstudio(null);
      setFallo(false);
      return;
    }
    let cancelado = false;
    setFallo(false);
    apiEstudioGet()
      .then((payload) => {
        if (!cancelado) setEstudio(payload);
      })
      .catch(() => {
        if (cancelado) return;
        setEstudio(null);
        setFallo(true);
      });
    return () => { cancelado = true; };
  }, [esMultiBase, firma, intento]);

  const reintentar = useCallback(() => setIntento((actual) => actual + 1), []);

  const estado: EstadoEstudioCarga = !esMultiBase
    ? "inactivo"
    : estudio
      ? "listo"
      : fallo
        ? "error"
        : "leyendo";

  return { estudio, setEstudio, estado, reintentar };
}

/**
 * Segundos enteros desde que `activo` pasó a `true`; vuelve a 0 al apagarse.
 * Es texto, no animación: no necesita variante de movimiento reducido.
 */
export function useSegundosTranscurridos(activo: boolean): number {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    setSegundos(0);
    if (!activo) return;
    const inicio = Date.now();
    const id = window.setInterval(() => {
      setSegundos(Math.floor((Date.now() - inicio) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [activo]);
  return segundos;
}
