// Qué textos de una lámina se editan en la sección «Contenido» del inspector (F6.1).
//
// El registro del backend declara los argumentos de cada tipo de lámina. Contenido muestra los textos simples
// (título, subtítulo, base, pie, introducción del Word…) con su rótulo del registro; los argumentos con editor propio
// (índice jerárquico, filas técnicas, ícono) se nombran y quedan en el Editor anterior hasta que tengan su superficie.

import type { ArgMetadata } from "../../../api/graficos";

export type CampoTexto = { name: string; label: string; multilinea: boolean; descripcion: string };

export type ContenidoLamina = {
  campos: CampoTexto[];
  /** Rótulos de los argumentos que todavía se editan en el Editor anterior. */
  pendientes: string[];
};

const GRUPOS_DE_CONTENIDO = new Set(["textos", "lectura", "datos"]);

export function contenidoDeLamina(args: readonly ArgMetadata[], ranuras: readonly string[]): ContenidoLamina {
  const ranuraSet = new Set(ranuras);
  const campos: CampoTexto[] = [];
  const pendientes: string[] = [];
  for (const a of args) {
    if (ranuraSet.has(a.name) || a.tipo_input === "meta") continue;
    const esTexto = a.tipo_input === "string" || a.tipo_input === "textarea";
    if (esTexto && GRUPOS_DE_CONTENIDO.has(String(a.grupo ?? "textos"))) {
      campos.push({ name: a.name, label: a.label || a.name, multilinea: a.tipo_input === "textarea", descripcion: a.descripcion ?? "" });
    } else if (!esTexto && (a.tipo_input === "technical_rows" || a.tipo_input === "icono" || a.tipo_input === "iconos_list"
      || a.tipo_input === "variables_list" || a.tipo_input === "codigos_list")) {
      pendientes.push(a.label || a.name);
    }
  }
  // El título va primero: es el que el analista busca.
  campos.sort((x, y) => (x.name === "titulo" ? -1 : y.name === "titulo" ? 1 : 0));
  if (!campos.some((c) => c.name === "titulo")) {
    campos.unshift({ name: "titulo", label: "Título", multilinea: false, descripcion: "" });
  }
  return { campos, pendientes: [...new Set(pendientes)] };
}
