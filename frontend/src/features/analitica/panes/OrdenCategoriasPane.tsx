import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Check, Layers, Search, X } from "lucide-react";
import {
  apiAnaliticaDataReview,
  apiAnaliticaVariables,
  type DataReviewOption,
  type DataReviewVariable,
  type VariableInstrumento,
} from "../../../api/client";
import { Alert } from "../../../components/Alert";
import { Panel } from "../../../components/Panel";
import { ErrorBlock, LoadingBlock } from "../../../components/States";
import { useAnaliticaStore } from "../store";
import { Section } from "../PaneKit";
import { VariableSelect } from "../VariableSelect";
import { OrdenCategoriasEditor } from "./OrdenCategoriasEditor";
import { derivarCatalogoListas } from "./ordenCategoriasModel";

// Pane "Orden de categorías" (Analítica).
//
// Flujo: el analista elige una LISTA de opciones (list_name) del catálogo de
// listas disponibles → cargamos sus categorías (code + label + count) y las
// variables que la comparten → editor drag-and-drop que persiste el orden en
// `orden_categorias[list_name]` vía el store + autosave. El VariableSelect
// queda como atajo para saltar a la lista de una variable concreta.

// Solo variables de selección tienen categorías ordenables.
function esVariableSeleccion(v: VariableInstrumento): boolean {
  const tipo = (v.tipo ?? "").trim().toLowerCase();
  return tipo.startsWith("select_one") || tipo.startsWith("select_multiple");
}

// Resuelve las opciones (code+label+count) de una lista. La variable elegida
// puede no tener casos en la base; en ese caso caemos a cualquier variable que
// comparta el list_name y sí traiga opciones desde data-review.
export function resolverOpcionesLista(
  variablesLista: VariableInstrumento[],
  dataReview: DataReviewVariable[],
): DataReviewOption[] {
  const nombres = new Set(variablesLista.map((v) => v.name));
  const candidatas = dataReview.filter((d) => nombres.has(d.name));
  const conOpciones = candidatas.find((d) => d.opciones.length > 0);
  return conOpciones ? conOpciones.opciones : [];
}

