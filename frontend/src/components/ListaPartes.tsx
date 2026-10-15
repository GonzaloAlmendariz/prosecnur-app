// ListaPartes — la columna de partes de una pestaña (2026-10-15). Un solo panel con filas separadas por un filete:
// las filas no son tarjetas y miden lo mismo (rótulo y detalle, una línea cada uno). La elegida lleva una barra de
// acento de 3 px, relleno suave del acento del módulo y el rótulo en el acento, con `aria-current`.
//
// Estado a la derecha con una sola gramática (neutro, aviso, listo, conteo); si una fila lo lleva, el slot se reserva
// en todas. Grupos opcionales con encabezado en versalitas y, si se declaran plegables, con una fila que los abre.
//
// Teclado: flechas arriba/abajo, Inicio y Fin con tabindex itinerante; la fila enfocada queda elegida.

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronRight } from "../vendor/lucide-react";
import {
  anchoDeSlot,
  destinoDeTecla,
  nombreAccesibleDeParte,
  partesNavegables,
  reservaSlotDeEstado,
  type EstadoParte,
  type GrupoDePartes,
  type ParteDeLista,
} from "./listaPartesModelo";
import "./ListaPartes.css";

export type { EstadoParte, GrupoDePartes, ParteDeLista, TonoEstadoParte } from "./listaPartesModelo";

export type ListaPartesProps<K extends string> = {
  /** Nombre accesible de la lista («Partes del impreso»). */
  etiqueta: string;
  grupos: readonly GrupoDePartes<K>[];
  actual: K;
  onElegir: (clave: K) => void;
  /** Id del contenido que la parte elegida gobierna (`aria-controls`). */
  idPanel?: string;
  /** Prefijo de los ids de fila; el contenido puede usar `${prefijoId}-${clave}` como `aria-labelledby`. */
  prefijoId?: string;
  className?: string;
};

function SlotEstado({ estado }: { estado?: EstadoParte }) {
  if (!estado) return <span className="pulso-lista-partes-estado" aria-hidden="true" />;
  if (estado.tono === "listo") {
    return (
      <span className="pulso-lista-partes-estado is-listo" title={estado.texto} aria-hidden="true">
        <Check size={13} strokeWidth={2.4} />
      </span>
    );
  }
  return (
    <span className={`pulso-lista-partes-estado is-${estado.tono}`} title={estado.texto} aria-hidden="true">
      {estado.texto}
    </span>
  );
}

function Fila<K extends string>({ parte, elegida, tabulable, prefijoId, idPanel, conEstado, onElegir }: {
  parte: ParteDeLista<K>;
  elegida: boolean;
  /** Tabindex itinerante: una sola fila entra en el orden de tabulación. */
  tabulable: boolean;
  prefijoId: string;
  idPanel?: string;
  conEstado: boolean;
  onElegir: (clave: K) => void;
}) {
  return (
    <li className="pulso-lista-partes-item" data-qa-geometry-member="">
      <button
        type="button"
        id={`${prefijoId}-${parte.clave}`}
        className={`pulso-lista-partes-fila${elegida ? " is-elegida" : ""}${conEstado ? " con-estado" : ""}`}
        aria-current={elegida ? "true" : undefined}
        aria-controls={idPanel}
        aria-label={nombreAccesibleDeParte(parte)}
        tabIndex={tabulable ? 0 : -1}
        data-parte={parte.clave}
        onClick={() => onElegir(parte.clave)}
      >
        <span className="pulso-lista-partes-texto">
          <span className="pulso-lista-partes-rotulo" title={parte.rotulo}>{parte.rotulo}</span>
          <span className="pulso-lista-partes-detalle" title={parte.detalle ?? ""}>{parte.detalle ?? " "}</span>
        </span>
        {conEstado ? <SlotEstado estado={parte.estado} /> : null}
      </button>
    </li>
  );
}

export function ListaPartes<K extends string>({
  etiqueta,
  grupos,
  actual,
  onElegir,
  idPanel,
  prefijoId = "lista-partes",
  className,
}: ListaPartesProps<K>) {
  const raiz = useRef<HTMLDivElement>(null);
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(grupos.filter((g) => g.plegable).map((g) => [g.id, Boolean(g.plegable?.abiertoInicial)])),
  );
  const conEstado = reservaSlotDeEstado(grupos);
  const slot = anchoDeSlot(grupos);
  // Un grupo plegado que contiene la parte elegida se muestra abierto: la elegida nunca queda escondida.
  const estaAbierto = (g: GrupoDePartes<K>) =>
    !g.plegable || Boolean(abiertos[g.id]) || g.partes.some((p) => p.clave === actual);
  const navegables = useMemo(() => partesNavegables(grupos, estaAbierto),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grupos, abiertos, actual]);

  // Si la elegida no está a la vista (o no existe), la primera visible recibe el tabindex.
  const tabulable: K | undefined = navegables.includes(actual) ? actual : navegables[0];

  const onTecla = (e: KeyboardEvent<HTMLDivElement>) => {
    const destino = destinoDeTecla(e.key, navegables, navegables.includes(actual) ? actual : null);
    if (destino === null) return;
    e.preventDefault();
    onElegir(destino);
    raiz.current?.querySelector<HTMLButtonElement>(`[data-parte="${CSS.escape(destino)}"]`)?.focus();
  };

  return (
    <div
      ref={raiz}
      className={["pulso-lista-partes", slot === "angosto" ? "is-slot-angosto" : null, className].filter(Boolean).join(" ")}
      role="group"
      aria-label={etiqueta}
      onKeyDown={onTecla}
    >
      {grupos.map((g) => {
        const abierto = estaAbierto(g);
        const idLista = `${prefijoId}-grupo-${g.id}`;
        return (
          <section key={g.id} className="pulso-lista-partes-grupo" aria-label={g.titulo ?? undefined}>
            {g.plegable ? (
              <button
                type="button"
                className="pulso-lista-partes-plegable"
                aria-expanded={abierto}
                aria-controls={idLista}
                onClick={() => setAbiertos((prev) => ({ ...prev, [g.id]: !abierto }))}
              >
                <ChevronRight size={14} aria-hidden="true" className="pulso-lista-partes-chevron" />
                <span className="pulso-lista-partes-plegable-texto">{g.titulo}</span>
                <span className="pulso-lista-partes-estado is-conteo" aria-hidden="true">{g.partes.length}</span>
              </button>
            ) : g.titulo ? (
              <h3 className="pulso-lista-partes-encabezado">{g.titulo}</h3>
            ) : null}
            {abierto ? (
              // Filas pares: mismo marco (C2). El grupo es la lista de filas, no el panel.
              <ul id={idLista} className="pulso-lista-partes-filas"
                data-qa-geometry-group={`lista-partes/${prefijoId}-${g.id}`} data-qa-geometry-contract="equal">
                {g.partes.map((p) => (
                  <Fila key={p.clave} parte={p} elegida={p.clave === actual} tabulable={p.clave === tabulable} prefijoId={prefijoId}
                    idPanel={idPanel} conEstado={conEstado} onElegir={onElegir} />
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
