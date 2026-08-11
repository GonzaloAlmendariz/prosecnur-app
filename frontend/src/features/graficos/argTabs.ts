import { ArgGrupo } from "../../api/client";
import { normalizeArgGroup } from "./ArgGroup";

export type GraficadorSlotMode = "data" | "style" | "filters";

// `valores`, `tabla` y `semaforo` viven en «Estilo» y no en «Filtros».
//
// El tab de Filtros es un editor de REGLAS —condiciones sobre variables— y no
// monta el slot del graficador, asi que esos tres grupos no tenian donde salir:
// el registro los servia y la UI no los mostraba. `titulo_tabla` y
// `umbral_rojo_pct` de `p_tabla` llevaban asi desde que existen.
//
// Y ahi es donde se buscan: decidir si el porcentaje se escribe sobre la barra o
// con cuantos decimales es una decision de lectura, no un filtro. `filtro` se
// queda en su tab, que es el unico grupo que el editor de reglas si gobierna.
export const MODE_GROUPS: Record<GraficadorSlotMode, ArgGrupo[]> = {
  data:    ["datos"],
  style:   ["lectura", "leyenda", "espacio", "textos", "estilo", "canvas",
            "valores", "tabla", "semaforo"],
  filters: ["filtro"],
};

/** Etiqueta visible de cada tab del inspector, tal como se lee en pantalla. */
export const MODE_LABELS: Record<GraficadorSlotMode, string> = {
  data: "Datos",
  style: "Estilo",
  filters: "Filtros",
};

// El reparto se indexa por el nombre CRUDO del grupo, no por el normalizado.
//
// `normalizeArgGroup` colapsa `estilo`, `filtro` y `semaforo` en `valores`, así
// que indexar por el normalizado hace que `filters` pise a `style` y todo lo de
// Estilo se anuncie como si viviera en Filtros. El crudo es único por tab
// —`graficadorSlotGrupos.test.ts` lo exige— y por eso es la clave correcta.
const GRUPO_A_MODO = new Map<string, GraficadorSlotMode>(
  (Object.entries(MODE_GROUPS) as [GraficadorSlotMode, ArgGrupo[]][])
    .flatMap(([modo, grupos]) => grupos.map((g) => [String(g), modo] as const)),
);

/** En qué pestaña del inspector se edita un grupo de ajustes.
 *
 *  Existe porque el buscador de ajustes de un gráfico recorre los args del
 *  graficador COMPLETO, pero cada pestaña sólo puede pintar los suyos: sin esto
 *  el analista busca «orden» en Datos, no ve nada, y concluye que el ajuste no
 *  existe cuando vive en Estilo. */
export function tabDeGrupo(grupo: ArgGrupo | string | undefined): string | null {
  if (grupo == null) return null;
  const modo = GRUPO_A_MODO.get(String(grupo))
    ?? GRUPO_A_MODO.get(String(normalizeArgGroup(grupo as ArgGrupo)));
  return modo ? MODE_LABELS[modo] : null;
}
