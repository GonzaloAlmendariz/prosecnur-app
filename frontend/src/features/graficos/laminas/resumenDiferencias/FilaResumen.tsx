// Una fila del resumen de diferencias (CapitulosResumen): la pregunta, la respuesta que se cuenta y el rótulo de la fila
// en la tabla. Una fila que suma varias respuestas (Top 2 Box) lo dice y puede pasar a contar una sola. Lo demás que
// trae se lee en una nota y viaja intacto.

import { useId } from "react";
import { ArrowDown, ArrowUp, X } from "../../../../vendor/lucide-react";
import VariablePicker from "../../VariablePicker";
import { SelectorCategorias } from "../SelectorCategorias";
import { avisoFila, cuentaSuma, notaRestoFila, respuestasSumadas, sinSuma, type FilaResumenEditable } from "./modeloCapitulosResumen";
import { PulsoButton } from "../../../../components/PulsoButton";

type Props = {
  fila: FilaResumenEditable;
  numero: number;
  /** «fila 2 del capítulo «Vida universitaria»», para los nombres accesibles. */
  nombre: string;
  primera: boolean;
  ultima: boolean;
  /** La pregunta calificada (`base$var`) con la que se piden sus respuestas. */
  calificar: (ref: string) => string;
  scope: "active" | "consolidated";
  onCambio: (fila: FilaResumenEditable) => void;
  onMover: (delta: -1 | 1) => void;
  onQuitar: () => void;
};

export function FilaResumen({ fila: f, numero, nombre, primera, ultima, calificar, scope, onCambio, onMover, onQuitar }: Props) {
  const id = useId();
  const aviso = avisoFila(f);
  const nota = notaRestoFila(f);
  const suma = cuentaSuma(f);
  const cambiar = (parche: Partial<Pick<FilaResumenEditable, "var" | "fila" | "rotulo">>) => onCambio({ ...f, ...parche });
  const respaldo = (
    <div className="pulso-f6-campo">
      <label htmlFor={`${id}-fila`}>Respuesta que cuenta</label>
      <input id={`${id}-fila`} className="pulso-f6-input" value={f.fila} placeholder="Etiqueta de la respuesta, p. ej. Sí"
        onChange={(e) => cambiar({ fila: e.target.value })} />
    </div>
  );
  return (
    <div className={`pulso-f6-hallazgo${aviso ? " is-incompleto" : ""}`} role="group" aria-label={`F${nombre.slice(1)}`} data-qa-geometry-member
      data-qa-geometry-group="graficos/f6-resumen-fila-campos" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-hallazgo-cabeza">
        <span className="pulso-f6-dato-rotulo">Fila {numero}</span>
        <span className="pulso-f6-hallazgo-acciones">
          <PulsoButton variant="icon" tone="quiet" size="sm" aria-label={`Subir la ${nombre}`} disabled={primera} onClick={() => onMover(-1)}>
            <ArrowUp aria-hidden="true" />
          </PulsoButton>
          <PulsoButton variant="icon" tone="quiet" size="sm" aria-label={`Bajar la ${nombre}`} disabled={ultima} onClick={() => onMover(1)}>
            <ArrowDown aria-hidden="true" />
          </PulsoButton>
          <PulsoButton variant="icon" tone="quiet" size="sm" intent="remove" aria-label={`Quitar la ${nombre}`} onClick={onQuitar}>
            <X aria-hidden="true" />
          </PulsoButton>
        </span>
      </div>

      <div className="pulso-f6-campo" role="group" aria-labelledby={`${id}-preg`}>
        <span id={`${id}-preg`} className="pulso-f6-hallazgo-rotulo">Pregunta</span>
        <VariablePicker value={f.var || null} placeholder="Elige una pregunta…"
          onChange={(v) => { const ref = v ?? ""; if (ref !== f.var) cambiar({ var: ref, fila: "" }); }} />
      </div>

      {suma ? (
        <div className="pulso-f6-campo" data-qa="resumen-fila-suma">
          <span className="pulso-f6-hallazgo-rotulo">Respuestas que cuentan</span>
          <span className="pulso-f6-dato-ayuda">Cuenta la suma: {respuestasSumadas(f)}.</span>
          <PulsoButton variant="secondary" size="sm" className="pulso-f6-dato-accion" onClick={() => onCambio(sinSuma(f))}>
            Contar una sola respuesta
          </PulsoButton>
        </div>
      ) : (
        <SelectorCategorias id={`${id}-cats`} variable={f.var ? calificar(f.var) : ""} scope={scope} graficador="" modo="una" porEtiqueta
          valor={f.fila ? [f.fila] : []} onCambio={(e) => cambiar({ fila: e[0] ?? "" })}
          etiqueta={<span className="pulso-f6-hallazgo-rotulo">Respuesta que cuenta</span>}
          textoRespaldo={respaldo} nota={null} />
      )}

      <div className="pulso-f6-campo">
        <label htmlFor={`${id}-rotulo`}>Rótulo de la fila</label>
        <input id={`${id}-rotulo`} className="pulso-f6-input" value={f.rotulo} aria-required="true"
          placeholder="p. ej. Trabaja de forma remunerada" onChange={(e) => cambiar({ rotulo: e.target.value })} />
      </div>

      {(nota || aviso) && (
        // En su propia caja: suelto, el texto se mide sin su interlineado y el gate lo lee como hueco (capacity-drift).
        <div className="pulso-f6-campo">
          {nota && <span className="pulso-f6-dato-ayuda is-nota">{nota}</span>}
          {aviso && <span className="pulso-f6-dato-ayuda is-aviso" role="note">{aviso}</span>}
        </div>
      )}
    </div>
  );
}
