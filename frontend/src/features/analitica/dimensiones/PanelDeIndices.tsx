// "Índices" (prototipo, Analítica › Dimensiones): cada índice con su puntaje
// medio y su barra de 0 a 100; después, los bloques que ningún índice usa y las
// preguntas de escala que no entran en un bloque. Lo elegido vive en `?foco=`.

import { useEffect, useRef } from "react";

import { EstadoVacio } from "../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { enumerar } from "../../../lib/enumerar";
import { Layers, Plus } from "../../../vendor/lucide-react";
import { FilaDeIndice } from "./FilaDeIndice";
import type { EntradaDeDimension } from "./modeloDeDimensiones";

export function PanelDeIndices({ entradas, elegida, sinBloque, onElegir, onCrearBloque }: {
  entradas: readonly EntradaDeDimension[];
  elegida: string | null;
  /** Preguntas de escala fuera de todo bloque; null si las listas no se pudieron leer. */
  sinBloque: readonly string[] | null;
  onElegir: (columna: string) => void;
  onCrearBloque: () => void;
}) {
  // Con `?foco=` lo elegido puede quedar bajo el pliegue del panel: se trae a la vista sin mover la página.
  const listaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [elegida]);

  const indices = entradas.filter((e) => e.tipo === "indice");
  const sueltos = entradas.filter((e) => e.tipo === "bloque");
  // Sin conteo junto al título: la cabecera ya dice cuántos índices hay (una cifra, una vez).
  return (
    <PanelDeMesa zona="indices" titulo="Índices">
      <div ref={listaRef} className="dimensiones-indices-cuerpo">
        {entradas.length === 0 ? (
          <EstadoVacio
            icono={<Layers size={16} />}
            titulo="Sin índices ni bloques"
            descripcion="La estructura guardada no tiene bloques. Se arman en el asistente."
          />
        ) : null}
        {indices.length > 0 ? (
          // C1: cada índice mide lo que su nombre; no son marcos pares.
          <ul
            className="dimensiones-indices"
            aria-label="Índices"
            data-qa-geometry-group="analitica/dimensiones-indices"
            data-qa-geometry-contract="intrinsic"
          >
            {indices.map((e) => <FilaDeIndice key={e.columna} entrada={e} elegida={e.columna === elegida} onElegir={onElegir} />)}
          </ul>
        ) : null}
        {sueltos.length > 0 ? (
          <section className="dimensiones-grupo" aria-labelledby="dimensiones-sueltos">
            <h3 id="dimensiones-sueltos" className="dimensiones-subtitulo">Bloques sin índice</h3>
            <ul
              className="dimensiones-indices"
              aria-labelledby="dimensiones-sueltos"
              data-qa-geometry-group="analitica/dimensiones-sueltos"
              data-qa-geometry-contract="intrinsic"
            >
              {sueltos.map((e) => <FilaDeIndice key={e.columna} entrada={e} elegida={e.columna === elegida} onElegir={onElegir} />)}
            </ul>
          </section>
        ) : null}
        {sinBloque && sinBloque.length > 0 ? (
          <section className="dimensiones-grupo dimensiones-sin-bloque" aria-labelledby="dimensiones-sin-bloque">
            <h3 id="dimensiones-sin-bloque" className="dimensiones-subtitulo">Preguntas de escala sin bloque</h3>
            <p className="dimensiones-sin-bloque-lista">{enumerar(sinBloque)}</p>
            <PulsoButton variant="secondary" size="sm" onClick={onCrearBloque}>
              <Plus size={14} aria-hidden="true" /> Crear bloque
            </PulsoButton>
          </section>
        ) : null}
      </div>
    </PanelDeMesa>
  );
}
