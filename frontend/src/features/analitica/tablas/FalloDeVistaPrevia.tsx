// La vista previa no se pudo leer. Dos casos, dentro del contenedor de la
// tabla: el servicio no tiene una base preparada (409 E_NO_RP_DATA), con la
// acción que la prepara, o cualquier otro fallo, con su causa y Reintentar.
// Común a Frecuencias y Cruces.

import { PulsoButton } from "../../../components/PulsoButton";
import { ErrorBlock } from "../../../components/States";
import { DatabaseZap, RotateCw } from "../../../vendor/lucide-react";
import { SIN_BASE_PREPARADA } from "./cifrasDeFrecuencias";
import type { Lectura } from "./useLecturaPorBase";
import { usePrepararBase } from "./usePrepararBase";

export function FalloDeVistaPrevia({ fallo }: { fallo: Pick<Lectura<unknown>, "causa" | "codigo" | "reintentar"> }) {
  const base = usePrepararBase(fallo.reintentar);
  if (fallo.codigo === SIN_BASE_PREPARADA) {
    return (
      <ErrorBlock
        label="Sin base preparada"
        causa={base.causa
          ? `No se pudo preparar la base: ${base.causa}`
          : "Analítica todavía no tiene la base lista para tabular: no hay datos cargados o no se pudieron preparar."}
        queda="Los ajustes del archivo siguen como estaban."
        acciones={(
          <>
            <PulsoButton variant="primary" onClick={base.preparar} disabled={base.preparando}>
              <DatabaseZap size={14} aria-hidden="true" /> {base.preparando ? "Preparando la base" : "Preparar la base"}
            </PulsoButton>
            <PulsoButton variant="secondary" onClick={fallo.reintentar} disabled={base.preparando}>
              <RotateCw size={14} aria-hidden="true" /> Reintentar
            </PulsoButton>
          </>
        )}
      />
    );
  }
  return (
    <ErrorBlock
      label="No se pudo leer la vista previa"
      causa={fallo.causa || "El servidor no respondió al pedido de la vista previa."}
      queda="Los ajustes del archivo siguen como estaban."
      acciones={(
        <PulsoButton variant="secondary" onClick={fallo.reintentar}>
          <RotateCw size={14} aria-hidden="true" /> Reintentar
        </PulsoButton>
      )}
    />
  );
}
