import { Plus } from "lucide-react";

import type { CalcMuestraWorkspace, CalcMuestraWorkspaceVariableControl } from "../../../api/calcMuestra";
import { uid } from "../sharedCore";
import { variableControl } from "./catalogos";

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
        <span className="cmv2-eyebrow">Control</span>
        <strong id="cmg-variables-titulo">Variables disponibles</strong>
      </div>
      <div className="cmv2-variable-list">
        {variables.map((v, i) => (
          <div className="cmv2-variable" key={v.id}>
            <input aria-label="Nombre de la variable" value={v.label} onChange={(e) => update(i, { label: e.currentTarget.value })} />
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
            <label className="cmv2-check">
              <input type="checkbox" checked={v.disponible} onChange={(e) => update(i, { disponible: e.currentTarget.checked })} />
              Disponible
            </label>
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
