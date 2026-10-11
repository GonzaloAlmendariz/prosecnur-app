// Pestaña PowerPoint de Gráficos: los ajustes de cada tipo de gráfico en el PPT, que antes sólo vivían en
// «Configuración global» del editor anterior. El tamaño de un gráfico según la lámina (uno, dos o cuatro por lámina) no
// se ajusta aquí: lo resuelve el motor con la versión compacta de cada pieza para la ranura que le toca, por eso los
// «estilos guardados» del editor anterior (compacto, grande…) no se trajeron.

import { useLocation } from "react-router-dom";
import { PresetsEditor } from "../PresetsEditor";
import { useGraficosReportScope } from "../reportScope";
import "../estilo/estilo.css";
import "../estiloInforme/estiloInforme.css";

export default function PestanaPowerPoint() {
  const { search } = useLocation();
  const scope = useGraficosReportScope(search);
  return (
    <div className="pulso-f6-informe" data-audit-ready="graficos-powerpoint" data-qa-surface="graficos/f6-powerpoint" data-scope={scope}>
      <header className="pulso-f6-informe-barra">
        <h2 className="pulso-f6-informe-titulo">PowerPoint</h2>
        <p className="pulso-f6-informe-ayuda" role="note">Cómo sale cada tipo de gráfico en el PowerPoint.</p>
      </header>
      <div className="pulso-f6-informe-cuerpo" data-qa-scroll-owner="powerpoint">
        <PresetsEditor />
      </div>
    </div>
  );
}
