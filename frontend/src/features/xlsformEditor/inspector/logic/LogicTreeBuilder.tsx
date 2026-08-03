// =============================================================================
// inspector/logic/LogicTreeBuilder.tsx — builder visual con AND/OR mezclados
// =============================================================================
// Reemplaza la caja read-only "Avanzada" del LogicBuilder cuando la fórmula
// no encaja en el flat condition. Render recursivo del `LogicTree` con:
//
//   · Grupos visualizados con borde + connector pill ("Y"/"O") al lado.
//   · "+ Condición" y "+ Grupo" en cada nivel.
//   · Detección y render compacto de "selected(v,'a') or selected(v,'b') or
//     selected(v,'c')" como pill "v incluye {a, b, c}".
//   · Las partes que no se pueden parsear (regex, count-selected, etc) se
//     muestran como caja read-only honesta y se preservan tal cual.
// =============================================================================

import { Plus, X, FolderPlus, ChevronDown, Hash } from "lucide-react";
import {
  buildDefaultCondition,
  detectMultiSelected,
  expandMultiSelected,
  serializeExpression,
} from "../../logic";
import type {
  FlatCondition,
  LogicScope,
  LogicTree,
} from "../../logic";
import type { LogicalOp } from "../../logic/ast";
import { ConditionRow, retargetConditionVariable } from "./ConditionRow";
import { VariablePicker } from "./VariablePicker";

export type LogicTreeBuilderProps = {
  tree: LogicTree;
  scope: LogicScope;
  onChange: (next: LogicTree) => void;
  /** Si true, este es el nodo raíz — render con header y CTA "Quitar". */
  isRoot?: boolean;
};

export function LogicTreeBuilder({ tree, scope, onChange, isRoot }: LogicTreeBuilderProps) {
  return <NodeRenderer tree={tree} scope={scope} onChange={onChange} isRoot={isRoot} />;
}

// -----------------------------------------------------------------------------
// NodeRenderer — switch por kind
// -----------------------------------------------------------------------------

function NodeRenderer({
  tree,
  scope,
  onChange,
  isRoot,
}: {
  tree: LogicTree;
  scope: LogicScope;
  onChange: (next: LogicTree) => void;
  isRoot?: boolean;
}) {
  if (tree.kind === "leaf") {
    return <LeafRow tree={tree} scope={scope} onChange={onChange} />;
  }
  if (tree.kind === "raw") {
    return <RawBox tree={tree} />;
  }
  return <GroupBlock tree={tree} scope={scope} onChange={onChange} isRoot={isRoot} />;
}

// -----------------------------------------------------------------------------
// LeafRow — una FlatCondition editable
// -----------------------------------------------------------------------------

function LeafRow({
  tree,
  scope,
  onChange,
}: {
  tree: Extract<LogicTree, { kind: "leaf" }>;
  scope: LogicScope;
  onChange: (next: LogicTree) => void;
}) {
  return (
    <ConditionRow
      scope={scope}
      condition={tree.condition}
      onChange={(next) => onChange({ kind: "leaf", condition: next })}
    />
  );
}

// -----------------------------------------------------------------------------
// RawBox — fórmula no editable (regex, count-selected, etc)
// -----------------------------------------------------------------------------

