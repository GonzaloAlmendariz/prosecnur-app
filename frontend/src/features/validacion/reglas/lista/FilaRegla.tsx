/**
 * Una regla en la lista de su familia (prototipo `reglaF`, `vistas.js:607`):
 * el nombre y el interruptor de activa en el primer renglón, la frase con sus
 * fichas en el segundo y, en el tercero, la clase, el tratamiento previsto y
 * los casos de la última auditoría (o por qué no los tiene).
 *
 * Elegir la fila abre su ficha; el interruptor es un control aparte, fuera del
 * botón de la fila, para que el teclado llegue a los dos.
 */
import { Copy } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { FraseDelCatalogo } from "./FraseDelCatalogo";
import { estadoDeFila, rotuloDeClase, textoDeTratamiento, type ReglaDelCatalogo } from "./modeloCatalogo";

export function FilaRegla({
  regla,
  elegida,
  conAviso,
  ocupada,
  onElegir,
  onActivar,
  onDuplicar,
}: {
  regla: ReglaDelCatalogo;
  elegida: boolean;
  conAviso: boolean;
  ocupada: boolean;
  onElegir: () => void;
  onActivar: (activa: boolean) => void;
  /** Una regla propia se duplica desde su fila; sin esta función no se ofrece. */
  onDuplicar?: () => void;
}) {
  const estado = estadoDeFila(regla);
  const clase = regla.clase === "caso_a_revisar" ? "revisar" : "inconsistencia";
  return (
    <li className="pulso-rl-regla" data-qa-geometry-member="" data-inactiva={regla.activa ? undefined : ""}>
      <button
        type="button"
        className="pulso-rl-regla-boton"
        data-con-acciones={onDuplicar ? "" : undefined}
        aria-current={elegida ? "true" : undefined}
        onClick={onElegir}
      >
        <span className="pulso-rl-regla-nombre">
          {regla.nombre}
          {conAviso ? (
            <>
              <span className="pulso-rl-punto" data-tono="aviso" aria-hidden="true" />
              <span className="pulso-sr-only">, con un aviso</span>
            </>
          ) : null}
        </span>
        <span className="pulso-rl-regla-frase">
          <FraseDelCatalogo piezas={regla.frase} />
        </span>
        <span className="pulso-rl-regla-pie">
          <span className="pulso-rl-clase" data-clase={clase}>{rotuloDeClase(regla.clase)}</span>
          <span className="pulso-rl-regla-tratamiento">{textoDeTratamiento(regla.tratamiento)}</span>
          <span className="pulso-rl-regla-casos">
            {estado.tipo === "casos" ? (
              <>
                <span><b>{estado.cifra}</b> {estado.unidad}</span>
                <small>{estado.decididos}</small>
              </>
            ) : estado.tipo === "sin-casos" ? (
              "Sin casos"
            ) : estado.tipo === "sin-evaluar" ? (
              <span className="pulso-rl-regla-causa">{estado.causa}</span>
            ) : estado.tipo === "desactivada" ? (
              "Desactivada"
            ) : (
              "Sin auditar"
            )}
          </span>
        </span>
      </button>
      {regla.se_puede_desactivar || onDuplicar ? (
        <span className="pulso-rl-regla-interruptor">
          {onDuplicar ? (
            <PulsoButton
              variant="icon"
              size="sm"
              aria-label={`Duplicar la regla ${regla.nombre}`}
              title="Duplicar"
              disabled={ocupada}
              onClick={onDuplicar}
            >
              <Copy size={14} aria-hidden="true" />
            </PulsoButton>
          ) : null}
          {regla.se_puede_desactivar ? <PulsoSwitch
            size="sm"
            checked={regla.activa}
            disabled={ocupada}
            ariaLabel={`${regla.activa ? "Desactivar" : "Activar"} la regla ${regla.nombre}`}
            onCheckedChange={onActivar}
          /> : null}
        </span>
      ) : null}
    </li>
  );
}