export function OrdenCategoriasPane() {
  const [variables, setVariables] = useState<VariableInstrumento[] | null>(null);
  const [dataReview, setDataReview] = useState<DataReviewVariable[] | null>(null);
  const [error, setError] = useState("");
  // Estado UI efímero: lista seleccionada, variable del atajo y filtro del
  // catálogo. La config vive en el store; esto es sólo navegación.
  const [listName, setListName] = useState("");
  const [atajoVar, setAtajoVar] = useState("");
  const [query, setQuery] = useState("");

  const overrides = useAnaliticaStore((s) => s.config.orden_categorias);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [vRes, dRes] = await Promise.all([
          apiAnaliticaVariables(),
          apiAnaliticaDataReview(),
        ]);
        if (cancelled) return;
        setVariables(vRes.variables);
        setDataReview(dRes.variables);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const seleccionables = useMemo(
    () => (variables ?? []).filter(esVariableSeleccion),
    [variables],
  );

  const catalogo = useMemo(
    () => (dataReview ? derivarCatalogoListas(seleccionables, dataReview, overrides) : []),
    [seleccionables, dataReview, overrides],
  );

  const catalogoFiltrado = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalogo;
    return catalogo.filter((e) => e.listName.toLowerCase().includes(q));
  }, [catalogo, query]);

  const varsCompartidas = useMemo(
    () => (listName ? (variables ?? []).filter((v) => v.list_name === listName) : []),
    [variables, listName],
  );

  const opciones = useMemo(
    () => (listName && dataReview ? resolverOpcionesLista(varsCompartidas, dataReview) : []),
    [listName, dataReview, varsCompartidas],
  );

  // Atajo: elegir una variable resuelve su list_name y selecciona esa lista.
  function saltarAListaDeVariable(name: string) {
    setAtajoVar(name);
    const v = seleccionables.find((x) => x.name === name);
    if (v && v.list_name.trim()) setListName(v.list_name.trim());
  }

  const ready = variables !== null && dataReview !== null;

  if (error) {
    return <ErrorBlock label="No se pudo cargar el instrumento" detail={error} />;
  }
  if (!ready) {
    return <LoadingBlock label="Cargando variables y categorías…" />;
  }

  return (
    <Panel>
      <div className="analitica-report-shell" data-audit-ready="true">
        <div className="analitica-dimensiones-docbar">
          <span className="analitica-dimensiones-docbar-icon" aria-hidden="true">
            <ArrowUpDown size={16} />
          </span>
          <div className="analitica-dimensiones-docbar-copy">
            <span>Presentación de categorías</span>
            <strong>Orden de categorías</strong>
            <small>Define en qué orden aparecen las respuestas de una variable ordinal en tablas y PPT.</small>
          </div>
        </div>

        <Section
          title="Lista a ordenar"
          subtitle="Elige una lista de opciones del catálogo. El orden se aplica por lista, así que se comparte entre todas las variables que la usan. Si prefieres, usa el atajo para saltar a la lista de una variable concreta."
        >
          <div className="analitica-orden-atajo">
            <span className="analitica-orden-atajo-label">Saltar a la lista de una variable</span>
            <VariableSelect
              variables={seleccionables}
              value={atajoVar}
              onChange={saltarAListaDeVariable}
              allowClear
              placeholder="Buscar variable de selección…"
            />
          </div>

          {catalogo.length === 0 ? (
            <Alert kind="info">
              No se detectaron listas de opciones en el instrumento. Las categorías ordenables
              provienen de preguntas de selección (<code>select_one</code> / <code>select_multiple</code>).
            </Alert>
          ) : (
            <>
              {catalogo.length > 6 && (
                <div className="analitica-orden-catalogo-search">
                  <Search size={13} className="analitica-orden-catalogo-search-icon" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filtrar listas por nombre…"
                    className="analitica-orden-catalogo-search-input"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="pulso-icon"
                      aria-label="Limpiar filtro"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              )}

              <div className="analitica-orden-catalogo" role="listbox" aria-label="Listas de opciones">
                {catalogoFiltrado.length === 0 ? (
                  <div className="analitica-orden-catalogo-empty">
                    Ninguna lista coincide con “{query}”.
                  </div>
                ) : (
                  catalogoFiltrado.map((e) => {
                    const selected = e.listName === listName;
                    return (
                      <button
                        key={e.listName}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => setListName(e.listName)}
                        className={`analitica-orden-lista-card${selected ? " is-selected" : ""}`}
                      >
                        <span className="analitica-orden-lista-icon" aria-hidden="true">
                          {selected ? <Check size={13} /> : <Layers size={13} />}
                        </span>
                        <span className="analitica-orden-lista-name">{e.listName}</span>
                        {e.tieneOverride && (
                          <span className="analitica-orden-lista-override" title="Esta lista ya tiene un orden propio guardado">
                            orden propio
                          </span>
                        )}
                        <span className="analitica-orden-lista-meta">
                          {e.nVariables} {e.nVariables === 1 ? "variable" : "variables"}
                          {" · "}
                          {e.nCategorias} {e.nCategorias === 1 ? "categoría" : "categorías"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </Section>

        {listName && opciones.length > 0 && (
          <OrdenCategoriasEditor
            listName={listName}
            opciones={opciones}
            varsCompartidas={varsCompartidas}
          />
        )}

        {listName && opciones.length === 0 && (
          <Alert kind="warn">
            No se detectaron categorías para <code>{listName}</code>. Verifica que la base tenga
            respuestas para esta lista de opciones.
          </Alert>
        )}

        {!listName && catalogo.length > 0 && (
          <Alert kind="info">
            Selecciona una lista del catálogo para ordenar sus categorías.
          </Alert>
        )}
      </div>
    </Panel>
  );
}
