// Un hallazgo del resumen ejecutivo (CapitulosHallazgos): la pregunta, la respuesta que se cuenta, el texto que sigue a
// la cifra y la comparación. Lo que el editor no maneja se lee en una nota y viaja intacto.

import { useId } from "react";
import { ArrowDown, ArrowUp, X } from "../../../../vendor/lucide-react";
import VariablePicker from "../../VariablePicker";
import { RadioSegmentado } from "../../subpestanas/RadioSegmentado";
import { SelectorCategorias } from "../SelectorCategorias";
import { avisoHallazgo, notaRestoHallazgo, type HallazgoEditable, type TipoComparacion } from "./modeloCapitulosHallazgos";

const COMPARACIONES: readonly { clave: TipoComparacion; rotulo: string }[] = [
  { clave: "auto", rotulo: "Automática" },
  { clave: "ninguna", rotulo: "Ninguna" },
  { clave: "escrita", rotulo: "Escrita" },
];

type Props = {
  hallazgo: HallazgoEditable;
  numero: number;
  /** «hallazgo 2 del capítulo «Información general»», para los nombres accesibles. */
  nombre: string;
  primero: boolean;
  ultimo: boolean;
  /** La pregunta calificada (`base$var`) con la que se piden sus respuestas. */
  calificar: (ref: string) => string;
  scope: "active" | "consolidated";
  onCambio: (parche: Partial<Omit<HallazgoEditable, "clave" | "resto">>) => void;
  onMover: (delta: -1 | 1) => void;
  onQuitar: () => void;
};

export function HallazgoFila({ hallazgo: h, numero, nombre, primero, ultimo, calificar, scope, onCambio, onMover, onQuitar }: Props) {
  const id = useId();
  const aviso = avisoHallazgo(h);
  const nota = notaRestoHallazgo(h.resto);
  const respaldo = (
    <div className="pulso-f6-campo">
      <label htmlFor={`${id}-fila`}>Respuesta que cuenta</label>
      <input id={`${id}-fila`} className="pulso-f6-input" value={h.fila} placeholder="Etiqueta de la respuesta, p. ej. Privado"
        onChange={(e) => onCambio({ fila: e.target.value })} />
    </div>
  );
  return (
    <div className={`pulso-f6-hallazgo${aviso ? " is-incompleto" : ""}`} role="group" aria-label={`H${nombre.slice(1)}`} data-qa-geometry-member
      data-qa-geometry-group="graficos/f6-hallazgo-campos" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-hallazgo-cabeza">
        <span className="pulso-f6-dato-rotulo">Hallazgo {numero}</span>
        <span className="pulso-f6-hallazgo-acciones">
          <button type="button" className="pulso-f6-icono-boton" aria-label={`Subir el ${nombre}`} disabled={primero} onClick={() => onMover(-1)}>
            <ArrowUp size={14} aria-hidden="true" />
          </button>
          <button type="button" className="pulso-f6-icono-boton" aria-label={`Bajar el ${nombre}`} disabled={ultimo} onClick={() => onMover(1)}>
            <ArrowDown size={14} aria-hidden="true" />
          </button>
          <button type="button" className="pulso-f6-icono-boton" aria-label={`Quitar el ${nombre}`} onClick={onQuitar}>
            <X size={14} aria-hidden="true" />
          </button>
        </span>
      </div>

      <div className="pulso-f6-campo" role="group" aria-labelledby={`${id}-preg`}>
        <span id={`${id}-preg`} className="pulso-f6-hallazgo-rotulo">Pregunta</span>
        <VariablePicker value={h.var || null} placeholder="Elige una pregunta…"
          onChange={(v) => { const ref = v ?? ""; if (ref !== h.var) onCambio({ var: ref, fila: "" }); }} />
      </div>

      <SelectorCategorias id={`${id}-cats`} variable={h.var ? calificar(h.var) : ""} scope={scope} graficador="" modo="una" porEtiqueta
        valor={h.fila ? [h.fila] : []} onCambio={(e) => onCambio({ fila: e[0] ?? "" })}
        etiqueta={<span className="pulso-f6-hallazgo-rotulo">Respuesta que cuenta</span>}
        textoRespaldo={respaldo} nota={null} />

      <div className="pulso-f6-campo">
        <label htmlFor={`${id}-texto`}>Texto tras la cifra</label>
        <textarea id={`${id}-texto`} className="pulso-f6-input" rows={2} value={h.texto} aria-required="true"
          placeholder="p. ej. estudió la secundaria en un colegio privado" onChange={(e) => onCambio({ texto: e.target.value })} />
      </div>

      <div className="pulso-f6-campo">
        <span className="pulso-f6-hallazgo-rotulo">Comparación</span>
        <RadioSegmentado etiqueta={`Comparación del ${nombre}`} opciones={COMPARACIONES} valor={h.comparacion}
          onCambiar={(c) => onCambio({ comparacion: c })} />
        {h.comparacion === "escrita" && (
          <>
            <input className="pulso-f6-input" value={h.comparacionTexto} aria-label={`Comparación escrita del ${nombre}`}
              aria-describedby={`${id}-escrita`} placeholder="p. ej. 12 puntos más que en 2025" onChange={(e) => onCambio({ comparacionTexto: e.target.value })} />
            <span id={`${id}-escrita`} className="pulso-f6-dato-ayuda">Sale tal cual; el motor avisa que no la verifica.</span>
          </>
        )}
      </div>

      {nota && <span className="pulso-f6-dato-ayuda is-nota">{nota}</span>}
      {aviso && <span className="pulso-f6-dato-ayuda is-aviso" role="note">{aviso}</span>}
    </div>
  );
}
