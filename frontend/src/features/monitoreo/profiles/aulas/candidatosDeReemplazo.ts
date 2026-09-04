import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * A quién ir cuando un aula no sale, ordenado por lo que de verdad decide.
 *
 * ## El modelo, dicho por quien dirige el estudio
 *
 * «No es que los reemplazos no estén atados a su titular en forma de cadena, sí
 * lo están, pero es una guía de procedimiento de cómo aplicar los reemplazos.
 * Lo que nos da la cadena es una guía de: ¿con quién podemos reemplazar los
 * titulares? Y si cae un reemplazo uno, ¿cuál sería el otro? Mas no es un
 * requisito exclusivo y fundamental.»
 *
 * O sea: **la cadena es el orden recomendado, no un candado.** Se sigue por
 * defecto; cuando no alcanza, se toma el mejor disponible de otra cadena o de
 * la reserva adicional, y se declara en qué se aleja. Esta lista **nunca dice
 * “no hay reemplazo”**: dice cuál es el mejor y qué se concede al tomarlo.
 *
 * Y la equivalencia es preferencia, no requisito: «no es un requisito exclusivo
 * y siempre mandatorio de que sea exactamente igual al aula que estás
 * reemplazando, porque no podemos hacer eso, nos estaríamos ahorcando
 * demasiado».
 *
 * ## La facultad es una frontera dura, no una preferencia
 *
 * Gonzalo: «la reserva adicional es siempre siempre siempre dentro de la misma
 * facultad, jamás de otra». Y no es sólo la reserva adicional: **el motor
 * nunca sale de la facultad**.
 * Medido sobre ULT2: de 1.173 reservas de cadena, **cero** tienen una facultad
 * distinta a la de su titular, y `equivalence_level` tope es `misma_facultad`.
 *
 * La razón es la cuota: se reparte por facultad y sexo, así que un aula de
 * Derecho no cierra nada en Arquitectura —deja a una corta y a la otra pasada—.
 * Un candidato de otra facultad no es un reemplazo peor: **no es un reemplazo**.
 *
 * Por eso el filtro va en el origen y no en la puntuación. Puntuarlo bajo lo
 * dejaría aparecer cuando no hubiera nada mejor, que es exactamente cuando más
 * daño hace.
 *
 * ## Qué significa DISPONIBLE
 *
 * También suyo, y es una definición operativa, no una del sorteo: una reserva
 * queda al aire «cuando ya se aplicó su titular o ya se aplicó un reemplazo
 * previo, entonces esas quedan al aire». Se lee del estado de aplicación de su
 * cadena, no del rol que le tocó en el sorteo.
 *
 * ## Por qué dos puntuaciones y no una
 *
 * Porque colapsarlas esconde la única decisión que hay que tomar. El
 * **parecido** protege el diseño —sustituir un aula por otra que se le parece,
 * y de paso valora traer más elegibles que el aula caída, nunca menos—; la
 * **ayuda** cierra la cuota que de verdad falta, que casi siempre es de un
 * sexo. En el caso más ajustado de HSVG2026 (cae CH 118, ARQUITECTURA / M /
 * G1, con brecha de 30 mujeres y 5 hombres) hubo candidatos que ganaban en
 * parecido y perdían en ayuda, y viceversa. Con un solo número, el
 * coordinador nunca sabría que estaba eligiendo entre esas dos cosas.
 */

/** De dónde sale el candidato. La cadena primero: es la guía del procedimiento. */
export type OrigenDeCandidato = "cadena" | "otra_cadena" | "extra";

export type CandidatoDeReemplazo = {
  fila: MonitoreoAulasPlanRow;
  origen: OrigenDeCandidato;
  /** Cuánto se parece al aula que cae, 0-1. */
  parecido: number;
  /** Cuánto de la brecha por sexo cierra, 0-1. */
  ayuda: number;
  /** La mezcla con la que se ordena. Las dos partes se muestran igual. */
  total: number;
  /**
   * En qué se aleja, en palabras. Vacío cuando es de la misma celda: ahí no hay
   * nada que conceder y decir «misma celda» sería ruido.
   */
  concesiones: string[];
};

