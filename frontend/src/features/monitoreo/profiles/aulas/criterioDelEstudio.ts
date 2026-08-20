/**
 * Los validadores de la hoja NO son los filtros del estudio.
 *
 * «Base de control» enseña tres columnas —VALIDADOR 1, 2 y 3— que son casillas
 * que el equipo llena en su Excel. El estudio, aparte, declara sus propios
 * filtros de respuesta válida en la app («cumple 2 condiciones: sexo, p01»).
 * Son **dos sistemas de validación distintos** y la pantalla los ponía juntos
 * sin decir de quién era cada uno.
 *
 * Gonzalo: «ni siquiera he configurado mi sistema de filtros. Entonces, ¿tú cómo
 * sabes si validador uno, dos o tres son mis filtros? ¿Qué pasa si solo tengo un
 * filtro o dos filtros?». En este corte ni el número coincide: **2 filtros
 * declarados contra 3 columnas de validador**.
 *
 * Esto no inventa la relación entre unos y otros —no la hay, y fabricarla sería
 * peor— sino que la nombra: dice cuántos filtros declara el estudio, cuántas
 * columnas trae la hoja, y que las segundas no las calcula la app.
 */

export type CriterioDelEstudio = {
  modo?: string;
  filtros?: string[] | string;
  filtros_ausentes?: string[] | string;
  columna?: string;
  validas?: number;
  total?: number;
};

const lista = (v: string[] | string | undefined): string[] => {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const uno = String(v ?? "").trim();
  return uno ? [uno] : [];
};

export type ContrasteDeValidadores = {
  /** Filtros que el estudio declara en la app. */
  declarados: string[];
  /** Columnas VALIDADOR con dato en la hoja. */
  columnas: number;
  /** `true` si el estudio no ha declarado ningún filtro. */
  sinDeclarar: boolean;
};

/**
 * @param criterio `criterio_validez` del payload.
 * @param filas filas de «Base de control», para contar validadores con dato.
 */
export function contrasteDeValidadores(
  criterio: CriterioDelEstudio | null | undefined,
  filas: ReadonlyArray<Readonly<Record<string, unknown>>>,
): ContrasteDeValidadores {
  const declarados = lista(criterio?.filtros);
  // Con DATO, no declaradas: una columna que la hoja trae vacía en las 152
  // filas no es un validador que el equipo use, es una cabecera.
  const columnas = ["validator_1", "validator_2", "validator_3"].filter((campo) =>
    filas.some((f) => String(f[campo] ?? "").trim() !== ""),
  ).length;
  return { declarados, columnas, sinDeclarar: declarados.length === 0 };
}
