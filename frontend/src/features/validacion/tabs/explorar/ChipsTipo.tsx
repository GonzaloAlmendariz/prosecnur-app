import { TIPO_TONO, FAMILIAS_TIPO, type FamiliaTipo } from "./tiposVariable";

/**
 * Chips de tipo con su conteo (E1, E7; prototipo `pp-tipos-f`): filtran la
 * lista. Cada tipo lleva su punto de color (`--tipo-*`). Un chip sin
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
          {f.id !== "todas" && <i className="vx-tp" data-tono={TIPO_TONO[f.id]} aria-hidden />}
          <b>{f.etiqueta}</b>
          <span>{conteo[f.id]}</span>
        </button>
      ))}
    </div>
  );
}
