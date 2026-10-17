import { useCallback, useMemo } from "react";
import { Plus } from "../../../vendor/lucide-react";
import type { LogicScope } from "../logic";
import type { BuilderStructure } from "../types";
import { describeExpression } from "../canvas/reglasHumanas";
import { PanelCard, QuestionToken, ReadsAs, TypeIcon } from "../kit";
import { EditarEnConstructor } from "../shell/EditarEnConstructor";
import { PestanaReglas, type ReglaListaGrupo } from "./PestanaReglas";
import { calculosDelFormulario } from "./reglasModel";
import { ProbarCalculo } from "./ProbarCalculo";
import { CatalogoFunciones } from "./CatalogoFunciones";
import { CalculationRecipePanel } from "../canvas/constructor/CalculoRepeticionPaneles";

// Pestaña Cálculos (revamp 2026-10-16): cada `calculate` del formulario con su fórmula leída
// en español, de qué respuestas sale y quién lo usa después.

const COLUMNA: Record<string, string> = {
  relevant: "cuándo aparece",
  constraint: "qué acepta",
  calculation: "otro cálculo",
  choice_filter: "opciones visibles",
};

export type PestanaCalculosProps = {
  structure: BuilderStructure | null;
  scope: LogicScope;
  seleccionada: string | null;
  onSeleccionar: (variable: string | null) => void;
  onEditar: (rowIndex: number) => void;
  onCampo: (rowIndex: number, field: string, value: string) => void;
  catalogs: { listName: string; items: { name: string; label: string }[] }[];
  /** M5: crea un cálculo al final del formulario y lo deja abierto aquí (cada pestaña deja crear lo que muestra). */
  onNuevo?: () => void;
};

