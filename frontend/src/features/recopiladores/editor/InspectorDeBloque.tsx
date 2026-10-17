import type { CollectionMaterialBlock } from "../../../api/recopiladores";
import type { MaterialPreviewZone } from "../../../api/materialPreview";
import { PulsoButton } from "../../../components/PulsoButton";
import { ArrowDown, ArrowUp, Trash2 } from "../../../vendor/lucide-react";
import { PropRow } from "../../xlsformEditor/kit";
import { rotuloDeBloque } from "../bloquesDeMaterial";
import { AjustesDelBloque } from "./AjustesDelBloque";
import { loLlena, procedencia, puedeQuitar, siFalta, type NotasDeBloque } from "./modeloEditor";

type Props = {
  /** La cara del bloque: `block_id` sólo es único dentro de ella. */
  pageId: string;
  block: CollectionMaterialBlock | null;
  /** La zona del bloque en la página, si la página ya lo dibujó. */
  zona: MaterialPreviewZone | null;
  notas: NotasDeBloque;
  puedeSubir: boolean;
  puedeBajar: boolean;
  onCambiar: (patch: Partial<CollectionMaterialBlock>) => void;
  onMover: (direccion: -1 | 1) => void;
  onQuitar: () => void;
  /** `data-pulso-panel` del inspector declarado. */
  panelProps: { "data-pulso-panel": string };
};

/**
 * El bloque elegido: qué es, qué lo llena, de quién es el dato y qué pasa si
 * falta. Los ajustes son sólo los que cambian la tinta en esta cara, y las
 * flechas sólo aparecen si el layout apila el bloque de verdad.
 */
export function InspectorDeBloque({
  pageId,
  block,
  zona,
  notas,
  puedeSubir,
  puedeBajar,
  onCambiar,
  onMover,
  onQuitar,
  panelProps,
}: Props) {
  if (!block) {
    return (
      <aside className="rec-ed-columna rec-ed-inspector" aria-label="Bloque elegido" {...panelProps}>
        <div className="rec-contained-empty" data-qa-geometry-capacity="owned">Esta cara no tiene bloques.</div>
      </aside>
    );
  }
  const rotulo = rotuloDeBloque(block.type);
  const origen = procedencia(block, zona?.fills_from);
  const movible = zona?.reorderable === true;
  const quitable = puedeQuitar(block);
  return (
    <aside className="rec-ed-columna rec-ed-inspector" aria-label={`Bloque elegido: ${rotulo}`} {...panelProps}>
      <header className="rec-ed-columna-cabecera">
        <span className="rec-ed-sobre">Bloque</span>
        <strong>{rotulo}</strong>
        <span className={`rec-ed-origen${origen.llenaLaUnidad ? " is-unidad" : ""}`}>
          {origen.llenaLaUnidad ? "Lo llena cada unidad" : "Igual en todas las fichas"}
        </span>
      </header>
      <div className="rec-ed-cuerpo">
        {notas.problemas.length || notas.noDibujado || notas.avisos.length ? (
          <ul className="rec-ed-notas">
            {notas.problemas.map((texto) => <li key={`p-${texto}`} className="is-problema" role="alert">{texto}</li>)}
            {notas.noDibujado ? <li className="is-nota">{notas.noDibujado}</li> : null}
            {notas.avisos.map((texto) => <li key={`a-${texto}`} className="is-nota">{texto}</li>)}
          </ul>
        ) : null}
        <div
          className="rec-ed-props"
          data-qa-geometry-group="material-editor-inspector-filas"
          data-qa-geometry-contract="equal"
        >
          <PropRow label="Tipo">{rotulo}</PropRow>
          <PropRow label="Lo llena">{loLlena(block, zona?.fills_from)}</PropRow>
          <PropRow label="Dueño del dato">{origen.dueno}</PropRow>
          <PropRow label="Si falta">{siFalta(block)}</PropRow>
        </div>
        <AjustesDelBloque pageId={pageId} block={block} editable={zona?.editable ?? []} onCambiar={onCambiar} />
      </div>
      <footer className="rec-ed-columna-pie rec-ed-acciones">
        {movible ? (
          <span className="rec-ed-mover" role="group" aria-label="Orden en la cara">
            <PulsoButton variant="icon" size="sm" aria-label={`Subir ${rotulo}`} title="Subir" disabled={!puedeSubir} onClick={() => onMover(-1)}>
              <ArrowUp size={14} aria-hidden />
            </PulsoButton>
            <PulsoButton variant="icon" size="sm" aria-label={`Bajar ${rotulo}`} title="Bajar" disabled={!puedeBajar} onClick={() => onMover(1)}>
              <ArrowDown size={14} aria-hidden />
            </PulsoButton>
          </span>
        ) : null}
        <PulsoButton
          variant="secondary"
          size="sm"
          disabled={!quitable}
          title={quitable ? undefined : "El QR y lo obligatorio no se quitan."}
          onClick={onQuitar}
        >
          <Trash2 size={14} aria-hidden /> Quitar de esta receta
        </PulsoButton>
      </footer>
    </aside>
  );
}
