// Lista de preguntas armonizadas de la pestaña Comparativos (contrato E4-E7, R4).
//
// Con 74 preguntas, una grilla plana de tarjetas no se recorre: no se sabe qué
// está elegido sin bajar hasta el final ni dónde está una pregunta concreta. La
// lista agrupa por sección con encabezados plegables, busca por texto y dice
// cuántas hay elegidas. La cobertura de cada pregunta va como un chip por
// medición, porque con siete bases una frase no dice dónde falta cada una.
//
// La lógica (agrupar, filtrar, contar, cobertura) vive en `comparativosModel`.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, CircleSlash2, Minus, Search, SearchX } from "../../../vendor/lucide-react";
import {
  TEXTO_COBERTURA,
  agruparPorSeccion,
  cantidad,
  contadorElegidas,
  coberturaPorMedicion,
  estadoDeCasilla,
  filtrarFilas,
  type EstadoCobertura,
  type FilaArmonizada,
} from "./comparativosModel";
import type { NombreDeSerie } from "../../carga/nombreDeSerie";
import { rotuloDeMatriz } from "../../../lib/rotuloDeMatriz";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoButton } from "../../../components/PulsoButton";

export type ComparativosListaProps = {
  id: string;
  titulo: string;
  ayuda: string;
  filas: FilaArmonizada[];
  elegidas: string[];
  /** Filas que llevan una marca informativa, sin cambiar su selección. */
  marcadas: string[];
  marca: string;
  periodos: string[];
  rotulos: Record<string, string>;
  /** Cómo se nombra la serie, decidido por `nombreDeSerie`. */
  serie: NombreDeSerie;
  onAlternar: (clave: string) => void;
  /** Elige o suelta todas las preguntas de una sección. Sin él, no se ofrece. */
  onElegirVarias?: (claves: string[], valor: boolean) => void;
  acciones?: JSX.Element;
};

function IconoCobertura({ estado }: { estado: EstadoCobertura }) {
  if (estado === "comparable") return <Check size={11} aria-hidden="true" />;
  if (estado === "sin-variable") return <Minus size={11} aria-hidden="true" />;
  return <CircleSlash2 size={11} aria-hidden="true" />;
}

