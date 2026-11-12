// Las respuestas que guarda un código se comparan con la lista de la base por su forma normalizada.
//
// El motor lee `grupos[].respuestas` pasando cada texto por `.normalize_text` (api/R/router_codificacion.R,
// al armar el mapa texto a código y al contar respuestas por código; api/R/codificacion_omitidas.R) y lo
// compara con la columna normalizada de la misma forma. Un código importado desde la matriz o escrito por
// otra vía puede guardar el texto tal cual ("Necesita seguimiento."), mientras la lista de respuestas
// únicas llega con su clave `texto_normalizado` ("necesita seguimiento."). Sin esta alineación, Codificar
// decía "0 de 3 respuestas con código" de una pregunta que Aplicar contaba como codificada.
//
// Al cargar, cada clave guardada que coincide con una respuesta de la lista se reemplaza por la clave de
// esa respuesta, que es la misma que Codificar escribe al asignar. Las que no coinciden con ninguna se
// conservan tal cual: son textos que la base ya no trae y se siguen mostrando como tales.

import type { Grupo } from "../../../api/codificacion";
import { normalizarTextoCodif } from "../sugerenciasModulo";

export function alinearClavesConRespuestas(
  grupos: readonly Grupo[],
  respuestas: readonly { texto_normalizado: string }[],
): Grupo[] {
  const porNormal = new Map<string, string>();
  for (const r of respuestas) {
    const normal = normalizarTextoCodif(r.texto_normalizado);
    if (!porNormal.has(normal)) porNormal.set(normal, r.texto_normalizado);
  }
  return grupos.map((g) => {
    const vistas = new Set<string>();
    const claves: string[] = [];
    let cambio = false;
    for (const guardada of g.respuestas) {
      const clave = porNormal.get(normalizarTextoCodif(guardada)) ?? guardada;
      if (clave !== guardada) cambio = true;
      if (vistas.has(clave)) {
        cambio = true;
        continue;
      }
      vistas.add(clave);
      claves.push(clave);
    }
    return cambio ? { ...g, respuestas: claves } : g;
  });
}

/**
 * Los códigos con un `id` único. Un estado guardado puede traer códigos sin `id` o dos con el mismo (lo visto
 * en el proyecto sintético: React avisaba claves repetidas en la lista de códigos); como todo cambio busca el
 * código por su `id`, editar uno cambiaba los dos. El primero conserva su `id`; los demás reciben uno nuevo.
 */
export function idsUnicos(grupos: readonly Grupo[]): Grupo[] {
  const vistos = new Set<string>();
  let cambio = false;
  const lista = grupos.map((g, i) => {
    // Un código guardado sin `id` (el proyecto sintético los trae así) recibe uno a partir de su número.
    if (!g.id) {
      cambio = true;
      let nuevo = `g_${g.codigo || i}`;
      while (vistos.has(nuevo)) nuevo = `${nuevo}_${i}`;
      vistos.add(nuevo);
      return { ...g, id: nuevo };
    }
    if (!vistos.has(g.id)) {
      vistos.add(g.id);
      return g;
    }
    cambio = true;
    let nuevo = `${g.id}_${i}`;
    while (vistos.has(nuevo)) nuevo = `${nuevo}_`;
    vistos.add(nuevo);
    return { ...g, id: nuevo };
  });
  return cambio ? lista : [...grupos];
}
