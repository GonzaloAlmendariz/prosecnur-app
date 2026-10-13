// Pestaña Word de Gráficos: los ajustes de Word de cada tipo de gráfico (y la opción de no repetir el título como
// etiqueta del eje), que antes sólo vivían en «Configuración global» del editor anterior. Los ajustes que no se pueden
// cambiar no se muestran. En el informe compartido el Word no sale: se dice por qué.

import { useOptionalSession } from "../../../lib/SessionContext";
import { useLocation } from "react-router-dom";
import { disponibilidadInforme } from "../estiloInforme/disponibilidadInforme";
import { useGraficosReportScope } from "../reportScope";
import { WordPresetsEditor } from "../WordPresetsEditor";
import "../estilo/estilo.css";
import "../estiloInforme/estiloInforme.css";

export default function PestanaWord() {
  const { search } = useLocation();
  const scope = useGraficosReportScope(search);
  const sesion = useOptionalSession();
  const disponibilidad = disponibilidadInforme(scope, sesion?.state?.estudio_processing_mode === "independent_siblings");

  return (
    <div className="pulso-f6-informe" data-audit-ready="graficos-word" data-qa-surface="graficos/f6-word" data-scope={scope}>
      <header className="pulso-f6-informe-barra">
        <h2 className="pulso-f6-informe-titulo">Word</h2>
        <p className="pulso-f6-informe-ayuda" role="note">Cómo sale cada gráfico en el documento Word.</p>
      </header>
      <div className="pulso-f6-informe-cuerpo" data-qa-scroll-owner="word">
        <div className="pulso-f6-informe-secciones" data-qa-geometry-group="graficos/f6-word-secciones" data-qa-geometry-contract="intrinsic">
          {disponibilidad.motivoWord ? (
            <p className="pulso-f6-informe-motivo" role="note">{disponibilidad.motivoWord}</p>
          ) : (
            <section className="pulso-f6-informe-seccion" aria-label="Ajustes por tipo de gráfico" data-qa-geometry-member data-seccion="word-graficos">
              <WordPresetsEditor />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
