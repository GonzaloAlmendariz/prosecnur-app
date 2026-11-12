import { Skeleton } from "../../../components/Skeleton";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { MessageSquare, Tags } from "../../../vendor/lucide-react";

/**
 * La mesa mientras llegan las respuestas (plan 8.3): las dos columnas en su sitio, con la silueta de lo
 * que traen. No escribe `data-audit-ready`: esa marca es de la vista con datos.
 */
export function CargaDeCodificar({ rotulo }: { rotulo: string }) {
  return (
    <>
      <PanelDeMesa zona="respuestas" titulo="Respuestas" icono={<MessageSquare size={15} />} ocupado>
        <div className="pulso-cc-carga-filas" role="status" aria-busy="true">
          <span className="pulso-sr-only">{rotulo}</span>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} forma="fila" />
          ))}
        </div>
      </PanelDeMesa>
      <PanelDeMesa zona="codigos" titulo="Códigos" icono={<Tags size={15} />} ocupado>
        <div className="pulso-cc-carga-filas" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} forma="card" alto="4.5rem" />
          ))}
        </div>
      </PanelDeMesa>
    </>
  );
}
