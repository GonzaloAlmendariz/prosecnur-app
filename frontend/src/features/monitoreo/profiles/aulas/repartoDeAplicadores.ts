/**
 * El reparto vigente de aplicadores, listo para la pestaña de Asignación.
 *
 * Dictado (2026-09-02): «necesitaríamos una pestaña de asignación… para poder
 * hacer una asignación equitativa en base a lo que ya tenemos de momento, pero
 * que sea repetible por si llegan nuevas confirmaciones». La repetibilidad ya
 * la garantiza el motor (`monitoreo_aulas_reparto`, B29): puro y determinista,
 * recomputado en cada conversar del dashboard — cada Recargar trae el reparto
 * del estado nuevo, sin memoria entre corridas.
 *
 * Por eso aquí NO se reordena ni se recalcula nada: el greedy por fecha+hora,
 * el desempate alfabético y la equidad con ceros son pines del motor, y un
 * segundo dueño de cualquiera divergiría en la primera regla nueva. Este
 * módulo solo normaliza la frontera jsonlite y suma los totales que la vista
 * rotula.
 *
 * `null` (bloque ausente) ≠ reparto vacío: sin la clave de disponibilidad en
 * sesión el dashboard no publica el bloque, y la vista dice «falta cargarla»;
 * con la clave y cero agendadas llega `{dias: [], equidad: […0]}` y la vista
 * dice «nada que repartir todavía». Confundirlos es el vacío sin clasificar
 * que el contrato de superficie (C5) existe para impedir.
 */
import type { MonitoreoAulasReparto } from "../../../../api/monitoreo";
import { etiquetaDeFecha } from "./agendaPorDia";

const uno = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

const texto = (v: unknown): string => {
  const crudo = uno(v);
  return typeof crudo === "string" ? crudo.trim() : "";
};

const num = (v: unknown): number | null => {
  const crudo = uno(v);
  if (crudo === null || crudo === undefined || crudo === "") return null;
  const n = typeof crudo === "number" ? crudo : Number(crudo);
  return Number.isFinite(n) ? n : null;
};

/** Códigos que pueden llegar como lista o como escalar suelto (jsonlite). */
const leerCodigos = (v: unknown): string[] => {
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  if (!Array.isArray(v)) return [];
  return v.map((c) => texto(c)).filter(Boolean);
};

export type AsignacionDeCita = {
  codigo: string;
  aplicador: string;
  inicio: string;
  fin: string;
  /** B71: la hora del recojo de materiales (T−30), dicha por el motor. */
  recojo: string;
  /** B71: la hora de salir hacia el aula (T−15), dicha por el motor. */
  salida: string;
  /** B36: la puso el usuario (fijación), no el greedy. */
  fijada: boolean;
  /** Lo que la oferta no respalda, declarado por el motor; "" si nada. */
  advertencia: "" | "sin_disponibilidad" | "se_solapa";
};

export type DiaDeReparto = {
  fecha: string;
  /** «Viernes 11/09», la etiqueta de la casa. */
  etiqueta: string;
  /** En el orden del motor: greedy por hora ascendente. */
  asignaciones: AsignacionDeCita[];
  /** Citas pactadas sin candidato libre — el problema operativo del día. */
  noCubiertos: string[];
  /** Fechas sin hora pactada: no piden gente todavía (vocabulario B11). */
  porConfirmar: string[];
};

export type CargaDeAplicador = { aplicador: string; asignadas: number };

export type RepartoVista = {
  dias: DiaDeReparto[];
  /** Alfabético DEL MOTOR, ceros incluidos: quien está libre también cuenta. */
  equidad: CargaDeAplicador[];
  /** Citas con aplicador asignado, sumadas sobre todos los días. */
  citas: number;
  /** Citas pactadas que nadie cubre. */
  sinCubrir: number;
  porConfirmar: number;
  /** Aplicadores del resumen con al menos una cita. */
  conCarga: number;
  /** El tope del rail de cargas; 0 solo cuando no hay equidad que pintar. */
  cargaMax: number;
  /** Días sin fecha o asignaciones sin sus señas: declarados, no tragados. */
  ilegibles: number;
  /** B36: códigos fijados por el usuario cuya cita ya no está pactada. */
  fijadasSinCita: string[];
  /**
   * B36: el mapa completo de fijaciones vigente (eco saneado del motor).
   * La UI lo clona al fijar/soltar UNA cita y manda el mapa entero — así una
   * fijación huérfana no se pierde en silencio por editar otra.
   */
  fijadas: ReadonlyMap<string, string>;
  /** B70: con qué duración (min) armó el motor este reparto; 0 = no llegó. */
  duracionMin: number;
  /** B71: minutos de preparación previa (recojo + desplazamiento); 0 = no llegó. */
  preparacionMin: number;
  /**
   * B75: lo aplazado por el rango de despliegue, por fecha y con etiqueta de
   * la casa — se declara, no se esconde: esas citas esperan su tanda.
   */
  fueraDeRango: Array<{ fecha: string; etiqueta: string; codigos: string[]; porConfirmar: string[] }>;
  /** B75: el rango saneado que rigió; `null` = todo el horizonte. */
  rango: { desde: string; hasta: string } | null;
};

