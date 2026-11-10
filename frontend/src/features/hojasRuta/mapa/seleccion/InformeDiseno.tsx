import { ContenedorEntregable } from "../../../../components/entregables/ContenedorEntregable";
import { useGeneracion } from "../../../../components/entregables/useGeneracion";
import { PulsoButton } from "../../../../components/PulsoButton";
import { apiHojasRutaReporteDecisionalIniciar } from "../../../../api/hojasRuta";
import { FileText } from "../../../../vendor/lucide-react";
import { MODULO_HOJAS_RUTA } from "../entregas/modeloEntrega";
import "../entregas/entregas.css";

/**
 * «Descargar el informe» (brecha B22): el informe de diseño muestral (U16) que arma el
 * motor en un job. La espera, el archivo y el fallo van en el contenedor del kit
 * (ADR 0133, forma bloque); el botón sólo se deshabilita mientras se genera.
 */
export function InformeDiseno({ deshabilitado }: { deshabilitado: boolean }) {
  const gen = useGeneracion({ titulo: "Informe de diseño muestral", modulo: MODULO_HOJAS_RUTA, formato: "html", articulo: "el" });
  const enCurso = gen.estado.fase === "en_curso";
  return (
    <section className="hr-muestra-grupo" aria-label="Informe de diseño muestral">
      <h3>Informe de diseño muestral</h3>
      <p className="hr-mapa-nota">Territorio, población, tamaño, marco elegible y sorteo, con sus supuestos, para compartir con el cliente.</p>
      <div className="hr-entrega-bloque">
        <PulsoButton
          variant="secondary"
          size="sm"
          disabled={deshabilitado || enCurso}
          onClick={() => { void gen.ejecutar(() => apiHojasRutaReporteDecisionalIniciar("html")); }}
        >
          <FileText size={13} aria-hidden /> Descargar el informe
        </PulsoButton>
        <ContenedorEntregable estado={gen.estado} forma="bloque" onCerrar={gen.cerrar} />
      </div>
    </section>
  );
}
