// "Listas" (prototipo, Analítica › Categorías): el buscador por lista o por
// pregunta y las listas de respuesta del formulario, con si son ordinales y
// cuántas preguntas las usan. La elegida vive en `?foco=`.

import { useEffect, useRef } from "react";

import { EstadoVacio } from "../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoInput } from "../../../components/PulsoInput";
import { formatoConteoDe } from "../../../lib/formatoNumero";
import { ListOrdered, Search } from "../../../vendor/lucide-react";
import type { ListaCatalogoEntry } from "../panes/ordenCategoriasModel";

export function PanelDeListas({ total, listas, elegida, consulta, onBuscar, onElegir }: {
  total: number;
  listas: readonly ListaCatalogoEntry[];
  elegida: string | null;
  consulta: string;
  onBuscar: (consulta: string) => void;
  onElegir: (listName: string) => void;
}) {
  // Con `?foco=` la lista elegida puede caer bajo el pliegue del panel: se trae a la vista
  // sin mover la página (block "nearest").
  const listaRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [elegida]);
  return (
    <PanelDeMesa zona="listas" titulo="Listas" conteo={total}>
      <div className="categorias-buscador">
        <Search size={14} aria-hidden="true" />
        <PulsoInput
          size="sm"
          type="search"
          value={consulta}
          onChange={(e) => onBuscar(e.target.value)}
          placeholder="Buscar lista o pregunta"
          aria-label="Buscar lista o pregunta"
        />
      </div>
      {total === 0 ? (
        <EstadoVacio
          icono={<ListOrdered size={16} />}
          titulo="El formulario no trae listas de respuesta"
          descripcion="Las categorías se ordenan en las preguntas de opción única o múltiple."
        />
      ) : null}
      {total > 0 && listas.length === 0 ? (
        <EstadoVacio
          icono={<Search size={16} />}
          titulo="Ninguna lista coincide"
          descripcion={`Nada con "${consulta.trim()}" en el nombre de una lista ni en sus preguntas.`}
        />
      ) : null}
      {listas.length > 0 ? (
        // C1: cada lista mide lo que su nombre; no son marcos pares.
        <ul
          ref={listaRef}
          className="categorias-listas"
          aria-label="Listas de respuesta"
          data-qa-geometry-group="analitica/categorias-listas"
          data-qa-geometry-contract="intrinsic"
        >
          {listas.map((e) => (
            <li key={e.listName}>
              <button
                type="button"
                className="categorias-lista"
                aria-current={e.listName === elegida ? "true" : undefined}
                onClick={() => onElegir(e.listName)}
              >
                <b>{e.listName}</b>
                <span className="categorias-lista-detalle">
                  <span className="categorias-marca" data-tono={e.ordinalEfectivo ? "ordinal" : undefined}>
                    {e.ordinalEfectivo ? "Ordinal" : "Sin orden"}
                  </span>
                  {formatoConteoDe(e.nVariables, "pregunta", "preguntas")}
                  {e.tieneOverride ? <span className="categorias-lista-propio">Orden propio</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </PanelDeMesa>
  );
}
