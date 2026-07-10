import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
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
import { Section } from "../PaneKit";
import { VariableSelect } from "../VariableSelect";
import { OrdenCategoriasEditor } from "./OrdenCategoriasEditor";

// Pane "Orden de categorías" (Analítica).
//
// Flujo: el analista elige una variable de selección → resolvemos su
// `list_name` → cargamos las categorías (code + label + count) de esa lista y
// las variables que la comparten → editor drag-and-drop que persiste el orden
// en `orden_categorias[list_name]` vía el store + autosave.

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
  const [selected, setSelected] = useState("");

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

  const selectedVar = useMemo(
    () => seleccionables.find((v) => v.name === selected) ?? null,
    [seleccionables, selected],
  );

  const listName = selectedVar?.list_name ?? "";

  const varsCompartidas = useMemo(
    () => (listName ? (variables ?? []).filter((v) => v.list_name === listName) : []),
    [variables, listName],
  );

  const opciones = useMemo(
    () => (listName && dataReview ? resolverOpcionesLista(varsCompartidas, dataReview) : []),
    [listName, dataReview, varsCompartidas],
  );

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
          title="Variable a ordenar"
          subtitle="Elige una pregunta de selección. El orden se aplica por lista de opciones, así que se comparte entre todas las variables que usan la misma lista."
        >
          <VariableSelect
            variables={seleccionables}
            value={selected}
            onChange={setSelected}
            allowClear
            placeholder="Seleccionar variable de selección…"
          />
        </Section>

        {selectedVar && listName && opciones.length > 0 && (
          <OrdenCategoriasEditor
            listName={listName}
            opciones={opciones}
            varsCompartidas={varsCompartidas}
          />
        )}

        {selectedVar && listName && opciones.length === 0 && (
          <Alert kind="warn">
            No se detectaron categorías para <code>{listName}</code>. Verifica que la base tenga
            respuestas para esta lista de opciones.
          </Alert>
        )}

        {!selectedVar && (
          <Alert kind="info">
            Selecciona una variable de selección para ordenar sus categorías.
          </Alert>
        )}
      </div>
    </Panel>
  );
}
