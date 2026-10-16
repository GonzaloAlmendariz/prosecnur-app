import { PulsoButton } from "../../../components/PulsoButton";
import type { MaterialCatalogPreset } from "../../../api/materialCatalog";
import { Check, Loader2, Pencil } from "../../../vendor/lucide-react";
import { PanelCard, PropRow } from "../../xlsformEditor/kit";
import { EscenarioDePagina } from "./EscenarioDePagina";
import type { VistaDePagina } from "./estadoCatalogo";
import {
  textoDeCopias,
  textoDeFormato,
  textoDeImpresion,
  textoDeLectura,
  textoDePaginas,
} from "./modeloCatalogo";

type Props = {
  preset: MaterialCatalogPreset;
  paginas: number;
  vistaDe: (page: number) => VistaDePagina | undefined;
  motivo: string | null;
  usando: boolean;
  /** Por qué «Usar este tipo» no está disponible (sin estado del plan, por ejemplo). */
  bloqueoUsar: string | null;
  error: string;
  onUsar: () => void;
  onAbrirEditor: () => void;
};

function rotuloDePagina(preset: MaterialCatalogPreset, page: number, total: number): string {
  if (preset.faces === 2 && total === 2) return page === 1 ? "Frente" : "Dorso";
  return `Página ${page}`;
}

export function InspectorDeTipo({
  preset,
  paginas,
  vistaDe,
  motivo,
  usando,
  bloqueoUsar,
  error,
  onUsar,
  onAbrirEditor,
}: Props) {
  const copias = textoDeCopias(preset.copies_per);
  const motivoUsar = preset.active ? "Es la plantilla en uso." : motivo ?? bloqueoUsar;
  const paginasLista = Array.from({ length: paginas }, (_, i) => i + 1);
  return (
    <PanelCard
      className="rec-cat-inspector"
      fill
      aria-label={`Tipo seleccionado: ${preset.title}`}
      title={preset.title}
      meta={preset.active ? <span className="rec-cat-en-uso">En uso</span> : textoDePaginas(paginas)}
      footer={(
        <div className="rec-cat-acciones">
          <PulsoButton
            variant="primary"
            size="sm"
            disabled={Boolean(motivoUsar) || usando}
            title={motivoUsar ?? undefined}
            onClick={onUsar}
          >
            {usando ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Check size={14} aria-hidden />}
            {preset.active ? "En uso" : "Usar este tipo"}
          </PulsoButton>
          <PulsoButton variant="secondary" size="sm" onClick={onAbrirEditor}>
            <Pencil size={14} aria-hidden /> Abrir en el editor
          </PulsoButton>
          {error ? <p className="rec-inline-error" role="alert">{error}</p> : null}
        </div>
      )}
    >
      <ol className="rec-cat-paginas" aria-label="Páginas del tipo">
        {paginasLista.map((page) => (
          <li key={page}>
            <EscenarioDePagina
              frente={vistaDe(page)}
              orientation={preset.orientation}
              alt={`${preset.title}, ${rotuloDePagina(preset, page, paginas).toLowerCase()}`}
              tamano="pagina"
            />
            <span className="rec-cat-pagina-rotulo">{rotuloDePagina(preset, page, paginas)}</span>
          </li>
        ))}
      </ol>
      <div className="rec-cat-props">
        <PropRow label="Formato">{textoDeFormato(preset)}</PropRow>
        <PropRow label="Cuántos">{copias ?? "Sin declarar"}</PropRow>
        <PropRow label="Lee de">{textoDeLectura(preset.compatible_unit_types)}</PropRow>
        <PropRow label="Impresión">{textoDeImpresion(preset.faces)}</PropRow>
      </div>
      {motivo ? <p className="rec-cat-motivo rec-cat-motivo--inspector">{motivo}</p> : null}
    </PanelCard>
  );
}
