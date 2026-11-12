/**
 * Elegir varias opciones de una pregunta: una lista de interruptores con la
 * etiqueta, el código y cuántas respuestas tiene cada una. Con más de ocho, un
 * buscador. Era `OptionChecklist` de `components/ReglaEditor.tsx`.
 */
import { useState } from "react";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { Search } from "../../../../vendor/lucide-react";
import type { OpcionDeVariable } from "./opcionesDeVariable";

export function ListaDeOpciones({
  opciones,
  valor,
  onCambio,
  compacta = false,
  ariaLabel,
}: {
  opciones: readonly OpcionDeVariable[];
  valor: readonly string[];
  onCambio: (valor: string[]) => void;
  compacta?: boolean;
  ariaLabel: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const elegidas = new Set(valor);
  const q = busqueda.trim().toLowerCase();
  const visibles = opciones
    .filter((o) => !q || o.code.toLowerCase().includes(q) || o.label.toLowerCase().includes(q))
    .slice(0, compacta ? 80 : 140);

  function alternar(codigo: string) {
    const siguiente = new Set(elegidas);
    if (siguiente.has(codigo)) siguiente.delete(codigo);
    else siguiente.add(codigo);
    onCambio(Array.from(siguiente));
  }

  return (
    <div className="pulso-regla-opciones" data-compacta={compacta ? "" : undefined}>
      {opciones.length > 8 ? (
        <PulsoInput
          size="sm"
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar opción"
          aria-label={`Buscar en ${ariaLabel}`}
        />
      ) : null}
      <ul
        className="pulso-regla-opciones-lista"
        aria-label={ariaLabel}
        data-qa-geometry-group="validacion/regla-opciones"
        data-qa-geometry-contract="equal"
      >
        {visibles.map((o) => (
          <li key={o.code} className="pulso-regla-opciones-fila" data-elegida={elegidas.has(o.code) ? "" : undefined}>
            <PulsoSwitch
              size="sm"
              checked={elegidas.has(o.code)}
              onCheckedChange={() => alternar(o.code)}
              label={o.label || o.code}
              description={o.code !== o.label ? o.code : undefined}
            />
            <span className="pulso-regla-opciones-n">{formatoConteo(o.n)}</span>
          </li>
        ))}
      </ul>
      {!visibles.length ? <EstadoVacio tamano="compacto" icono={<Search size={16} />} titulo="Sin opciones con ese filtro" /> : null}
    </div>
  );
}
