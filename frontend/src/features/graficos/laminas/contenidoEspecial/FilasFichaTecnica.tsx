// Filas de la ficha técnica (`p_slide_tabla_tecnica`, arg `filas`) en Inspector › Contenido (A10 W-B, C38). Cada fila es
// un criterio y su detalle; se escriben, se quitan y se añaden. El texto viejo (una fila por línea) se lee como filas y
// no se reescribe hasta que el analista edita: el plan guardado viaja intacto mientras nadie lo toca.

import { useId, useRef, useState } from "react";
import { Plus, Trash2 } from "../../../../vendor/lucide-react";
import type { ArgMetadata } from "../../../../api/graficos";
import { normalizeTechnicalRows, type TechnicalRow } from "../../technicalRows";
import "./contenidoEspecial.css";

type Props = {
  arg: ArgMetadata;
  valor: unknown;
  onCambio: (filas: TechnicalRow[]) => void;
};

/** Filas tal como se editan: las que ya son `{criterio, detalle}` se leen sin recortar (si no, un espacio recién
 *  tecleado se borraría en cada render); el texto viejo y otras formas pasan por `normalizeTechnicalRows`. */
export function filasEditables(valor: unknown): TechnicalRow[] {
  const esFila = (f: unknown): f is { criterio?: unknown; detalle?: unknown } =>
    !!f && typeof f === "object" && !Array.isArray(f) && ("criterio" in f || "detalle" in f);
  if (Array.isArray(valor) && valor.every(esFila)) {
    return valor.map((f) => ({ criterio: String(f.criterio ?? ""), detalle: String(f.detalle ?? "") }));
  }
  return normalizeTechnicalRows(valor);
}

export function FilasFichaTecnica({ arg, valor, onCambio }: Props) {
  const filas = filasEditables(valor);
  const lista = useRef<HTMLOListElement>(null);
  const botonAnadir = useRef<HTMLButtonElement>(null);
  const [anuncio, setAnuncio] = useState("");
  const idTitulo = useId();
  const idAyuda = useId();
  const textoViejo = typeof valor === "string" && valor.trim().length > 0;

  const cambiarFila = (i: number, clave: keyof TechnicalRow, texto: string) => {
    onCambio(filas.map((f, k) => (k === i ? { ...f, [clave]: texto } : f)));
  };
  const quitar = (i: number) => {
    const nombre = filas[i].criterio.trim() || `la fila ${i + 1}`;
    onCambio(filas.filter((_, k) => k !== i));
    setAnuncio(`Se quitó ${nombre}. Ctrl+Z la devuelve.`);
    requestAnimationFrame(() => {
      const quedan = lista.current?.querySelectorAll<HTMLInputElement>("input");
      // Sin filas, el foco va a «Añadir fila»: nunca se pierde en el documento.
      (quedan?.[Math.max(0, Math.min(i, filas.length - 2))] ?? botonAnadir.current)?.focus();
    });
  };
  const anadir = () => {
    onCambio([...filas, { criterio: "", detalle: "" }]);
    requestAnimationFrame(() => {
      const inputs = lista.current?.querySelectorAll<HTMLInputElement>("input");
      inputs?.[inputs.length - 1]?.focus();
    });
  };

  return (
    <section className="pulso-f6-especial" aria-labelledby={idTitulo} aria-describedby={idAyuda}
      data-qa-geometry-group="graficos/f6-ficha-tecnica" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-especial-cabeza">
        <h3 id={idTitulo} className="pulso-f6-subtitulo">{arg.label || "Filas"}</h3>
        <span className="pulso-f6-ayuda">{filas.length === 0 ? "Ninguna" : `${filas.length} ${filas.length === 1 ? "fila" : "filas"}`}</span>
      </div>
      <span id={idAyuda} className="pulso-f6-ayuda">
        {arg.descripcion || "Cada fila lleva un criterio y su detalle."}
        {textoViejo ? " El texto guardado se separó en filas; se reescribe sólo cuando lo edites." : ""}
      </span>
      {filas.length === 0 ? (
        <p className="pulso-f6-especial-vacio">La ficha no tiene filas: sin ellas, la tabla sale vacía. Añade la primera.</p>
      ) : (
        <ol ref={lista} className="pulso-f6-filas" data-qa-geometry-group="graficos/f6-ficha-tecnica-filas" data-qa-geometry-contract="intrinsic">
          {filas.map((f, i) => (
            <li key={i} className="pulso-f6-fila-tecnica" data-qa-geometry-member>
              <input
                className="pulso-f6-input"
                aria-label={`Criterio de la fila ${i + 1}`}
                placeholder="Ej. Periodo de campo"
                value={f.criterio}
                onChange={(e) => cambiarFila(i, "criterio", e.target.value)}
              />
              <textarea
                className="pulso-f6-input"
                rows={2}
                aria-label={`Detalle de la fila ${i + 1}`}
                placeholder="Detalle que verá el cliente"
                value={f.detalle}
                onChange={(e) => cambiarFila(i, "detalle", e.target.value)}
              />
              <button type="button" className="pulso-f6-icono-boton" aria-label={`Quitar la fila ${i + 1}`} onClick={() => quitar(i)}>
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <button ref={botonAnadir} type="button" className="pulso-f6-boton pulso-f6-especial-anadir" onClick={anadir}>
        <Plus size={15} aria-hidden="true" />
        Añadir fila
      </button>
      <span className="pulso-sr-only" aria-live="polite">{anuncio}</span>
    </section>
  );
}
