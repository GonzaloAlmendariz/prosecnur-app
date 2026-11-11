import { EstadoChip } from "../../../components/EstadoChip";
import { estadoDeUnidad, faltaOpcionOtros, type Unidad } from "./modeloUnidades";

/** El estado de la unidad en su fila: un chip y, al lado, lo que falta o el motivo. */
export function EstadoUnidad({ unidad }: { unidad: Unidad }) {
  const estado = estadoDeUnidad(unidad);
  const aviso = faltaOpcionOtros(unidad) ? 'Falta la opción "Otros"' : null;
  if (!estado && !aviso) return null;
  const nota = aviso ?? estado?.nota ?? null;
  return (
    <span className="pulso-preg-estado" data-estado={estado?.clave}>
      {estado ? <EstadoChip label={estado.rotulo} tone={estado.tono} detail={estado.detalle || undefined} /> : null}
      {nota ? (
        <span className="pulso-preg-estado-nota" data-tono={aviso ? "aviso" : undefined} title={nota}>
          {nota}
        </span>
      ) : null}
    </span>
  );
}
