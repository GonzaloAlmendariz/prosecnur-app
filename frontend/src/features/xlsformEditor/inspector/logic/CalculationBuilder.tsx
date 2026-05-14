// =============================================================================
// inspector/logic/CalculationBuilder.tsx — builder visual de calculation
// =============================================================================
// Este builder es para los campos `calculate` (variable automática). El
// usuario lo ve dentro del tab Básico — la fórmula es la propiedad
// principal de un campo automático, no algo "avanzado".
//
// Tres modos:
//
//   1. Vacío → empty state con galería de templates predefinidos
//      (`if 1/0`, `if A/B`, `count-selected`, `position`, `concat`).
//      Click en una template inserta el AST y entra en modo edición.
//
//   2. `if(cond, then, else)` detectado → IfBlock visual: la condición
//      reusa el LogicBuilder (toda la maquinaria AND/OR/comparaciones),
//      then/else son inputs simples.
//
//   3. Otra fórmula → editor libre: textarea con sintaxis ODK + toolbar
//      con botones "Insertar variable" y "Insertar función". El usuario
//      siempre puede caer al modo texto si la fórmula es muy específica.
//
// Cualquier modo escribe el AST canónico al estado vía `onChange`. Si la
// fórmula importada no se puede parsear, mostramos el raw en read-only
// con CTA "Reemplazar".
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Code2, Variable, X } from "lucide-react";
import { IconTemplate } from "../../../../lib/icons";
import {
  parseExpression,
  serializeExpression,
} from "../../logic";
import type { Expr, LogicScope } from "../../logic";
import { FORMULA_TEMPLATES } from "./formulaTemplates";
import { IfBlock } from "./IfBlock";

export type CalculationBuilderProps = {
  expression: string;
  scope: LogicScope;
  fieldLabel: string;
  hint?: string;
  onChange: (next: string) => void;
};

export function CalculationBuilder({
  expression,
  scope,
  fieldLabel,
  hint,
  onChange,
}: CalculationBuilderProps) {
  const ast = parseExpression(expression);

  // Caso 1: vacío.
  if (!ast) {
    return (
      <div className="pulso-logic-builder">
        <header className="pulso-logic-builder-header">
          <span className="pulso-section-eyebrow">{fieldLabel}</span>
        </header>
        <div className="pulso-logic-calc-templates">
          <p>
            <IconTemplate size={12} /> Empieza con una plantilla o escribe la
            fórmula a mano.
          </p>
          <div className="pulso-logic-calc-templates-grid">
            {FORMULA_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="pulso-logic-calc-template"
                onClick={() => onChange(serializeExpression(tpl.build()))}
              >
                <strong>{tpl.title}</strong>
                <span>{tpl.description}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="pulso-logic-calc-blank"
            onClick={() => onChange(" ")} // espacio fuerza modo libre con expr vacía
          >
            <Code2 size={12} /> Escribir libre
          </button>
        </div>
        {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
      </div>
    );
  }

  // Caso 2: if(cond, then, else)
  if (ast.kind === "call" && ast.name === "if" && ast.args.length === 3) {
    return (
      <div className="pulso-logic-builder">
        <header className="pulso-logic-builder-header">
          <span className="pulso-section-eyebrow">{fieldLabel}</span>
          <button
            type="button"
            className="pulso-logic-builder-clear"
            onClick={() => onChange("")}
            title="Quitar la fórmula"
          >
            <X size={12} /> Quitar
          </button>
        </header>
        <IfBlock
          scope={scope}
          expr={ast as Expr & { kind: "call"; name: "if" }}
          onChange={(next) => onChange(serializeExpression(next))}
        />
        {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
      </div>
    );
  }

  // Caso 3: otra fórmula → editor libre con toolbar.
  return (
    <FreeCalculationEditor
      expression={expression}
      scope={scope}
      fieldLabel={fieldLabel}
      hint={hint}
      onChange={onChange}
    />
  );
}

// ----------------------------------------------------------------------------
// Editor libre — textarea con toolbar de inserción
// ----------------------------------------------------------------------------

function FreeCalculationEditor({
  expression,
  scope,
  fieldLabel,
  hint,
  onChange,
}: CalculationBuilderProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [varPickerOpen, setVarPickerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!varPickerOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setVarPickerOpen(false);
    };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onMouseDown);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [varPickerOpen]);

  const insertAtCursor = (snippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(`${expression}${snippet}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = expression.slice(0, start) + snippet + expression.slice(end);
    onChange(next);
    // Re-foco al final del snippet insertado.
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + snippet.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div className="pulso-logic-builder" ref={containerRef}>
      <header className="pulso-logic-builder-header">
        <span className="pulso-section-eyebrow">{fieldLabel}</span>
        <div className="pulso-logic-calc-toolbar">
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="pulso-logic-calc-insert"
              onClick={() => setVarPickerOpen((v) => !v)}
              title="Insertar referencia a otra pregunta"
            >
              <Variable size={12} /> Insertar variable
              <ChevronDown size={11} />
            </button>
            {varPickerOpen && (
              <div className="pulso-logic-calc-varpop" role="listbox">
                {scope.variables.length === 0 ? (
                  <div className="pulso-logic-calc-varempty">
                    Sin preguntas para insertar todavía.
                  </div>
                ) : (
                  <ul>
                    {scope.variables.map((v) => (
                      <li key={v.name}>
                        <button
                          type="button"
                          onClick={() => {
                            insertAtCursor(`\${${v.name}}`);
                            setVarPickerOpen(false);
                          }}
                        >
                          <code>${v.name}</code>
                          <em>{v.label}</em>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="pulso-logic-builder-clear"
            onClick={() => onChange("")}
            title="Quitar la fórmula"
          >
            <X size={12} /> Quitar
          </button>
        </div>
      </header>
      <textarea
        ref={textareaRef}
        className="pulso-logic-calc-textarea"
        rows={3}
        value={expression}
        onChange={(event) => onChange(event.target.value)}
        placeholder='Ej. ${edad} * 12  ·  if(${respuesta}=&apos;si&apos;, 1, 0)'
        spellCheck={false}
      />
      {hint && <p className="pulso-logic-builder-hint">{hint}</p>}
    </div>
  );
}
