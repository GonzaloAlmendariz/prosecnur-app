import { fmt } from "./kpisDeAulas";
import type {
  MonitoreoAulasEfectividadFacultad,
  MonitoreoAulasEfectividadSeguimiento,
} from "../../../../api/monitoreo";

/**
 * **Resumen tiene que resumir también Rendimiento y Efectividad.**
 *
 * Gonzalo, dos veces el 2026-09-10: «no estás resumiendo la información ni de
 * rendimiento ni de efectividad… si Resumen tiene que ser un resumen». Y con el
 * qué: «contrastando siempre que tenemos un rendimiento diferenciado entre el
 * rendimiento planificado y el rendimiento que vamos encontrando… ya podemos ir
 * prediciendo para cada facultad cómo nos irá».
 *
 * Las dos pestañas contestan la misma pregunta en dos granos —cuánto deja cada
 * aula— y el motor ya las tiene resueltas en `efectividad_seguimiento` (ADR
 * 0082). Aquí NO se calcula ninguna tasa: se elige qué decir y con qué palabras.
 *
 * **Lo que se resume es la comparación, no la tasa.** «τ observada 58,1 %» sola
 * no dice nada a quien abre el tablero por la mañana; «el diseño supuso 51,4 % y
 * las aulas están dando 58,1 %» dice si el operativo va a alcanzar con las aulas
 * que tiene o hace falta pedir más, que es la decisión del día.
 */

export type LecturaDeEfectividad = {
  /** Lo que supuso el diseño y lo que está dando el campo, en tanto por uno. */
  previsto: number | null;
  observado: number | null;
  /** La diferencia en PUNTOS porcentuales; `null` si falta alguna de las dos. */
  puntos: number | null;
  /**
   * **El intervalo de confianza al 95 % de la observada**, no una «banda».
   *
   * Gonzalo, 2026-09-10: «¿más que su banda es el margen de error? siento que
   * podemos ser más académicos, hasta con un margen de confianza». Lo es, y con
   * nombre propio: el motor calcula τ̂ = Σefectivas/Σelegibles y su error
   * estándar por el estimador de RAZÓN linealizado, con las aulas como
   * conglomerados y Z = 1,959964 (`.maes_banda_razon`). Llamarlo «banda» era
   * quedarse corto: es un IC 95 %, y decirlo permite leerlo como se debe.
   *
   * El conglomerado no es un adorno: los elegibles de un curso-horario comparten
   * profesor, hora y sala y responden juntos o no responden, así que tratar τ
   * como binomial sobre Σelegibles daría un intervalo varias veces más angosto
   * que el real y señalaría facultades por ruido de agrupamiento.
   */
  bandaBajo: number | null;
  bandaAlto: number | null;
  /**
   * El semiancho en PUNTOS porcentuales —el «± tanto»— cuando el intervalo es
   * simétrico respecto del punto. `null` cuando se recortó contra 0 o 100: τ es
   * una fracción de elegibles y un intervalo que asomara fuera prometería un
   * rendimiento imposible, pero entonces el «±» ya no describe el intervalo y
   * escribirlo mentiría sobre su forma.
   */
  margen: number | null;
  /** De cuántas aulas y cuántos elegibles sale la observada. */
  aulas: number;
  elegibles: number;
  efectivas: number;
  /** Cómo se lee el contraste, en una frase. */
  frase: string;
  /** `"sobre" | "bajo" | "conforme"` para el tono; `""` sin comparación. */
  tono: "sobre" | "bajo" | "conforme" | "";
};

export type RiesgoDeCierre = {
  /** Las que su proyección NO cierra la cuota. Es el número que decide. */
  facultadesEnRiesgo: number;
  /** El déficit de esas facultades, sin compensar con las que van sobradas. */
  alumnosEnRiesgo: number;
  /** Las que rinden bajo su τ con evidencia; no es lo mismo que estar en riesgo. */
  facultadesBajoSuTau: number;
  frase: string;
};

const pct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 10;

/**
 * Los puntos de diferencia, con un decimal.
 *
 * **Se restan las cifras MOSTRADAS, no las crudas.** 0,5812 − 0,5135 da 6,77 y
 * redondeado 6,8, pero la frase enseña 58,1 y 51,4: quien lee tiene que poder
 * restar y llegar al mismo número. Es la misma regla con la que el pie del ritmo
 * saca su faltante de la meta que muestra.
 */
function puntosEntre(previsto: number | null, observado: number | null) {
  const a = pct(previsto);
  const b = pct(observado);
  if (a == null || b == null) return null;
  return Math.round((b - a) * 10) / 10;
}

