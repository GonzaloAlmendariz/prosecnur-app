import type { MonitoreoAulasFranjas } from "../../../../api/monitoreo";
import { etiquetaDeFecha } from "./agendaPorDia";

/**
 * El modelo de vista del «Mapa de horas»: el bloque `franjas` del dashboard
 * convertido en geometría dibujable.
 *
 * El motor (`monitoreo_aulas_franjas.R`) ya hizo el trabajo duro: parseó las
 * horas AM/PM, armó las ventanas de veinte minutos, excluyó retiradas y contó
 * el pico por RANGO real. Aquí sólo se decide el eje horario de cada día y se
 * traducen minutos a porcentajes; recalcular cualquiera de esas reglas sería
 * tener dos dueños del mismo número.
 *
 * Defensivo en la frontera jsonlite —escalares envueltos en arrays de uno—
 * por el mismo motivo que `tiemposDeRespuesta`, y declarativo con lo roto:
 * una hora ilegible no se dibuja, pero se CUENTA (`ilegibles`), porque un
 * aula que se esfuma del mapa en silencio es la lista cerrada que se traga
 * filas.
 */

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

const bool = (v: unknown): boolean => {
  const crudo = uno(v);
  return crudo === true || crudo === "TRUE" || crudo === 1;
};

/** `"18:45"` → minutos desde medianoche, o `null` si no es una hora legible. */
export function minutosDeHora(hora: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hora);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

