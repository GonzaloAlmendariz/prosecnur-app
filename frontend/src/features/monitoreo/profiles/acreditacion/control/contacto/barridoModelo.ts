/**
 * Control › Barrido de acreditación (ficha Ctl2): cuánto del padrón se llamó
 * y con qué resultado. Modelo puro sobre los bloques de la hoja telefónica:
 * `resumen_telefonico`, `estatus_telefonico`, `estatus_dia` y
 * `operacion_responsable`. Las familias de status salen del vocabulario del
 * proyecto con el clasificador del telefónico (`familiasDelCliente`), el
 * mismo emparejamiento que el motor.
 *
 * Realismo operativo: la hoja guarda solo la fecha del último intento de
 * cada caso, así que la serie diaria es «casos por fecha de su último
 * intento», no barridos por día. Las fechas se normalizan antes de agrupar
 * («1/07/2026» y «2026-07-01» son el mismo día, H2).
 */

import type { MonitoreoAcreditacionReports, MonitoreoStateRule } from "../../../../../../api/client";
import { filasDeBloque } from "../../../telefonico/navegacion/bloques";
import { fechaDeColumna } from "../../../telefonico/control/barridoModel";
import { clasificadorDeStatus, type FamiliaDelCliente } from "../../../telefonico/control/familiasDelCliente";

type Fila = Record<string, unknown>;

function texto(valor: unknown) {
  return valor == null ? "" : String(valor).trim();
}

function numero(valor: unknown): number {
  const n = Number(texto(valor).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normal(valor: unknown) {
  return texto(valor).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Rótulos de familia en la voz de la acreditación (lienzo Ctl2). */
export const ROTULO_DE_FAMILIA: Record<FamiliaDelCliente, string> = {
  efectiva: "Efectiva al teléfono",
  parcial: "Parcial",
  rechazo: "Rechazo",
  reintentable: "Reintentable",
  terminal: "Cerrado sin efectiva",
  "sin-llamar": "No barrido",
};

const ORDEN: FamiliaDelCliente[] = ["efectiva", "reintentable", "terminal", "rechazo", "parcial", "sin-llamar"];

export type FamiliaDeBarrido = {
  familia: FamiliaDelCliente;
  etiqueta: string;
  total: number;
  items: Array<{ status: string; casos: number; conRegla: boolean }>;
};

export type DiaDeBarrido = { fecha: string; barridos: number; efectivos: number };

export type ModeloDeBarrido = {
  padron: number;
  barridos: number;
  efectivosAlTelefono: number;
  /** Efectivas al teléfono que también son completas en la plataforma. */
  conciliadas: number | null;
  soloTelefono: number | null;
  soloPlataforma: number | null;
  familias: FamiliaDeBarrido[];
  porFecha: DiaDeBarrido[];
  /** Casos barridos sin fecha o con una fecha que no se lee. */
  sinFecha: { barridos: number; efectivos: number };
  publicos: string[];
};

function suma(filas: readonly Fila[], columna: string): number | null {
  if (!filas.length || !filas.some((fila) => columna in fila)) return null;
  return filas.reduce((total, fila) => total + numero(fila[columna]), 0);
}

export function construirBarridoDeAcreditacion(
  reports: MonitoreoAcreditacionReports | null | undefined,
  reglas: readonly MonitoreoStateRule[],
): ModeloDeBarrido {
  const clasificar = clasificadorDeStatus(reglas);
  const resumen = filasDeBloque(reports, ["resumen_telefonico"]);
  const valor = (indicador: string) => {
    const fila = resumen.find((item) => normal(item.Indicador) === indicador);
    return fila ? numero(fila.Casos) : null;
  };

  const grupos = new Map<FamiliaDelCliente, FamiliaDeBarrido>();
  filasDeBloque(reports, ["estatus_telefonico"]).forEach((fila) => {
    const status = texto(fila.Estatus ?? fila.Estado);
    const casos = numero(fila.Casos);
    if (!status || !casos) return;
    const { familia, conRegla } = clasificar(status);
    const grupo = grupos.get(familia) ?? { familia, etiqueta: ROTULO_DE_FAMILIA[familia], total: 0, items: [] };
    grupo.total += casos;
    grupo.items.push({ status, casos, conRegla });
    grupos.set(familia, grupo);
  });
  const familias = ORDEN
    .map((familia) => grupos.get(familia))
    .filter((grupo): grupo is FamiliaDeBarrido => Boolean(grupo))
    .map((grupo) => ({ ...grupo, items: [...grupo.items].sort((a, b) => b.casos - a.casos) }));
  const totalDe = (familia: FamiliaDelCliente) => grupos.get(familia)?.total ?? 0;

  const porDia = new Map<string, DiaDeBarrido>();
  const sinFecha = { barridos: 0, efectivos: 0 };
  filasDeBloque(reports, ["estatus_dia"]).forEach((fila) => {
    const { familia } = clasificar(texto(fila.Estado));
    if (familia === "sin-llamar") return;
    Object.entries(fila).forEach(([columna, crudo]) => {
      if (columna === "Estado" || columna === "Total" || columna.startsWith("_")) return;
      const casos = numero(crudo);
      if (!casos) return;
      const iso = fechaDeColumna(columna);
      const destino = iso ? (porDia.get(iso) ?? { fecha: iso, barridos: 0, efectivos: 0 }) : null;
      if (destino) {
        destino.barridos += casos;
        if (familia === "efectiva") destino.efectivos += casos;
        porDia.set(destino.fecha, destino);
      } else {
        sinFecha.barridos += casos;
        if (familia === "efectiva") sinFecha.efectivos += casos;
      }
    });
  });

  // Una fecha de otro año que el grueso de la hoja (un año tecleado por error)
  // va con las que no tienen fecha, como en el barrido del telefónico.
  const porAnio = new Map<string, number>();
  porDia.forEach((dia) => porAnio.set(dia.fecha.slice(0, 4), (porAnio.get(dia.fecha.slice(0, 4)) ?? 0) + dia.barridos));
  const anio = [...porAnio.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  porDia.forEach((dia, clave) => {
    if (dia.fecha.slice(0, 4) === anio) return;
    sinFecha.barridos += dia.barridos;
    sinFecha.efectivos += dia.efectivos;
    porDia.delete(clave);
  });

  const operacion = filasDeBloque(reports, ["operacion_responsable"]);
  const padron = valor("total telefonico") ?? familias.reduce((total, grupo) => total + grupo.total, 0);
  return {
    padron,
    barridos: valor("casos barridos") ?? Math.max(0, padron - totalDe("sin-llamar")),
    efectivosAlTelefono: totalDe("efectiva"),
    conciliadas: suma(operacion, "Conciliadas") ?? suma(operacion, "Conciliadas por CodPulso"),
    soloTelefono: suma(operacion, "Tel. efectiva sin plataforma completa"),
    soloPlataforma: suma(operacion, "Plataforma completa sin tel. efectiva"),
    familias,
    porFecha: [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    sinFecha,
    publicos: [...new Set(operacion.map((fila) => texto(fila.Actor)).filter(Boolean))],
  };
}

/** Acumulado de casos barridos por fecha de su último intento. */
export function barridosAcumulados(porFecha: readonly DiaDeBarrido[]) {
  let total = 0;
  return porFecha.map((dia) => {
    total += dia.barridos;
    return { fecha: dia.fecha, efectivas: dia.barridos, acumulado: total };
  });
}
