/**
 * Avisar ANTES de lanzar la comparación cuando va a ser larga.
 *
 * Medido el 2026-08-21 con el motor real, aislando la causa: sobre el MISMO
 * marco de 3.142 cursos-horario y el MISMO método balanceado, una corrida
 * cuesta 57 s con objetivo global y **más de ocho minutos** con el reparto
 * real por 17 facultades. Balancear respetando diecisiete cuotas a la vez no
 * es el mismo problema más grande: es otro problema. Proyectado, la
 * comparación completa de un estudio así pasa de dos horas.
 *
 * El motor ya estima un costo (`.cm_aulas_comparar_estimated_cost`) pero es
 * `n_aulas × n_métodos × (olas + corridas)`: no mira los estratos ni distingue
 * métodos, que son justo los dos factores que dominan. Y sólo decide sync/job
 * — nunca llega al usuario.
 *
 * Así que esto NO reusa esa cifra ni promete minutos: da el aviso cualitativo
 * que falta, con los dos números que lo causan a la vista, para que quien
 * pulsa sepa a qué atenerse. Un tiempo inventado sería peor que ninguno.
 */

/** Aulas × facultades a partir del cual la espera deja de medirse en minutos. */
export const CM_COMPARAR_UMBRAL_LARGO = 10_000;

export type AvisoDuracion = {
  /** true cuando conviene avisar antes de lanzar. */
  avisar: boolean;
  /** El producto que dispara el aviso, para poder explicarlo. */
  carga: number;
};

export function avisoDuracionComparacion({
  aulas,
  facultades,
}: {
  /** Cursos-horario incluidos en el marco. */
  aulas: number;
  /** Estratos con objetivo propio en el reparto. */
  facultades: number;
}): AvisoDuracion {
  const n = Number.isFinite(aulas) && aulas > 0 ? aulas : 0;
  // Sin reparto declarado se cuenta como un solo estrato: es el caso barato
  // que se midió en 57 s, no el de 17 cuotas simultáneas.
  const f = Number.isFinite(facultades) && facultades > 0 ? facultades : 1;
  const carga = n * f;
  return { avisar: carga >= CM_COMPARAR_UMBRAL_LARGO, carga };
}

/**
 * Avisar ANTES de sortear cuando el método elegido repite el sorteo N veces.
 *
 * `pool_controlado` («Optimizar repetidos») no es un sorteo: es
 * `candidate_pool_size` sorteos completos con el cubo como motor base, de los
 * que se queda con el mejor (`.cm_aulas_select_once_pool`,
 * `api/R/calc_muestra_aulas.R:2211`). Con el default de 500 y el cubo medido en
 * ~1,9 s por corrida sobre el marco de HSVG2026, eso son ~16 minutos frente a
 * los 22,8 s de los otros tres.
 *
 * Eso costó una espera de más de seis minutos hasta que Gonzalo canceló el
 * 2026-08-22, y días de diagnóstico buscando el problema en el entorno del job
 * cuando estaba en el método. La comparación ya avisa de su coste; el sorteo no
 * avisaba de ninguno.
 *
 * Igual que su hermana, NO promete minutos: dice cuántos sorteos son, que es el
 * hecho, y deja la escala al lector.
 */
export type AvisoSorteo = {
  avisar: boolean;
  /** Cuántos sorteos completos hace el método elegido. */
  sorteos: number;
};

export function avisoDuracionSorteo({
  metodoId,
  candidatas,
}: {
  metodoId: string;
  /** `candidate_pool_size` de la config vigente. */
  candidatas: number;
}): AvisoSorteo {
  const esPool = metodoId === "pool_controlado";
  const n = Number.isFinite(candidatas) && candidatas > 0 ? Math.floor(candidatas) : 0;
  const sorteos = esPool ? Math.max(1, n) : 1;
  // Un pool de una o dos candidatas no cambia la escala: el aviso existe para
  // la diferencia entre un sorteo y cientos.
  return { avisar: esPool && sorteos >= 25, sorteos };
}


/** Corridas por defecto cuando el estudio no declara ninguna. */
export const CM_CORRIDAS_ESTABILIDAD_DEFECTO = 500;

/**
 * Cuántas corridas mide el botón de estabilidad, y de dónde sale ese número.
 *
 * Estaba resuelto así:
 *
 *     // El número de corridas de estabilidad es del estudio, no del botón.
 *     Number(config.simulation_runs ?? config.monte_carlo_n ?? 500) || 500
 *
 * y el comentario decía justo lo contrario de lo que hacía el código: `??` no
 * cubre el cero y `|| 500` lo reemplaza, así que con el `simulation_runs: 0` que
 * trae HSVG2026 el botón anunciaba «500 corridas» como si el estudio las hubiera
 * pedido. Un rótulo que promete un número que su fuente no dijo.
 *
 * Ahora el origen viaja con la cifra, para que quien lea el botón sepa si está
 * viendo una decisión del estudio o un valor por defecto.
 */
export function corridasDeEstabilidad(config: Record<string, unknown>) {
  const declarado = Number(config.simulation_runs ?? config.monte_carlo_n ?? Number.NaN);
  const delEstudio = Number.isFinite(declarado) && declarado > 0;
  return {
    corridas: delEstudio ? Math.floor(declarado) : CM_CORRIDAS_ESTABILIDAD_DEFECTO,
    delEstudio,
  };
}


/**
 * Corridas con las que se lanza LA COMPARACIÓN de métodos.
 *
 * Comparar y medir estabilidad son dos acciones distintas desde `d87e5ac9`:
 * comparar hace una pasada por método para poder elegir, y la estabilidad
 * repite el sorteo del método vigente. Pero había **tres caminos** para lanzar
 * la comparación y mandaban cosas distintas: la barra de acciones mandaba `0`,
 * mientras `runComparison` de Método y el aviso de etapa de Simulación mandaban
 * `config.simulation_runs ?? config.monte_carlo_n ?? 500`.
 *
 * Hoy no se nota porque HSVG2026 trae `simulation_runs: 0` y `??` lo deja pasar,
 * así que los tres acaban en 0 por casualidad. Con un estudio que declare 300,
 * un botón compararía con 300 corridas y otro con ninguna, sobre el mismo marco
 * y sin que nada lo dijera.
 */
export const CM_CORRIDAS_COMPARACION = 0;
