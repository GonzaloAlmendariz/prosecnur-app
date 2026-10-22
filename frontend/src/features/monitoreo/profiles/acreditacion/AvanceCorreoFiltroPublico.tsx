import { clasePublico, type PaletaDePublicos } from "./paletaPublicos";

// Chips de público con su color: eligen qué público leen el embudo, la
// cronología y la tabla de envíos. Botones con `aria-pressed`: un grupo de
// conmutadores, no pestañas.

export function AvanceCorreoFiltroPublico({
  publicos,
  elegido,
  paleta,
  onElegir,
}: {
  publicos: readonly string[];
  elegido: string;
  paleta: PaletaDePublicos;
  onElegir: (publico: string) => void;
}) {
  if (publicos.length < 2) return null;
  return (
    <div className="mon-correo-chips-publico" role="group" aria-label="Público">
      <button
        type="button"
        className="mon-correo-chip-publico es-todos"
        aria-pressed={!elegido}
        onClick={() => onElegir("")}
      >
        Todos
      </button>
      {publicos.map((p) => (
        <button
          key={p}
          type="button"
          className={`mon-correo-chip-publico ${clasePublico(paleta, p)}`}
          aria-pressed={elegido === p}
          onClick={() => onElegir(p)}
        >
          <i className="mon-publico-punto" aria-hidden />
          {p}
        </button>
      ))}
    </div>
  );
}
