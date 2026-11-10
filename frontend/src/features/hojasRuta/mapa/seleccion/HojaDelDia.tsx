// «Hoja del día» de una jornada del plan de campo, en su celda (ADR 0133, fase 5;
// forma «fila» del censo de descargas, MC-29). El disparador queda donde estaba y
// sólo se deshabilita mientras se genera; debajo, en la misma celda, el contenedor
// del kit con su línea, el archivo y Abrir / Mostrar en la carpeta, o la causa del
// fallo con Reintentar.

import { ContenedorEntregable } from "../../../../components/entregables/ContenedorEntregable";
import { useGeneracion } from "../../../../components/entregables/useGeneracion";
import { MODULO_HOJA_DEL_DIA } from "../entregas/modeloEntrega";
import "../entregas/entregas.css";

export function HojaDelDia({ jornada, generar }: { jornada: string; generar: () => Promise<unknown> }) {
  const gen = useGeneracion({ titulo: `Hoja del día ${jornada}`, modulo: MODULO_HOJA_DEL_DIA, formato: "pdf", articulo: "la" });
  return (
    <span className="hr-entrega-celda">
      <button
        type="button"
        className="hr-plan-hoja"
        aria-label={`Hoja del día de la jornada ${jornada}`}
        disabled={gen.estado.fase === "en_curso"}
        onClick={() => { void gen.ejecutar(generar); }}
      >
        Hoja del día
      </button>
      <ContenedorEntregable estado={gen.estado} forma="fila" onCerrar={gen.cerrar} />
    </span>
  );
}
