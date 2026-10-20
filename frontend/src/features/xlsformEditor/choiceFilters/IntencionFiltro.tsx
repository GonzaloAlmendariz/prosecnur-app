// Edición por intención (E5, 2026-10-20): cuatro formas de filtro dichas por lo que hacen, y la configuración de cada
// una. La comparten el editor del detalle y el diálogo «Nuevo filtro». El filtro fijo se configura con columna y valor
// y luego se marca en la lista, nunca escribiendo la expresión.

import { useRef, type KeyboardEvent } from "react";
import type { XlsformEditorSheet } from "../../../api/multiIntegrado";
import { X } from "../../../vendor/lucide-react";
import { columnaSugerida } from "./cascada";
import type { Intento } from "./escrituraFiltros";
import type { AnalisisFiltro, TipoFiltro } from "./modeloFiltros";
import { SelectorPreguntaFiltro, type PreguntaElegible } from "./SelectorPreguntaFiltro";

export const INTENCIONES: { forma: TipoFiltro; titulo: string; detalle: string }[] = [
  { forma: "cascada", titulo: "Según una respuesta anterior", detalle: "La lista depende de otra pregunta." },
  { forma: "opcion", titulo: "Cada opción según su pregunta", detalle: "Cada opción la habilita una pregunta distinta." },
  { forma: "fijo", titulo: "Siempre las mismas opciones", detalle: "Un subconjunto que no cambia." },
  { forma: "expresion", titulo: "Escribir la expresión", detalle: "Para casos que no encajan." },
];

/** El intento con que arranca cada forma: lo que ya tiene el filtro si es de esa forma, o un punto de partida. */
export function intentoInicial(forma: TipoFiltro, a: AnalisisFiltro | null, pregunta: string, choices: XlsformEditorSheet): Intento {
  if (forma === "cascada") return { forma, madre: a?.cascada?.madre ?? "", columna: a?.cascada?.columna ?? "" };
  if (forma === "opcion") return { forma, preguntas: a?.porOpcion ? [...new Set(a.porOpcion.terminos.map((t) => t.pregunta))] : [] };
  if (forma === "fijo") {
    if (a?.fijo?.forma === "columna") return { forma, columna: a.fijo.columna, valor: a.fijo.valor };
    return { forma, columna: columnaLibre(choices, `solo_${pregunta}`), valor: "si" };
  }
  return { forma, texto: a?.expresion ?? "" };
}

function columnaLibre(choices: XlsformEditorSheet, base: string): string {
  const limpia = base.replace(/[^\w.-]/g, "_");
  let n = limpia;
  for (let i = 2; choices.columns.includes(n) && i < 100; i += 1) n = `${limpia}_${i}`;
  return n;
}

export function TarjetasIntencion({ valor, onCambio, columnas = 4 }: { valor: TipoFiltro | null; onCambio: (f: TipoFiltro) => void; columnas?: 2 | 4 }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const mover = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const j = (i + d + INTENCIONES.length) % INTENCIONES.length;
    onCambio(INTENCIONES[j]!.forma);
    refs.current[j]?.focus();
  };
  return (
    <div className={`xcf-intenciones is-${columnas}`} role="radiogroup" aria-label="Forma del filtro">
      {INTENCIONES.map((x, i) => {
        const on = valor === x.forma;
        return (
          <button
            key={x.forma}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (valor === null && i === 0) ? 0 : -1}
            className={on ? "xcf-intencion is-on" : "xcf-intencion"}
            onClick={() => onCambio(x.forma)}
            onKeyDown={(e) => mover(e, i)}
          >
            <b>{x.titulo}</b>
            <span>{x.detalle}</span>
          </button>
        );
      })}
    </div>
  );
}

type ConfigProps = {
  intento: Intento;
  onCambio: (i: Intento) => void;
  /** Preguntas de selección anteriores a la filtrada (madre o habilitadoras). */
  candidatas: readonly PreguntaElegible[];
  choices: XlsformEditorSheet;
};

