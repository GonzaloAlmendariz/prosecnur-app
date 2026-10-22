// Los filtros del tablero, como chips removibles. Se aplican a todo: tablero,
// cruce y lista.

import { formatoConteoDe } from "../../../../lib/formatoNumero";
import { X } from "../../../../vendor/lucide-react";
import { chipsDeFiltros, rotuloDeValor } from "./modeloContactos";
import { useContactosStore } from "./store";

type Props = {
  etiquetas: Readonly<Record<string, string>>;
  base: number | null;
};

export function FiltrosActivos({ etiquetas, base }: Props) {
  const filtros = useContactosStore((s) => s.filtros);
  const quitar = useContactosStore((s) => s.quitarFiltro);
  const limpiar = useContactosStore((s) => s.limpiarFiltros);
  const chips = chipsDeFiltros(filtros, etiquetas);
  if (chips.length === 0) return null;
  return (
    <div className="rec-contactos-filtros" role="group" aria-label="Filtros activos" data-testid="contactos-filtros">
      <span className="rec-contactos-filtros-rotulo">
        Filtrado{base !== null ? `: ${formatoConteoDe(base, "efectivo")}` : ""}
      </span>
      <ul className="rec-contactos-filtros-lista">
        {chips.map((chip) => (
          <li key={`${chip.columna}\u0000${chip.valor}`}>
            <span className="rec-contactos-chip">
              <span className="rec-contactos-chip-texto">
                <span className="rec-contactos-chip-columna">{chip.etiqueta}:</span> {rotuloDeValor(chip.valor)}
              </span>
              <button
                type="button"
                className="rec-contactos-chip-quitar"
                aria-label={`Quitar el filtro ${chip.rotulo}`}
                title="Quitar este filtro"
                onClick={() => quitar(chip.columna, chip.valor)}
              >
                <X size={12} aria-hidden />
              </button>
            </span>
          </li>
        ))}
      </ul>
      {chips.length > 1 ? (
        <button type="button" className="rec-mail-link" onClick={limpiar}>Quitar todos</button>
      ) : null}
    </div>
  );
}
