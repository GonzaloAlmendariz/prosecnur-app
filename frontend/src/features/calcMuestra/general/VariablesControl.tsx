import { Plus } from "lucide-react";

import type { CalcMuestraWorkspace, CalcMuestraWorkspaceVariableControl } from "../../../api/calcMuestra";
import { Switch } from "../../../components/Switch";
import { uid } from "../sharedCore";
import { variableControl } from "./catalogos";
import "./general.css";

/** Muestra general › Marco: las variables de control que el marco trae. */
export function VariablesControl({
  workspace,
  onWorkspace,
}: {
  workspace: CalcMuestraWorkspace;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
  const variables = workspace.variables_control;
  function update(index: number, patch: Partial<CalcMuestraWorkspaceVariableControl>) {
    onWorkspace({
      ...workspace,
      variables_control: variables.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    });
  }
  return (
    <section className="cmv2-panel" aria-labelledby="cmg-variables-titulo">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Control</span>
          <h3 className="cmg-panel-titulo" id="cmg-variables-titulo">Variables disponibles</h3>
        </div>
      </div>
      <div
        className="cmv2-variable-list"
        data-qa-geometry-group="calc-muestra/general-variables"
        data-qa-geometry-contract="equal"
      >
        {variables.map((v, i) => (
          <div className="cmv2-variable" key={v.id} data-qa-geometry-member>
            <input aria-label={`Nombre de la variable ${i + 1}`} value={v.label} onChange={(e) => update(i, { label: e.currentTarget.value })} />
            <select
              aria-label={`Uso de ${v.label}`}
              value={v.tipo}
              onChange={(e) => update(i, { tipo: e.currentTarget.value as CalcMuestraWorkspaceVariableControl["tipo"] })}
            >
              <option value="estrato">Estrato</option>
              <option value="cuota">Cuota</option>
              <option value="filtro">Filtro</option>
              <option value="segmento">Segmento</option>
              <option value="otro">Otro</option>
            </select>
            {/* Interruptor y no casilla: dice si la variable ESTÁ en el marco
                ahora, no algo que se marca para enviar. La casilla heredaba el
                estilo de los campos de texto y salía como píldora (2026-09-27). */}
            <span className="cmg-variable-disponible">
              <Switch
                checked={v.disponible}
                ariaLabel={`${v.label || `Variable ${i + 1}`} disponible en el marco`}
                onToggle={() => update(i, { disponible: !v.disponible })}
              />
              <span aria-hidden="true">En el marco</span>
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="cmv2-ghost"
        onClick={() => onWorkspace({ ...workspace, variables_control: [...variables, variableControl(uid("var"), "Nueva variable", "estrato")] })}
      >
        <Plus size={14} aria-hidden="true" /> Agregar variable
      </button>
    </section>
  );
}
