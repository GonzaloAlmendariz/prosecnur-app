// Columna izquierda de Frecuencias y Cruces: las preguntas del archivo por
// sección, con un buscador. Elegir una escribe `foco` en la dirección y la
// tabla del centro pasa a ser la suya. Es navegación (cada fila lleva a una
// dirección), no pestañas: la elegida se marca con `aria-current` y las
// flechas recorren la lista.
//
// Al pie, lo que decide qué preguntas entran al archivo y se cambia en otro
// lugar: las secciones visibles (en Datos) y las variables excluidas (su panel).

import { useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { PulsoInput } from "../../../components/PulsoInput";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { ListTree, Search } from "../../../vendor/lucide-react";
import { PanelDeZona } from "./PanelDeZona";
import { anchoDeCodigos, contarPreguntas, esLaElegida, filtrarPreguntas, hayCodigosLargos, type GrupoDePreguntas } from "./preguntasModelo";

export function ListaDePreguntas({ pestana, grupos, elegida, leyendo, sinLeer = false, onElegir, pie }: {
  pestana: "frecuencias" | "cruces";
  grupos: readonly GrupoDePreguntas[];
  /** La pregunta cuya tabla se ve. */
  elegida: string | null;
  /** La hoja todavía no llegó: la lista no se puede armar. */
  leyendo: boolean;
  /** La hoja no se pudo leer: no hay lista, y no es que el archivo no tenga preguntas. */
  sinLeer?: boolean;
  onElegir: (variable: string) => void;
  /** Los enlaces a donde se decide qué entra al archivo. */
  pie?: ReactNode;
}) {
  const [consulta, setConsulta] = useState("");
  const lista = useRef<HTMLDivElement>(null);
  const idBuscador = useId();
  const visibles = useMemo(() => filtrarPreguntas(grupos, consulta), [grupos, consulta]);
  const total = contarPreguntas(grupos);
  // La columna del código mide lo que el código más largo, con un tope: los códigos quedan alineados.
  const estilo = { "--tablas-codigo-ancho": anchoDeCodigos(grupos) } as CSSProperties;

  // Arriba y abajo recorren las preguntas; Inicio y Fin van a los extremos.
  const recorrer = (e: KeyboardEvent<HTMLDivElement>) => {
    const teclas = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!teclas.includes(e.key)) return;
    const botones = Array.from(lista.current?.querySelectorAll<HTMLButtonElement>(".tablas-pregunta") ?? []);
    if (botones.length === 0) return;
    e.preventDefault();
    const actual = botones.indexOf(document.activeElement as HTMLButtonElement);
    const siguiente = e.key === "Home" ? 0
      : e.key === "End" ? botones.length - 1
        : e.key === "ArrowDown" ? Math.min(botones.length - 1, actual + 1)
          : Math.max(0, actual - 1);
    botones[siguiente]?.focus();
  };

  return (
    <PanelDeZona
      zona="preguntas"
      titulo="Preguntas"
      conteo={leyendo ? undefined : total}
      icono={<ListTree size={16} aria-hidden="true" />}
      pie={pie}
    >
      <div className="tablas-buscador">
        <Search size={14} aria-hidden="true" />
        <PulsoInput
          id={idBuscador}
          size="sm"
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar pregunta o código"
          aria-label="Buscar pregunta o código"
          disabled={leyendo || sinLeer}
        />
      </div>
      {leyendo ? <CargaDeBloque label="Leyendo las preguntas del archivo" /> : null}
      {sinLeer ? <EstadoVacio icono={<Search size={16} />} titulo="Sin lista de preguntas" descripcion="No se pudo leer la vista previa." /> : null}
      {!leyendo && !sinLeer && visibles.length === 0 ? (
        <EstadoVacio
          icono={<Search size={16} />}
          titulo={total === 0 ? "Sin preguntas en el archivo" : "Ninguna pregunta coincide"}
          descripcion={total === 0 ? undefined : `Nada con "${consulta.trim()}" en la pregunta ni en el código.`}
        />
      ) : null}
      {!leyendo && visibles.length > 0 ? (
        <nav aria-label={`Preguntas de ${pestana === "frecuencias" ? "frecuencias" : "cruces"}`}>
          {/* C1: las secciones son bloques independientes, cada uno con el alto de sus preguntas. */}
          <div
            ref={lista}
            className="tablas-preguntas"
            style={estilo}
            data-codigos-largos={hayCodigosLargos(grupos) ? "" : undefined}
            onKeyDown={recorrer}
            data-qa-geometry-group={`analitica/${pestana}-preguntas`}
            data-qa-geometry-contract="intrinsic"
          >
            {visibles.map((g) => (
              <section key={g.clave} className="tablas-preguntas-grupo" aria-label={g.nombre || "Sin sección"}>
                {g.nombre ? <h4 className="tablas-preguntas-seccion">{g.nombre}</h4> : null}
                <ul className="tablas-preguntas-lista">
                  {g.preguntas.map((p) => {
                    const actual = esLaElegida(p, elegida);
                    return (
                      <li key={p.variable}>
                        <button
                          type="button"
                          className="tablas-pregunta"
                          aria-current={actual ? "true" : undefined}
                          title={p.codigo === p.etiqueta ? p.etiqueta : `${p.codigo}: ${p.etiqueta}`}
                          onClick={() => onElegir(p.variable)}
                        >
                          {p.codigo !== p.etiqueta ? <code className="tablas-pregunta-codigo">{p.codigo}</code> : null}
                          <span className="tablas-pregunta-etiqueta">{p.etiqueta}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </nav>
      ) : null}
    </PanelDeZona>
  );
}