export type BrechaPorSexo = { mujeres: number; hombres: number };

/**
 * Un grupo de candidatos: cuántos HAY y cuáles son los mejores.
 *
 * Las dos cifras hacen falta y son distintas. La solapa mostraba
 * `mejores.length` —el tope, 3— como si fuera el inventario: sobre el simulacro
 * de campo malo, CH 1 tiene **9 reservas disponibles en su cadena** y la solapa
 * decía «Su cadena 3». Quien la lee entiende que la cadena está casi agotada y
 * decide con eso.
 */
export type GrupoDeCandidatos = {
  /** Cuántos candidatos admisibles hay en el grupo, sin recortar. */
  disponibles: number;
  /** Los mejores, hasta `tope`. */
  mejores: CandidatoDeReemplazo[];
};

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const numero = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** El grupo de tamaño va al final del estrato: `FACULTAD / F / G2`. */
const grupoDeTamano = (fila: MonitoreoAulasPlanRow): string => {
  const partes = texto(fila.stratum).split("/");
  return partes.length >= 3 ? partes[partes.length - 1].trim() : "";
};

const sexoDominante = (fila: MonitoreoAulasPlanRow): string => {
  const partes = texto(fila.stratum).split("/");
  return partes.length >= 3 ? partes[partes.length - 2].trim() : "";
};

/**
 * Disponible son DOS condiciones sobre DOS ejes, no una.
 *
 * El backend y esta vista llegaron a preguntarlo de dos maneras distintas, y
 * eso es la deriva que hay que evitar. Reconciliadas, son complementarias:
 *
 *  1. **Su cadena ya no la necesita** — algún eslabón de esa cadena se aplicó,
 *     así que el slot está cubierto. Vive en `operational_status`, que es el eje
 *     de la APLICACIÓN.
 *  2. **Ella misma sigue sin desplegarse** — nadie la ha agendado todavía. Vive
 *     en `sample_status`, que es el eje de la AGENDACIÓN.
 *
 * Son ejes distintos y las dos preguntas hacen falta: una reserva de una cadena
 * resuelta pero que ya se agendó para otra cosa NO está libre.
 *
 * `ESTADOS_DORMIDOS` replica `MONITOREO_AULAS_ESTADOS_DORMIDOS` del motor
 * (`api/R/monitoreo_aulas_en_juego.R`). El `"-"` está porque es como el equipo
 * escribe «todavía nada aquí» en el Excel: 1.810 de 2.040 celdas en 2025.
 */
// «en_cierre» era un estado FANTASMA: no lo produce ningún sitio del motor
// —comprobado el 2026-08-30 con un grep sobre `api/R/`— así que esa rama del Set
// no casaba nunca. El estado de cierre que sí existe es «cerrando», y vive en
// `course_status`, que es un derivado y no este campo.
/**
 * Estados en los que el aula ya se aplicó, así que su cadena está resuelta.
 *
 * «parcial» entra por decisión de quien dirige el estudio: «en principio una
 * aplicación en un aula que te cataloga como parcial sí cuenta». Se aplicó y se
 * recogieron respuestas; pedir otro reemplazo por ella sería mandar al equipo a
 * un aula que ya se visitó.
 *
 * Réplica de `MONITOREO_AULAS_ESTADOS_APLICADOS` (`monitoreo_aulas_en_juego.R`)
 * y ATADA a ella por `estadosAtadosAlMotor.contract.test.ts`, igual que
 * `ESTADOS_DORMIDOS`. Sin esa atadura son dos listas que nadie compara, que es
 * exactamente lo que la nota de abajo describe como el patrón más caro del repo.
 */
