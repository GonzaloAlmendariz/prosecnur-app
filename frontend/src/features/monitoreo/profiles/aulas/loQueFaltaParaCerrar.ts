/**
 * Cuánto falta para que un aula evaluada pase a efectiva.
 *
 * La pantalla dice «23 de 152 aulas efectivas · 15 %» y ahí se acaba: nadie
 * sabe si esas 79 que no llegaron quedaron a una encuesta o a veinte. Medido
 * sobre el corte real, **505 encuestas cierran las 79, la mediana es 6 y 36
 * cierran con cinco o menos** —dos con una sola—. Es la diferencia entre un
 * veredicto y una cola de trabajo ordenada por esfuerzo.
 *
 * El faltante NO se inventa: sale del umbral que la propia hoja calculó
 * (`threshold_total` / `threshold_population`, conteos de encuestas, ya
 * resueltos por el equipo con su denominador) contra lo que el aula envió.
 * Sólo se cuenta el umbral que el aula FALLÓ, y cuando falla los dos manda el
 * más exigente: cerrar el mayor cierra el otro de paso.
 */

/** Una fila de «Base de control» tal como el motor la publica. */
type FilaDeControl = Readonly<Record<string, unknown>>;

const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number.parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const txt = (v: unknown) => String(v ?? "").trim();

export type AulaPorCerrar = {
  codigo: string;
  /** La del plan, adosada por el motor. Vacía si el código no cruzó. */
  facultad: string;
  /** Encuestas que faltan para alcanzar el umbral que falló. */
  faltan: number;
  enviadas: number;
  /** El umbral que decide, ya en encuestas. */
  umbral: number;
  /**
   * Contra qué se midió y qué falló. Los tres primeros son los umbrales del
   * 70 % de los libros de 2025; `meta` es la vara vigente —lo que el diseño
   * esperaba de ESA aula— y es la única que aplica en los estudios nuevos.
   */
  falla: "ambos" | "total" | "poblacion" | "meta";
};

export type LoQueFalta = {
  aulas: AulaPorCerrar[];
  /** Evaluadas y no efectivas. Incluye las que no traen cifras. */
  noEfectivas: number;
  /**
   * Las filas que el libro SI evaluo —las que traen los dos veredictos—. Sin
   * este numero el panel no puede distinguir «ninguna se quedo corta» de
   * «ninguna se evaluo», y la segunda se leia como la primera: la mejor
   * noticia del operativo anunciada sobre cero aulas.
   */
  evaluadas: number;
  /** Suma de faltantes: lo que costaría cerrarlas todas. */
  costoTotal: number;
  /**
   * Evaluadas y no efectivas a las que la hoja no da con qué calcular el
   * faltante. Se dicen aparte: son las que este panel NO puede priorizar, y
   * callarlas haría leer «79 aulas» donde se midieron menos.
   */
  sinCifras: number;
  /**
   * Aulas cuyo veredicto dice que no cumple aunque las enviadas ya pasan el
   * umbral de la propia hoja. No es un faltante de cero: es una discrepancia
   * de la hoja consigo misma, y se cuenta aparte para no rebajarla a «ya está».
   */
  contradicciones: number;
};

/**
 * @param filas filas publicadas de «Base de control».
 * @returns las aulas por cerrar, de la más barata a la más cara.
 */
