/**
 * Los seis pasos de cada facultad, con la columna del estudio anterior.
 *
 * Es la cadena que Gonzalo pidió ver entera y por facultad: cuántos alumnos se
 * calcularon, cuánta es la muestra, cuántas aulas del catálogo pasan los
 * criterios, cuántos alumnos hay por curso-horario, cuántas aulas hacen falta y
 * si quedan reemplazos. Medida para LETRAS Y CIENCIAS HUMANAS: 225 alumnos →
 * cuota 26 → 12 de 149 aulas → p25 de 15 → 4 titulares → 8 sobrantes, o sea
 * **2 reservas por titular**. Y el contraste que importa: EE.GG. LETRAS
 * necesita 49 y tiene 12.
 *
 * Este módulo sólo proyecta cifras que R ya publicó y las enfrenta con las del
 * histórico. No recalcula nada: si un dato no está, viaja `null` y la ficha lo
 * dice, porque un 0 se leería como medido.
 */
import type {
  CalcMuestraAulasEstrato,
  CalcMuestraReferenciaCriterios,
  CalcMuestraReferenciaCriteriosFila,
} from "../../../../api/calcMuestra";

export type PasoFicha = {
  n: number;
  titulo: string;
  hoy: number | null;
  antes: number | null;
  /** Texto corto que explica de dónde sale la cifra de hoy. */
  detalle: string;
};

/**
 * Una regla que rige SÓLO en esta facultad.
 *
 * Gonzalo: «los criterios no son generales, son por facultad». Dos cosas se
 * declaran por facultad hoy: su **mínimo de elegibles propio**
 * (`minEligible.byFaculty`) y sus **excepciones de tipo de sesión**
 * (`byVariable.<var>.exceptions`, con `add` que suma categorías a las generales
 * y `replace` que las sustituye). Sin verlas, la ficha muestra cuentas sin decir
 * de qué reglas salen.
 */
export type CriterioPropio = {
  clase: "minimo" | "excepcion";
  etiqueta: string;
  detalle: string;
};

export type FichaFacultad = {
  facultad: string;
  pasos: PasoFicha[];
  /** Reglas que rigen SÓLO en esta facultad. Vacío = usa las generales. */
  criteriosPropios: CriterioPropio[];
  /** Reservas por titular que la facultad puede sostener, y las que pide el
   *  diseño. `null` cuando el motor no publicó el margen. */
  reservasSostenibles: number | null;
  reservasPedidas: number | null;
  aviso: string;
};

/**
 * Clave de facultad en el formato del MOTOR (`.cm_criterios_fac_key`):
 * minúsculas, sin acentos, la ñ a n, apóstrofes BORRADOS —no convertidos en
 * guion bajo— y todo lo demás a guion bajo. Es la que indexa
 * `minEligible.byFaculty` y `exceptions`; usar otra deja los criterios propios
 * invisibles sin que nada falle.
 *
 * El motor convierte la ñ con un `gsub` explícito porque su
 * `iconv(ASCII//TRANSLIT)` no la resuelve igual en toda plataforma; acá
 * `normalize("NFD")` ya la descompone, así que no hace falta el paso aparte.
 */
