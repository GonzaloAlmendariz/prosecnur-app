// Paleta de comandos (L30, maqueta m/L30-paleta): buscar cualquier vista de la app desde el teclado.
//
// La búsqueda corre sobre el manifiesto de navegación (las mismas direcciones que recorre el QA), así que una
// vista nueva aparece en la paleta sin registrarla en otro lado. Cada resultado lleva su ruta de migas
// («Monitoreo › Territorial › Avance») porque «Avance» a secas existe en varios módulos.

import type { NodoNavegacion } from "./manifiesto";

export type ResultadoPaleta = {
  clave: string;
  label: string;
  /** «Módulo › Sección»: de dónde cuelga. */
  ruta: string;
  href: string;
  nivel: NodoNavegacion["nivel"];
};

function plano(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Migas del nodo, de la raíz del módulo hasta su padre. */
export function migasDe(nodo: NodoNavegacion, porClave: ReadonlyMap<string, NodoNavegacion>): string[] {
  const migas: string[] = [];
  let padre = nodo.padre ? porClave.get(nodo.padre) : undefined;
  while (padre) {
    migas.unshift(padre.label);
    padre = padre.padre ? porClave.get(padre.padre) : undefined;
  }
  return migas;
}

/**
 * Vistas que casan con la consulta. Cada palabra tiene que aparecer en el nombre o en las migas (sin tildes ni
 * mayúsculas); pesa más casar con el nombre y más aún si el nombre empieza así. Sólo direcciones publicadas: un
 * nodo que la URL no sabe abrir no se ofrece.
 */
export function buscarEnPaleta(
  nodos: readonly NodoNavegacion[],
  consulta: string,
  limite = 12,
): ResultadoPaleta[] {
  const porClave = new Map(nodos.map((n) => [n.clave, n]));
  const palabras = plano(consulta).split(/\s+/).filter(Boolean);
  const puntuados: Array<{ r: ResultadoPaleta; puntos: number; orden: number }> = [];
  nodos.forEach((nodo, orden) => {
    if (!nodo.direccionPublicada) return;
    const migas = migasDe(nodo, porClave);
    const nombre = plano(nodo.label);
    const todo = plano([...migas, nodo.label].join(" "));
    if (palabras.some((p) => !todo.includes(p))) return;
    let puntos = 0;
    for (const p of palabras) {
      if (nombre.startsWith(p)) puntos += 3;
      else if (nombre.includes(p)) puntos += 2;
      else puntos += 1;
    }
    puntos -= migas.length * 0.1;
    puntuados.push({
      r: { clave: nodo.clave, label: nodo.label, ruta: migas.join(" › "), href: nodo.href, nivel: nodo.nivel },
      puntos,
      orden,
    });
  });
  return puntuados
    .sort((a, b) => b.puntos - a.puntos || a.orden - b.orden)
    .slice(0, limite)
    .map(({ r }) => r);
}
