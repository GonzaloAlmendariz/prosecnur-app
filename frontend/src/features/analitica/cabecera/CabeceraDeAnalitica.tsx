// La cabecera de las pestañas de Analítica que todavía no se rehicieron (plan
// 4.7: una sola cabecera en el módulo, sin "pestaña n de m"). Es la del kit
// (`CabeceraDePestana`): tesela, antetítulo "Analítica" y título; a la derecha,
// la barra de fuente del módulo (versión de la base y plantilla). Debajo, los
// casos que cuentan. Las cifras de cada pestaña siguen en su contenido: se
// suben a la cabecera cuando la pestaña se rehaga, para no repetirlas.

import type { ReactNode } from "react";

import { CabeceraDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import type { LucideIcon } from "../../../vendor/lucide-react";
import { UniversoAnalisis } from "../UniversoAnalisis";
import "./cabeceraDeAnalitica.css";

export function CabeceraDeAnalitica({ titulo, icono, fuente }: {
  titulo: string;
  icono: LucideIcon;
  /** La barra de fuente del módulo: de qué datos sale y la plantilla. */
  fuente: ReactNode;
}) {
  return (
    <div className="pulso-analitica-panel-head analitica-cabecera-comun">
      <CabeceraDePestana
        seccion="Analítica"
        titulo={titulo}
        icono={icono}
        acciones={fuente}
        className="analitica-cabecera-kit"
      />
      {/* Cuántos casos cuentan si Validación declara "Qué caso cuenta". */}
      <div className="pulso-analitica-universo-banda">
        <UniversoAnalisis />
      </div>
    </div>
  );
}
