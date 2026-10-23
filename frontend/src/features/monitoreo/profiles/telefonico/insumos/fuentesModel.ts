/**
 * Insumos › Fuentes del telefónico: qué se lee y de dónde.
 *
 * Una fila por fuente conectada, con el papel que cumple en el contrato
 * telefónico (universo, barrido, respuestas), su servicio, volumen y última
 * lectura; y las columnas que cada pieza espera, con la que la fuente declara
 * si la declara. No se inventa validación: el corte no publica qué trae cada
 * columna de la hoja.
 */

import type { MonitoreoSource, MonitoreoState } from "../../../../../api/client";
import { nombreDeFuente, servicioDeFuente } from "../../../fuentes/enlacesDeFuente";
import type { AcreditacionPhoneSourceContract } from "../TelefonicoSourcesModel";
import { acreditacionSourceResponseCount } from "../TelefonicoSourcesModel";
import { sourceRowCount, sourceSheetField, sourceSyncLabel } from "../fuentes/camposDeFuente";
import { rotuloDeDato } from "./rotulosDeColumna";

export type FilaDeFuente = {
  id: string;
  nombre: string;
  etiqueta: string;
  papel: string;
  servicio: string;
  detalle: string;
  volumen: number;
  unidad: "filas" | "envíos";
  leida: string;
  activa: boolean;
};

const NOMBRE_DE_PIEZA = { universo: "Universo", barrido: "Barrido", plataforma: "Respuestas" } as const;

/** Papel de cada fuente según el contrato: una hoja puede ser universo y barrido a la vez. */
export function papelesDeFuente(contrato: AcreditacionPhoneSourceContract): Map<string, string[]> {
  const papeles = new Map<string, string[]>();
  ([["universo", contrato.universe], ["barrido", contrato.sweep], ["plataforma", contrato.platform]] as const).forEach(([clave, slot]) => {
    slot.sources.forEach((fuente) => {
      papeles.set(fuente.id, [...(papeles.get(fuente.id) ?? []), NOMBRE_DE_PIEZA[clave]]);
    });
  });
  return papeles;
}

function unirPapeles(papeles: string[]) {
  if (!papeles.length) return "Sin papel en el corte";
  if (papeles.length === 1) return papeles[0];
  return `${papeles.slice(0, -1).join(", ")} y ${papeles[papeles.length - 1].toLowerCase()}`;
}

export function filasDeFuentes(fuentes: readonly MonitoreoSource[], contrato: AcreditacionPhoneSourceContract): FilaDeFuente[] {
  const papeles = papelesDeFuente(contrato);
  const orden = (fuente: MonitoreoSource) => (fuente.enabled ? 0 : 2) + (fuente.kind === "google_sheets" ? 0 : 1);
  return [...fuentes]
    .sort((a, b) => orden(a) - orden(b))
    .map((fuente) => {
      const esHoja = fuente.kind === "google_sheets";
      const pestana = esHoja ? sourceSheetField(fuente, "sheet_name") : "";
      const rango = esHoja ? sourceSheetField(fuente, "range") : "";
      return {
        id: fuente.id,
        nombre: nombreDeFuente(fuente),
        etiqueta: fuente.label,
        papel: unirPapeles(papeles.get(fuente.id) ?? []),
        servicio: servicioDeFuente(fuente),
        detalle: esHoja
          ? [pestana ? `pestaña ${pestana}` : "", rango ? `rango ${rango.replace(/^[^!]*!/, "")}` : ""].filter(Boolean).join(", ")
          : String(fuente.survey_title ?? "").trim(),
        volumen: esHoja ? sourceRowCount(fuente) : acreditacionSourceResponseCount(fuente),
        unidad: esHoja ? "filas" : "envíos",
        leida: sourceSyncLabel(fuente),
        activa: fuente.enabled,
      };
    });
}

export type ColumnaQueSeLee = {
  pieza: string;
  /** Clave interna del dato (no se muestra). */
  dato: string;
  /** Lo que se pinta. */
  rotulo: string;
  columna: string;
  declarada: boolean;
};

/**
 * Las columnas que cada pieza espera, con la que la fuente declara en sus
 * dimensiones cuando la declara; si no, se busca por nombre. La llave va
 * primero, con su primera columna candidata.
 */
export function columnasQueSeLeen(contrato: AcreditacionPhoneSourceContract, state: MonitoreoState | null | undefined): ColumnaQueSeLee[] {
  const filas: ColumnaQueSeLee[] = [];
  const llave = state?.config?.monitoreo_profile?.key_rules;
  if (llave?.universe_fields?.length) {
    filas.push({ pieza: "Universo y barrido", dato: "llave", rotulo: rotuloDeDato("llave") ?? "Llave del caso", columna: String(llave.universe_fields[0]), declarada: true });
  }
  ([["Universo", contrato.universe], ["Barrido", contrato.sweep], ["Respuestas", contrato.platform]] as const).forEach(([pieza, slot]) => {
    const dimensiones = new Map<string, string>();
    slot.sources.filter((fuente) => fuente.enabled).forEach((fuente) => {
      Object.entries(fuente.dimensions ?? {}).forEach(([clave, valor]) => {
        if (String(valor ?? "").trim()) dimensiones.set(clave.toLowerCase(), String(valor).trim());
      });
    });
    slot.expected.forEach((dato) => {
      const declarada = dimensiones.get(dato.toLowerCase());
      filas.push({ pieza, dato, rotulo: rotuloDeDato(dato) ?? dato, columna: declarada ?? "", declarada: Boolean(declarada) });
    });
  });
  return filas;
}
