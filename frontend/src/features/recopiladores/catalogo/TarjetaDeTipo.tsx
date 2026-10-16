import type { MaterialCatalogPreset } from "../../../api/materialCatalog";
import { EscenarioDePagina } from "./EscenarioDePagina";
import type { VistaDePagina } from "./estadoCatalogo";
import { chipsDelTipo } from "./modeloCatalogo";

type Props = {
  preset: MaterialCatalogPreset;
  seleccionado: boolean;
  frente: VistaDePagina | undefined;
  dorso: VistaDePagina | undefined;
  /** Motivo por el que el tipo no aplica al plan; `null` si aplica. */
  motivo: string | null;
  onSelect: () => void;
};

export function TarjetaDeTipo({ preset, seleccionado, frente, dorso, motivo, onSelect }: Props) {
  const chips = chipsDelTipo(preset);
  const cls = [
    "rec-cat-tarjeta",
    seleccionado ? "is-selected" : "",
    motivo ? "is-incompatible" : "",
  ].filter(Boolean).join(" ");
  return (
    <button
      type="button"
      className={cls}
      aria-pressed={seleccionado}
      title={motivo ?? preset.title}
      onClick={onSelect}
      data-qa-geometry-member
    >
      <EscenarioDePagina
        frente={frente}
        dorso={preset.faces === 2 ? dorso : undefined}
        orientation={preset.orientation}
        alt={preset.title}
      />
      <span className="rec-cat-tarjeta-texto">
        <span className="rec-cat-tarjeta-titulo">
          <strong>{preset.title}</strong>
          {preset.active ? <span className="rec-cat-en-uso">En uso</span> : null}
        </span>
        <span className="rec-cat-chips">
          {chips.map((chip) => <span key={chip} className="rec-cat-chip">{chip}</span>)}
        </span>
        {motivo ? <span className="rec-cat-motivo">{motivo}</span> : null}
      </span>
    </button>
  );
}
