import type { BuilderNode, ChoiceItem, SectionMeta } from "../../types";
import type { LogicScope } from "../../logic";
import type { CatalogInfo, ConditionalContext } from "../../inspector/ContextPanel";
import { stripMarkdown } from "../../helpers/markdown";
import { typeLabel } from "../../parsing/parseType";
import { PanelCard, PropRow, esMetadato } from "../../kit";
import { describeExpression, describeValidation } from "../reglasHumanas";
import "./resumenPregunta.css";

// Resumen de la pregunta en el Constructor (revamp 2026-10-16): cuatro contenedores de igual altura que
// dicen, en español, cuándo aparece (con lo que hereda de sus secciones), qué acepta, cómo responde y cómo
// se imprime. La edición vive en las pestañas internas de la derecha; «Editar» lleva a la indicada sin salir
// del Constructor. Reemplaza a la «vista rápida» de cuatro tarjetas sueltas.

export type ResumenPreguntaProps = {
  node: BuilderNode;
  section: SectionMeta | null;
  choices: ChoiceItem[];
  catalogUsageCount: number;
  catalogInfo?: CatalogInfo;
  conditionalContext?: ConditionalContext | null;
  logicScope: LogicScope;
  onEditar: (pestana: "response" | "rules") => void;
};

const MAX_OPCIONES_PAPEL = 4;

/** Campos que llena el dispositivo o la fórmula: no se preguntan ni se imprimen. */
const esAutomatico = (b: string) => esMetadato(b) || b === "calculate" || b === "hidden" || b === "background-geopoint";

function esDinamica(listName: string): string | null {
  const m = listName.match(/^\$\{([^}]+)\}$/);
  return m ? m[1] : null;
}

