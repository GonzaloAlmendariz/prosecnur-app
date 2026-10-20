import type { BuilderNode } from "../types";
import { evaluarRestriccion, valoresDeEjemplo, type ResultadoPrueba } from "../logic/probarRestriccion";
import { bloquesDesdePatron, cuerpoDeConstraint, ejemploValido, FORMATOS } from "./armador/armadorModelo";

// Casos de «Probar valores» sacados de la regla vigente. Un formato que el armador entiende da un ejemplo válido y
// variantes que fallan por una sola cosa (falta, sobra, un espacio, una letra); lo demás usa los bordes del motor.
// Una respuesta vacía no se evalúa contra la restricción en XLSForm: se muestra así, no como «Pide corregir».

export type ResultadoCaso = ResultadoPrueba | "no-se-evalua";

export const ETIQUETA_CASO: Record<ResultadoCaso, string> = {
  acepta: "Se acepta",
  rechaza: "Pide corregir",
  "no-evaluable": "No se puede probar aquí",
  "no-se-evalua": "No se evalúa",
};

export function resultadoDeCaso(node: Pick<BuilderNode, "constraint" | "name">, valor: string): ResultadoCaso {
  if (!valor.trim()) return "no-se-evalua";
  return evaluarRestriccion(node.constraint, valor, {}, node.name);
}

/** Variantes de un valor válido que rompen una sola cosa. */
function variantes(ej: string): string[] {
  const medio = Math.max(1, Math.floor(ej.length / 2));
  const otraClase = (c: string) => (/\d/.test(c) ? "a" : /\p{L}/u.test(c) ? "9" : "x");
  return [
    ej.slice(0, -1),
    ej + ej.slice(-1),
    `${ej.slice(0, medio)} ${ej.slice(medio)}`,
    ej.slice(0, medio) + otraClase(ej[medio] ?? "") + ej.slice(medio + 1),
  ].filter((v) => v && v !== ej);
}

export function casosDeRestriccion(node: BuilderNode, opciones: readonly string[] = []): string[] {
  const cuerpo = node.typeInfo.base === "text" ? cuerpoDeConstraint(node.constraint) : null;
  const leido = cuerpo !== null ? bloquesDesdePatron(cuerpo) : null;
  if (leido) {
    const formato = FORMATOS.find((f) => f.id === leido.formato);
    const ej = ejemploValido(leido.bloques, leido.formato)?.map((t) => t.texto).join("") ?? "";
    const malos = [...(formato?.malos ?? []), ...(ej ? variantes(ej) : [])].filter((v) => resultadoDeCaso(node, v) === "rechaza");
    const validos = [formato?.ej, ej].filter((v): v is string => !!v && resultadoDeCaso(node, v) === "acepta");
    const casos = [...new Set([...validos.slice(0, 1), ...malos])].slice(0, 5);
    if (casos.length) return [...casos, ""];
  }
  return valoresDeEjemplo(node, opciones);
}