function RawBox({ tree }: { tree: Extract<LogicTree, { kind: "raw" }> }) {
  return (
    <div className="pulso-logic-tree-raw">
      <span className="pulso-logic-tree-raw-eyebrow">Código Kobo</span>
      <pre>{serializeExpression(tree.expr)}</pre>
      <p>
        Se preserva al exportar; edítala desde la vista <strong>Hojas</strong>.
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// GroupBlock — AND/OR con hijos editables
// -----------------------------------------------------------------------------

function GroupBlock({
  tree,
  scope,
  onChange,
  isRoot,
}: {
  tree: Extract<LogicTree, { kind: "group" }>;
  scope: LogicScope;
  onChange: (next: LogicTree) => void;
  isRoot?: boolean;
}) {
  // Detectar el patrón "v includes {a,b,c}" para render compacto
  const multiSelected = detectMultiSelected(tree);
  if (multiSelected) {
    return (
      <MultiSelectedPill
        tree={tree}
        match={multiSelected}
        scope={scope}
        onChange={onChange}
      />
    );
  }

  // Grupo cuyas condiciones hablan TODAS de la misma pregunta: la variable
  // sube al encabezado y cada fila queda con criterio + valor. Es la forma
  // dominante de los índices —`${p9} != '' and not(selected(${p9},'98'))
  // and not(selected(${p9},'99'))`— donde repetir la pregunta una vez por
  // comparación triplicaba el alto y dejaba el enunciado recortado al 27 %.
  const sharedVariable = detectSharedVariable(tree);
  if (sharedVariable && !isRoot) {
    return (
      <SharedVariableGroup
        tree={tree}
        variableName={sharedVariable}
        scope={scope}
        onChange={onChange}
      />
    );
  }

  const updateChild = (index: number, next: LogicTree) => {
    const copy = [...tree.children];
    copy[index] = next;
    onChange({ ...tree, children: copy });
  };
  const removeChild = (index: number) => {
    const copy = tree.children.filter((_, i) => i !== index);
    if (copy.length === 0) {
      // Grupo vacío — colapsar a un leaf vacío default si es root, o
      // dejar vacío para que el padre lo elimine.
      onChange({ kind: "group", op: tree.op, children: [] });
      return;
    }
    if (copy.length === 1) {
      // Colapsar al único hijo (más limpio en el AST).
      onChange(copy[0]!);
      return;
    }
    onChange({ ...tree, children: copy });
  };
  const addCondition = () => {
    const cond = buildEmptyCondition(scope);
    onChange({
      ...tree,
      children: [...tree.children, { kind: "leaf", condition: cond }],
    });
  };
  const addSubgroup = () => {
    const cond = buildEmptyCondition(scope);
    const subOp: LogicalOp = tree.op === "and" ? "or" : "and";
    onChange({
      ...tree,
      children: [
        ...tree.children,
        {
          kind: "group",
          op: subOp,
          children: [{ kind: "leaf", condition: cond }],
        },
      ],
    });
  };
  const setOp = (next: LogicalOp) => {
    if (next === tree.op) return;
    onChange({ ...tree, op: next });
  };

  return (
    <div className={`pulso-logic-tree-group${isRoot ? " is-root" : ""}`}>
      {/* El conector va en una cabecera horizontal, no en un carril vertical
          a la izquierda: los 62 px del carril más los 70 px de sangría de las
          acciones se cobraban en cada nivel de anidamiento, justo el ancho
          que a los enunciados les faltaba para leerse. */}
      {tree.children.length > 1 && (
        <header className="pulso-logic-tree-head">
          <ConnectorToggle op={tree.op} onChange={setOp} />
          <span className="pulso-logic-tree-count">de {tree.children.length}</span>
        </header>
      )}

      <div className="pulso-logic-tree-main">
        <div
          className="pulso-logic-tree-children"
          data-qa-geometry-group="xlsform/logic-tree-children"
          data-qa-geometry-contract="intrinsic"
        >
          {tree.children.map((child, i) => (
            <div key={`child-${i}`} className="pulso-logic-tree-child">
              <NodeRenderer
                tree={child}
                scope={scope}
                onChange={(next) => updateChild(i, next)}
              />
              <button
                type="button"
                className="pulso-logic-tree-remove"
                onClick={() => removeChild(i)}
                title="Quitar"
                aria-label="Quitar"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="pulso-logic-tree-actions">
        <button
          type="button"
          className="pulso-logic-tree-add"
          onClick={addCondition}
          disabled={!scope.variables.length}
        >
          <Plus size={12} /> Condición
        </button>
        <button
          type="button"
          className="pulso-logic-tree-add"
          onClick={addSubgroup}
          disabled={!scope.variables.length}
          title="Crear un grupo anidado con conector contrario"
        >
          <FolderPlus size={12} /> Grupo
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ConnectorToggle — "Todas" / "Alguna" compartido por los dos tipos de grupo
// -----------------------------------------------------------------------------

function ConnectorToggle({
  op,
  onChange,
}: {
  op: LogicalOp;
  onChange: (next: LogicalOp) => void;
}) {
  return (
    <span
      className="pulso-logic-tree-connector"
      role="radiogroup"
      aria-label="Conector entre condiciones"
    >
      <button
        type="button"
        role="radio"
        aria-checked={op === "and"}
        className={op === "and" ? "is-on" : ""}
        onClick={() => onChange("and")}
        title="Todas las condiciones deben cumplirse"
      >
        Todas
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={op === "or"}
        className={op === "or" ? "is-on" : ""}
        onClick={() => onChange("or")}
        title="Cualquiera de las condiciones basta"
      >
        Alguna
      </button>
    </span>
  );
}

// -----------------------------------------------------------------------------
// SharedVariableGroup — todas las condiciones del grupo hablan de una pregunta
// -----------------------------------------------------------------------------

/** Nombre de la variable si TODOS los hijos son hojas sobre la misma
 *  pregunta; si no, `null`. No toca el AST: es solo presentación. */
function detectSharedVariable(
  tree: Extract<LogicTree, { kind: "group" }>,
): string | null {
  if (tree.children.length < 2) return null;
  let shared: string | null = null;
  for (const child of tree.children) {
    if (child.kind !== "leaf") return null;
    const name = child.condition.variableName;
    if (!name) return null;
    if (shared === null) shared = name;
    else if (shared !== name) return null;
  }
  return shared;
}

function SharedVariableGroup({
  tree,
  variableName,
  scope,
  onChange,
}: {
  tree: Extract<LogicTree, { kind: "group" }>;
  variableName: string;
  scope: LogicScope;
  onChange: (next: LogicTree) => void;
}) {
  const conditions = tree.children.flatMap((child) =>
    child.kind === "leaf" ? [child.condition] : [],
  );

  const writeConditions = (next: FlatCondition[]) => {
    if (next.length === 0) {
      onChange({ kind: "group", op: tree.op, children: [] });
      return;
    }
    if (next.length === 1) {
      onChange({ kind: "leaf", condition: next[0]! });
      return;
    }
    onChange({
      ...tree,
      children: next.map((condition) => ({ kind: "leaf" as const, condition })),
    });
  };

  // Reapuntar la pregunta reescribe TODAS las condiciones del grupo: es lo
  // que el encabezado promete al mostrarla una sola vez.
  const retargetAll = (nextName: string) => {
    writeConditions(
      conditions.map((condition) =>
        retargetConditionVariable(condition, nextName, scope),
      ),
    );
  };

  const addCondition = () => {
    const base = buildEmptyCondition(scope);
    onChange({
      ...tree,
      children: [
        ...tree.children,
        {
          kind: "leaf",
          condition: retargetConditionVariable(base, variableName, scope),
        },
      ],
    });
  };

  return (
    <div className="pulso-logic-samevar">
      <header className="pulso-logic-samevar-head">
        <VariablePicker
          variables={scope.variables}
          selected={variableName}
          onChange={retargetAll}
        />
        <div className="pulso-logic-samevar-meta">
          <ConnectorToggle
            op={tree.op}
            onChange={(next) => {
              if (next !== tree.op) onChange({ ...tree, op: next });
            }}
          />
          <span className="pulso-logic-tree-count">de {conditions.length}</span>
        </div>
      </header>

      {/* Las columnas se rotulan una vez para todo el bloque: repetir
          "CRITERIO" y "VALOR" en cada fila era el mismo derroche que repetir
          la pregunta. */}
      <div className="pulso-logic-samevar-cols" aria-hidden="true">
        <span>Criterio</span>
        <span>Valor</span>
      </div>

      <div
        className="pulso-logic-samevar-rows"
        data-qa-geometry-group="xlsform/logic-samevar-rows"
        data-qa-geometry-contract="equal"
      >
        {conditions.map((condition, i) => (
          <div key={`cond-${i}`} className="pulso-logic-samevar-row">
            <ConditionRow
              scope={scope}
              condition={condition}
              hideVariable
              onChange={(next) => {
                const copy = [...conditions];
                copy[i] = next;
                writeConditions(copy);
              }}
            />
            <button
              type="button"
              className="pulso-logic-tree-remove"
              onClick={() => writeConditions(conditions.filter((_, j) => j !== i))}
              title="Quitar"
              aria-label="Quitar"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="pulso-logic-tree-actions">
        <button
          type="button"
          className="pulso-logic-tree-add"
          onClick={addCondition}
          disabled={!scope.variables.length}
          title="Sumar otra comparación sobre la misma pregunta"
        >
          <Plus size={12} /> Condición
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// MultiSelectedPill — render compacto de "v includes {a,b,c}"
// -----------------------------------------------------------------------------

function MultiSelectedPill({
  tree,
  match,
  scope,
  onChange,
}: {
  tree: Extract<LogicTree, { kind: "group" }>;
  match: { variableName: string; values: string[] };
  scope: LogicScope;
  onChange: (next: LogicTree) => void;
}) {
  const variable = scope.variables.find((v) => v.name === match.variableName);
  // Para mostrar labels amigables en lugar de codes, mapear contra el
  // catálogo asociado a la variable (si es select_*).
  const choices = variable?.listName
    ? scope.catalogsByListName.get(variable.listName)?.items ?? []
    : [];
  const labelFor = (raw: string) => {
    const choice = choices.find((c) => c.name === raw);
    return choice?.label || raw;
  };

  const removeValue = (raw: string) => {
    const next = match.values.filter((v) => v !== raw);
    if (next.length === 0) {
      onChange({ kind: "group", op: "or", children: [] });
      return;
    }
    if (next.length === 1) {
      // Colapsar a leaf simple.
      onChange({
        kind: "leaf",
        condition: {
          variableName: match.variableName,
          predicate: { kind: "selected", label: "incluye" },
          value: { kind: "literal", raw: next[0]! },
        },
      });
      return;
    }
    onChange(expandMultiSelected(match.variableName, next));
  };

  const addValue = () => {
    // Agrega el primer code disponible que no esté ya en la lista
    const used = new Set(match.values);
    const candidate = choices.find((c) => !used.has(c.name));
    if (!candidate) return;
    onChange(expandMultiSelected(match.variableName, [...match.values, candidate.name]));
  };

  // Convertir a árbol expandido (para editar manualmente cada selected)
  const expand = () => {
    onChange({
      kind: "group",
      op: "or",
      children: match.values.map((raw) => ({
        kind: "leaf" as const,
        condition: {
          variableName: match.variableName,
          predicate: { kind: "selected" as const, label: "incluye" },
          value: { kind: "literal" as const, raw },
        },
      })),
    });
    // Ahora detectMultiSelected sigue retornando match — necesitamos un
    // flag para forzar render expandido. Esto es F3.5; por ahora dejamos
    // el botón "expandir" preparado pero la action es explicita: el
    // usuario puede agregar otro tipo de condición en el grupo y el
    // detector deja de aplicar.
  };

  return (
    <div className="pulso-logic-tree-multi">
      <Hash size={12} />
      <span className="pulso-logic-tree-multi-var">
        {variable?.label || match.variableName}
      </span>
      <span className="pulso-logic-tree-multi-op">incluye cualquiera de estas opciones</span>
      <span className="pulso-logic-tree-multi-values">
        {match.values.map((raw) => (
          <span key={raw} className="pulso-logic-tree-multi-value">
            {labelFor(raw)}
            <button
              type="button"
              className="pulso-logic-tree-multi-remove"
              onClick={() => removeValue(raw)}
              title="Quitar este valor"
              aria-label={`Quitar ${labelFor(raw)}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        {choices.length > match.values.length && (
          <button
            type="button"
            className="pulso-logic-tree-multi-add"
            onClick={addValue}
            title="Agregar otro valor"
          >
            <Plus size={11} />
          </button>
        )}
      </span>
      <button
        type="button"
        className="pulso-logic-tree-multi-expand"
        onClick={expand}
        title="Mostrar una fila por opción"
      >
        <ChevronDown size={11} />
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------

function buildEmptyCondition(scope: LogicScope): FlatCondition {
  return buildDefaultCondition(scope);
}
