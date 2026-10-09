import { fmt, fmtAporte } from "./kpisDeAulas";
// El orden de los sexos es UNO en todo el perfil: si esta lista y la tabla de
// cuotas lo definieran cada una, acabarían discrepando en cuanto una cambiara.
import { ORDEN_SEXO } from "./ordenFacultadSexo";
import { etiquetaDeSexo } from "./etiquetaDeSexo";

/**
 * El avance por celda facultad × sexo, ordenado por lo que hay que hacer.
 *
 * Es la lectura que faltaba. La tabla de cuotas dice **dónde estás**; ésta dice
 * **si vas a llegar** y **si el campo se está comportando como el modelo**. Las
 * dos conviven a propósito: en 2025 la única celda incumplida fue EE.GG. Letras
 * hombres, y para cuando «ya no llegaste» es visible, no queda nada que hacer.
 *
 * Las frases vienen del motor (`etiqueta`, `etiqueta_calibracion`): aquí no se
 * redacta nada. Con dos redacciones vivas del mismo estado, la pantalla acaba
 * diciendo dos cosas y ningún test lo ve.
 */

/** Una celda tal como la publica el motor. */
export type CeldaAvance = {
  faculty?: unknown;
  sex?: unknown;
  cuota?: unknown;
  logrado?: unknown;
  previsto?: unknown;
  aporte_pendiente?: unknown;
  proyeccion?: unknown;
  brecha?: unknown;
  calibracion?: unknown;
  estado?: unknown;
  previsto_origen?: unknown;
  etiqueta?: unknown;
  etiqueta_calibracion?: unknown;
  /**
   * Probabilidad de que la celda cierre su cuota, en [0,1]. `null`/ausente
   * cuando el motor no pudo medirla, que NO es lo mismo que cero.
   */
  prob_cierre?: unknown;
  /** Sobredispersión medida del estudio, y sobre cuántas aulas. */
  dispersion?: unknown;
  dispersion_n?: unknown;
};

export type FilaAvance = {
  clave: string;
  facultad: string;
  sexo: string;
  cuota: number;
  logrado: number;
  proyeccion: number;
  brecha: number;
  estado: string;
  etiqueta: string;
  etiquetaCalibracion: string;
  /** La causa en una frase, no sólo el hecho. Vacía cuando no aporta nada. */
  porque: string;
  /** El origen del previsto; `""` cuando el motor no lo declara. */
  origen: string;
  /** Lo que aún se espera recibir. En 0 la celda ya cerró: nada que proyectar. */
  aportePendiente: number;
  /**
   * La misma pregunta que `estado` —«¿va a llegar?»— con la incertidumbre
   * puesta. `null` cuando alguna aula pendiente de la celda no declara tasa: sin
   * saber cuánto varía, no hay probabilidad que dar. Un `null` NO se pinta como
   * 0 %; se dice que no se pudo medir.
   */
  probabilidad: number | null;
  /**
   * Lo que corrige esa probabilidad y sobre cuántas aulas se midió. Va a la
   * pantalla porque un «×4,4» sin su denominador no es comprobable.
   */
  dispersion: number | null;
  dispersionN: number;
};

/**
 * Orden de urgencia **de la facultad**, no de la celda suelta.
 *
 * Gonzalo, fijando la unidad de lectura: «la vista prioritaria es siempre por
 * facultad y en facultad hombre y mujeres, el cruce de ambos no va separado, o
 * sea no puedo tener hombre de una facultad y mujeres de otra; debe estar
 * ordenado por facultad y en cada facultad por sexo».
 *
 * Ordenar por estado y luego por brecha —que es lo que hacía— partía las
 * facultades: Derecho·Mujeres salía cuarta y Derecho·Hombres a diez filas de
 * distancia, así que nadie podía leer cómo va Derecho. La urgencia no se pierde:
 * pasa a ser de la facultad —manda su celda más urgente y, a igualdad, su brecha
 * total—, y dentro de ella los dos sexos van siempre juntos y en el mismo orden.
 */
const ORDEN: Record<string, number> = {
  deficit_no_subsanable: 0,
  deficit_proyectado: 1,
  ajustada: 2,
  asegurada: 3,
  sin_cuota: 4,
};

const num = (v: unknown, def = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};
const txt = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * La causa del estado, en las cifras que el motor ya publica.
 *
 * «Derecho mujeres en déficit» no manda a nadie a ningún sitio; «faltan 24 y
 * las 4 aulas pendientes aportan 21» sí. Se compone sólo cuando hay algo que
 * explicar: repetir el titular con otras palabras es ruido.
 */
export function porqueDeLaCelda(c: CeldaAvance): string {
  const estado = txt(c.estado);
  if (estado !== "deficit_proyectado" && estado !== "deficit_no_subsanable") return "";
  const cuota = num(c.cuota);
  const logrado = num(c.logrado);
  const pendiente = num(c.aporte_pendiente);
  if (cuota <= 0) return "";
  const falta = Math.max(0, cuota - logrado);
  const p = pendiente > 0
    // `fmt` conserva el decimal del aporte esperado y son PERSONAS: «aportan
    // 14.1» es un décimo de alumno. Cuarta vez que el mismo defecto sale hoy
    // —reserva dirigida, brecha por estrato, ritmo diario y aquí—.
    //
    // Pero `fmtCuenta` era el redondeo EQUIVOCADO: va hacia arriba, que es la
    // regla de una meta que hay que cumplir. Esto es un APORTE esperado, y ahí
    // prometer de más es el error caro. Medido con el simulacro `como_2025`:
    // «Lleva 1 de 4: faltan 3 y las aulas que faltan por aplicar aportan 3»
    // junto a un veredicto que decía «falta 1 encuesta» —3 − 3 = 0, no 1—,
    // porque el aporte real era 2,1 y subía a 3.
    ? `los cursos-horario que faltan por aplicar aportan ${fmtAporte(pendiente)}`
    : "no quedan cursos-horario por aplicar";
  return `Lleva ${fmt(logrado)} de ${fmt(cuota)}: faltan ${fmt(falta)} y ${p}.`;
}

