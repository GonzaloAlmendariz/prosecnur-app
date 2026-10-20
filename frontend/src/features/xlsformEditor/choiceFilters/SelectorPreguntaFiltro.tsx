// Selector de pregunta de «Filtros de opciones» (E5, 2026-10-20): lista en línea con búsqueda por código o texto,
// el sello del tipo y la marca «ya tiene filtro». Reemplaza al <select> nativo de ~500 preguntas sin búsqueda. Las
// filas van alineadas a la izquierda. Teclado: flechas mueven, Enter elige (patrón combobox con aria-activedescendant).

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { Search } from "../../../vendor/lucide-react";
import { Sello } from "../kit";

export type PreguntaElegible = { name: string; titulo: string; baseType: string; tieneFiltro?: boolean };

type Props = {
  preguntas: readonly PreguntaElegible[];
  /** Elegidas (una en modo simple, varias en modo múltiple). */
  elegidas: readonly string[];
  onElegir: (name: string) => void;
  etiqueta: string;
  /** Muestra la marca «ya tiene filtro». */
  marcarConFiltro?: boolean;
  multiple?: boolean;
  autoFocus?: boolean;
};

const TOPE = 150;

export function SelectorPreguntaFiltro({ preguntas, elegidas, onElegir, etiqueta, marcarConFiltro, multiple, autoFocus }: Props) {
  const id = useId();
  const [busca, setBusca] = useState("");
  const [activo, setActivo] = useState(0);
  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? preguntas.filter((p) => `${p.name} ${p.titulo}`.toLowerCase().includes(q)) : preguntas;
  }, [preguntas, busca]);
  const mostradas = visibles.slice(0, TOPE);
  const idOpcion = (i: number) => `${id}-op-${i}`;

  const tecla = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActivo((a) => Math.min(a + 1, mostradas.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && mostradas[activo]) { e.preventDefault(); onElegir(mostradas[activo]!.name); }
  };

  return (
    <div className="xcf-sel">
      <label className="xcf-sel__busca">
        <Search size={13} aria-hidden="true" />
        <input
          role="combobox"
          aria-expanded="true"
          aria-controls={`${id}-lista`}
          aria-activedescendant={mostradas[activo] ? idOpcion(activo) : undefined}
          aria-label={`Buscar: ${etiqueta}`}
          placeholder="Buscar por código o texto"
          value={busca}
          autoFocus={autoFocus}
          onChange={(e) => { setBusca(e.target.value); setActivo(0); }}
          onKeyDown={tecla}
        />
      </label>
      <ul id={`${id}-lista`} role="listbox" aria-label={etiqueta} aria-multiselectable={multiple || undefined} className="xcf-sel__lista">
        {mostradas.length ? mostradas.map((p, i) => {
          const elegida = elegidas.includes(p.name);
          return (
            <li
              key={p.name}
              id={idOpcion(i)}
              role="option"
              aria-selected={elegida}
              className={`xcf-sel__op${elegida ? " is-elegida" : ""}${i === activo ? " is-activa" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActivo(i)}
              onClick={() => onElegir(p.name)}
            >
              <Sello baseType={p.baseType} size={16} />
              <code className="xcf-sel__codigo" title={p.name}>{p.name}</code>
              <span className="xcf-sel__titulo" title={p.titulo}>{p.titulo}</span>
              {marcarConFiltro && p.tieneFiltro ? <span className="xcf-chip is-nunca">ya tiene filtro</span> : null}
            </li>
          );
        }) : <li className="xcf-sel__nada" role="presentation">Ninguna pregunta coincide.</li>}
        {visibles.length > TOPE ? <li className="xcf-sel__nada" role="presentation">{visibles.length - TOPE} más. Escribe para acotar.</li> : null}
      </ul>
    </div>
  );
}