const comoHora = (minutos: number): string => {
  const h = Math.floor(minutos / 60) % 24;
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const pct = (x: number): number => Math.round(x * 100) / 100;

/** Margen del eje a cada lado de la primera y la última ventana. */
const MARGEN_MIN = 10;
/** El eje abre y cierra en una media hora redonda: se lee sin calcular. */
const REDONDEO_MIN = 30;

export type MapaVentana = {
  codigo: string;
  inicio: string;
  fin: string;
  confirmada: boolean;
  desdePct: number;
  anchoPct: number;
  /**
   * B71: el segmento de PREPARACIÓN (recojo de materiales + desplazamiento)
   * delante de la aplicación, solo en confirmadas y solo si el bloque trae
   * `preparacion_min`. La hora del recojo acompaña para el title.
   */
  prepDesdePct?: number;
  prepAnchoPct?: number;
  recojo?: string;
};

export type MapaMarca = { minuto: number; etiqueta: string; posPct: number };

export type MapaPico = {
  aulas: number;
  inicio: string;
  fin: string;
  desdePct: number;
  anchoPct: number;
};

export type MapaDia = {
  fecha: string;
  /** «Martes 08/09», la etiqueta de la casa. */
  etiqueta: string;
  ventanas: MapaVentana[];
  marcas: MapaMarca[];
  /** La banda dibujable del pico; `null` con cero confirmadas o franja rota. */
  pico: MapaPico | null;
  /** El número del pico se dice aunque la banda no se pueda dibujar. */
  picoAulas: number;
  porConfirmar: string[];
  /** Ventanas que llegaron con horas ilegibles: no se dibujan, se declaran. */
  ilegibles: number;
};

export type MapaDeHoras =
  | { disponible: false }
  | {
    disponible: true;
    dias: MapaDia[];
    /** El mayor pico del operativo: el número que dimensiona aplicadores. */
    picoMaximo: { aulas: number; fecha: string; etiqueta: string; inicio: string; fin: string } | null;
    /** De qué citas sale el pico («confirmadas», pin del motor). */
    personasFuente: string;
  };

type VentanaLegible = { codigo: string; iniMin: number; finMin: number; confirmada: boolean };

/** El paso entre marcas según cuánto eje hay que rotular. */
const pasoDeMarcas = (spanMin: number): number => {
  if (spanMin <= 120) return 30;
  if (spanMin <= 360) return 60;
  return 120;
};

export function mapaDeHoras(crudo: MonitoreoAulasFranjas | null | undefined): MapaDeHoras {
  if (crudo === null || crudo === undefined) return { disponible: false };
  const raiz = crudo as unknown as Record<string, unknown>;
  const diasCrudos = Array.isArray(raiz.dias) ? raiz.dias : [];
  // B71: minutos de preparación del eco del motor. Sin eco (payload viejo) es
  // 0 y el mapa dibuja como siempre — no se inventa protocolo.
  const prepCrudo = num(raiz.preparacion_min);
  const prepMin = prepCrudo !== null && prepCrudo > 0 ? prepCrudo : 0;

  const dias: MapaDia[] = [];
  for (const diaCrudo of diasCrudos) {
    const d = (diaCrudo ?? {}) as Record<string, unknown>;
    const fecha = texto(d.fecha);
    if (!fecha) continue;

    // Primera pasada: qué se puede dibujar y qué llegó roto.
    const legibles: VentanaLegible[] = [];
    let ilegibles = 0;
    const ventanasCrudas = Array.isArray(d.ventanas) ? d.ventanas : [];
    for (const vCruda of ventanasCrudas) {
      const v = (vCruda ?? {}) as Record<string, unknown>;
      const iniMin = minutosDeHora(texto(v.inicio));
      const finMin = minutosDeHora(texto(v.fin));
      if (iniMin === null || finMin === null || finMin <= iniMin) {
        ilegibles += 1;
        continue;
      }
      legibles.push({ codigo: texto(v.codigo), iniMin, finMin, confirmada: bool(v.confirmada) });
    }

    // El eje del día nace de SUS ventanas: margen y redondeo a la media hora.
    let ejeInicio = 0;
    let ejeFin = 0;
    let ventanas: MapaVentana[] = [];
    const marcas: MapaMarca[] = [];
    if (legibles.length) {
      // B71: el eje abre en el primer RECOJO, no en la primera aplicación —
      // la hora completa del aplicador es lo que el mapa promete enseñar.
      const inicioOcupado = (v: VentanaLegible) =>
        v.confirmada && prepMin > 0 ? Math.max(0, v.iniMin - prepMin) : v.iniMin;
      const minIni = Math.min(...legibles.map(inicioOcupado));
      const maxFin = Math.max(...legibles.map((v) => v.finMin));
      ejeInicio = Math.floor((minIni - MARGEN_MIN) / REDONDEO_MIN) * REDONDEO_MIN;
      ejeFin = Math.ceil((maxFin + MARGEN_MIN) / REDONDEO_MIN) * REDONDEO_MIN;
      const span = ejeFin - ejeInicio;
      const enEje = (minuto: number) => pct(((minuto - ejeInicio) / span) * 100);
      ventanas = legibles.map((v) => {
        const base: MapaVentana = {
          codigo: v.codigo,
          inicio: comoHora(v.iniMin),
          fin: comoHora(v.finMin),
          confirmada: v.confirmada,
          desdePct: enEje(v.iniMin),
          anchoPct: pct(((v.finMin - v.iniMin) / span) * 100),
        };
        if (v.confirmada && prepMin > 0) {
          const recojoMin = Math.max(0, v.iniMin - prepMin);
          base.prepDesdePct = enEje(recojoMin);
          base.prepAnchoPct = pct(((v.iniMin - recojoMin) / span) * 100);
          base.recojo = comoHora(recojoMin);
        }
        return base;
      });
      const paso = pasoDeMarcas(span);
      for (let m = Math.ceil(ejeInicio / paso) * paso; m <= ejeFin; m += paso) {
        marcas.push({ minuto: m, etiqueta: comoHora(m), posPct: enEje(m) });
      }
    }

    // El pico ya viene contado; aquí sólo se coloca. Con la franja rota o sin
    // eje, el número se conserva y la banda no se inventa.
    const picoCrudo = (uno(d.pico) ?? {}) as Record<string, unknown>;
    const picoAulas = num(picoCrudo.aulas) ?? 0;
    let pico: MapaPico | null = null;
    if (picoAulas > 0 && legibles.length) {
      const iniMin = minutosDeHora(texto(picoCrudo.inicio));
      const finMin = minutosDeHora(texto(picoCrudo.fin));
      if (iniMin !== null && finMin !== null && finMin > iniMin) {
        const span = ejeFin - ejeInicio;
        pico = {
          aulas: picoAulas,
          inicio: comoHora(iniMin),
          fin: comoHora(finMin),
          desdePct: pct(((iniMin - ejeInicio) / span) * 100),
          anchoPct: pct(((finMin - iniMin) / span) * 100),
        };
      }
    }

    const porConfirmar = (Array.isArray(d.por_confirmar) ? d.por_confirmar : [])
      .map((c) => texto(c))
      .filter(Boolean);

    dias.push({
      fecha,
      etiqueta: etiquetaDeFecha(fecha),
      ventanas,
      marcas,
      pico,
      picoAulas,
      porConfirmar,
      ilegibles,
    });
  }

  dias.sort((a, b) => a.fecha.localeCompare(b.fecha));

  // El mayor pico del operativo. En empate manda el día más temprano (los
  // días ya están ordenados), igual que el motor dentro de un día.
  let picoMaximo: Extract<MapaDeHoras, { disponible: true }>["picoMaximo"] = null;
  for (const d of dias) {
    if (d.picoAulas > 0 && (!picoMaximo || d.picoAulas > picoMaximo.aulas)) {
      picoMaximo = {
        aulas: d.picoAulas,
        fecha: d.fecha,
        etiqueta: d.etiqueta,
        inicio: d.pico?.inicio ?? "",
        fin: d.pico?.fin ?? "",
      };
    }
  }

  return {
    disponible: true,
    dias,
    picoMaximo,
    personasFuente: texto(raiz.personas_fuente),
  };
}