/**
 * El mapa de fijaciones que resulta de fijar (`aplicador` con nombre) o
 * soltar (`aplicador` vacío) UNA cita, partiendo del mapa vigente completo.
 * Devuelve el mapa ENTERO porque así viaja al config: mandar solo el cambio
 * descartaría las demás fijaciones en silencio, huérfanas incluidas.
 */
export function mapaDeFijaciones(
  vigentes: ReadonlyMap<string, string>,
  codigo: string,
  aplicador: string,
): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const [c, a] of vigentes) mapa[c] = a;
  if (aplicador) mapa[codigo] = aplicador;
  else delete mapa[codigo];
  return mapa;
}

/**
 * El despliegue de un día como texto plano, listo para pegarse en el chat
 * del equipo (régimen 2026-09-02: «cómo se va a desplegar a los
 * aplicadores» — el despliegue literal viaja por WhatsApp). Una línea por
 * cita en orden de hora, con lugar cuando se conoce; lo descubierto se
 * declara al final, nunca se omite.
 */
export function textoDelDespliegue(
  dia: DiaDeReparto,
  lugares?: ReadonlyMap<string, string>,
): string {
  // Los edificios del día en el encabezado (B51 en el chat): «A×3 J×2» es el
  // croquis que el equipo lee antes que la lista.
  const porEdificio = new Map<string, number>();
  const lineas = dia.asignaciones.map((a) => {
    const lugar = lugares?.get(a.codigo) ?? "";
    if (/^[A-ZÁÉÍÓÚ]{1,2}\d{2,4}$/i.test(lugar.trim())) {
      const letra = lugar.trim()[0].toUpperCase();
      porEdificio.set(letra, (porEdificio.get(letra) ?? 0) + 1);
    }
    const donde = lugar ? `${lugar} · ${a.codigo}` : a.codigo;
    // B71: la hora del recojo viaja por cita — es la hora a la que ESA
    // persona debe estar en la base, y la dice el motor (no se re-parsea).
    const recojo = a.recojo ? ` (recojo ${a.recojo})` : "";
    return `• ${a.inicio}${a.fin ? `–${a.fin}` : ""} ${donde} — ${a.aplicador}${recojo}`;
  });
  const edificios = [...porEdificio.entries()]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], "es"))
    .map(([letra, n]) => `${letra}×${n}`)
    .join(" ");
  const cola = dia.noCubiertos.length
    ? [`Sin nadie asignado: ${dia.noCubiertos.join(", ")}`]
    : [];
  // B71 (dictado 2026-09-03): el protocolo del despliegue va EN el aviso —
  // recojo de materiales a T−30 y salida al aula a T−15 no son folclore del
  // equipo, son parte del mensaje.
  const protocolo = dia.asignaciones.length
    ? ["Materiales se recogen 30 min antes; salida al aula 15 min antes de la hora pactada."]
    : [];
  return [
    `Despliegue ${dia.etiqueta}${edificios ? ` — pabellones ${edificios}` : ""}`,
    ...protocolo,
    ...lineas,
    ...cola,
  ].join("\n");
}

export type VeredictoDeEquidad = {
  /** Diferencia ≤ 1 cita entre quienes salen: lo más parejo que un reparto entero permite. */
  parejo: boolean;
  texto: string;
};

/**
 * B66 (dictado 2026-09-03: «no tengo ninguna forma de ver porque esto es
 * equitativo»): el rail listaba cifras y barras pero nunca DECÍA el veredicto.
 * Esta función lo dice: el rango de cargas entre quienes salen, la diferencia
 * máxima, y las dos causas legítimas de desbalance —quien queda libre porque
 * su disponibilidad no coincide, y lo fijado a mano que manda sobre el
 * automático— declaradas en la misma línea, no escondidas.
 *
 * El juicio corre SOLO entre aplicadores con carga: un cero no es inequidad
 * del motor (el greedy no puede darle a quien no está libre a esa hora); los
 * libres se cuentan aparte con su porqué.
 */