export const ESTADOS_QUE_LIBERAN = new Set(["aplicada", "cerrada", "parcial"]);
// Se exporta sólo para que `estadosAtadosAlMotor.contract.test.ts` la compare
// con la del motor: la réplica estaba declarada en el comentario de arriba pero
// no la ataba nada, y una lista de estados que nadie ata es el patrón más caro
// del repo —la vuelta 82 encontró 329,3 encuestas fantasma por eso mismo—.
export const ESTADOS_DORMIDOS = new Set(["", "-", "sin_contactar", "en_reserva", "planificada"]);

/** Su cadena ya se resolvió: alguien de ella salió. Eje de aplicación. */
const seResolvio = (fila: MonitoreoAulasPlanRow | undefined): boolean =>
  !!fila && ESTADOS_QUE_LIBERAN.has(texto(fila.operational_status).toLowerCase());

/**
 * Ella misma sigue sin desplegarse. Eje de agendación.
 *
 * Lista CERRADA a propósito, igual que en el motor: se nombra lo que está
 * dormido y cualquier otro estado cuenta como desplegado. Al revés, un estado
 * nuevo que nadie mapeara ofrecería un aula que ya está agendada para otra
 * cosa, y ése es el error caro.
 */
export const sigueDormida = (fila: MonitoreoAulasPlanRow): boolean => {
  const v = texto((fila as { sample_status?: string }).sample_status).toLowerCase();
  // «en reserva 3» es el vocabulario del Excel para la que todavía espera.
  const norm = v.replace(/^en reserva.*$/, "en_reserva");
  return ESTADOS_DORMIDOS.has(norm);
};

/**
 * Reservas al aire: las de una cadena cuyo titular —o algún eslabón previo— ya
 * se aplicó. Excluye la cadena del aula que cae, que se ofrece aparte y primero.
 */
export function reservasDisponibles(
  filas: ReadonlyArray<MonitoreoAulasPlanRow>,
  caido: MonitoreoAulasPlanRow,
): MonitoreoAulasPlanRow[] {
  const facultad = texto(caido.faculty);
  const porCadena = new Map<string, MonitoreoAulasPlanRow[]>();
  for (const f of filas) {
    // La facultad es frontera dura: ver la nota de arriba.
    if (facultad && texto(f.faculty) !== facultad) continue;
    const clave = texto(f.titular_operational_code) || texto(f.operational_code);
    if (!clave) continue;
    const lista = porCadena.get(clave) ?? [];
    lista.push(f);
    porCadena.set(clave, lista);
  }

  const cadenaDelCaido = texto(caido.titular_operational_code) || texto(caido.operational_code);
  const libres: MonitoreoAulasPlanRow[] = [];

  for (const [clave, cadena] of porCadena) {
    if (clave === cadenaDelCaido) continue;
    // La cadena se resolvió si CUALQUIERA de sus eslabones ya salió. Basta uno:
    // el slot está cubierto y los demás dejan de estar comprometidos.
    if (!cadena.some(seResolvio)) continue;
    for (const f of cadena) {
      if (texto(f.sample_role) === "titular") continue;
      if (seResolvio(f)) continue;   // ésa es la que cubrió el slot
      if (!sigueDormida(f)) continue; // ya está agendada para otra cosa
      libres.push(f);
    }
  }
  return libres;
}

/** Los eslabones de la propia cadena que todavía no salieron. */
export function cadenaPropia(
  filas: ReadonlyArray<MonitoreoAulasPlanRow>,
  caido: MonitoreoAulasPlanRow,
): MonitoreoAulasPlanRow[] {
  const clave = texto(caido.titular_operational_code) || texto(caido.operational_code);
  if (!clave) return [];
  return filas
    .filter((f) => {
      if (texto(f.operational_code) === texto(caido.operational_code)) return false;
      if (texto(f.sample_role) === "titular") return false;
      if (texto(f.titular_operational_code) !== clave) return false;
      return !seResolvio(f);
    })
    .sort((a, b) => numero(a.replacement_order) - numero(b.replacement_order));
}

