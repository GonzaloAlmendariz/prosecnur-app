import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { criteriosDesdeFiltro } from "../../../filtroEfectiva/criterios";
import { avisosDelNumerador, filasDeBloque } from "../navegacion/bloques";
import { rotuloDelSegmento, variableDeCuotas, variablesConMeta } from "../segmentoDeCuotas";
import { origenDeEfectivas } from "./origenDeEfectivas";
import { caracterDeclarado, estadoDeCuotaDesde } from "../../../core/caracterDeCuota";
import { normalizeSourceMatch } from "../formato";
import { cadenaDeLaCifra, construirCuotasFaltante, type CuotaDeEntrada } from "./cuotasFaltanteModel";

function numero(valor: unknown): number {
  const n = Number(String(valor ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normal(valor: unknown) {
  return String(valor ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * «No barrido» sin responsable, de `no_barridos_responsable`. El motor rotula
 * esa fila «Sin responsable»; si el bloque no viaja, `null` (no cero).
 */
export function sinAsignarDesdeBloque(filas: ReadonlyArray<Record<string, unknown>>): number | null {
  if (!filas.length) return null;
  return filas
    .filter((fila) => ["sin responsable", "sin asignar", ""].includes(normal(fila.Responsable)))
    .reduce((suma, fila) => suma + numero(fila["No barridos"]), 0);
}

/**
 * El carácter de cada cuota (ADR 0126) desde las filas del motor. Se cruza por
 * VARIABLE y valor con la misma clave de la tarjeta (`phone-quota-<variable>-<valor>`):
 * el bloque trae varias variables y un «Sí» de una no es el «Sí» de otra.
 * Manda la fila «Total» (la meta global). Una referencial declarada trae su
 * número en `Referencia`. Sin columna `Caracter` (un corte anterior), la cuota
 * sigue la regla por defecto en el modelo.
 */
export function conCaracter(cuotas: readonly CuotaDeEntrada[], filas: ReadonlyArray<Record<string, unknown>>): CuotaDeEntrada[] {
  const porClave = new Map<string, Record<string, unknown>>();
  for (const fila of filas) {
    const clave = `phone-quota-${normalizeSourceMatch(fila.Variable)}-${normalizeSourceMatch(fila.Valor)}`;
    if (porClave.has(clave) && !["total", "todos"].includes(normal(fila.Actor))) continue;
    porClave.set(clave, fila);
  }
  return cuotas.map((cuota) => {
    const fila = porClave.get(cuota.id);
    if (!fila) return cuota;
    const referencia = Number(fila.Referencia);
    return {
      ...cuota,
      caracter: caracterDeclarado(fila.Caracter),
      estadoCuota: estadoDeCuotaDesde(fila.estado_cuota),
      referencia: Number.isFinite(referencia) && referencia > 0 ? referencia : null,
    };
  });
}

/** Lo que Avance › Cuotas necesita del corte, armado desde los bloques que ya existen. */
export function entradaDeCuotasFaltante(
  reports: MonitoreoAcreditacionReports,
  state: MonitoreoState | null | undefined,
  cuotas: readonly CuotaDeEntrada[],
  /** La variable que eligió el usuario (R5 paso 2); sin ella, la regla de `variableDeCuotas`. */
  elegida?: string | null,
) {
  const filasDeCuota = filasDeBloque(reports, ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]);
  const segmento = variableDeCuotas(filasDeCuota.map((fila) => ({ variable: fila.Variable, meta: fila.Meta })), "Cuota", elegida);
  const conMeta = variablesConMeta(filasDeCuota.map((fila) => ({ variable: fila.Variable, meta: fila.Meta })));
  const porDefecto = variableDeCuotas(filasDeCuota.map((fila) => ({ variable: fila.Variable, meta: fila.Meta })), "Cuota");
  const modelo = {
    ...construirCuotasFaltante({
      cuotas: conCaracter(cuotas, filasDeCuota),
      segmento: rotuloDelSegmento(segmento),
      sinAsignar: sinAsignarDesdeBloque(filasDeBloque(reports, ["no_barridos_responsable"])),
    }),
    origen: origenDeEfectivas(filasDeCuota),
    avisos: avisosDelNumerador(reports),
    otrasConMeta: conMeta
      .filter((otra) => otra.variable !== segmento)
      .map((otra) => `${rotuloDelSegmento(otra.variable).toLocaleLowerCase("es")} (${otra.metas})`),
    // R5 paso 2: con metas en más de una variable, se elige cuál ver; con una sola, no hay selector.
    selector: conMeta.length > 1 ? {
      actual: segmento,
      porDefecto,
      // La de siempre va primera: es la que se ve sin elegir.
      opciones: [...conMeta]
        .sort((a, b) => Number(b.variable === porDefecto) - Number(a.variable === porDefecto))
        .map((opcion) => ({ clave: opcion.variable, rotulo: rotuloDelSegmento(opcion.variable), metas: opcion.metas })),
    } : null,
  };

  const fuentesKobo = new Set((state?.sources ?? []).filter((fuente) => fuente.enabled && fuente.kind === "kobo").map((fuente) => fuente.id));
  const encuestas = Object.values(state?.source_metadata?.surveys ?? {}).filter((encuesta) => fuentesKobo.has(encuesta.source_id));
  const recibidas = encuestas.reduce((suma, encuesta) => suma + (Number(encuesta.response_count) || 0), 0);
  const criterios = criteriosDesdeFiltro(state?.config?.monitoreo_profile?.platform_effective_filter)
    .map((criterio) => `${criterio.label || criterio.variable}: ${criterio.value_label || criterio.values.join(" o ")}`)
    .join(" y ");
  const tiempos = filasDeBloque(reports, ["control_tiempo_kobo", "tiempos_kobo", "validacion_tiempos"]);

  return {
    modelo,
    cadena: cadenaDeLaCifra({
      recibidas: recibidas || null,
      encuesta: encuestas.map((encuesta) => encuesta.title || encuesta.label || "").filter(Boolean).join(" y "),
      pasanFiltro: tiempos.length || null,
      criterios: criterios || "Filtro de efectiva sin declarar",
      unicas: modelo.total.efectivas,
    }),
  };
}
