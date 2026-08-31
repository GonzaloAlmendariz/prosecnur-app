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
  /**
   * Cuántas respuestas tumba CADA filtro, y cuántas tumba él solo.
   *
   * Lo calcula `.monitoreo_aulas_caidas_por_filtro()` y viajaba dentro de
   * `criterio_validez` sin que nadie lo leyera: la pantalla decía cuántos
   * filtros declara el estudio y no cuál de ellos decide. Medido sobre este
   * corte, «filtro» tumba 109 y `consent_1` sólo 7: son dos papeles muy
   * distintos bajo la misma palabra.
   *
   * `solo_este` es lo que se recuperaría quitando ese filtro y dejando los
   * otros. Sin él, tres filtros que tumban 109, 28 y 7 parecen sumar 144
   * cuando pueden estar cayendo sobre las mismas respuestas.
   */
  por_filtro?: Array<{ var?: string; caen?: number; solo_este?: number }>;
};

/** Los filtros con su cuenta, ordenados por lo que tumban. Descarta los vacíos. */
export function caidasPorFiltro(criterio: CriterioDelEstudio | null | undefined) {
  const filas = Array.isArray(criterio?.por_filtro) ? criterio.por_filtro : [];
  return filas
    .map((f) => ({
      nombre: String(f?.var ?? "").trim(),
      caen: Number.isFinite(Number(f?.caen)) ? Number(f.caen) : 0,
      soloEste: Number.isFinite(Number(f?.solo_este)) ? Number(f.solo_este) : 0,
    }))
    .filter((f) => f.nombre)
    .sort((a, b) => b.caen - a.caen);
}

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