export function claveMotor(valor: string): string {
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[`'\u00b4\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Reglas que rigen sólo en esta facultad, leídas de la suite de criterios. */
export function criteriosPropiosDeFacultad(
  facultad: string,
  criteriosSeleccion: unknown,
  minimoGeneral: number | null,
): CriterioPropio[] {
  const sel = (criteriosSeleccion ?? {}) as Record<string, unknown>;
  const k = claveMotor(facultad);
  const out: CriterioPropio[] = [];

  const minElig = (sel.minEligible ?? {}) as Record<string, unknown>;
  const byFaculty = (minElig.byFaculty ?? {}) as Record<string, unknown>;
  const propio = Number(byFaculty[k]);
  if (Number.isFinite(propio)) {
    out.push({
      clase: "minimo",
      etiqueta: `Mínimo propio: ${propio} elegibles`,
      detalle:
        minimoGeneral != null && minimoGeneral !== propio
          ? `el general es ${minimoGeneral}`
          : "declarado para esta facultad",
    });
  }

  const byVariable = (sel.byVariable ?? {}) as Record<string, unknown>;
  for (const varId of Object.keys(byVariable)) {
    const crit = (byVariable[varId] ?? {}) as Record<string, unknown>;
    const exc = (crit.exceptions ?? {}) as Record<string, unknown>;
    const propia = exc[k] as Record<string, unknown> | undefined;
    if (!propia) continue;
    const cats = Array.isArray(propia.categories)
      ? (propia.categories as unknown[]).map(String)
      : propia.categories != null
        ? [String(propia.categories)]
        : [];
    if (!cats.length) continue;
    const op = String(propia.op ?? "add");
    out.push({
      clase: "excepcion",
      etiqueta:
        op === "replace"
          ? `${varId}: sólo ${cats.join(", ")}`
          : `${varId}: además ${cats.join(", ")}`,
      detalle:
        op === "replace"
          ? "sustituye a las categorías generales"
          : "se suman a las categorías generales",
    });
  }
  return out;
}

/**
 * De qué componente salen las cuentas por facultad.
 *
 * Medido contra HSVG2026: exigir que las filas trajeran `margen` —un campo que R
 * publica desde hace poco— dejaba la tarjeta en CERO facultades para cualquier
 * estudio calculado antes, aunque `aulas_por_estrato` viniera completo. El
 * margen es UNO de los seis pasos, no la condición para mostrar los otros cinco.
 *
 * Y POR FACULTAD: cuando ningún componente publica margen, las filas salen del
 * que dimensiona por facultad, jamás del total.
 */
type ConEstratos<T> = { resultado?: { aulas_por_estrato?: T[] } | null } | null | undefined;

export function filasParaFichas<T extends { margen?: unknown }>(
  componentes: ReadonlyArray<ConEstratos<T>>,
  facultyComp: ConEstratos<T>,
): T[] | null {
  const conMargen = componentes.find((c) =>
    (c?.resultado?.aulas_por_estrato ?? []).some((f) => f.margen != null),
  );
  if (conMargen) return conMargen?.resultado?.aulas_por_estrato ?? null;
  const filas = facultyComp?.resultado?.aulas_por_estrato ?? [];
  return filas.length ? filas : null;
}

/** Misma normalización que el motor: sin acentos, sin mayúsculas, sin espacios. */
export function claveFicha(valor: string): string {
  return valor
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function buscarHistorico(
  referencia: CalcMuestraReferenciaCriterios | null,
  facultad: string,
): CalcMuestraReferenciaCriteriosFila | null {
  if (!referencia) return null;
  const k = claveFicha(facultad);
  return referencia.por_facultad.find((f) => claveFicha(f.facultad) === k) ?? null;
}

export function fichaDeFacultad(
  fila: CalcMuestraAulasEstrato,
  aulasDelCatalogo: number | null,
  aulasElegibles: number | null,
  alumnosPorCh: number | null,
  referencia: CalcMuestraReferenciaCriterios | null,
  criteriosSeleccion: unknown = null,
  minimoGeneral: number | null = null,
  titularesSeleccionados: number | null = null,
): FichaFacultad {
  const h = buscarHistorico(referencia, fila.estrato);
  const m = fila.margen ?? null;
  const cuota = Number.isFinite(fila.cuota) ? fila.cuota : null;
  return {
    facultad: fila.estrato,
    criteriosPropios: criteriosPropiosDeFacultad(fila.estrato, criteriosSeleccion, minimoGeneral),
    reservasSostenibles: m?.reservas_sostenibles ?? null,
    reservasPedidas: m?.reservas_pedidas ?? null,
    aviso: m?.aviso ?? "",
    pasos: [
      {
        n: 1, titulo: "Población",
        hoy: Number.isFinite(fila.N) ? fila.N : null, antes: h?.poblacion ?? null,
        detalle: "alumnos únicos de esta facultad",
      },
      {
        n: 2, titulo: "Muestra",
        hoy: cuota, antes: h?.cuota ?? null,
        detalle: "cuota que le toca del total",
      },
      {
        n: 3, titulo: "Aulas que pasan los criterios",
        hoy: aulasElegibles, antes: h?.aulas_sorteadas ?? null,
        detalle: aulasDelCatalogo != null ? `de ${aulasDelCatalogo} en el catálogo` : "en el marco",
      },
      {
        n: 4, titulo: "Alumnos por curso-horario",
        hoy: alumnosPorCh, antes: h?.alumnos_por_ch ?? null,
        detalle: "el estadístico que dimensiona",
      },
      {
        n: 5, titulo: "Aulas necesarias",
        hoy: m?.aulas_requeridas ?? (Number.isFinite(fila.aulas_base) ? fila.aulas_base : null),
        // Contra las aulas que el estudio anterior APLICÓ, no contra sus
        // titulares: 2025 declaró 170 y aplicó 194 —la diferencia son los
        // reemplazos—, y comparar contra lo que de verdad se hizo cambia el
        // diagnóstico. En DERECHO, contra el objetivo de la plantilla nuestra
        // cifra parecía −6 y contra lo aplicado es −1.
        antes: h?.aulas_aplicadas ?? h?.aulas_titulares ?? null,
        detalle: "titulares que hay que visitar",
      },
      {
        n: 6, titulo: "Aulas que sobran",
        hoy: m?.aulas_sobrantes ?? null, antes: null,
        detalle: "de ellas salen los reemplazos",
      },
      {
        n: 7, titulo: "Titulares seleccionados",
        // El sorteo VIGENTE de esta facultad contra los titulares que 2025
        // dimensionó (rescatados de las cadenas de la asistencia). Sin
        // selección corrida viaja null y la ficha lo dice — un 0 se leería
        // como «se sorteó y no le tocó ninguna».
        hoy: titularesSeleccionados, antes: h?.aulas_titulares ?? null,
        detalle: "M1 del sorteo vigente",
      },
    ],
  };
}