export function veredictoDeEquidad(r: RepartoVista): VeredictoDeEquidad | null {
  if (r.citas === 0 || r.equidad.length === 0) return null;
  const conCarga = r.equidad.filter((e) => e.asignadas > 0);
  if (conCarga.length === 0) return null;
  const min = conCarga.reduce((m, e) => Math.min(m, e.asignadas), Infinity);
  const max = conCarga.reduce((m, e) => Math.max(m, e.asignadas), 0);
  const dif = max - min;
  const libres = r.equidad.length - conCarga.length;
  const fijadas = r.dias.reduce(
    (n, d) => n + d.asignaciones.filter((a) => a.fijada).length,
    0,
  );

  const cita = (n: number) => (n === 1 ? "cita" : "citas");
  const base =
    dif === 0
      ? `Reparto parejo: cada quien lleva ${min} ${cita(min)}`
      : dif === 1
        ? `Reparto parejo: cargas entre ${min} y ${max} — diferencia máxima 1 cita`
        : `Cargas entre ${min} y ${max} — diferencia de ${dif} citas`;
  const colas: string[] = [];
  if (dif > 1) {
    colas.push(
      fijadas > 0
        ? "el desbalance viene de la disponibilidad y de lo fijado a mano"
        : "el desbalance viene de la disponibilidad de cada quien",
    );
  } else if (fijadas > 0) {
    colas.push(fijadas === 1 ? "1 fijada a mano incluida" : `${fijadas} fijadas a mano incluidas`);
  }
  if (libres > 0) {
    colas.push(
      `${libres} ${libres === 1 ? "queda libre" : "quedan libres"} — sin cita en sus horarios`,
    );
  }
  return { parejo: dif <= 1, texto: colas.length ? `${base} · ${colas.join(" · ")}` : base };
}

export function repartoDeAplicadores(
  crudo: MonitoreoAulasReparto | null | undefined,
): RepartoVista | null {
  if (crudo === null || crudo === undefined) return null;
  const raiz = crudo as unknown as Record<string, unknown>;

  let ilegibles = 0;
  const dias: DiaDeReparto[] = [];
  for (const diaCrudo of Array.isArray(raiz.dias) ? raiz.dias : []) {
    const d = (diaCrudo ?? {}) as Record<string, unknown>;
    const fecha = texto(d.fecha);
    if (!fecha) {
      ilegibles += 1;
      continue;
    }
    const asignaciones: AsignacionDeCita[] = [];
    for (const aCruda of Array.isArray(d.asignaciones) ? d.asignaciones : []) {
      const a = (aCruda ?? {}) as Record<string, unknown>;
      const codigo = texto(a.codigo);
      const aplicador = texto(a.aplicador);
      if (!codigo || !aplicador) {
        ilegibles += 1;
        continue;
      }
      const avisoCrudo = texto(a.advertencia);
      asignaciones.push({
        codigo,
        aplicador,
        inicio: texto(a.inicio),
        fin: texto(a.fin),
        recojo: texto(a.recojo),
        salida: texto(a.salida),
        fijada: uno(a.fijada) === true,
        // Lista cerrada del motor; un valor desconocido no se inventa lectura.
        advertencia:
          avisoCrudo === "sin_disponibilidad" || avisoCrudo === "se_solapa" ? avisoCrudo : "",
      });
    }
    dias.push({
      fecha,
      etiqueta: etiquetaDeFecha(fecha),
      asignaciones,
      noCubiertos: leerCodigos(d.no_cubiertos),
      porConfirmar: leerCodigos(d.por_confirmar),
    });
  }

  const equidad: CargaDeAplicador[] = [];
  for (const eCruda of Array.isArray(raiz.equidad) ? raiz.equidad : []) {
    const e = (eCruda ?? {}) as Record<string, unknown>;
    const aplicador = texto(e.aplicador);
    if (!aplicador) continue;
    equidad.push({ aplicador, asignadas: num(e.asignadas) ?? 0 });
  }

  return {
    dias,
    equidad,
    citas: dias.reduce((n, d) => n + d.asignaciones.length, 0),
    sinCubrir: dias.reduce((n, d) => n + d.noCubiertos.length, 0),
    porConfirmar: dias.reduce((n, d) => n + d.porConfirmar.length, 0),
    conCarga: equidad.filter((e) => e.asignadas > 0).length,
    cargaMax: equidad.reduce((m, e) => Math.max(m, e.asignadas), 0),
    ilegibles,
    fijadasSinCita: leerCodigos(raiz.fijadas_sin_cita),
    fijadas: new Map(
      (Array.isArray(raiz.fijadas) ? raiz.fijadas : [])
        .map((f) => {
          const e = (f ?? {}) as Record<string, unknown>;
          return [texto(e.codigo), texto(e.aplicador)] as const;
        })
        .filter(([c, a]) => c !== "" && a !== ""),
    ),
    duracionMin: num(raiz.duracion_min) ?? 0,
    preparacionMin: num(raiz.preparacion_min) ?? 0,
    fueraDeRango: (Array.isArray(raiz.fuera_de_rango) ? raiz.fuera_de_rango : [])
      .map((f) => {
        const e = (f ?? {}) as Record<string, unknown>;
        const fecha = texto(e.fecha);
        return {
          fecha,
          etiqueta: fecha ? etiquetaDeFecha(fecha) : "",
          codigos: leerCodigos(e.codigos),
          porConfirmar: leerCodigos(e.por_confirmar),
        };
      })
      .filter((f) => f.fecha !== ""),
    rango: (() => {
      const r = (raiz.rango ?? null) as Record<string, unknown> | null;
      if (!r) return null;
      const desde = texto(r.desde);
      const hasta = texto(r.hasta);
      return desde && hasta ? { desde, hasta } : null;
    })(),
  };
}
