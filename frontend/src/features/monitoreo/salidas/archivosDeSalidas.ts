// Los archivos que acompañan a cada entregable de Salidas (ADR 0133, fase 5).
// El principal lo entrega el contenedor del kit (el ZIP de Procesamiento, el de
// la evidencia, la plantilla del paquete operativo); éstos van a su pie como
// botones neutros. Puro: se prueba sin React ni red.

import type {
  MonitoreoProcessingHandoffResult,
  MonitoreoPublicationEvidencePackResult,
  MonitoreoTerritorialOperationalPackageReviewResult,
} from "../../../api/monitoreo";
import { archivosSueltos, type ArchivoSuelto } from "../entregas/modeloEntrega";

/** Las piezas del ZIP de Procesamiento, sueltas: la data y el XLSForm. */
export function archivosDelPaqueteDeProcesamiento(result?: MonitoreoProcessingHandoffResult | null): ArchivoSuelto[] {
  return archivosSueltos(result?.files, [["data_xlsx", "Data XLSX"], ["xlsform", "XLSForm"]]);
}

/** Los archivos directos de la evidencia de publicación (el ZIP es el entregable). */
export function archivosDeLaEvidencia(result?: MonitoreoPublicationEvidencePackResult | null): ArchivoSuelto[] {
  return archivosSueltos(result?.files, [
    ["operational_package_request_csv", "Solicitud CSV"],
    ["operational_package_request", "Solicitud JSON"],
    ["operational_package_status", "Diagnóstico"],
    ["publication_decision", "Decisión"],
  ]);
}

/** Lo que acompaña a la plantilla del paquete operativo: la revisión y el reporte. */
export function archivosDeLaRevisionOperativa(result?: MonitoreoTerritorialOperationalPackageReviewResult | null): ArchivoSuelto[] {
  return archivosSueltos(result?.files, [["review_csv", "Revisión CSV"], ["report_json", "Reporte JSON"], ["report_md", "Reporte MD"]]);
}

/** La plantilla del paquete operativo, como la lee el kit (en la raíz); null si no llegó. */
export function plantillaDeLaRevisionOperativa(result?: MonitoreoTerritorialOperationalPackageReviewResult | null): Record<string, unknown> | null {
  const plantilla = result?.files?.template;
  return plantilla?.file_id ? { ...plantilla } : null;
}