export function ComparativosLista({
  id,
  titulo,
  ayuda,
  filas,
  elegidas,
  marcadas,
  marca,
  periodos,
  rotulos,
  serie,
  onAlternar,
  onElegirVarias,
  acciones,
}: ComparativosListaProps) {
  const uid = useId();
  const [consulta, setConsulta] = useState("");
  const grupos = useMemo(() => agruparPorSeccion(filas), [filas]);
  const visibles = useMemo(() => filtrarFilas(filas, consulta), [filas, consulta]);
  const gruposVisibles = useMemo(() => agruparPorSeccion(visibles), [visibles]);
  // Plegado por sección. Todas arrancan plegadas, con cualquier cantidad de
  // preguntas: el encabezado ya dice cuántas hay y cuántas están elegidas, y
  // buscar o «Desplegar secciones» abre lo que haga falta.
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set());
  const buscando = consulta.trim() !== "";
  // Mientras se busca, toda sección con coincidencias se abre: esconder lo que
  // se acaba de encontrar sería no encontrarlo.
  const estaAbierta = (clave: string) => buscando || abiertas.has(clave);
  const alternarSeccion = (clave: string) =>
    setAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });

  return (
    <fieldset className="pulso-comparativos-bloque pulso-comparativos-lista" data-qa-geometry-member>
      <legend className="pulso-sr-only">{titulo}</legend>
      <header className="pulso-comparativos-bloque-head">
        <h3 id={`${id}-titulo`} aria-hidden="true">{titulo}</h3>
        <p>{ayuda}</p>
        {acciones}
      </header>

      <div className="pulso-comparativos-lista-barra">
        <label className="pulso-comparativos-buscar">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={consulta}
            placeholder="Buscar por pregunta o sección"
            aria-label={`Buscar en ${titulo.toLowerCase()}`}
            onChange={(e) => setConsulta(e.target.value)}
          />
        </label>
        <span className="pulso-comparativos-contador" aria-live="polite">
          {contadorElegidas(filas, elegidas)}
        </span>
        {!buscando && grupos.length > 1 ? (
          <PulsoButton
            variant="ghost"
            size="sm"
            className="pulso-comparativos-desplegar"
            aria-expanded={abiertas.size === grupos.length}
            // Hay dos listas con este botón en la vista: el nombre accesible
            // dice de cuál es (P-B3).
            aria-label={`${abiertas.size === grupos.length ? "Plegar secciones" : "Desplegar secciones"} de ${titulo.toLowerCase()}`}
            onClick={() =>
              setAbiertas(abiertas.size === grupos.length ? new Set() : new Set(grupos.map((g) => g.clave)))
            }
          >
            {abiertas.size === grupos.length ? "Plegar secciones" : "Desplegar secciones"}
          </PulsoButton>
        ) : null}
      </div>

      <ul className="pulso-comparativos-leyenda" aria-label={`Qué dice cada marca de ${serie.singular}`}>
        {(Object.keys(TEXTO_COBERTURA) as EstadoCobertura[]).map((e) => (
          <li key={e} className={`pulso-comparativos-cob is-${e}`}>
            <IconoCobertura estado={e} />
            {TEXTO_COBERTURA[e]}
          </li>
        ))}
      </ul>

      {visibles.length === 0 ? (
        // C3: el vacío de la búsqueda vive dentro de la lista y dice cómo salir.
        <EstadoVacio
          icono={<SearchX size={15} />}
          titulo={`Ninguna pregunta coincide con «${consulta.trim()}»`}
          descripcion="Prueba con otra palabra o borra la búsqueda."
          accion={(
            <PulsoButton variant="secondary" size="sm" onClick={() => setConsulta("")}>
              Borrar búsqueda
            </PulsoButton>
          )}
        />
      ) : (
        <div
          className="pulso-comparativos-grupos"
          data-qa-geometry-group={`${id}-grupos`}
          data-qa-geometry-contract="intrinsic"
        >
          {gruposVisibles.map((grupo) => {
            const abierta = estaAbierta(grupo.clave);
            const regionId = `${uid}-${id}-${grupo.clave || "sin-seccion"}`.replace(/[^A-Za-z0-9_-]/g, "_");
            const seleccionables = grupo.filas.filter((f) => f.seleccionable);
            const nElegidas = seleccionables.filter((f) => elegidas.includes(f.clave)).length;
            return (
              <section key={grupo.clave || "__sin__"} className="pulso-comparativos-grupo" data-qa-geometry-member>
                <div className="pulso-comparativos-grupo-head">
                  {onElegirVarias && seleccionables.length > 0 ? (
                    <CasillaDeSeccion
                      titulo={grupo.titulo}
                      claves={seleccionables.map((f) => f.clave)}
                      elegidas={elegidas}
                      onCambiar={onElegirVarias}
                    />
                  ) : null}
                  <h4>
                    <button
                      type="button"
                      className="pulso-comparativos-grupo-toggle"
                      aria-expanded={abierta}
                      aria-controls={regionId}
                      disabled={buscando}
                      onClick={() => alternarSeccion(grupo.clave)}
                    >
                      {abierta ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                      <span className="pulso-comparativos-grupo-titulo">{grupo.titulo}</span>
                      <small>
                        {cantidad(grupo.filas.length, "pregunta", "preguntas")}, {nElegidas} {nElegidas === 1 ? "elegida" : "elegidas"}
                      </small>
                    </button>
                  </h4>
                </div>
                {abierta ? (
                  <ul
                    id={regionId}
                    className="pulso-comparativos-filas"
                    // Intrínseco: cada fila mide lo que su enunciado necesita.
                    // Igualar los marcos obligaría a recortar el enunciado, que
                    // es lo que se elige.
                    data-qa-geometry-group={`${id}-filas`}
                    data-qa-geometry-contract="intrinsic"
                  >
                    {grupo.filas.map((fila) => (
                      <TarjetaFila
                        key={fila.clave}
                        fila={fila}
                        marcada={fila.seleccionable && elegidas.includes(fila.clave)}
                        conMarca={Boolean(marca) && marcadas.includes(fila.clave)}
                        marca={marca}
                        periodos={periodos}
                        rotulos={rotulos}
                        serie={serie}
                        onAlternar={onAlternar}
                      />
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

/**
 * Una casilla por sección en vez de «Elegir todas» y «Quitar todas»: marcada si
 * están todas, vacía si ninguna e indeterminada si algunas. El estado
 * intermedio se fija por la propiedad del DOM, que no tiene atributo HTML.
 */
function CasillaDeSeccion({
  titulo,
  claves,
  elegidas,
  onCambiar,
}: {
  titulo: string;
  claves: string[];
  elegidas: string[];
  onCambiar: (claves: string[], valor: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const estado = estadoDeCasilla(claves, elegidas);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = estado === "algunas";
  }, [estado]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="pulso-comparativos-grupo-casilla"
      checked={estado === "todas"}
      aria-label={`Elegir todas las preguntas de ${titulo}`}
      onChange={() => onCambiar(claves, estado !== "todas")}
    />
  );
}

function TarjetaFila({
  fila,
  marcada,
  conMarca,
  marca,
  periodos,
  rotulos,
  serie,
  onAlternar,
}: {
  fila: FilaArmonizada;
  marcada: boolean;
  conMarca: boolean;
  marca: string;
  periodos: string[];
  rotulos: Record<string, string>;
  serie: NombreDeSerie;
  onAlternar: (clave: string) => void;
}) {
  const cobertura = coberturaPorMedicion(fila, periodos, rotulos);
  return (
    <li data-qa-geometry-member>
      <label className={`pulso-comparativos-fila${marcada ? " is-on" : ""}${fila.seleccionable ? "" : " is-off"}`}>
        <input
          type="checkbox"
          checked={marcada}
          disabled={!fila.seleccionable}
          onChange={() => onAlternar(fila.clave)}
        />
        <span className="pulso-comparativos-fila-copy">
          <strong>{rotuloDeMatriz(fila.etiqueta)}</strong>
          <small>{cantidad(fila.nCategorias, "categoría", "categorías")} en la escala común</small>
          {/* `span` con roles de lista y no `ul`: dentro de un `label` sólo cabe
              contenido de frase. */}
          <span role="list" className="pulso-comparativos-coberturas" aria-label={`Cobertura de ${fila.etiqueta} por ${serie.singular}`}>
            {cobertura.map((c) => (
              <span
                role="listitem"
                key={c.base}
                className={`pulso-comparativos-cob is-${c.estado}`}
                title={`${c.rotulo}: ${TEXTO_COBERTURA[c.estado]}`}
              >
                <IconoCobertura estado={c.estado} />
                <span>{c.rotulo}</span>
                <span className="pulso-sr-only">: {TEXTO_COBERTURA[c.estado]}</span>
              </span>
            ))}
          </span>
          {!fila.seleccionable ? (
            <span className="pulso-comparativos-fila-marca is-off">No es comparable en {serie.ninguna}</span>
          ) : conMarca ? (
            <span className="pulso-comparativos-fila-marca">{marca}</span>
          ) : null}
        </span>
      </label>
    </li>
  );
}
