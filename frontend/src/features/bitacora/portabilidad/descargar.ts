// Descarga del mapa del estudio (ADR 0047).

import { apiBitacoraExportar } from "../../../api/bitacora";
import { toast } from "../../../components/toasterStore";

/**
 * Baja el grafo completo como un `.json` con nombre fechado.
 *
 * El archivo va al disco del usuario, no al `.pulso`: los entregables se
 * exportan al lado del proyecto, nunca adentro. Y el nombre lleva la fecha
 * porque dos exportaciones del mismo estudio en días distintos son cosas
 * distintas — sin fecha, la segunda pisa la primera en la carpeta de descargas.
 */
export async function descargarMapaDelEstudio(): Promise<void> {
  try {
    const doc = await apiBitacoraExportar();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `mapa-del-estudio-${(doc.exported_at || "").slice(0, 10) || "sin-fecha"}.json`;
    a.click();
    URL.revokeObjectURL(url);

    const total =
      doc.plan.tasks.length + doc.bitacora.length + doc.canvas.canvases.length;
    toast.exito("Mapa exportado", { detalle: `${total} elementos en ${a.download}.` });
  } catch (e) {
    toast.error("No se pudo exportar", {
      detalle: e instanceof Error ? e.message : "Error desconocido.",
    });
  }
}