export function ConfigIntento({ intento, onCambio, candidatas, choices }: ConfigProps) {
  if (intento.forma === "cascada") {
    const elegir = (madre: string) => {
      const auto = !intento.columna || intento.columna.startsWith("filtro_");
      onCambio({ ...intento, madre, columna: auto ? columnaSugerida(choices, madre) : intento.columna });
    };
    return (
      <div className="xcf-config">
        <div className="xcf-campo">
          <span className="xcf-campo__rot">Pregunta de la que depende</span>
          {candidatas.length
            ? <SelectorPreguntaFiltro preguntas={candidatas} elegidas={intento.madre ? [intento.madre] : []} onElegir={elegir} etiqueta="Pregunta de la que depende" />
            : <p className="xcf-nota">No hay preguntas de selección antes de esta.</p>}
        </div>
        <label className="xcf-campo">
          <span className="xcf-campo__rot">Columna de la lista que guarda la respuesta</span>
          <input className="xcf-input is-mono" value={intento.columna} spellCheck={false} onChange={(e) => onCambio({ ...intento, columna: e.target.value.trim() })} />
          <span className="xcf-nota">{choices.columns.includes(intento.columna) ? "Ya existe en choices: se conservan sus valores." : "Se crea vacía. Luego marcas qué opción va con cada respuesta."}</span>
        </label>
      </div>
    );
  }
  if (intento.forma === "opcion") {
    const alternar = (name: string) =>
      onCambio({ ...intento, preguntas: intento.preguntas.includes(name) ? intento.preguntas.filter((p) => p !== name) : [...intento.preguntas, name] });
    return (
      <div className="xcf-config">
        <div className="xcf-campo">
          <span className="xcf-campo__rot">Preguntas que habilitan opciones</span>
          {intento.preguntas.length ? (
            <ul className="xcf-elegidas" aria-label="Preguntas elegidas">
              {intento.preguntas.map((p) => (
                <li key={p}>
                  <code>{p}</code>
                  <button type="button" className="xcf-icono" aria-label={`Quitar ${p}`} onClick={() => alternar(p)}><X size={12} aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          ) : null}
          <SelectorPreguntaFiltro preguntas={candidatas} elegidas={intento.preguntas} onElegir={alternar} etiqueta="Preguntas que habilitan opciones" multiple />
          <span className="xcf-nota">{intento.preguntas.length < 2 ? "Elige al menos dos. Con una sola es una cascada." : "Las opciones empiezan fijas y se reparten en la matriz."}</span>
        </div>
      </div>
    );
  }
  if (intento.forma === "fijo") {
    return (
      <div className="xcf-config is-fila">
        <label className="xcf-campo">
          <span className="xcf-campo__rot">Columna que marca las opciones</span>
          <input className="xcf-input is-mono" value={intento.columna} spellCheck={false} onChange={(e) => onCambio({ ...intento, columna: e.target.value.trim() })} />
        </label>
        <label className="xcf-campo is-corto">
          <span className="xcf-campo__rot">Valor</span>
          <input className="xcf-input is-mono" value={intento.valor} spellCheck={false} onChange={(e) => onCambio({ ...intento, valor: e.target.value })} />
        </label>
        <span className="xcf-nota">{choices.columns.includes(intento.columna) ? "Ya existe en choices: se conservan sus marcas." : "Se crea con todas las opciones marcadas. Luego desmarcas en la lista."}</span>
      </div>
    );
  }
  return (
    <div className="xcf-config">
      <label className="xcf-campo">
        <span className="xcf-campo__rot">Expresión (choice_filter)</span>
        <textarea className="xcf-input is-mono xcf-expresion" rows={3} spellCheck={false} value={intento.texto} onChange={(e) => onCambio({ ...intento, texto: e.target.value })} />
      </label>
    </div>
  );
}
