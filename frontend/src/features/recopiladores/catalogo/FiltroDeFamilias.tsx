import type { FamiliaDelCatalogo } from "./modeloCatalogo";

type Props = {
  familias: readonly FamiliaDelCatalogo[];
  activa: string;
  onChange: (familia: string) => void;
};

/** Filtro de la galería por familia, con su conteo. Filtra; no es navegación. */
export function FiltroDeFamilias({ familias, activa, onChange }: Props) {
  return (
    <nav className="rec-cat-familias" aria-label="Familias de material">
      <span className="xfk-over rec-cat-familias-titulo">Familias</span>
      <ul>
        {familias.map((familia) => (
          <li key={familia.id}>
            <button
              type="button"
              className={`rec-cat-familia${familia.id === activa ? " is-active" : ""}`}
              aria-pressed={familia.id === activa}
              onClick={() => onChange(familia.id)}
            >
              <span>{familia.label}</span>
              <span className="rec-cat-familia-cuenta">{familia.count.toLocaleString("es-PE")}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
