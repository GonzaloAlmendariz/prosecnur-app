import { useEffect, useState } from "react";
import { pedirCatalogoCompleto, type CatalogoCompleto } from "../../../../api/validacionCatalogo";

export type LecturaDelCatalogoDeExplorar =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "listo"; catalogo: CatalogoCompleto };

/**
 * El catálogo de reglas de la base, una vez por base y versión: el panel
 * "Reglas sobre esta pregunta" lo filtra por la pregunta elegida sin volver a
 * pedirlo al cambiar de pregunta. Una base de grupo repetido no tiene plan
 * propio: sus reglas viven en el catálogo de la base madre (contrato M3, 5b).
 */
export function useCatalogoDeExplorar(baseNombre: string | null, version: unknown): LecturaDelCatalogoDeExplorar {
  const [lectura, setLectura] = useState<{ clave: string; valor: LecturaDelCatalogoDeExplorar } | null>(null);
  const clave = `${baseNombre ?? ""}|${String(version)}`;

  useEffect(() => {
    let cancelado = false;
    pedirCatalogoCompleto(baseNombre)
      .then(({ completo }) => {
        if (!cancelado) setLectura({ clave, valor: { estado: "listo", catalogo: completo } });
      })
      .catch((e: unknown) => {
        if (!cancelado) setLectura({ clave, valor: { estado: "error", mensaje: e instanceof Error ? e.message : String(e) } });
      });
    return () => {
      cancelado = true;
    };
  }, [baseNombre, clave]);

  return lectura && lectura.clave === clave ? lectura.valor : { estado: "cargando" };
}
