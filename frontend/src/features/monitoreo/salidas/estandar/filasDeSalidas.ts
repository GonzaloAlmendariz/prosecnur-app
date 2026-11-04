// Las filas de «Salidas del corte», iguales en los cuatro modos de Monitoreo (estándar de Salidas, 4 nov 2026,
// decidido por coordinación a pedido de Gonzalo: «¿no se pueden estandarizar en el mejor?»). Se derivan de lo
// mismo que lee el motor de salidas (`MonitoreoOutputsWorkbench`): el corte, su readiness y las dos últimas
// publicaciones del Sheets. No calculan nada que el motor no sepa.

import type { MonitoreoLastSheetsPublication } from "../../../../api/monitoreo";
import type { ChromeStatusTone } from "../../../../components/ModuleCommandBar";
import { readinessDeSalidas, type MonitoreoCorte } from "../../corte/corteContract";
import { PDF_POR_FAMILIA } from "../MonitoreoOutputsWorkbench";

export type FamiliaDeSalidas = keyof typeof PDF_POR_FAMILIA;

export type ClaveDeSalida = "pdf-cliente" | "pdf-produccion" | "sheets-cliente" | "sheets-interno" | "base-final";

export type FilaDeSalida = {
  clave: ClaveDeSalida | string;
  titulo: string;
  estado: string;
  tono: ChromeStatusTone;
  detalle: string;
};

const PDF_CLIENTE: Record<FamiliaDeSalidas, string> = {
  acreditacion: "PDF ejecutivo",
  territorial: "PDF de avance territorial",
  telefonico: "PDF de avance telefónico",
  aulas: "PDF de avance",
};

const PRODUCCION: Record<FamiliaDeSalidas, string> = {
  acreditacion: "por responsable o recopilador",
  territorial: "por encuestador",
  telefonico: "por responsable, con sus estados de llamada",
  aulas: "por aplicador",
};

function fecha(iso?: string): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" });
}

function filaDeSheets(clave: ClaveDeSalida, titulo: string, publicacion: MonitoreoLastSheetsPublication | null | undefined, puede: boolean, quien: string): FilaDeSalida {
  if (publicacion?.spreadsheet_id) {
    const cuando = fecha(publicacion.updated_at);
    return {
      clave, titulo,
      estado: cuando ? `Publicada el ${cuando}` : "Publicada",
      tono: "success",
      detalle: `${quien}. Se actualiza con la revisión de cambios antes de escribir.`,
    };
  }
  return {
    clave, titulo,
    estado: puede ? "Sin publicar" : "Bloqueada",
    tono: puede ? "neutral" : "warn",
    detalle: `${quien}. Todavía no tiene destino publicado.`,
  };
}

export function filasDeSalidas({ familia, corte, clientSheets, internalSheets }: {
  familia: FamiliaDeSalidas;
  corte: MonitoreoCorte;
  clientSheets?: MonitoreoLastSheetsPublication | null;
  internalSheets?: MonitoreoLastSheetsPublication | null;
}): FilaDeSalida[] {
  const readiness = readinessDeSalidas(corte);
  const puede = readiness.puedePublicarCliente;
  const conCorte = corte.hasSnapshot;
  const pdf = PDF_POR_FAMILIA[familia];
  const filas: FilaDeSalida[] = [];
  if (pdf.client) {
    filas.push({
      clave: "pdf-cliente",
      titulo: PDF_CLIENTE[familia],
      estado: puede ? "Listo para generar" : "Bloqueado",
      tono: puede ? "info" : "warn",
      detalle: puede ? "El avance del corte vigente, como lo recibe el cliente." : (readiness.bloqueos[0]?.mensaje ?? "El corte todavía no puede salir a cliente."),
    });
  }
  if (pdf.production) {
    filas.push({
      clave: "pdf-produccion",
      titulo: "Producción",
      estado: conCorte ? "Disponible" : "Sin corte",
      tono: conCorte ? "neutral" : "warn",
      detalle: `Para el equipo: respuestas del corte ${PRODUCCION[familia]}.`,
    });
  }
  filas.push(filaDeSheets("sheets-cliente", "Sheets del cliente", clientSheets, puede, "Tablas ejecutivas, sin trazabilidad sensible"));
  filas.push(filaDeSheets("sheets-interno", "Sheets interno", internalSheets, conCorte, "Tablas del equipo con los datos operativos completos"));
  filas.push({
    clave: "base-final",
    titulo: "Base final",
    estado: conCorte ? "Disponible" : "Sin corte",
    tono: conCorte ? "neutral" : "warn",
    detalle: "La base del corte para Procesamiento, con su paquete.",
  });
  return filas;
}
