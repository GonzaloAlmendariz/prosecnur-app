// Lista de filtros (E5, variante A): código en columna de ancho fijo, pregunta legible, la frase del motor en dos
// líneas como máximo, la forma y el estado. Elegir fija el `foco` de la dirección.

import { useEffect, useRef } from "react";
import type { FraseFiltro } from "./fraseFiltro";
import { EstadoChip } from "../../../components/EstadoChip";
import type { ChromeStatusTone } from "../../../components/ModuleCommandBar";
import { NOMBRE_TIPO, type AnalisisFiltro, type ClaseEstado, type Estado } from "./modeloFiltros";

/** P6 de la pasada de formato: el estado del filtro es el `EstadoChip` del kit (punto de tono, mayúscula inicial). */
const TONO_DEL_ESTADO: Record<ClaseEstado, ChromeStatusTone> = {
  ok: "success",
  nunca: "warn",
  vacia: "danger",
  conflicto: "danger",
  "sin-vista": "neutral",
};

export function ChipEstado({ estado }: { estado: Estado }) {
  return <EstadoChip label={estado.texto} tone={TONO_DEL_ESTADO[estado.clase]} />;
}

type Props = {
  filtros: readonly AnalisisFiltro[];
  frases: ReadonlyMap<number, FraseFiltro>;
  actual: number;
  idDetalle: string;
  onElegir: (pregunta: string) => void;
};

export function ListaFiltros({ filtros, frases, actual, idDetalle, onElegir }: Props) {
  const porRevisar = filtros.filter((f) => f.estado.clase !== "ok").length;
  const raiz = useRef<HTMLElement>(null);
  // Un enlace con `foco` abre con el filtro elegido a la vista en la lista.
  useEffect(() => {
    raiz.current?.querySelector(".xcf-item.is-elegido")?.scrollIntoView?.({ block: "nearest" });
  }, [actual]);
  return (
    <nav ref={raiz} className="xcf-lista" aria-labelledby="xcf-lista-titulo" data-qa-geometry-member="" data-qa-geometry-capacity="owned" data-qa-scroll-owner="filtros-lista">
      <h3 id="xcf-lista-titulo" className="xcf-lista__cab">
        <span>Filtros <b>{filtros.length}</b></span>
        <span>{porRevisar ? `${porRevisar} por revisar` : "Todo en orden"}</span>
      </h3>
      <ul>
        {filtros.map((f) => {
          const elegido = f.fila === actual;
          const frase = frases.get(f.fila);
          return (
            <li key={f.fila}>
              <button
                type="button"
                className={elegido ? "xcf-item is-elegido" : "xcf-item"}
                aria-current={elegido ? "true" : undefined}
                aria-controls={idDetalle}
                onClick={() => onElegir(f.pregunta)}
              >
                <span className="xcf-item__r1">
                  <code className="xcf-item__codigo" title={f.pregunta}>{f.pregunta}</code>
                  <span className="xcf-item__titulo" title={f.etiqueta}>{f.etiqueta}</span>
                </span>
                {frase ? <span className="xcf-item__frase" title={frase.texto}>{frase.texto}</span> : null}
                <span className="xcf-item__r3">
                  <span className="xcf-chip">{NOMBRE_TIPO[f.tipo]}</span>
                  <ChipEstado estado={f.estado} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
