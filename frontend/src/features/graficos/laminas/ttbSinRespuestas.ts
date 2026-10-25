// ¿Avisar «Top Two Box encendido sin sus respuestas»? Sólo donde el motor lo avisa (`.box_decidir`,
// api/R/graficador_box_cobertura.R): sin respuestas declaradas no dibuja la columna, pero en una escala corta (menos de
// 3 respuestas, como Sí/No) o sin orden (sexo, carrera) no hay nada que elegir y calla. Avisar ahí mandaba a elegir
// respuestas que la pestaña Gráfico ni ofrece (CCSS-UI-1). Puro, sin React.

import { parseVarRef } from "../useVariables";
import { preguntasDelGrafico, tienePistasDeOrden, twoBoxDeGrafico } from "./modeloMaqueta";

/** Mínimo de respuestas para que el motor pida declarar el box (`minimo = 3L` de `.box_decidir`). */
export const TTB_MINIMO_RESPUESTAS = 3;

type Presets = Readonly<Record<string, Readonly<Record<string, unknown>>>>;
type VarConEscala = { name: string; source?: string; choices?: readonly { label: string }[] };

/** ¿Una escala sin respuestas declaradas es de las que el motor avisa? */
export function escalaPideTwoBox(rotulos: readonly string[]): boolean {
  return rotulos.length >= TTB_MINIMO_RESPUESTAS && tienePistasDeOrden(rotulos);
}

export function avisaTtbSinRespuestas(
  graficador: string,
  args: Record<string, unknown>,
  presets: Presets,
  variables: readonly VarConEscala[],
): boolean {
  const tb = twoBoxDeGrafico(graficador, args, presets);
  if (!tb.ttb || !Array.isArray(tb.etiquetas) || tb.etiquetas.length) return false;
  const escalas = preguntasDelGrafico(args)
    .map((ref) => {
      const pr = parseVarRef(ref);
      const v = variables.find((x) => x.name === pr.name && (!pr.source || !x.source || x.source === pr.source));
      return (v?.choices ?? []).map((c) => c.label).filter((l) => typeof l === "string" && l.trim());
    })
    .filter((e) => e.length > 0);
  // Sin la escala a mano no se sabe qué hará el motor: se avisa, como antes (la variable sin resolver tiene su aviso).
  if (!escalas.length) return true;
  return escalas.some(escalaPideTwoBox);
}
