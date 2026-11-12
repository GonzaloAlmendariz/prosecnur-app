import { useCallback, useEffect, useRef, useState } from "react";
import { apiReglaProbar } from "../../../../api/validacionAuditoria";
import { crearConteoPrevio, esperaDelConteo, type EstadoDelConteo } from "./conteoPrevio";

/**
 * "Casos que marca hoy": cuenta el borrador en el motor sin guardarlo. Ver
 * `conteoPrevio.ts` (espera, cancelación del pedido anterior y descarte de lo
 * que llega tarde).
 */
export function useConteoPrevio(
  cuerpo: Record<string, unknown> | null,
  baseNombre: string | null | undefined,
): { estado: EstadoDelConteo; reintentar: () => void } {
  const [estado, setEstado] = useState<EstadoDelConteo>({ fase: cuerpo ? "contando" : "sin-regla" });
  const conteo = useRef<ReturnType<typeof crearConteoPrevio> | null>(null);

  useEffect(() => {
    const c = crearConteoPrevio({
      probar: (regla, { signal }) => apiReglaProbar(regla, baseNombre, { signal }),
      alCambiar: setEstado,
      esperaMs: esperaDelConteo(),
    });
    conteo.current = c;
    return () => {
      c.cerrar();
      conteo.current = null;
    };
  }, [baseNombre]);

  // `clave` resume el cuerpo: un objeto nuevo con lo mismo no vuelve a contar.
  const clave = cuerpo ? JSON.stringify(cuerpo) : "";
  const ultimo = useRef(cuerpo);
  ultimo.current = cuerpo;
  useEffect(() => {
    conteo.current?.pedir(ultimo.current);
  }, [clave, baseNombre]);

  const reintentar = useCallback(() => conteo.current?.reintentar(), []);
  return { estado, reintentar };
}