/**
 * La reserva adicional DE SU FACULTAD, incluidas las aulas de una ampliación
 * declarada.
 *
 * «La reserva adicional es siempre siempre siempre dentro de la misma
 * facultad, jamás de otra.» La facultad del aula que cae se COMPARA siempre,
 * también cuando llega vacía, y eso cubre los dos escenarios:
 *
 * - **El estudio no reparte por facultad.** Ni el aula que cae ni las extras
 *   la declaran, `"" === ""` y la reserva adicional entera sigue disponible.
 * - **El estudio sí reparte y esta fila viene sin facultad.** Las extras sí la
 *   traen, ninguna iguala a `""` y la reserva adicional sale vacía. Es lo
 *   correcto: no se ofrece lo que no se puede garantizar que respeta la
 *   frontera.
 *
 * Antes un `!fac ||` desactivaba el filtro cuando la facultad venía vacía, y
 * entonces el segundo escenario ofrecía la reserva adicional de TODAS las
 * facultades. El motor tampoco lo ataja: `E_REEMPLAZO_OTRA_FACULTAD` exige que
 * las dos facultades sean no vacías (`monitoreo_aulas_reemplazos.R:75`), así
 * que con la del aula caída en blanco la ofrecía la pantalla y la aceptaba el
 * backend.
 */
export function reservaAdicionalDeLaFacultad(
  filas: ReadonlyArray<MonitoreoAulasPlanRow>,
  facultad?: string,
): MonitoreoAulasPlanRow[] {
  const fac = texto(facultad);
  return filas.filter(
    (f) =>
      texto(f.sample_role) === "extra_reserve_pool" &&
      !seResolvio(f) &&
      sigueDormida(f) &&
      texto(f.faculty) === fac,
  );
}

/** Cuánto se parece un candidato al aula que cae, y qué se concede al tomarlo. */
export function parecidoCon(
  caido: MonitoreoAulasPlanRow,
  cand: MonitoreoAulasPlanRow,
): { parecido: number; concesiones: string[] } {
  const mismaCelda = texto(cand.stratum) === texto(caido.stratum) && texto(caido.stratum) !== "";
  const mismaFacultad = texto(cand.faculty) === texto(caido.faculty);
  const gC = grupoDeTamano(caido);
  const gX = grupoDeTamano(cand);
  const mismoTamano = gC !== "" && gC === gX;
  const sC = sexoDominante(caido);
  const sX = sexoDominante(cand);
  const mismoSexo = sC !== "" && sC === sX;
  const mismoNivel = texto(cand.level) === texto(caido.level) && texto(caido.level) !== "";

  const eC = numero(caido.eligible_n);
  const eX = numero(cand.eligible_n);
  // Antes esto era «cercanía»: penalizaba por igual quedarse corto o pasarse
  // de elegibles frente al aula caída. Pero un candidato con MÁS elegibles
  // cierra más cuota, no menos -pasarse no le resta utilidad al reemplazo-.
  // Crece con eX y se topa en 1 al igualar o superar al caído; quedarse
  // corto sí sigue penalizando, proporcional a cuánto falta.
  const utilidadElegibles = eC > 0 ? Math.min(1, eX / eC) : eX > 0 ? 1 : 0;

  const parecido =
    0.35 * (mismaCelda ? 1 : 0) +
    0.2 * (mismaFacultad ? 1 : 0) +
    0.15 * (mismoSexo ? 1 : 0) +
    0.25 * utilidadElegibles +
    0.05 * (mismoNivel ? 1 : 0);

  // Sólo se nombra lo que se concede. Un candidato de la misma celda no lleva
  // etiquetas: no hay nada que advertir y llenarlo de «mismo todo» es ruido.
  const concesiones: string[] = [];
  if (!mismaFacultad) concesiones.push(`otra facultad (${texto(cand.faculty) || "sin declarar"})`);
  else if (!mismaCelda) {
    if (!mismoSexo && sX) concesiones.push(`mayoría ${sX === "F" ? "femenina" : "masculina"}, no ${sC === "F" ? "femenina" : "masculina"}`);
    if (!mismoTamano && gX) concesiones.push(`tamaño ${gX}, no ${gC}`);
  }
  // Traer MÁS elegibles ya no se concede -es la ventaja que se busca-; sólo
  // se avisa cuando el candidato trae menos, que es lo que de verdad resta.
  if (eC > 0 && eX < eC && (eC - eX) / eC > 0.3) {
    concesiones.push(`${eX} elegibles frente a ${eC}`);
  }
  return { parecido, concesiones };
}

