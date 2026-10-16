import { useMemo } from "react";
import type { LogicScope } from "../logic";
import type { BuilderStructure } from "../types";
import { describeExpression } from "../canvas/reglasHumanas";
import { PanelCard, QuestionToken, ReadsAs, TypeIcon } from "../kit";
import { EditarEnConstructor } from "../shell/EditarEnConstructor";
import { PestanaReglas, type ReglaListaGrupo } from "./PestanaReglas";
import { calculosDelFormulario } from "./reglasModel";

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
};

export function PestanaCalculos({ structure, scope, seleccionada, onSeleccionar, onEditar }: PestanaCalculosProps) {
  const items = useMemo(() => calculosDelFormulario(structure), [structure]);
  const actual = items.find((i) => i.node.name === seleccionada) ?? items[0] ?? null;
  const porNombre = (name: string) => structure?.outline.find((n) => n.name === name) ?? null;
  const numero = (n: { paperNumber?: string; name: string }) => n.paperNumber || n.name;
  const grupos: ReglaListaGrupo[] = [
    {
      titulo: "En uso",
      items: items.filter((i) => i.loUsan.length > 0).map((i) => ({
        key: i.node.name, baseType: "calculate", numero: "ƒ", titulo: i.node.name,
        resumen: i.node.label || `lo usan ${i.loUsan.length}`, aviso: i.vacio,
      })),
    },
    {
      titulo: "Sólo para la base",
      items: items.filter((i) => i.loUsan.length === 0).map((i) => ({
        key: i.node.name, baseType: "calculate", numero: "ƒ", titulo: i.node.name,
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
      vacio="Este formulario no tiene cálculos. Un cálculo no se pregunta: se obtiene de otras respuestas y queda como columna en la base."
      pie="Un cálculo no se pregunta: se obtiene de otras respuestas y queda como columna en la base."
    >
      {actual ? (
        <>
          <div className="xfp-encabezado">
            <span className="xfp-encabezado__ruta"><TypeIcon baseType="calculate" boxed /> Cálculo · <span className="xfk-mono">{actual.node.name}</span></span>
            <h2 className="xfp-encabezado__titulo">{actual.node.label || actual.node.name}</h2>
            <span className="xfp-encabezado__accion"><EditarEnConstructor onEditar={() => onEditar(actual.node.rowIndex)} que={`el cálculo ${actual.node.name}`} /></span>
          </div>
          <PanelCard title="Fórmula" meta={actual.vacio ? "vacía" : undefined} flush>
            <ReadsAs label="Se lee">{actual.vacio ? "Sin fórmula: la columna quedará vacía en la base." : lectura?.summary ?? actual.node.calculation}</ReadsAs>
            <ReadsAs label="XLSForm" code>{actual.vacio ? "calculation vacío" : `calculation = ${actual.node.calculation.trim()}`}</ReadsAs>
          </PanelCard>
          <div className="xfp-fila2">
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