/**
 * El «± tanto» del intervalo, sólo si de verdad lo describe.
 *
 * El motor acota el IC a [0, 1] porque τ es una fracción, y ese recorte lo
 * vuelve asimétrico: en una facultad con pocas aulas el extremo bajo puede topar
 * en cero. Publicar entonces «58,1 % ± 6,0» describiría un intervalo que no es
 * el que se calculó. Se admite un cuarto de punto de holgura por el redondeo a
 * cuatro decimales con el que viaja.
 */
function margenSimetrico(punto: number | null, bajo: number | null, alto: number | null) {
  if (punto == null || bajo == null || alto == null) return null;
  const izquierda = (punto - bajo) * 100;
  const derecha = (alto - punto) * 100;
  if (!Number.isFinite(izquierda) || !Number.isFinite(derecha)) return null;
  if (Math.abs(izquierda - derecha) > 0.25) return null;
  return Math.round(((izquierda + derecha) / 2) * 10) / 10;
}

/**
 * @param fila La facultad en foco, o `null` para leer el conjunto.
 *
 * **Sin datos NO se inventa una lectura conforme.** Una facultad sin aulas
 * aplicadas no es una facultad que va bien: es una de la que todavía no se sabe
 * nada, y decirlo es lo que evita que el panel la dé por resuelta.
 */
export function lecturaDeEfectividad(
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined,
  fila: MonitoreoAulasEfectividadFacultad | null = null,
): LecturaDeEfectividad | null {
  const base = fila ?? bloque?.total ?? null;
  if (!base) return null;
  const previsto = base.tau_previsto ?? null;
  const observado = base.tau_observado ?? null;
  const puntos = puntosEntre(previsto, observado);
  const aulas = Number(base.aulas_aplicadas ?? 0) || 0;

  // La señal de la fila manda cuando existe: la calcula el motor con la BANDA y
  // no con el punto, que es lo que impide llamar «bajo» a una facultad con tres
  // cursos-horario aplicados. Sin fila —el conjunto— se deduce del signo, que
  // ahí sí tiene detrás mil ochocientos elegibles.
  const senal = fila?.senal;
  const tono: LecturaDeEfectividad["tono"] =
    previsto == null || observado == null ? ""
      : senal === "bajo" || senal === "sobre" || senal === "conforme" ? senal
      : puntos == null ? ""
      : puntos > 0 ? "sobre" : puntos < 0 ? "bajo" : "conforme";

  const frase = !aulas
    ? "Todavía no se ha aplicado ningún curso-horario aquí, así que no hay rendimiento que contrastar."
    : previsto == null
      ? "El diseño no dejó una tasa prevista contra la que comparar lo que está dando el campo."
      : observado == null
        ? "Los cursos-horario aplicados todavía no dan una tasa observada con la que comparar."
        : tono === "sobre"
          ? `El diseño supuso ${pct(previsto)} % y el campo está dando ${pct(observado)} %: ${Math.abs(puntos ?? 0)} puntos por encima.`
          : tono === "bajo"
            ? `El diseño supuso ${pct(previsto)} % y el campo está dando ${pct(observado)} %: ${Math.abs(puntos ?? 0)} puntos por debajo.`
            : `El diseño supuso ${pct(previsto)} % y el campo está dando ${pct(observado)} %: lo previsto, dentro de la banda.`;

  const bajo = base.banda_bajo ?? null;
  const alto = base.banda_alto ?? null;
  return {
    previsto, observado, puntos,
    bandaBajo: bajo,
    bandaAlto: alto,
    margen: margenSimetrico(observado, bajo, alto),
    aulas,
    elegibles: Number(base.elegibles_aplicados ?? 0) || 0,
    efectivas: Number(base.efectivas ?? 0) || 0,
    frase, tono,
  };
}

/**
 * El riesgo de cierre del conjunto, que es lo OTRO que hay que resumir.
 *
 * **Rendir bajo su τ y no cerrar la cuota son dos cosas.** El motor las publica
 * separadas a propósito —el backtest mostró que juntarlas en un número engaña—
 * y aquí se conservan separadas: la que decide es la segunda.
 */
/**
 * La fila de una facultad dentro del bloque, emparejada por su nombre.
 *
 * Normaliza igual que `deLaFacultad` y `delMapaPorFacultad`: un solo criterio en
 * todo el perfil para decidir si dos nombres de facultad son el mismo. Es lo que
 * evita que un panel encuentre Psicología y el de al lado no.
 */
export function filaDeLaFacultad(
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined,
  facultad: string | undefined,
): MonitoreoAulasEfectividadFacultad | null {
  if (!facultad) return null;
  const clave = (v: unknown) =>
    (v == null ? "" : String(v)).trim().toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const buscada = clave(facultad);
  return (bloque?.facultades ?? []).find(
    (f) => clave(f.facultad) === buscada || clave(f.faculty_key) === buscada,
  ) ?? null;
}

