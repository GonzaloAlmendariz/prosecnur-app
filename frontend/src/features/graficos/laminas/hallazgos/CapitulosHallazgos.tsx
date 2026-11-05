// Capítulos y hallazgos del resumen ejecutivo (`p_slide_hallazgos`, arg `capitulos`; revisión del PPT v7.11, ítem 2:
// «la UI pueda generarlos»). Cada capítulo se titula, se mueve y se quita; dentro, sus hallazgos (HallazgoFila). Lo
// incompleto se queda en el editor con su aviso y no sale al plan (modeloCapitulosHallazgos). Con la selección
// automática el motor propone los hallazgos: el editor se ve atenuado y no se edita.

import { useId, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "../../../../vendor/lucide-react";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { HallazgoFila } from "./HallazgoFila";
import {
  avisoCapitulo,
  capituloNuevo,
  escribirCapitulos,
  hallazgoNuevo,
  leerCapitulos,
  mismosCapitulos,
  mover,
  type CapituloEditable,
  type HallazgoEditable,
} from "./modeloCapitulosHallazgos";
import { revelarFilaNueva, selectorFila } from "../../revelarFila";
import "./hallazgos.css";

type Props = {
  valor: unknown;
  modo: string;
  /** `seleccion = "auto"`: el motor propone los hallazgos. */
  automatica: boolean;
  calificar: (ref: string) => string;
  scope: "active" | "consolidated";
  onCambio: (capitulos: Record<string, unknown>[]) => void;
  /** La propuesta del motor (PropuestaResumen): con selección automática ocupa el lugar del editor. */
  propuesta?: ReactNode;
};

export function CapitulosHallazgos({ valor, modo, automatica, calificar, scope, onCambio, propuesta }: Props) {
  const idTitulo = useId();
  const idAyuda = useId();
  const [borrador, setBorrador] = useState<CapituloEditable[]>(() => leerCapitulos(valor));
  const [anuncio, setAnuncio] = useState("");
  const siguiente = useRef(0);
  const raiz = useRef<HTMLElement>(null);
  // Cambió afuera (deshacer, el plan): manda lo guardado.
  const capitulos = mismosCapitulos(valor, borrador) ? borrador : leerCapitulos(valor);
  if (capitulos !== borrador) setBorrador(capitulos);

  const clave = (p: string) => { siguiente.current += 1; return `${p}-nuevo-${siguiente.current}`; };
  const aplicar = (nuevos: CapituloEditable[]) => {
    setBorrador(nuevos);
    if (!mismosCapitulos(valor, nuevos)) onCambio(escribirCapitulos(nuevos));
  };
  const cambiarCapitulo = (i: number, parche: Partial<CapituloEditable>) =>
    aplicar(capitulos.map((c, k) => (k === i ? { ...c, ...parche } : c)));
  const cambiarHallazgo = (i: number, j: number, parche: Partial<HallazgoEditable>) =>
    cambiarCapitulo(i, { hallazgos: capitulos[i].hallazgos.map((h, k) => (k === j ? { ...h, ...parche } : h)) });
  const nombreCapitulo = (c: CapituloEditable, i: number) => (c.titulo.trim() ? `capítulo «${c.titulo.trim()}»` : `capítulo ${i + 1}`);
  const completos = escribirCapitulos(capitulos).length;
  const titulares = modo === "titulares";

  return (
    <section ref={raiz} className="pulso-f6-especial pulso-f6-hallazgos" aria-labelledby={idTitulo} aria-describedby={idAyuda}
      data-campo="capitulos" data-qa="capitulos-hallazgos" data-qa-geometry-group="graficos/f6-hallazgos" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-especial-cabeza" data-qa-geometry-member>
        <h3 id={idTitulo} className="pulso-f6-subtitulo">Capítulos y hallazgos</h3>
        <span className="pulso-f6-ayuda">
          {automatica ? "Los propone el motor"
            : capitulos.length === 0 ? "Ninguno" : `${formatoConteo(completos)} de ${formatoConteo(capitulos.length)} ${capitulos.length === 1 ? "sale" : "salen"}`}
        </span>
      </div>
      <span id={idAyuda} className="pulso-f6-ayuda">
        {automatica ? "Marca los que quedan y edita a partir de ellos." : "Pregunta, respuesta, texto y comparación de cada hallazgo."}
      </span>
      {propuesta}
      {!automatica && completos === 0 && (
        <span className="pulso-f6-dato-ayuda is-aviso" role="note">Sin un capítulo completo, el motor no arma esta lámina en selección manual.</span>
      )}
      {!automatica && (
        <fieldset className="pulso-f6-hallazgos-campo" data-qa-geometry-member>
          <legend className="pulso-sr-only">Capítulos</legend>
          {capitulos.length > 0 && (
            <ol className="pulso-f6-hallazgos-capitulos" data-qa-geometry-group="graficos/f6-hallazgos-capitulos" data-qa-geometry-contract="intrinsic">
              {capitulos.map((c, i) => {
                const nombre = nombreCapitulo(c, i);
                const aviso = avisoCapitulo(c, modo);
                return (
                  <li key={c.clave} data-fila={c.clave} className="pulso-f6-criterio pulso-f6-hallazgos-capitulo" role="group" aria-label={`C${nombre.slice(1)}`} data-qa-geometry-member>
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
                    {titulares && (
                      <input className="pulso-f6-input" value={c.titular} placeholder="Titular del capítulo" aria-label={`Titular del ${nombre}`}
                        onChange={(e) => cambiarCapitulo(i, { titular: e.target.value })} />
                    )}
                    <ol className="pulso-f6-hallazgos-lista" data-qa-geometry-group="graficos/f6-hallazgos-lista" data-qa-geometry-contract="intrinsic">
                      {c.hallazgos.map((h, j) => (
                        <li key={h.clave} data-fila={h.clave}>
                          <HallazgoFila hallazgo={h} numero={j + 1} nombre={`hallazgo ${j + 1} del ${nombre}`} primero={j === 0} ultimo={j === c.hallazgos.length - 1}
                            calificar={calificar} scope={scope}
                            onCambio={(parche) => cambiarHallazgo(i, j, parche)}
                            onMover={(d) => cambiarCapitulo(i, { hallazgos: mover(c.hallazgos, j, d) })}
                            onQuitar={() => { cambiarCapitulo(i, { hallazgos: c.hallazgos.filter((_, k) => k !== j) }); setAnuncio(`Se quitó el hallazgo ${j + 1}.`); }} />
                        </li>
                      ))}
                    </ol>
                    <button type="button" className="pulso-f6-boton pulso-f6-dato-accion" data-qa-geometry-capacity="owned"
                      onClick={() => {
                        // H10: la fila nueva se trae a la vista con el foco en su primer campo.
                        const k = clave("h");
                        cambiarCapitulo(i, { hallazgos: [...c.hallazgos, hallazgoNuevo(k)] });
                        revelarFilaNueva(raiz.current, selectorFila(k));
                      }}>
                      <Plus size={14} aria-hidden="true" /> Agregar hallazgo
                    </button>
                    {aviso && <span className="pulso-f6-dato-ayuda is-aviso" role="note">{aviso}</span>}
                  </li>
                );
              })}
            </ol>
          )}
          <button type="button" className="pulso-f6-boton pulso-f6-especial-anadir" data-qa-geometry-capacity="owned"
            onClick={() => {
              const k = clave("c");
              aplicar([...capitulos, capituloNuevo(k, clave("h"))]);
              revelarFilaNueva(raiz.current, selectorFila(k));
            }}>
            <Plus size={15} aria-hidden="true" /> Agregar capítulo
          </button>
        </fieldset>
      )}
      <span className="pulso-sr-only" aria-live="polite">{anuncio}</span>
    </section>
  );
}
