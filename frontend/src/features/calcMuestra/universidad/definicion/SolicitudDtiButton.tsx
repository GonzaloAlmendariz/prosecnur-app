/**
 * Botón "Exportar solicitud para DTI (XLSX)": el Excel de estructura de
 * variables esperadas + criterios de la reunión del diseño muestral en
 * bullets, listo para adjuntar al correo con el que se pide la base. El
 * payload es puro (solicitudDti.ts); el motor registra el archivo y la
 * entrega va por el kit de entregables (ADR 0133, forma bloque): el botón sólo
 * se deshabilita y el contenedor muestra la espera, el archivo o el fallo.
 */
import { FileSpreadsheet } from "lucide-react";
import { apiCalcMuestraSolicitudDtiExportar } from "../../../../api/calcMuestra";
import { ContenedorEntregable } from "../../../../components/entregables/ContenedorEntregable";
import { useGeneracion } from "../../../../components/entregables/useGeneracion";
import { MODULO_CALC_MUESTRA } from "../../entregas/modeloEntrega";
import { solicitudDtiPayload } from "./solicitudDti";

export function SolicitudDtiButton() {
  const gen = useGeneracion({ titulo: "Solicitud de base para DTI", modulo: MODULO_CALC_MUESTRA, formato: "xlsx", articulo: "la" });
  return (
    <div className="cmv2-defi-dti">
      <button
        type="button"
        className="cmv2-defi-dti-btn"
        onClick={() => { void gen.ejecutar(() => apiCalcMuestraSolicitudDtiExportar(solicitudDtiPayload())); }}
        disabled={gen.estado.fase === "en_curso"}
        title="Excel de estructura + criterios en bullets para el correo a DTI"
      >
        <FileSpreadsheet size={14} aria-hidden="true" />
        Exportar solicitud para DTI (XLSX)
      </button>
      <span className="cmv2-defi-dti-hint">
        ¿Aún no tienes la base? Este Excel lista las columnas esperadas por hoja y los criterios
        acordados, para pedirla con el formato correcto.
      </span>
      <ContenedorEntregable estado={gen.estado} forma="bloque" onCerrar={gen.cerrar} />
    </div>
  );
}
