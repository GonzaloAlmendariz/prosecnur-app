import { FAMILIAS_TIPO, type FamiliaTipo } from "./tiposVariable";

/**
 * Chips de tipo con su conteo (E1, E7): filtran la lista. Un chip sin
 * variables se deshabilita en vez de dejar una lista vacía al tocarlo.
 */
export default function ChipsTipo({
  valor,
  conteo,
  onCambio,
  etiqueta,
}: {
  valor: FamiliaTipo;
  conteo: Readonly<Record<FamiliaTipo, number>>;
  onCambio: (familia: FamiliaTipo) => void;
  etiqueta: string;
}) {
  return (
    <div className="vx-chips" role="group" aria-label={etiqueta}>
      {FAMILIAS_TIPO.map((f) => (
        <button
          key={f.id}
          type="button"
          className="vx-chip"
          aria-pressed={valor === f.id}
          disabled={f.id !== "todas" && conteo[f.id] === 0}
          onClick={() => onCambio(f.id)}
        >
          {f.etiqueta} <span>{conteo[f.id]}</span>
        </button>
      ))}
    </div>
  );
}
