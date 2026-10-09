/**
 * Cómo va el agendamiento, para quien llama a los docentes.
 *
 * Agendar y aplicar son dos trabajos distintos, y la pestaña de agenda enseñaba
 * las doce columnas del Excel sin resumir nada: para saber cuántas faltan por
 * agendar había que leer 196 filas. Encima presidía la banda de la sección, que
 * habla de aulas APLICADAS —el trabajo del que va al aula, no del que llama—.
 *
 * Gonzalo: «el registro de campo y la agenda no son lo mismo… lo que se registra
 * en campo tiene que verse diferente, son dos cosas diferentes».
 *
 * Lo que decide quien llama: cuántas quedan por cerrar, cuáles están costando
 * más de una gestión, y por qué medio se consigue.
 */

type Fila = Readonly<Record<string, unknown>>;

const txt = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown) => {
  const n = Number.parseFloat(txt(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export type Agendamiento = {
  /** Filas que se van a visitar: sin el banco ni las ya reemplazadas. */
  enJuego: number;
  /** De ésas, con fecha y hora cerradas. */
  agendadas: number;
  /**
   * Aplicadas SIN fecha agendada. No es un estado legítimo: si no se agenda un
   * aula no se aplica, así que cada una es un descuadre entre la agenda y el
   * parte que alguien tiene que mirar.
   */
  aplicadasSinAgenda: number;
  /** Las que aún no tienen cita NI se han aplicado. */
  porAgendar: number;
  /** Cuántas necesitaron más de una gestión. */
  conInsistencia: number;
  /**
   * Las que van por su TERCERA gestión y siguen sin fecha.
   *
   * No es un umbral elegido: sale medido del campo de 2025 (170 titulares,
   * hoja «Aulas Agendadas»). De las que se cerraron en una o dos gestiones se
   * cayó el **17–19 %**; a partir de la tercera, el **36–38 %** —el doble—.
   * La insistencia deja de ser una molestia y pasa a ser un pronóstico.
   */
  enUmbralDeRiesgo: number;
  /**
   * Filas donde `sample_status` dice «sin contactar» y `operational_status` dice
   * que ya está agendada, aplicada o cerrada: **los dos estados de la misma fila
   * se contradicen** y uno está desactualizado.
   *
   * `scheduled_date` NO prueba una cita cerrada: sale de la columna «FECHA
   * AGENDADA» del Excel, que llega **pre-rellenada con la fecha prevista de cada
   * curso-horario**. La prueba está en las reservas dormidas: las 1.173 traen
   * fecha —nadie ha agendado una reserva dormida— y **1.137 de ellas la tienen
   * DISTINTA de la de su titular**, o sea la de su propio curso, no una heredada.
   *
   * Así que contar «agendadas» por fecha es correcto para «cuántas se pueden
   * visitar», que es lo que este módulo mide, pero deja fuera una pregunta que
   * el mismo panel promete: `kpisDeAulas` define que «agendar es llamar al
   * docente y cerrar una cita». Nueve cursos-horario de este corte tienen fecha,
   * medio declarado y de tres a cinco intentos, y su estado sigue en
   * `sin_contactar`: se intentó y no se logró.
   *
   * Se cuentan aparte para que «Por agendar 0» no las esconda.
   */
  estadosEnDesacuerdo: number;
  /**
   * Cuántas efectivas se esperan de esas filas contradictorias.
   *
   * El conteo dice que hay una contradicción; esto dice cuánto depende de ella.
   * Medido en HSVG2026 el 2026-08-30: las 9 en desacuerdo aportan **168 de las
   * 373,5 efectivas del aporte pendiente, el 45 %** — la proyección de cierre se
   * apoya en filas cuyos dos estados no se ponen de acuerdo.
   */
  esperadasEnDesacuerdo: number;
  /**
   * Las que **siguen sin fecha** y no tienen medio de contacto anotado.
   *
   * En 2025 fueron 14 de 170 y **se cayeron las catorce**. No es que sean
   * difíciles: es que no hay por dónde llamarlas, y una reserva se activa antes
   * si eso se ve el primer día en vez del último.
   *
   * **La condición de la fecha estaba en el código y no en el nombre.** Se
   * cuentan sólo las que aún hay que agendar —una que ya tiene fecha no
   * necesita que la llamen— pero el rótulo decía «sin medio de contacto» a
   * secas. Medido sobre HSVG2026 «como 2025»: **33 de las 174 en juego no
   * declaran medio** y el contador marca **0**, porque las 174 tienen fecha.
   * Quien compare las dos cifras no puede reconciliarlas sin leer el código.
   */
  sinMedioDeContacto: number;
  /** Mediana de intentos entre las que registran alguno. */
  intentosMedianos: number | null;
  /**
   * Cuántas aulas llevan cada número de gestiones, de 1 en adelante.
   *
   * La mediana sola dice dónde está el centro y **esconde la cola**, que es
   * justo donde vive el riesgo: en 2025 la mediana fue 2 y aun así 33 aulas de
   * 170 llegaron a la cuarta llamada o más. Con la distribución, la cola se ve.
   *
   * `enRiesgo` marca los tramos que están en o por encima de `UMBRAL_DE_RIESGO`,
   * para que el corte se dibuje sin que quien pinta tenga que saber el umbral.
   */
  distribucionDeGestiones: Array<{ gestiones: number; aulas: number; enRiesgo: boolean }>;
  /** Por qué medio se contactó, de más a menos. */
  medios: Array<{ medio: string; aulas: number }>;
};

/**
 * Un aula del banco, ya reemplazada o **dormida en su cadena** no la va a
 * agendar nadie.
 *
 * Contaba las 507 reservas encadenadas como aulas por agendar, así que el KPI
 * decía «0 de **700** que se van a visitar» al pie de una tabla de **193**. Y no
 * es sólo una cifra descuadrada: nadie va a llamar a los docentes de esas 507.
 * Una reserva entra en juego el día que su titular se cae, y hasta entonces
 * pedirle cita sería llamar a un aula que no toca.
 *
 * La regla de «dormida» es la del motor —`monitoreo_aulas_universitarias.R`:
 * una `chain_reserve` con estado vacío, `en_reserva` o `sin_contactar` está
 * esperando—. Con cualquier otro estado ya la activaron y sí se agenda.
 */
function seVaAAgendar(fila: Fila): boolean {
  const rol = txt(fila.sample_role).toLowerCase();
  if (rol === "extra_reserve_pool") return false;
  const estado = txt(fila.sample_status).toLowerCase().replace(/[\s-]+/g, "_");
  if (estado === "reemplazada") return false;
  if (rol === "chain_reserve") {
    return Boolean(estado) && estado !== "en_reserva" && estado !== "sin_contactar";
  }
  return true;
}

/**
 * A partir de cuántas gestiones un aula deja de ser insistencia y pasa a ser
 * pronóstico. **Medido, no elegido**: en el campo de 2025 las que se cerraron en
 * una o dos gestiones se cayeron el 17-19 %; de la tercera en adelante, el
 * 36-38 %.
 */
export const UMBRAL_DE_RIESGO = 3;

export function agendamiento(filas: ReadonlyArray<Fila>): Agendamiento {
  const enJuego = filas.filter(seVaAAgendar);
  let agendadas = 0;
  let conInsistencia = 0;
  let enUmbralDeRiesgo = 0;
  let sinMedioDeContacto = 0;
  let estadosEnDesacuerdo = 0;
  let esperadasEnDesacuerdo = 0;
  const intentos: number[] = [];
  const porMedio = new Map<string, number>();

  let aplicadasSinAgenda = 0;
  for (const fila of enJuego) {
    const tieneFecha = Boolean(txt(fila.scheduled_date));
    // Con FECHA, no por el estado: «agendada» es lo que dice la hoja y la fecha
    // es lo que se puede visitar. Cuando los dos discrepan manda el hecho.
    if (tieneFecha) {
      agendadas += 1;
    } else if (["aplicada", "cerrada"].includes(txt(fila.operational_status).toLowerCase())) {
      // **Aplicada sin fecha agendada: eso no debería existir.**
      //
      // Regla del operativo (Gonzalo, 2026-08-24): «si no se agenda un aula, no
      // se aplica; esa situación no puede suceder». Así que esta rama NO es un
      // caso normal que contar aparte —como decía la primera versión de este
      // código, que lo llamaba «aplicadas sin cita previa» y lo daba por
      // bueno—: es un **descuadre** entre la hoja de agenda y el parte.
      //
      // Se cuenta, no se bloquea. La combinación puede llegar del Excel por un
      // error de transcripción —falta la fecha en la agenda, o el parte se
      // anotó en la fila equivocada— y rechazar la importación perdería un
      // parte real. Descartarlo en silencio lo escondería. Contarlo lo deja
      // visible y accionable.
      //
      // Tampoco suma a `agendadas`: no lo estuvo.
      aplicadasSinAgenda += 1;
    }
    const n = num(fila.contact_attempts);
    if (n !== null && n > 0) {
      intentos.push(n);
      if (n > 1) conInsistencia += 1;
      // El riesgo se cuenta sólo sobre las que TODAVÍA no tienen fecha: una que
      // costó cuatro llamadas pero ya está agendada no es un pronóstico, es una
      // historia.
      if (n >= UMBRAL_DE_RIESGO && !tieneFecha) enUmbralDeRiesgo += 1;
    }
    /**
     * **Los dos estados de la misma fila, en desacuerdo.**
     *
     * La primera versión de esto contaba «sin contacto logrado» mirando sólo
     * `sample_status === "sin_contactar"`, y eso afirmaba más de lo que se
     * sabe: esas mismas nueve filas traen `operational_status = "agendada"`.
     * Uno de los dos está desactualizado y no se puede decidir cuál desde aquí.
     *
     * Lo que sí es un hecho comprobable es que **se contradicen**, y eso es lo
     * que hay que ir a corregir. Medido sobre HSVG2026 «como 2025», los tres
     * pares que existen en el plan en juego:
     *
     * | `sample_status` / `operational_status` | filas |
     * |---|---|
     * | agendada / aplicada | 152 |
     * | agendada / agendada | 13 |
     * | **sin_contactar / agendada** | **9** |
     *
     * Las nueve llevan además de tres a cinco gestiones y `contact_date` vacío.
     */
    const estadoMuestra = txt(fila.sample_status).toLowerCase().replace(/[\s-]+/g, "_");
    const estadoOperativo = txt(fila.operational_status).toLowerCase().replace(/[\s-]+/g, "_");
    if (estadoMuestra === "sin_contactar"
        && (estadoOperativo === "agendada" || estadoOperativo === "aplicada"
            || estadoOperativo === "cerrada")) {
      estadosEnDesacuerdo += 1;
      const esperadas = Number(fila.expected_valid);
      if (Number.isFinite(esperadas) && esperadas > 0) esperadasEnDesacuerdo += esperadas;
    }
    const medio = txt(fila.contact_medium);
    if (medio) porMedio.set(medio, (porMedio.get(medio) ?? 0) + 1);
    else if (!tieneFecha) sinMedioDeContacto += 1;
  }

  // La distribución completa, no sólo su centro. Se agrupa por número entero de
  // gestiones —lo que la hoja anota— y se ordena de menos a más, que es como se
  // lee una cola.
  const porGestiones = new Map<number, number>();
  for (const n of intentos) {
    const k = Math.max(1, Math.round(n));
    porGestiones.set(k, (porGestiones.get(k) ?? 0) + 1);
  }
  const distribucionDeGestiones = [...porGestiones.entries()]
    .sort(([a], [b]) => a - b)
    .map(([gestiones, aulas]) => ({ gestiones, aulas, enRiesgo: gestiones >= UMBRAL_DE_RIESGO }));

  intentos.sort((a, b) => a - b);
  const mediana = intentos.length
    ? intentos[Math.floor((intentos.length - 1) / 2)]
    : null;

  return {
    enJuego: enJuego.length,
    agendadas,
    aplicadasSinAgenda,
    // Lo que de verdad queda por agendar: ni con fecha, ni ya aplicada.
    porAgendar: enJuego.length - agendadas - aplicadasSinAgenda,
    conInsistencia,
    estadosEnDesacuerdo,
    esperadasEnDesacuerdo: Math.round(esperadasEnDesacuerdo),
    distribucionDeGestiones,
    enUmbralDeRiesgo,
    sinMedioDeContacto,
    intentosMedianos: mediana,
    medios: [...porMedio.entries()]
      .map(([medio, aulas]) => ({ medio, aulas }))
      .sort((a, b) => b.aulas - a.aulas || a.medio.localeCompare(b.medio, "es")),
  };
}
