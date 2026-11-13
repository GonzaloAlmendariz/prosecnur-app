import { useEffect, useState } from "react";
import { apiCatalogoProponerPapeles, type PropuestaDePapeles } from "../../../../api/catalogoUbigeo";

export type EstadoDePropuesta =
  | { fase: "cargando" }
  | { fase: "lista"; propuesta: PropuestaDePapeles }
  | { fase: "error"; mensaje: string };

/**
 * Qué columna de la base cumple cada papel de "Combinación fuera de catálogo",
 * según el motor (por contenido, nunca por el nombre de la columna). Se pide
 * una vez por base; cambiar de base cancela el pedido anterior.
 */
export function usePropuestaDePapeles(baseNombre: string | null): EstadoDePropuesta {
  const [estado, setEstado] = useState<EstadoDePropuesta>({ fase: "cargando" });
  useEffect(() => {
    const control = new AbortController();
    setEstado({ fase: "cargando" });
    apiCatalogoProponerPapeles(baseNombre, { signal: control.signal })
      .then((propuesta) => setEstado({ fase: "lista", propuesta }))
      .catch((e: unknown) => {
        if (control.signal.aborted) return;
        setEstado({ fase: "error", mensaje: e instanceof Error ? e.message : "No se pudo leer la base." });
      });
    return () => control.abort();
  }, [baseNombre]);
  return estado;
}
