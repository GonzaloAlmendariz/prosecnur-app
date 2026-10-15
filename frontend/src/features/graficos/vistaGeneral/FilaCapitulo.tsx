// Una fila de la Vista general (F6.3): un bloque (Apertura, Cómo leer este informe, Cierre) o un capítulo con su
// separador, sus subcapítulos y sus láminas como tarjetas pares. La cabecera dice cuántas láminas tiene y cuántas
// llevan gráfico; la de un capítulo además se arrastra (asa) o se mueve con Alt+↑/↓ y con sus botones.

import { type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, Plus } from "../../../vendor/lucide-react";
import type { FilaVistaGeneral } from "./modeloVistaGeneral";

type Props = {
  fila: FilaVistaGeneral;
  /** Posición entre los capítulos (0-based) y cuántos hay; null en los bloques. */
  indiceCapitulo: number | null;
  totalCapitulos: number;
  arrastrada: boolean;
  soltarCapitulo: "antes" | "despues" | null;
  soltarAlFinal: boolean;
  onMoverCapitulo: (filaId: string, dir: -1 | 1) => void;
  onArrastrarCapitulo: (filaId: string, e: DragEvent<HTMLElement>) => void;
  onSobreFila: (filaId: string, e: DragEvent<HTMLElement>) => void;
  onSobreFinFila: (filaId: string, e: DragEvent<HTMLElement>) => void;
  onSoltar: (e: DragEvent<HTMLElement>) => void;
  onFinArrastre: () => void;
  /** I5: el capítulo está plegado (sólo su cabecera a la vista). */
  plegado: boolean;
  onPlegar: (filaId: string) => void;
  /** I5: cuántas láminas piden atención (aviso, colores o ranura vacía). */
  atencion: number;
  /** I5: agrega una lámina al final de la fila. */
  onAgregar: (filaId: string) => void;
  children: ReactNode;
};

export function textoConteo(c: FilaVistaGeneral["conteo"], atencion = 0): string {
  const partes = [`${c.laminas} ${c.laminas === 1 ? "lámina" : "láminas"}`, `${c.conGrafico} con gráfico`];
  if (atencion) partes.push(`${atencion} ${atencion === 1 ? "pide" : "piden"} atención`);
  else if (c.incompletas) partes.push(`${c.incompletas} ${c.incompletas === 1 ? "incompleta" : "incompletas"}`);
  return partes.join(", ");
}

export function FilaCapitulo({
  fila, indiceCapitulo, totalCapitulos, arrastrada, soltarCapitulo, soltarAlFinal,
  onMoverCapitulo, onArrastrarCapitulo, onSobreFila, onSobreFinFila, onSoltar, onFinArrastre,
  plegado, onPlegar, atencion, onAgregar, children,
}: Props) {
  const idTitulo = `pulso-f6-vg-fila-${fila.id}`;
  const esCapitulo = fila.clase === "capitulo" && indiceCapitulo !== null;
  const onTeclaAsa = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    // El atajo global del editor (Alt+↑/↓ mueve la lámina seleccionada) no debe actuar también.
    e.stopPropagation();
    onMoverCapitulo(fila.id, e.key === "ArrowUp" ? -1 : 1);
  };
  const clases = [
    "pulso-f6-vg-fila",
    `is-${fila.clase}`,
    arrastrada ? "is-arrastrada" : "",
    soltarCapitulo ? `is-soltar-${soltarCapitulo}` : "",
    plegado ? "is-plegado" : "",
  ].filter(Boolean).join(" ");
  return (
    <section
      className={clases}
      aria-labelledby={idTitulo}
      data-vg-fila={fila.id}
      data-qa-geometry-member
      onDragOver={(e) => onSobreFila(fila.id, e)}
      onDrop={onSoltar}
    >
      <header className="pulso-f6-vg-fila-cabeza">
        <button
          type="button"
          className="pulso-f6-icono-boton pulso-f6-vg-plegar"
          aria-expanded={!plegado}
          aria-controls={`${idTitulo}-cuerpo`}
          aria-label={`${plegado ? "Desplegar" : "Plegar"} ${fila.rotulo}`}
          onClick={() => onPlegar(fila.id)}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {esCapitulo ? (
          <button
            type="button"
            className="pulso-f6-icono-boton pulso-f6-vg-asa"
            draggable
            aria-label={`Mover el capítulo ${fila.rotulo}`}
            title="Arrastra para mover el capítulo (con el teclado, Alt+↑ o Alt+↓)"
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
            onKeyDown={onTeclaAsa}
            onDragStart={(e) => onArrastrarCapitulo(fila.id, e)}
            onDragEnd={onFinArrastre}
          >
            <GripVertical size={16} aria-hidden="true" />
          </button>
        ) : (
          <span className="pulso-f6-vg-asa-hueco" aria-hidden="true" />
        )}
        {fila.numero && <span className="pulso-f6-num pulso-f6-vg-num">{fila.numero}</span>}
        <h3 id={idTitulo} className="pulso-f6-vg-fila-titulo" title={fila.titulo}>{fila.titulo}</h3>
        <span className={`pulso-f6-vg-fila-conteo${atencion ? " is-atencion" : ""}`}>{textoConteo(fila.conteo, atencion)}</span>
        <span className="pulso-f6-col-sp" />
        {esCapitulo && (
          <span className="pulso-f6-vg-fila-acciones">
            <button
              type="button"
              className="pulso-f6-icono-boton"
              aria-label={`Subir el capítulo ${fila.rotulo}`}
              title="Subir el capítulo (Alt+↑)"
              disabled={indiceCapitulo === 0}
              onClick={() => onMoverCapitulo(fila.id, -1)}
            >
              <ArrowUp size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="pulso-f6-icono-boton"
              aria-label={`Bajar el capítulo ${fila.rotulo}`}
              title="Bajar el capítulo (Alt+↓)"
              disabled={indiceCapitulo >= totalCapitulos - 1}
              onClick={() => onMoverCapitulo(fila.id, 1)}
            >
              <ArrowDown size={16} aria-hidden="true" />
            </button>
          </span>
        )}
        <button type="button" className="pulso-f6-boton pulso-f6-vg-agregar" onClick={() => onAgregar(fila.id)}
          aria-label={`Agregar una lámina al final de ${fila.rotulo}`}>
          <Plus size={14} aria-hidden="true" />
          Lámina
        </button>
      </header>
      {/* Tarjetas: marco 176 × 99 + pie, iguales entre sí (C2). Soltar en el hueco tras la última la deja al final. */}
      {/* I5: plegar anima la altura de este envoltorio (0fr ↔ 1fr); plegado, lo de dentro sale del orden de foco. */}
      <div className="pulso-f6-vg-fila-cuerpo" id={`${idTitulo}-cuerpo`} ref={(el) => { if (el) el.inert = plegado; }}>
      <ul
        className={`pulso-f6-vg-tarjetas${soltarAlFinal ? " is-soltar-fin" : ""}`}
        role="listbox"
        aria-multiselectable="true"
        aria-labelledby={idTitulo}
        aria-orientation="horizontal"
        data-qa-geometry-group={`graficos/f6-vg-tarjetas-${fila.clase}`}
        data-qa-geometry-contract="equal"
        onDragOver={(e) => { if (e.target === e.currentTarget) onSobreFinFila(fila.id, e); }}
        onDrop={onSoltar}
      >
        {children}
      </ul>
      </div>
    </section>
  );
}
