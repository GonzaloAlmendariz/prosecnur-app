// Catálogo canónico de pestañas de Fuentes en el modo Acreditación.
//
// §4.1 de `docs/plan-fuentes-legibles-2026-07.md`, más la reestructuración que
// dejó el modo en tres pasos en vez de cuatro pestañas hermanas:
//
//   1. Las pestañas se nombran por la PREGUNTA que responden, no por el
//      servicio del que salen los datos (hallazgo A1).
//
//   2. **Actores** abre el modo. Todo lo que viene después es DE alguien: el
//      padrón es de un actor, la encuesta es de un actor, el barrido solo
//      existe si ese actor tiene canal telefónico. Sin elenco, las otras
//      pestañas hablan de un sujeto que nadie declaró.
//
//   3. **Fuentes y universo** reúne lo que antes eran tres sitios: el resumen
//      de dónde salen los datos, el detalle del padrón de cada actor y las
//      fichas de encuesta con su actor y su canal. Eran la misma pregunta
//      —«¿qué está conectado y de quién es?»— repartida en tres pestañas.
//
//   4. **Recopiladores** se queda con lo suyo. La ficha de encuesta declara el
//      canal base y el recopilador declara su excepción: la regla se ve en la
//      pestaña anterior y la excepción aquí, que es la lectura correcta.
//
// Las claves viejas se siguen LEYENDO como alias y nunca se ESCRIBEN, igual que
// los params heredados de navegación (ADR 0044). Una dirección guardada por un
// usuario con `?pestana=collectors` tiene que seguir aterrizando donde
// corresponde.

import { Layers3, ListChecks, Users } from "../../../../../vendor/lucide-react";
import type { LucideIcon } from "../../../../../vendor/lucide-react";

export type PestanaDeFuentes = "actores" | "fuentes" | "recopiladores";

export type PestanaDeFuentesDefinicion = {
  key: PestanaDeFuentes;
  label: string;
  detail: string;
  icon: LucideIcon;
};

export const PESTANAS_DE_FUENTES: readonly PestanaDeFuentesDefinicion[] = [
  {
    key: "actores",
    label: "Actores",
    detail: "Quiénes responden el estudio",
    icon: Users,
  },
  {
    key: "fuentes",
    label: "Fuentes y universo",
    detail: "Qué está conectado y de quién es",
    icon: Layers3,
  },
  {
    key: "recopiladores",
    label: "Recopiladores",
    detail: "Por dónde llegó cada respuesta",
    icon: ListChecks,
  },
];

/**
 * Dónde se aterriza en Fuentes.
 *
 * Era «resumen» —lectura pura, sin decisiones que tomar por accidente—, y ese
 * criterio valía cuando las pestañas eran hermanas. Con el elenco delante ya
 * no: Actores es el paso del que dependen los otros dos, y abrir por el resumen
 * dejaba al usuario mirando el recuento de lo que todavía no puede conectar.
 * Editable no es destructivo: nada se guarda hasta pulsar «Guardar elenco».
 */
export const PESTANA_DE_FUENTES_POR_DEFECTO: PestanaDeFuentes = "actores";

/**
 * Claves históricas de `?pestana=`, que se leen pero no se escriben.
 *
 * El mapeo es por CONTENIDO, no por posición: quien guardó `?pestana=survey`
 * buscaba las fichas de encuesta, y esas ahora viven en «Fuentes y universo»
 * aunque la pestaña que ocupa su antiguo lugar sea «Recopiladores».
 */
const ALIAS: Record<string, PestanaDeFuentes> = {
  actor: "actores",
  elenco: "actores",
  unidades: "actores",
  resumen: "fuentes",
  activas: "fuentes",
  estado: "fuentes",
  universo: "fuentes",
  sheets: "fuentes",
  bases: "fuentes",
  survey: "fuentes",
  plataforma: "fuentes",
  encuestas: "fuentes",
  collectors: "recopiladores",
};

export function esPestanaDeFuentes(value: unknown): value is PestanaDeFuentes {
  return PESTANAS_DE_FUENTES.some((pestana) => pestana.key === value);
}

/**
 * Resuelve lo que pide la URL a una pestaña que existe.
 *
 * Devuelve la pestaña por defecto ante cualquier valor desconocido: una
 * dirección rota aterriza en Actores, que es por donde se empieza.
 */
export function resolverPestanaDeFuentes(pedida: unknown): PestanaDeFuentes {
  const clave = String(pedida ?? "").trim().toLowerCase();
  if (esPestanaDeFuentes(clave)) return clave;
  return ALIAS[clave] ?? PESTANA_DE_FUENTES_POR_DEFECTO;
}

/** Las claves que la sección acepta en la URL, canónicas y heredadas. */
export function clavesAceptadasDeFuentes(): string[] {
  return [...PESTANAS_DE_FUENTES.map((pestana) => pestana.key), ...Object.keys(ALIAS)];
}