export function PestanaCalculos({ structure, scope, seleccionada, onSeleccionar, onEditar, onCampo, catalogs, onNuevo }: PestanaCalculosProps) {
  const opcionesDe = useCallback((listName: string) => catalogs.find((c) => c.listName === listName)?.items ?? [], [catalogs]);
  const items = useMemo(() => calculosDelFormulario(structure), [structure]);
  const actual = items.find((i) => i.node.name === seleccionada) ?? items[0] ?? null;
  const porNombre = (name: string) => structure?.outline.find((n) => n.name === name) ?? null;
  const numero = (n: { paperNumber?: string; name: string }) => n.paperNumber || n.name;
  const grupos: ReglaListaGrupo[] = [
    {
      titulo: "En uso",
      items: items.filter((i) => i.loUsan.length > 0).map((i) => ({
        key: i.node.name, baseType: "calculate", numero: "", titulo: i.node.name,
        resumen: i.node.label || `lo usan ${i.loUsan.length}`, aviso: i.vacio,
      })),
    },
    {
      titulo: "Sólo para la base",
      items: items.filter((i) => i.loUsan.length === 0).map((i) => ({
        key: i.node.name, baseType: "calculate", numero: "", titulo: i.node.name,
        resumen: i.vacio ? "Sin fórmula: quedará vacío" : i.node.label || "columna en la base", aviso: i.vacio,
      })),
    },
  ];
  const lectura = actual ? describeExpression(actual.node.calculation, scope) : null;

  return (
    <PestanaReglas
      titulo="Cálculos"
      total={`${items.length} cálculo${items.length === 1 ? "" : "s"}`}
      grupos={grupos}
      seleccionada={actual?.node.name ?? null}
      onSeleccionar={onSeleccionar}
      vacio={<>Este formulario todavía no tiene cálculos.{onNuevo ? <NuevoCalculo onNuevo={onNuevo} /> : null}</>}
      vacioDetalle={<CalculosVacio />}
      lateral={<CatalogoFunciones scope={scope} />}
      pie={<>{onNuevo ? <NuevoCalculo onNuevo={onNuevo} /> : null}<span>Un cálculo no se pregunta: se obtiene de otras respuestas y queda como columna en la base.</span></>}
    >
      {actual ? (
        <>
          <div className="xfp-encabezado">
            <span className="xfp-encabezado__ruta"><TypeIcon baseType="calculate" boxed /> Cálculo · <span className="xfk-mono">{actual.node.name}</span></span>
            <h2 className="xfp-encabezado__titulo">{actual.node.label || actual.node.name}</h2>
            <span className="xfp-encabezado__accion"><EditarEnConstructor onEditar={() => onEditar(actual.node.rowIndex)} que={`el cálculo ${actual.node.name}`} /></span>
          </div>
          <PanelCard title="Fórmula" className="xfp-editor">
            <CalculationRecipePanel
              expression={actual.node.calculation}
              scope={scope}
              onFieldChange={(field, value) => onCampo(actual.node.rowIndex, field, value)}
            />
          </PanelCard>
          <PanelCard title="Cómo se interpreta" meta={actual.vacio ? "vacía" : undefined} flush>
            <ReadsAs label="Se lee">{actual.vacio ? "Sin fórmula: la columna quedará vacía en la base." : lectura?.summary ?? actual.node.calculation}</ReadsAs>
            <ReadsAs label="XLSForm" code>{actual.vacio ? "calculation vacío" : `calculation = ${actual.node.calculation.trim()}`}</ReadsAs>
          </PanelCard>
          <ProbarCalculo node={actual.node} usa={actual.usa} structure={structure} opcionesDe={opcionesDe} />
          <div className="xfp-fila2" data-qa-geometry-group="xlsform/calculos-fila" data-qa-geometry-contract="equal">
            <PanelCard title="Usa" meta={actual.usa.length ? `${actual.usa.length}` : undefined} fill>
              {actual.usa.length ? (
                <div className="xfp-toks">
                  {actual.usa.map((v) => {
                    const n = porNombre(v);
                    return <QuestionToken key={v} baseType={n?.typeInfo.base ?? ""} label={n ? numero(n) : v} hint={n?.label} variable={v} />;
                  })}
                </div>
              ) : <p className="xfp-nota">No lee ninguna respuesta.</p>}
            </PanelCard>
            <PanelCard title="Lo usan" meta={actual.loUsan.length ? `${actual.loUsan.length}` : undefined} fill>
              {actual.loUsan.length ? (
                <ul className="xfp-usos">
                  {actual.loUsan.map((u) => (
                    <li key={`${u.node.rowIndex}-${u.columna}`}>
                      <QuestionToken baseType={u.node.typeInfo.base} label={numero(u.node)} hint={u.node.label} variable={u.node.name} />
                      <span className="xfp-usos__col">{COLUMNA[u.columna]}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="xfp-nota">Ninguna pregunta lo lee: sólo queda como columna en la base.</p>}
            </PanelCard>
          </div>
        </>
      ) : null}
    </PestanaReglas>
  );
}

function NuevoCalculo({ onNuevo }: { onNuevo: () => void }) {
  return (
    <button type="button" className="xfp-nuevo" onClick={onNuevo}>
      <Plus size={14} aria-hidden="true" /> Nuevo cálculo
    </button>
  );
}

const EJEMPLOS = [
  { titulo: "Tramo de edad", formula: "if(${edad} < 25, '18 a 24', '25 o más')", lee: "Agrupa la edad en tramos para cruzar resultados." },
  { titulo: "Índice promedio", formula: "round((${p8_1} + ${p8_2} + ${p8_3}) div 3, 1)", lee: "Resume una tabla de satisfacción en un solo número." },
  { titulo: "Cuántas marcó", formula: "count-selected(${servicios})", lee: "Cuenta las opciones elegidas en una pregunta múltiple." },
  { titulo: "Años desde el egreso", formula: "format-date(today(), '%Y') - ${anio_egreso}", lee: "Convierte un año en tiempo transcurrido." },
  { titulo: "Nombre completo", formula: "concat(${nombres}, ' ', ${apellidos})", lee: "Une dos textos para listados y fichas." },
  { titulo: "Duración", formula: "decimal-date-time(${fin}) - decimal-date-time(${inicio})", lee: "Mide cuánto tardó la entrevista." },
];

function CalculosVacio() {
  return (
    <>
      <div className="xfp-encabezado">
        <span className="xfp-encabezado__ruta"><TypeIcon baseType="calculate" boxed /> Cálculos</span>
        <h2 className="xfp-encabezado__titulo">Este formulario todavía no tiene cálculos</h2>
      </div>
      <PanelCard title="Qué es un cálculo" flush>
        <ReadsAs label="Qué hace">Se obtiene de otras respuestas, no se pregunta. Queda como columna en la base y puede decidir qué preguntas aparecen.</ReadsAs>
        <ReadsAs label="En XLSForm">Una fila de tipo <span className="xfk-mono">calculate</span> con su fórmula en la columna <span className="xfk-mono">calculation</span>.</ReadsAs>
        <ReadsAs label="Cómo crearlo">Con Nuevo cálculo, en la lista de la izquierda: queda al final del formulario y se abre aquí para escribir su fórmula. En el Constructor puedes ubicarlo donde lo necesites.</ReadsAs>
      </PanelCard>
      <PanelCard title="Cálculos frecuentes en encuestas" meta="ejemplos" fill flush>
        <ul className="xfp-ejemplos">
          {EJEMPLOS.map((e) => (
            <li key={e.titulo}>
              <span className="xfp-ejemplos__titulo">{e.titulo}</span>
              <span className="xfp-ejemplos__lee">{e.lee}</span>
              <code className="xfp-ejemplos__formula">{e.formula}</code>
            </li>
          ))}
        </ul>
      </PanelCard>
    </>
  );
}