export function riesgoDeCierre(
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined,
): RiesgoDeCierre | null {
  const t = bloque?.total;
  if (!t) return null;
  const enRiesgo = Number(t.facultades_en_riesgo ?? 0) || 0;
  const alumnos = Math.round(Number(t.alumnos_en_riesgo ?? 0) || 0);
  const bajoTau = Number(t.facultades_bajo_su_tau ?? 0) || 0;
  const frase = enRiesgo
    ? `${fmt(enRiesgo)} ${enRiesgo === 1 ? "facultad no cierra" : "facultades no cierran"} su cuota con lo que tienen agendado: faltarían ${fmt(alumnos)} ${alumnos === 1 ? "alumno" : "alumnos"}.`
    : bajoTau
      ? `Ninguna facultad se queda corta con lo agendado, aunque ${fmt(bajoTau)} ${bajoTau === 1 ? "rinde" : "rinden"} por debajo de su tasa prevista.`
      : "Con lo agendado, todas las facultades cierran su cuota.";
  return { facultadesEnRiesgo: enRiesgo, alumnosEnRiesgo: alumnos, facultadesBajoSuTau: bajoTau, frase };
}

/**
 * **Cuántas facultades caen a cada lado de su propia vara.**
 *
 * El carril del total contesta «¿rinde el operativo lo que se supuso?» y deja
 * fuera la pregunta que la pestaña de Efectividad contesta facultad por
 * facultad: **si eso es parejo o hay dispersión**. Una media de 58 % puede ser
 * quince facultades en 58 o siete en 40 y ocho en 75, y las dos piden cosas
 * distintas.
 *
 * Se cuenta por la SEÑAL del motor, que la calcula con la banda de cada
 * facultad y no con su punto: con tres cursos-horario aplicados la tasa de una
 * facultad es ruido, y contar por el signo llamaría «por debajo» a media tabla.
 * Las que no tienen banda —sin campo o sin tasa prevista— se cuentan aparte:
 * no son conformes, es que todavía no se sabe.
 */
export function repartoDeSenales(
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined,
) {
  const filas = bloque?.facultades ?? [];
  if (!filas.length) return null;
  let sobre = 0, bajo = 0, conforme = 0, sinVara = 0;
  for (const f of filas) {
    if (f.senal === "sobre") sobre += 1;
    else if (f.senal === "bajo") bajo += 1;
    else if (f.senal === "conforme") conforme += 1;
    else sinVara += 1;
  }
  const partes = [
    conforme ? `${fmt(conforme)} como lo previsto` : "",
    sobre ? `${fmt(sobre)} por encima` : "",
    bajo ? `${fmt(bajo)} por debajo` : "",
    sinVara ? `${fmt(sinVara)} sin vara todavía` : "",
  ].filter(Boolean);
  return {
    total: filas.length, sobre, bajo, conforme, sinVara,
    frase: `De ${fmt(filas.length)} facultades: ${partes.join(" · ")}.`,
  };
}

/**
 * La proyección de UNA facultad: a dónde llega con lo que tiene.
 *
 * Es la parte de «predecir para cada facultad cómo nos irá» que ya está
 * calculada. El intervalo viaja SIEMPRE con el central: una proyección sin sus
 * extremos se lee como una promesa.
 */
export function proyeccionDeLaFacultad(fila: MonitoreoAulasEfectividadFacultad | null | undefined) {
  if (!fila || fila.proyectado == null || fila.cuota == null) return null;
  const central = Math.round(fila.proyectado);
  const cuota = Math.round(fila.cuota);
  const bajo = fila.proyectado_pesimista == null ? null : Math.round(fila.proyectado_pesimista);
  const alto = fila.proyectado_optimista == null ? null : Math.round(fila.proyectado_optimista);
  return {
    central, cuota, bajo, alto,
    cierra: central >= cuota,
    // Que el PESIMISTA cierre es lo que permite decir «cierra seguro»; que sólo
    // cierre el central es «cierra si el rendimiento se mantiene».
    cierraEnLoPeor: bajo != null && bajo >= cuota,
    frase: central >= cuota
      ? (bajo != null && bajo >= cuota
        ? `Cierra su cuota de ${fmt(cuota)} incluso en el peor caso.`
        : `Llega a ${fmt(central)} sobre una cuota de ${fmt(cuota)}, si el rendimiento se mantiene.`)
      : `Se queda en ${fmt(central)} sobre una cuota de ${fmt(cuota)}: le faltarían ${fmt(cuota - central)}.`,
  };
}