export function loQueFaltaParaCerrar(filas: ReadonlyArray<FilaDeControl>): LoQueFalta {
  const aulas: AulaPorCerrar[] = [];
  let noEfectivas = 0;
  let evaluadas = 0;
  let sinCifras = 0;
  let contradicciones = 0;

  for (const fila of filas) {
    const t = fila.cumple_total;
    const p = fila.cumple_poblacion;
    // **El veredicto ya compuesto, no los dos umbrales sueltos.**
    //
    // Exigir que `cumple_total` y `cumple_poblacion` fueran booleanos dejaba el
    // panel vacío en cualquier estudio de 2026: esos dos salen de las columnas
    // `70T`/`70P`, que la app ya no escribe, así que ambos son nulos y las
    // 2.616 aulas se descartaban como «sin evaluar». `efectiva` es el veredicto
    // con su prioridad ya resuelta —veredicto de la hoja, umbral del 70, meta
    // del diseño— y por eso es el que decide quién entra.
    // Se DERIVA cuando la fila no lo trae: el motor siempre lo publica, pero
    // una fila cruda —o un consumidor que arme el payload a mano— no tiene por
    // qué, y quedarse sin panel por un campo ausente es peor que recomponerlo.
    const veredicto = typeof fila.efectiva === "boolean"
      ? fila.efectiva
      : (t === true || t === false) && (p === true || p === false)
        ? (t as boolean) && (p as boolean)
        : null;
    // Sin evaluar no es lo mismo que no llegó: un aula que nadie miró no tiene
    // faltante, tiene una hoja sin llenar. Va fuera del panel entero.
    if (veredicto !== true && veredicto !== false) continue;
    evaluadas += 1;
    if (veredicto) continue;
    noEfectivas += 1;

    const enviadas = num(fila.sent_total);
    const uT = num(fila.threshold_total);
    const uP = num(fila.threshold_population);
    // Un umbral menor o igual a 1 es una proporción escrita como tal, no un
    // número de encuestas; el motor ya descarta ese caso al decidir y aquí se
    // descarta por el mismo motivo.
    const usable = (u: number | null) => (u !== null && u > 1 ? u : null);
    const faltaT = t === false ? usable(uT) : null;
    const faltaP = p === false ? usable(uP) : null;

    // **La vara vigente, cuando el libro no trae los umbrales del 70 %.**
    //
    // La brecha es meta − obtenidas, y las dos cifras ya viajan: la meta en
    // `expected_valid`, que el cálculo de muestra publica por curso-horario
    // (2.616 de 2.616, mediana 17), y lo conseguido en las efectivas. Sin esto
    // el panel decía «el libro no trae con qué calcular cuánto les falta» y
    // mandaba a buscar dos columnas que ya no existen.
    const porUmbral = faltaT !== null || faltaP !== null;
    const meta = num(fila.expected_valid) ?? num(fila.efectivas_esperadas);
    const logrado = num(fila.efectivas_obtenidas) ?? num(fila.effective_surveys) ?? enviadas;

    if (!porUmbral && (meta === null || meta <= 0 || logrado === null)) {
      sinCifras += 1;
      continue;
    }
    if (porUmbral && enviadas === null) {
      sinCifras += 1;
      continue;
    }

    const umbral = porUmbral ? Math.max(faltaT ?? 0, faltaP ?? 0) : (meta as number);
    const base = porUmbral ? (enviadas as number) : (logrado as number);
    const faltan = Math.ceil(umbral - base);
    if (faltan <= 0) {
      contradicciones += 1;
      continue;
    }
    aulas.push({
      codigo: txt(fila.operational_code) || txt(fila.course_code) || "—",
      facultad: txt(fila.faculty),
      faltan,
      enviadas: base,
      umbral,
      falla: !porUmbral
        ? "meta"
        : faltaT !== null && faltaP !== null
          ? "ambos"
          : faltaT !== null
            ? "total"
            : "poblacion",
    });
  }

  // De la más barata a la más cara: es el orden en que se hace el trabajo, y el
  // que hace que la curva acumulada tenga sentido de leer.
  aulas.sort((a, b) => a.faltan - b.faltan || a.codigo.localeCompare(b.codigo, "es"));
  return {
    aulas,
    noEfectivas,
    evaluadas,
    costoTotal: aulas.reduce((s, a) => s + a.faltan, 0),
    sinCifras,
    contradicciones,
  };
}

/**
 * Cuántas aulas se cierran con un presupuesto de encuestas.
 *
 * @param aulas las aulas por cerrar, ya ordenadas por costo.
 * @param presupuesto encuestas adicionales disponibles.
 */
export function aulasQueCierran(aulas: ReadonlyArray<AulaPorCerrar>, presupuesto: number) {
  let gasto = 0;
  let cerradas = 0;
  for (const a of aulas) {
    if (gasto + a.faltan > presupuesto) break;
    gasto += a.faltan;
    cerradas += 1;
  }
  return { cerradas, gasto };
}

/** El corte natural: cuántas cierran con `n` encuestas o menos CADA UNA. */
export function cierranConHasta(aulas: ReadonlyArray<AulaPorCerrar>, n: number) {
  return aulas.filter((a) => a.faltan <= n).length;
}

export type FacultadPorCerrar = {
  facultad: string;
  aulas: number;
  /** Encuestas que cierran todas las de esta facultad. */
  costo: number;
  /** Cuántas de sus aulas están a cinco encuestas o menos. */
  baratas: number;
};

/**
 * La misma cola, agrupada por facultad.
 *
 * «Siempre todo es por facultad», y con razón: cerrar ocho aulas de una misma
 * facultad es UNA salida y ocho aulas repartidas son ocho.
 *
 * **Ordena por aulas que se cierran, no por lo que cuestan.** Primero lo ordené
 * por costo ascendente y el resultado encabezaba con una facultad de UNA aula a
 * dos encuestas: la salida más barata en encuestas y la peor de todas en
 * rendimiento, porque ir a una facultad a cerrar un aula cuesta lo mismo que ir
 * a cerrar ocho. La pregunta que este bloque contesta es a dónde ir, y a esa
 * pregunta responde cuántas aulas cierra la visita. El costo desempata.
 *
 * Las aulas cuyo código no cruzó con el plan quedan fuera del reparto y se
 * cuentan aparte: meterlas en una facultad «Sin facultad» las haría competir
 * con facultades reales en la misma lista.
 */
export function porFacultad(aulas: ReadonlyArray<AulaPorCerrar>) {
  const mapa = new Map<string, FacultadPorCerrar>();
  let sinFacultad = 0;
  for (const a of aulas) {
    if (!a.facultad) {
      sinFacultad += 1;
      continue;
    }
    const f = mapa.get(a.facultad) ?? { facultad: a.facultad, aulas: 0, costo: 0, baratas: 0 };
    f.aulas += 1;
    f.costo += a.faltan;
    if (a.faltan <= 5) f.baratas += 1;
    mapa.set(a.facultad, f);
  }
  const filas = [...mapa.values()].sort(
    (x, y) => y.aulas - x.aulas || x.costo - y.costo || x.facultad.localeCompare(y.facultad, "es"),
  );
  return { filas, sinFacultad };
}