export function ResumenPregunta({ node, section, choices, catalogUsageCount, catalogInfo, conditionalContext, logicScope, onEditar }: ResumenPreguntaProps) {
  const esNota = node.kind === "note";
  const automatico = esAutomatico(node.typeInfo.base);
  const heredadas = conditionalContext?.ancestorRelevants ?? [];
  const propia = node.relevant.trim();
  const validacion = esNota ? null : describeValidation(node.constraint, node, logicScope);
  const dinamica = node.typeInfo.listName ? esDinamica(node.typeInfo.listName) : null;
  const etiquetaDe = (name: string) => stripMarkdown(logicScope.variables.find((v) => v.name === name)?.label || name);
  const opcionesTexto = dinamica
    ? `Lo anotado en «${etiquetaDe(dinamica)}» (opciones dinámicas)`
    : node.typeInfo.listName
      ? `${choices.length} ${choices.length === 1 ? "opción" : "opciones"} · lista ${catalogInfo?.listName || node.typeInfo.listName}${catalogUsageCount > 1 ? ` · la usan ${catalogUsageCount} preguntas` : ""}`
      : null;
  const editar = (pestana: "response" | "rules") => (
    <button type="button" className="xfr-editar" onClick={() => onEditar(pestana)}>Editar</button>
  );
  const ubicacion = section && section.kind !== "root" ? stripMarkdown(section.label || section.name) : "Nivel principal";
  const papelOpciones = choices.slice(0, MAX_OPCIONES_PAPEL);

  return (
    <div className="xfr-resumen" aria-label="Resumen de la pregunta" data-qa-geometry-group="xlsform/resumen-pregunta" data-qa-geometry-contract="equal">
      <PanelCard title="Cuándo aparece" meta={editar("rules")} footer={<><span className="xfk-over">En total</span> {resumenVisibilidad(heredadas.length, Boolean(propia))}</>} flush fill>
        {heredadas.map((h, i) => (
          <div key={`${h.sectionLabel}-${i}`} className="xfr-herencia">
            <span className="xfr-herencia__marca" aria-hidden="true" />
            <span>
              Hereda de la sección «{stripMarkdown(h.sectionLabel || "sin nombre")}»: {describeExpression(h.relevant, logicScope).summary.replace(/^./, (c) => c.toLowerCase())}
            </span>
          </div>
        ))}
        <div className="xfr-propia">
          {propia ? (
            <>
              <span className="xfr-propia__tit">Condición propia</span>
              <span>{describeExpression(propia, logicScope).summary}</span>
            </>
          ) : (
            <span className="xfr-propia__nada">{heredadas.length ? "Sin condición propia: aparece cuando aparece su sección." : "Sin condición: se muestra a todas las personas."}</span>
          )}
        </div>
      </PanelCard>

      <PanelCard title="Qué acepta" meta={esNota ? undefined : editar("rules")} footer={<><span className="xfk-over">Se lee</span> {esNota ? "Las notas no piden respuesta." : automatico ? "Se completa sola: no la responde nadie." : validacion?.summary ?? aceptaPorDefecto(node.typeInfo.base)}</>} flush fill>
        <div className="xfr-props">
          <PropRow label="Obligatoria">{esNota ? "No aplica" : node.required ? (heredadas.length || propia ? "Sí, cuando aparece" : "Sí") : "No"}</PropRow>
          <PropRow label="Restricción">{esNota ? "No aplica" : node.constraint.trim() ? (validacion?.technical ? "Fórmula propia" : "Regla guiada") : "Ninguna"}</PropRow>
          <PropRow label="Mensaje">{node.constraint_message?.trim() ? stripMarkdown(node.constraint_message) : node.constraint.trim() ? "Falta: verá un aviso genérico" : "—"}</PropRow>
        </div>
      </PanelCard>

      <PanelCard title="Respuesta" meta={editar("response")} footer={<><span className="xfk-over">Dónde</span> {ubicacion}</>} flush fill>
        <div className="xfr-props">
          <PropRow label="Tipo">{typeLabel(node.typeInfo.base)}</PropRow>
          <PropRow label="Variable" mono>{node.name || "sin nombre"}</PropRow>
          {opcionesTexto ? <PropRow label="Opciones">{opcionesTexto}</PropRow> : null}
          {node.appearance.trim() ? <PropRow label="Apariencia" mono>{node.appearance}</PropRow> : null}
        </div>
      </PanelCard>

      <PanelCard title="Así se imprime" footer={<><span className="xfk-over">Papel</span> {node.paperNumber ? `Número ${node.paperNumber}` : "Numeración automática"}{node.paperSkip ? ` · ${node.paperSkip}` : ""}</>} flush fill>
        <div className="xfr-papel">
          {automatico ? null : <p className="xfr-papel__enunciado">
            {node.paperNumber ? <b>{node.paperNumber}. </b> : null}
            {stripMarkdown(node.paperLabel || node.label)}
            {node.name ? <span className="xfr-papel__var"> [{node.name}]</span> : null}
          </p>}
          {automatico ? (
            <p className="xfr-papel__nota">No se imprime: la completa el dispositivo o una fórmula.</p>
          ) : dinamica ? (
            <p className="xfr-papel__nota">Opciones: los nombres anotados en «{etiquetaDe(dinamica)}».</p>
          ) : papelOpciones.length ? (
            <ul className="xfr-papel__opciones">
              {papelOpciones.map((c) => (
                <li key={c.rowIndex}><span className="xfr-papel__caja" aria-hidden="true" />{c.name}<span>{stripMarkdown(c.label || c.name)}</span></li>
              ))}
              {choices.length > MAX_OPCIONES_PAPEL ? <li className="xfr-papel__mas">… y {choices.length - MAX_OPCIONES_PAPEL} más</li> : null}
            </ul>
          ) : esNota ? null : (
            <p className="xfr-papel__linea" aria-hidden="true" />
          )}
        </div>
      </PanelCard>
    </div>
  );
}

function resumenVisibilidad(heredadas: number, propia: boolean): string {
  if (!heredadas && !propia) return "Siempre visible.";
  const partes = [];
  if (heredadas) partes.push(`hereda ${heredadas === 1 ? "la regla de 1 sección" : `las reglas de ${heredadas} secciones`}`);
  partes.push(propia ? "además tiene una condición propia" : "no tiene condición propia");
  const t = partes.join("; ");
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}.`;
}

function aceptaPorDefecto(base: string): string {
  switch (base) {
    case "select_one":
      return "Una de las opciones de la lista.";
    case "select_multiple":
      return "Una o varias opciones de la lista.";
    case "integer":
      return "Cualquier número entero.";
    case "decimal":
      return "Cualquier número, con decimales.";
    case "date":
      return "Cualquier fecha.";
    case "text":
      return "Cualquier texto.";
    default:
      return `Cualquier valor de tipo ${typeLabel(base).toLowerCase()}.`;
  }
}
