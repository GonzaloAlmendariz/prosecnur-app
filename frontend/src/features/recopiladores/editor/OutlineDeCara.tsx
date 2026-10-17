import type { CollectionBlockType, CollectionMaterialBlock } from "../../../api/recopiladores";
import { rotuloDeBloque } from "../bloquesDeMaterial";
import { subtituloDelBloque } from "../outlineDelBloque";
import { notasDe, type NotasDeBloque } from "./modeloEditor";

type Props = {
  /** «Frente · Ficha de campo», «Croquis»… */
  titulo: string;
  blocks: readonly CollectionMaterialBlock[];
  seleccion: string | null;
  onSeleccionar: (blockId: string) => void;
  /** Bloques que llena la unidad (para el punto de procedencia). */
  deLaUnidad: ReadonlySet<string>;
  notas: Map<string, NotasDeBloque>;
  tiposAgregables: readonly CollectionBlockType[];
  onAgregar: (type: CollectionBlockType) => void;
};

/** La línea de estado de una fila: lo más grave primero. */
function subtituloDeFila(block: CollectionMaterialBlock, rotulo: string, notas: NotasDeBloque): { texto: string; tono: "problema" | "nota" | "neutro" } {
  if (notas.problemas.length) return { texto: notas.problemas[0], tono: "problema" };
  if (notas.noDibujado) return { texto: notas.noDibujado, tono: "nota" };
  if (notas.avisos.length) return { texto: notas.avisos[0], tono: "nota" };
  return { texto: subtituloDelBloque(block.text, rotulo), tono: "neutro" };
}

/**
 * Los bloques de la cara activa, en el orden de la receta. Cada fila elige el
 * mismo bloque que su zona en la página; el punto dice si lo llena la unidad
 * (acento) o es texto fijo (neutro).
 */
export function OutlineDeCara({
  titulo,
  blocks,
  seleccion,
  onSeleccionar,
  deLaUnidad,
  notas,
  tiposAgregables,
  onAgregar,
}: Props) {
  return (
    <section className="rec-ed-columna rec-ed-outline" aria-label="Bloques de la cara">
      <header className="rec-ed-columna-cabecera">
        <span className="rec-ed-sobre">{titulo}</span>
        <strong>{blocks.length === 1 ? "Un bloque" : `${blocks.length.toLocaleString("es-PE")} bloques`}</strong>
      </header>
      <ol
        className="rec-ed-filas"
        data-qa-geometry-group="material-editor-outline"
        data-qa-geometry-contract="equal"
      >
        {blocks.map((block) => {
          const rotulo = rotuloDeBloque(block.type);
          const deEsta = notasDe(notas, block.block_id);
          const sub = subtituloDeFila(block, rotulo, deEsta);
          const elegida = seleccion === block.block_id;
          return (
            <li key={block.block_id}>
              <button
                type="button"
                className={[
                  "rec-ed-fila",
                  elegida ? "is-elegida" : "",
                  deEsta.problemas.length ? "is-problema" : "",
                  deEsta.noDibujado ? "is-no-dibujado" : "",
                ].filter(Boolean).join(" ")}
                aria-current={elegida ? "true" : undefined}
                title={sub.texto ? `${rotulo}: ${sub.texto}` : rotulo}
                onClick={() => onSeleccionar(block.block_id)}
              >
                <span
                  className={`rec-ed-procedencia${deLaUnidad.has(block.block_id) ? " is-unidad" : ""}`}
                  aria-hidden
                />
                <span className="rec-ed-fila-texto">
                  <span className="rec-ed-fila-rotulo">{rotulo}</span>
                  {sub.texto ? <small className={`rec-ed-fila-sub is-${sub.tono}`}>{sub.texto}</small> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <footer className="rec-ed-columna-pie">
        <div className="rec-ed-leyenda" aria-label="Qué significa el punto de cada bloque">
          <span><span className="rec-ed-procedencia is-unidad" aria-hidden /> Lo llena cada unidad</span>
          <span><span className="rec-ed-procedencia" aria-hidden /> Texto fijo</span>
        </div>
        {tiposAgregables.length ? (
          <select
            className="rec-ed-agregar"
            aria-label="Añadir bloque a esta cara"
            value=""
            onChange={(event) => {
              const type = event.target.value as CollectionBlockType;
              if (type) onAgregar(type);
            }}
          >
            <option value="" disabled>Añadir bloque…</option>
            {tiposAgregables.map((type) => <option key={type} value={type}>{rotuloDeBloque(type)}</option>)}
          </select>
        ) : null}
      </footer>
    </section>
  );
}
