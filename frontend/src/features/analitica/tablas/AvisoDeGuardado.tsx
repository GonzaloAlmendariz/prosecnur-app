// El guardado de los ajustes falló: la vista previa lo dice una vez, bajo la
// hoja, con la acción que vuelve a intentar el guardado. Sin esto la hoja se
// quedaba atenuada para siempre sin decir por qué.

import { Alert } from "../../../components/Alert";
import { PulsoButton } from "../../../components/PulsoButton";
import { RotateCw } from "../../../vendor/lucide-react";
import { useAnaliticaStore } from "../store";

export function AvisoDeGuardado() {
  const reintentar = useAnaliticaStore((s) => s.reintentarGuardado);
  return (
    <Alert
      kind="warn"
      acciones={(
        <PulsoButton variant="secondary" size="sm" onClick={reintentar}>
          <RotateCw size={13} aria-hidden="true" /> Reintentar
        </PulsoButton>
      )}
    >
      No se pudieron guardar los ajustes. La vista previa muestra los anteriores.
    </Alert>
  );
}
