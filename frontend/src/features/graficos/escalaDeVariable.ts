import type { PaletaSugeridaEntry } from "../../api/graficos";

/** Escalas del estudio repartidas en «la de esta pregunta» y el resto. */
export type EscalasParaVariable = {
  /** La escala que usa `varActual`, si el instrumento lo declara. */
  propia: PaletaSugeridaEntry | null;
  /** Las demás, sin repetir juegos de etiquetas idénticos. */
  otras: PaletaSugeridaEntry[];
};

function firmaEtiquetas(l: PaletaSugeridaEntry): string {
  return l.choices.map((c) => c.label).join("\u0000");
}

/** Nombre sin calificar de base: `docentes$p5` → `p5`. */
function sinBase(v: string): string {
  const i = v.indexOf("$");
  return i >= 0 ? v.slice(i + 1) : v;
}

/** Reparte las escalas del estudio poniendo delante la de la variable graficada.
 *
 *  Sin este reparto el campo de orden manual ofrece las 23 escalas del estudio
 *  y espera que el analista reconozca la suya de memoria. El puente lo da el
 *  backend en `variables` (`/api/graficos/paletas-sugeridas`), leído del
 *  `type = "select_one <list_name>"` del instrumento.
 *
 *  El match es primero EXACTO sobre el nombre calificado, porque en multibase
 *  un mismo `list_name` es una escala distinta en cada base y casar por el
 *  nombre pelado devolvería la escala de otra población. El fallback sin
 *  calificar sólo entra cuando ninguna calificada coincide. */
export function escalasParaVariable(
  listas: PaletaSugeridaEntry[],
  varActual?: string,
): EscalasParaVariable {
  const utiles = listas.filter((l) => (l.choices?.length ?? 0) >= 2);
  const unicas = utiles.filter(
    (l, i, arr) => arr.findIndex((o) => firmaEtiquetas(o) === firmaEtiquetas(l)) === i,
  );

  const v = (varActual ?? "").trim();
  if (!v) return { propia: null, otras: unicas };

  const propia =
    utiles.find((l) => (l.variables ?? []).includes(v))
    ?? utiles.find((l) => (l.variables ?? []).some((x) => sinBase(x) === sinBase(v)))
    ?? null;

  if (!propia) return { propia: null, otras: unicas };
  return {
    propia,
    otras: unicas.filter((l) => firmaEtiquetas(l) !== firmaEtiquetas(propia)),
  };
}

/** Escalas que tiene sentido ofrecer para sembrar el orden manual.
 *
 *  Ninguna cuando la propia se conoce. Sembrar desde otra escala escribe
 *  etiquetas que no existen en este gráfico y, como las no listadas se agregan
 *  al final en su orden original, el orden resultante no hace nada — pero sí
 *  se guarda en el `.pulso`. Ofrecerlas era ofrecer 22 no-ops al lado de la
 *  única opción con efecto.
 *
 *  Cuando la propia NO se resuelve —variable sin escala declarada, o un
 *  cruce— siguen estando, porque ahí son el único modo de arrancar. */
export function escalasParaSembrar(escalas: EscalasParaVariable): PaletaSugeridaEntry[] {
  return escalas.propia ? [] : escalas.otras;
}
