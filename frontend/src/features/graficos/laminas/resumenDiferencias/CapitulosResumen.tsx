// Capítulos y filas de «Resumen de diferencias» (`p_slide_resumen_diferencias`, arg `capitulos`; ítem 15 de la
// revisión del PPT v7.23). Cada capítulo se titula, se mueve y se quita; dentro, sus filas (FilaResumen). Lo incompleto
// se queda en el editor con su aviso y no sale al plan (modeloCapitulosResumen). Con la selección automática el motor
// propone las filas: el editor se ve atenuado y no se edita.

import { useId, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "../../../../vendor/lucide-react";
import { mover } from "../hallazgos/modeloCapitulosHallazgos";
import { FilaResumen } from "./FilaResumen";
import {
  avisoCapituloResumen,
  capituloResumenNuevo,
  conteoResumen,
  escribirCapitulosResumen,
  filaNueva,
  filasQueSalen,
  leerCapitulosResumen,
  mismosCapitulosResumen,
  type CapituloResumenEditable,
  type FilaResumenEditable,
} from "./modeloCapitulosResumen";
import "../hallazgos/hallazgos.css";

type Props = {
  valor: unknown;
  /** `seleccion = "auto"`: el motor propone las filas. */
  automatica: boolean;
  calificar: (ref: string) => string;
  scope: "active" | "consolidated";
  onCambio: (capitulos: Record<string, unknown>[]) => void;
  /** La propuesta del motor (PropuestaResumen): con selección automática ocupa el lugar del editor. */
  propuesta?: ReactNode;
};

export function CapitulosResumen({ valor, automatica, calificar, scope, onCambio, propuesta }: Props) {
  const idTitulo = useId();
  const idAyuda = useId();
  const [borrador, setBorrador] = useState<CapituloResumenEditable[]>(() => leerCapitulosResumen(valor));
  const [anuncio, setAnuncio] = useState("");
  const siguiente = useRef(0);
  // Cambió afuera (deshacer, el plan): manda lo guardado.
  const capitulos = mismosCapitulosResumen(valor, borrador) ? borrador : leerCapitulosResumen(valor);
  if (capitulos !== borrador) setBorrador(capitulos);

  const clave = (p: string) => { siguiente.current += 1; return `${p}-nuevo-${siguiente.current}`; };
  const aplicar = (nuevos: CapituloResumenEditable[]) => {
    setBorrador(nuevos);
    if (!mismosCapitulosResumen(valor, nuevos)) onCambio(escribirCapitulosResumen(nuevos));
  };
  const cambiarCapitulo = (i: number, parche: Partial<CapituloResumenEditable>) =>
    aplicar(capitulos.map((c, k) => (k === i ? { ...c, ...parche } : c)));
  const cambiarFila = (i: number, j: number, fila: FilaResumenEditable) =>
    cambiarCapitulo(i, { filas: capitulos[i].filas.map((f, k) => (k === j ? fila : f)) });
  const nombreCapitulo = (c: CapituloResumenEditable, i: number) => (c.titulo.trim() ? `capítulo «${c.titulo.trim()}»` : `capítulo ${i + 1}`);
  const completos = escribirCapitulosResumen(capitulos).length;
  const filas = filasQueSalen(capitulos);

  return (
    <section className="pulso-f6-especial pulso-f6-hallazgos" aria-labelledby={idTitulo} aria-describedby={idAyuda}
      data-campo="capitulos" data-qa="capitulos-resumen" data-qa-geometry-group="graficos/f6-resumen-capitulos-bloque" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-especial-cabeza" data-qa-geometry-member>
        <h3 id={idTitulo} className="pulso-f6-subtitulo">Capítulos y filas</h3>
        <span className="pulso-f6-ayuda">
          {automatica ? "Las propone el motor" : conteoResumen(filas, completos, capitulos.length)}
        </span>
      </div>
      <span id={idAyuda} className="pulso-f6-ayuda">
        {automatica ? "Marca las que quedan y edita a partir de ellas." : "Pregunta, respuesta que se cuenta y rótulo de cada fila."}
      </span>
      {propuesta}
      {!automatica && completos === 0 && (
        <span className="pulso-f6-dato-ayuda is-aviso" role="note">Sin un capítulo completo, el motor no arma esta lámina en selección manual.</span>
      )}
      {!automatica && (
        <fieldset className="pulso-f6-hallazgos-campo" data-qa-geometry-member>
          <legend className="pulso-sr-only">Capítulos</legend>
          {capitulos.length > 0 && (
            <ol className="pulso-f6-hallazgos-capitulos" data-qa-geometry-group="graficos/f6-resumen-capitulos" data-qa-geometry-contract="intrinsic">
              {capitulos.map((c, i) => {
                const nombre = nombreCapitulo(c, i);
                const aviso = avisoCapituloResumen(c);
                return (
                  <li key={c.clave} className="pulso-f6-criterio pulso-f6-hallazgos-capitulo" role="group" aria-label={`C${nombre.slice(1)}`} data-qa-geometry-member>
                    <div className="pulso-f6-hallazgos-cabeza">
                      <input className="pulso-f6-input" value={c.titulo} placeholder="Título del capítulo" aria-label={`Título del capítulo ${i + 1}`}
                        onChange={(e) => cambiarCapitulo(i, { titulo: e.target.value })} />
                      <button type="button" className="pulso-f6-icono-boton" aria-label={`Subir el ${nombre}`} disabled={i === 0}
                        onClick={() => aplicar(mover(capitulos, i, -1))}>
                        <ArrowUp size={14} aria-hidden="true" />
                      </button>
                      <button type="button" className="pulso-f6-icono-boton" aria-label={`Bajar el ${nombre}`} disabled={i === capitulos.length - 1}
                        onClick={() => aplicar(mover(capitulos, i, 1))}>
                        <ArrowDown size={14} aria-hidden="true" />
                      </button>
                      <button type="button" className="pulso-f6-icono-boton" aria-label={`Quitar el ${nombre}`}
                        onClick={() => { aplicar(capitulos.filter((_, k) => k !== i)); setAnuncio(`Se quitó el ${nombre}. Ctrl+Z lo devuelve.`); }}>
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                    <ol className="pulso-f6-hallazgos-lista" data-qa-geometry-group="graficos/f6-resumen-filas" data-qa-geometry-contract="intrinsic">
                      {c.filas.map((f, j) => (
                        <li key={f.clave}>
                          <FilaResumen fila={f} numero={j + 1} nombre={`fila ${j + 1} del ${nombre}`} primera={j === 0} ultima={j === c.filas.length - 1}
                            calificar={calificar} scope={scope}
                            onCambio={(nueva) => cambiarFila(i, j, nueva)}
                            onMover={(d) => cambiarCapitulo(i, { filas: mover(c.filas, j, d) })}
                            onQuitar={() => { cambiarCapitulo(i, { filas: c.filas.filter((_, k) => k !== j) }); setAnuncio(`Se quitó la fila ${j + 1}.`); }} />
                        </li>
                      ))}
                    </ol>
                    <button type="button" className="pulso-f6-boton pulso-f6-dato-accion" data-qa-geometry-capacity="owned"
                      onClick={() => cambiarCapitulo(i, { filas: [...c.filas, filaNueva(clave("f"))] })}>
                      <Plus size={14} aria-hidden="true" /> Agregar fila
                    </button>
                    {aviso && <span className="pulso-f6-dato-ayuda is-aviso" role="note">{aviso}</span>}
                  </li>
                );
              })}
            </ol>
          )}
          <button type="button" className="pulso-f6-boton pulso-f6-especial-anadir" data-qa-geometry-capacity="owned"
            onClick={() => aplicar([...capitulos, capituloResumenNuevo(clave("c"), clave("f"))])}>
            <Plus size={15} aria-hidden="true" /> Agregar capítulo
          </button>
        </fieldset>
      )}
      <span className="pulso-sr-only" aria-live="polite">{anuncio}</span>
    </section>
  );
}
