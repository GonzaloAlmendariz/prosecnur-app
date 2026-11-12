// Los archivos de Codificación que se entregan aparte de la base codificada
// (ADR 0142 y 0144; plan 5.3: "Matriz de codificación" se genera en Aplicar como
// archivo de salida). Venían de la barra de la pestaña Matrices, retirada al
// codificar en la vista de tabla de Codificar: la matriz para el cliente, el
// registro de qué código recibió cada respuesta y el respaldo de la
// codificación. Un solo contenedor del kit: una generación a la vez.

import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import { PulsoButton } from "../../../components/PulsoButton";
import { Download } from "../../../vendor/lucide-react";
import { useEntregasMatrices } from "../entregas/useEntregasMatrices";

export function ArchivosDeCodificacion({ base }: { base: string }) {
  const entregas = useEntregasMatrices();
  return (
    <div className="pulso-aplicar-salidas" data-qa-geometry-group="codificacion/aplicar-salidas" data-qa-geometry-contract="intrinsic">
      <div className="pulso-aplicar-resultado-cab">
        <h4 className="pulso-aplicar-resultado-titulo">Archivos para entregar</h4>
        <p className="pulso-aplicar-resultado-nota">Con todas las preguntas codificadas de esta base</p>
      </div>
      <div className="pulso-aplicar-salidas-botones" role="group" aria-label="Archivos para entregar">
        <PulsoButton variant="secondary" size="sm" disabled={entregas.enCurso || !base} onClick={() => void entregas.matriz("client", [], base)}>
          <Download size={13} aria-hidden="true" /> Matriz de codificación
        </PulsoButton>
        <PulsoButton variant="secondary" size="sm" disabled={entregas.enCurso || !base} onClick={() => void entregas.matriz("internal", [], base)}>
          <Download size={13} aria-hidden="true" /> Registro de codificación
        </PulsoButton>
        <PulsoButton variant="secondary" size="sm" disabled={entregas.enCurso} onClick={() => void entregas.respaldo()}>
          <Download size={13} aria-hidden="true" /> Respaldo
        </PulsoButton>
      </div>
      <ContenedorEntregable estado={entregas.estado} forma="bloque" onCerrar={entregas.cerrar} />
    </div>
  );
}