/**
 * Cuánto de la brecha cierra su composición esperada.
 *
 * `sex_top_*` da el reparto observado del aula; se le aplica su propia tasa
 * porque entrar a un aula de treinta no produce treinta encuestas. Se acredita
 * sólo hasta la brecha: traer doscientas mujeres donde faltan treinta no es
 * cinco veces mejor que traer treinta.
 */
export function ayudaCon(
  cand: MonitoreoAulasPlanRow & { sex_top_1?: string; sex_top_1_n?: number; sex_top_2_n?: number; tasa_efectividad_aula?: number },
  brecha: BrechaPorSexo,
): number {
  const total = Math.max(0, brecha.mujeres) + Math.max(0, brecha.hombres);
  if (total <= 0) return 0;
  const tasa = numero(cand.tasa_efectividad_aula) > 0 ? numero(cand.tasa_efectividad_aula) : 0.55;
  const n1 = numero(cand.sex_top_1_n);
  const n2 = numero(cand.sex_top_2_n);
  const dominante = texto(cand.sex_top_1).toUpperCase();
  const mujeres = dominante === "M" ? n2 : n1;
  const hombres = dominante === "M" ? n1 : n2;
  const cierraM = Math.min(mujeres * tasa, Math.max(0, brecha.mujeres));
  const cierraH = Math.min(hombres * tasa, Math.max(0, brecha.hombres));
  return (cierraM + cierraH) / total;
}

/** Peso del parecido en el total. La ayuda se lleva el resto. */
export const PESO_DEL_PARECIDO = 0.6;

/**
 * Los mejores candidatos, agrupados por origen y ordenados dentro de cada uno.
 *
 * La cadena propia va primero **siempre**, aunque otro candidato puntúe más:
 * es la guía del procedimiento y saltársela sin decirlo convertiría una
 * recomendación en una decisión tomada por la máquina.
 */
export function candidatosDeReemplazo(
  filas: ReadonlyArray<MonitoreoAulasPlanRow>,
  caido: MonitoreoAulasPlanRow,
  brecha: BrechaPorSexo = { mujeres: 0, hombres: 0 },
  tope = 3,
): Record<OrigenDeCandidato, GrupoDeCandidatos> {
  const puntuar = (fila: MonitoreoAulasPlanRow, origen: OrigenDeCandidato): CandidatoDeReemplazo => {
    const { parecido, concesiones } = parecidoCon(caido, fila);
    const ayuda = ayudaCon(fila, brecha);
    return {
      fila,
      origen,
      parecido,
      ayuda,
      total: PESO_DEL_PARECIDO * parecido + (1 - PESO_DEL_PARECIDO) * ayuda,
      concesiones,
    };
  };
  const mejores = (lista: MonitoreoAulasPlanRow[], origen: OrigenDeCandidato): GrupoDeCandidatos => {
    const puntuados = lista.map((f) => puntuar(f, origen)).sort((a, b) => b.total - a.total);
    return { disponibles: puntuados.length, mejores: puntuados.slice(0, tope) };
  };

  // Dentro de la propia cadena manda el orden del sorteo, no la puntuación: el
  // reemplazo 1 es el reemplazo 1. La puntuación viaja para poder enseñarla, no
  // para reordenar la guía.
  const propia = cadenaPropia(filas, caido).map((f) => puntuar(f, "cadena"));

  return {
    cadena: { disponibles: propia.length, mejores: propia.slice(0, tope) },
    otra_cadena: mejores(reservasDisponibles(filas, caido), "otra_cadena"),
    extra: mejores(reservaAdicionalDeLaFacultad(filas, caido.faculty), "extra"),
  };
}
