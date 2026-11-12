import { useEffect, useState } from "react";
import { apiCatalogoDeReglas, type CatalogoDeReglas, type PreguntaDelCatalogo } from "../../../../api/validacionCatalogo";
import type { ExploradorVariable } from "../../types";

/**
 * El catálogo de reglas (M3) de la base, pedido solo mientras `activo`. Si
 * falla queda en `null`: lo que lo usa (la fila de las reglas sin evaluar, las
 * preguntas de una base sin respuestas) no aparece, no se inventa.
 */
export function useCatalogoDeReglas(activo: boolean, baseNombre: string | null | undefined): CatalogoDeReglas | null {
  const [catalogo, setCatalogo] = useState<{ clave: string; valor: CatalogoDeReglas } | null>(null);
  const clave = baseNombre ?? "";
  useEffect(() => {
    if (!activo) return;
    let cancelado = false;
    apiCatalogoDeReglas(baseNombre).then(
      (valor) => {
        if (!cancelado) setCatalogo({ clave, valor });
      },
      () => {
        if (!cancelado) setCatalogo(null);
      },
    );
    return () => {
      cancelado = true;
    };
  }, [activo, baseNombre, clave]);
  return activo && catalogo?.clave === clave ? catalogo.valor : null;
}

const TIPO_DE_FICHA: Record<PreguntaDelCatalogo["tipo"], ExploradorVariable["tipo"]> = {
  unica: "so",
  multiple: "sm",
  numerica: "num",
  texto: "texto",
};

/**
 * Las preguntas del formulario cuando la base aún no tiene respuestas: el
 * inventario de Explorar lee las respuestas y no contesta, el catálogo sí (las
 * preguntas que nombran sus reglas).
 */
export function preguntasDelCatalogo(catalogo: CatalogoDeReglas | null): ExploradorVariable[] {
  return (catalogo?.preguntas ?? []).map((p) => ({
    name: p.codigo,
    label: p.etiqueta ?? p.codigo,
    tipo: TIPO_DE_FICHA[p.tipo],
    n_validos: 0,
    n_nulos: 0,
  }));
}
