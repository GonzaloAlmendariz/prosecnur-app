/**
 * Control › Equipo de acreditación (ficha Ctl4): cómo rinde cada responsable
 * del barrido. Modelo puro sobre `operacion_responsable` (carga, barridos,
 * efectivas al teléfono y conciliadas), `estatus_responsable` (estado de sus
 * casos por familia, con el vocabulario del proyecto) e
 * `insistencia_no_contesta`. Las alertas usan los umbrales del perfil
 * (`monitoreo_profile.alerts`), los mismos del motor.
 *
 * «Sin asignar» va aparte y en gris: aún no está asignado y no es atraso
 * (procedimientos respondidos).
 */

import type { MonitoreoAcreditacionReports, MonitoreoStateRule } from "../../../../../../api/client";
import { filasDeBloque } from "../../../telefonico/navegacion/bloques";
import { clasificadorDeStatus, type FamiliaDelCliente } from "../../../telefonico/control/familiasDelCliente";

type Fila = Record<string, unknown>;

function texto(valor: unknown) {
  return valor == null ? "" : String(valor).trim();
}

function numero(valor: unknown): number {
  const n = Number(texto(valor).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function esSinAsignar(nombre: string) {
  return ["", "sin responsable", "sin asignar"].includes(nombre.toLowerCase());
}

export type ResponsableDelEquipo = {
  nombre: string;
  sinAsignar: boolean;
  asignados: number;
  barridos: number;
  efectivas: number;
  conciliadas: number | null;
  sinBarrer: number;
  pctSinBarrer: number | null;
  /** Barridos que no terminaron en efectiva, sobre los barridos. */
  pctIncidencias: number | null;
  /** Efectivas sobre asignados: el eje vertical de «Carga frente a efectividad». */
  efectividad: number | null;
  familias: Partial<Record<FamiliaDelCliente, number>>;
};

export type AlertaDelEquipo = { clave: string; texto: string; casos: number; tono: "atencion" | "informa" };

export type ModeloDeEquipo = {
  responsables: ResponsableDelEquipo[];
  total: { asignados: number; barridos: number; efectivas: number; sinAsignar: number };
  maximaCarga: number;
  alertas: AlertaDelEquipo[];
  publicos: string[];
};

export type UmbralesDelEquipo = {
  /** Mínimo de casos sin barrer para alertar (motor: 20). */
  sinBarrerMinimo: number;
  /** Proporción sin barrer para alertar, de 0 a 1 (motor: 0.5). */
  sinBarrerProporcion: number;
  /** Intentos promedio desde los que «no contesta» es mucha insistencia (motor: 4). */
  intentosNoContesta: number;
};

export function umbralesDelPerfil(alertas: Record<string, number> | null | undefined): UmbralesDelEquipo {
  const valor = (clave: string, porDefecto: number) => {
    const n = Number(alertas?.[clave]);
    return Number.isFinite(n) ? n : porDefecto;
  };
  return {
    sinBarrerMinimo: valor("no_sweep_min_cases", 20),
    sinBarrerProporcion: valor("no_sweep_pct", 0.5),
    intentosNoContesta: valor("no_answer_min_attempts", 4),
  };
}

const UNA_DECIMAL = (valor: number) => valor.toLocaleString("es-PE", { maximumFractionDigits: 1 });

export function construirEquipo(
  reports: MonitoreoAcreditacionReports | null | undefined,
  reglas: readonly MonitoreoStateRule[],
  umbrales: UmbralesDelEquipo,
): ModeloDeEquipo {
  const clasificar = clasificadorDeStatus(reglas);
  const operacion = filasDeBloque(reports, ["operacion_responsable"]);
  const porNombre = new Map<string, ResponsableDelEquipo & { conciliadasVistas: boolean }>();
  const fila = (crudo: string) => {
    const nombre = esSinAsignar(crudo) ? "Sin asignar" : crudo;
    const previo = porNombre.get(nombre);
    if (previo) return previo;
    const nuevo: ResponsableDelEquipo & { conciliadasVistas: boolean } = {
      nombre, sinAsignar: esSinAsignar(crudo), asignados: 0, barridos: 0, efectivas: 0, conciliadas: 0,
      sinBarrer: 0, pctSinBarrer: null, pctIncidencias: null, efectividad: null, familias: {}, conciliadasVistas: false,
    };
    porNombre.set(nombre, nuevo);
    return nuevo;
  };
  operacion.forEach((item) => {
    const destino = fila(texto(item.Responsable));
    destino.asignados += numero(item["Casos asignados"]);
    destino.barridos += numero(item.Barridos);
    destino.sinBarrer += numero(item["No barridos"]);
    destino.efectivas += numero(item["Efectivas telefónicas"] ?? item.Efectivas);
    if ("Conciliadas" in item) {
      destino.conciliadas = (destino.conciliadas ?? 0) + numero(item.Conciliadas);
      destino.conciliadasVistas = true;
    }
  });
  filasDeBloque(reports, ["estatus_responsable"]).forEach((item) => {
    const destino = fila(texto(item.Responsable));
    const { familia } = clasificar(texto(item.Estado ?? item.Estatus));
    destino.familias[familia] = (destino.familias[familia] ?? 0) + numero(item.Casos);
  });

  const responsables = [...porNombre.values()].map(({ conciliadasVistas, ...item }) => ({
    ...item,
    conciliadas: conciliadasVistas ? item.conciliadas : null,
    pctSinBarrer: item.asignados > 0 ? item.sinBarrer / item.asignados : null,
    pctIncidencias: item.barridos > 0 ? (item.barridos - item.efectivas) / item.barridos : null,
    efectividad: item.asignados > 0 ? item.efectivas / item.asignados : null,
  })).sort((a, b) => Number(a.sinAsignar) - Number(b.sinAsignar) || b.asignados - a.asignados || a.nombre.localeCompare(b.nombre, "es"));

  const alertas: AlertaDelEquipo[] = [];
  responsables.filter((item) => !item.sinAsignar && item.sinBarrer > 0).forEach((item) => {
    const proporcion = item.pctSinBarrer ?? 0;
    if (item.sinBarrer >= umbrales.sinBarrerMinimo || proporcion >= umbrales.sinBarrerProporcion) {
      alertas.push({
        clave: `sin-barrer-${item.nombre}`,
        texto: `${item.nombre} tiene el ${Math.round(proporcion * 100)} % de sus casos sin barrer`,
        casos: item.sinBarrer,
        tono: "atencion",
      });
    }
  });
  filasDeBloque(reports, ["insistencia_no_contesta"]).forEach((item) => {
    const promedio = numero(item["Promedio intentos"]);
    const casos = numero(item["Casos No contesta"]);
    if (!casos || promedio < umbrales.intentosNoContesta) return;
    const nombre = texto(item.Responsable) || "Sin asignar";
    alertas.push({
      clave: `no-contesta-${nombre}`,
      texto: `${nombre} tiene ${casos.toLocaleString("es-PE")} casos sin contestar, con ${UNA_DECIMAL(promedio)} intentos en promedio`,
      casos,
      tono: "atencion",
    });
  });
  const sinAsignar = responsables.find((item) => item.sinAsignar);
  const libres = sinAsignar ? sinAsignar.asignados : 0;
  if (libres > 0) {
    alertas.push({ clave: "sin-asignar", texto: "Casos sin asignar todavía; no cuentan como atraso", casos: libres, tono: "informa" });
  }

  return {
    responsables,
    total: {
      asignados: responsables.reduce((suma, item) => suma + item.asignados, 0),
      barridos: responsables.reduce((suma, item) => suma + item.barridos, 0),
      efectivas: responsables.reduce((suma, item) => suma + item.efectivas, 0),
      sinAsignar: libres,
    },
    maximaCarga: Math.max(1, ...responsables.map((item) => item.asignados)),
    alertas: [...alertas.filter((item) => item.tono === "atencion").sort((a, b) => b.casos - a.casos), ...alertas.filter((item) => item.tono === "informa")],
    publicos: [...new Set(operacion.map((item) => texto(item.Actor)).filter(Boolean))],
  };
}