/** Normaliza y ordena las celdas del motor. */
export function avanceProyectado(celdas: ReadonlyArray<CeldaAvance> | null | undefined): FilaAvance[] {
  if (!celdas?.length) return [];
  const filas = celdas.map((c) => {
    const facultad = txt(c.faculty) || "Sin facultad";
    const sexo = txt(c.sex).toUpperCase();
    return {
      clave: `${facultad}|${sexo}`,
      facultad,
      // La MISMA traducción que el resto del perfil: dos copias de esta regla
      // fue lo que dejó «38 m» en la tabla de anticipación.
      sexo: etiquetaDeSexo(sexo, { mayuscula: true }) || "Sin sexo",
      cuota: num(c.cuota),
      logrado: num(c.logrado),
      proyeccion: num(c.proyeccion),
      brecha: num(c.brecha),
      estado: txt(c.estado) || "sin_estado",
      // **Nunca se redacta aquí.** Sin frase del motor la celda lo dice, en vez
      // de que la pantalla se invente una que suene bien.
      etiqueta: txt(c.etiqueta) || "Sin estado",
      etiquetaCalibracion: txt(c.etiqueta_calibracion),
      porque: porqueDeLaCelda(c),
      origen: txt(c.previsto_origen),
      // Hace falta para distinguir «no se pudo medir» de «no queda nada que
      // medir»: sin aporte pendiente la celda ya cerró y no hay proyección que
      // hacer, que es un caso distinto de que falte un dato.
      aportePendiente: num(c.aporte_pendiente),
      // `num()` devuelve 0 para lo que no es número, y aquí 0 significa «no va
      // a cerrar» — que es una afirmación fuerte y distinta de «no se pudo
      // medir». Por eso se comprueba a mano en vez de reutilizar `num`.
      probabilidad: (() => {
        // `Number(null)` es 0 y `Number("")` también, así que la ausencia se
        // descarta ANTES de convertir. Sin esta línea una celda sin medir se
        // publicaba como «0 % de cerrar», que es la afirmación contraria.
        // Lo cazó su propio test.
        if (c.prob_cierre === null || c.prob_cierre === undefined || c.prob_cierre === "") return null;
        const v = Number(c.prob_cierre);
        return Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
      })(),
      dispersion: (() => {
        const v = Number(c.dispersion);
        return Number.isFinite(v) && v >= 1 ? v : null;
      })(),
      dispersionN: (() => {
        const v = Number(c.dispersion_n);
        return Number.isFinite(v) && v >= 0 ? v : 0;
      })(),
    };
  });
  // La facultad es la unidad: se le calcula su urgencia (la de su celda más
  // urgente) y su brecha total, y con eso compiten entre ellas. Las celdas nunca
  // compiten sueltas.
  const urgencia = new Map<string, number>();
  const brechaTotal = new Map<string, number>();
  for (const f of filas) {
    const o = ORDEN[f.estado] ?? 9;
    urgencia.set(f.facultad, Math.min(urgencia.get(f.facultad) ?? 9, o));
    brechaTotal.set(f.facultad, (brechaTotal.get(f.facultad) ?? 0) + f.brecha);
  }
  return filas.sort((a, b) => {
    if (a.facultad !== b.facultad) {
      const ua = urgencia.get(a.facultad) ?? 9;
      const ub = urgencia.get(b.facultad) ?? 9;
      if (ua !== ub) return ua - ub;
      const ba = brechaTotal.get(a.facultad) ?? 0;
      const bb = brechaTotal.get(b.facultad) ?? 0;
      if (bb !== ba) return bb - ba;
      return a.facultad.localeCompare(b.facultad, "es");
    }
    // Dentro de la facultad, el sexo manda y en un orden FIJO: el mismo en las
    // quince facultades, para que la lista se pueda escanear en vertical. F
    // antes que M es el orden en que la propia base los sirve.
    const sa = ORDEN_SEXO[a.sexo] ?? 9;
    const sb = ORDEN_SEXO[b.sexo] ?? 9;
    if (sa !== sb) return sa - sb;
    return a.sexo.localeCompare(b.sexo, "es");
  });
}

/** Cuántas celdas exigen una decisión. Cero es cero, no «todo bien». */
export function celdasQuePidenAccion(filas: ReadonlyArray<FilaAvance>): number {
  return filas.filter((f) => f.estado === "deficit_proyectado" || f.estado === "deficit_no_subsanable").length;
}

/**
 * Cuántas celdas se pueden evaluar: las que tienen cuota trazada.
 *
 * **El denominador del titular, y no es el total.** Visto en la app con el
 * panel poblado: el KPI decía «cierran con lo agendado: 10 de 30» y este panel
 * «10 de 30 no van a llegar», los dos ciertos y contándose sobre el mismo 30 —
 * porque 10 de esas 30 celdas no tienen objetivo declarado y no son ninguna de
 * las dos cosas. Puestos uno al lado del otro se leían como una contradicción.
 *
 * Con este denominador el titular dice «10 de 20», que es lo que también dice
 * el resumen de arriba («0 de 20 celdas cumplidas · 10 sin objetivo declarado»)
 * y ya no hay dos cuentas del mismo cruce diciendo cosas distintas.
 */
export function celdasEvaluables(filas: ReadonlyArray<FilaAvance>): number {
  return filas.filter((f) => f.estado !== "sin_cuota").length;
}
