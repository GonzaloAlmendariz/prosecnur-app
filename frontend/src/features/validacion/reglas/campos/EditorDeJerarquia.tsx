/**
 * "Opciones que van juntas": cada fila dice que si la respuesta incluye una
 * opción, también debe incluir otras. Era `HierarchyMapEditor` de
 * `components/ReglaEditor.tsx`; guarda lo mismo (`hierarchy_rows` y
 * `hierarchy_map`).
 */
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import { Plus, X } from "../../../../vendor/lucide-react";
import { hierarchyMapFromRows, hierarchyRowsFromParams, paramList, type HierarchyRow } from "../modeloRegla";
import { ListaDeOpciones } from "./ListaDeOpciones";
import { etiquetaDeOpcion, useOpcionesDeVariable } from "./opcionesDeVariable";

export function EditorDeJerarquia({
  params,
  onParams,
  variable,
}: {
  params: Record<string, unknown>;
  onParams: (params: Record<string, unknown>) => void;
  variable: string | undefined;
}) {
  const filas = hierarchyRowsFromParams(params);
  const visibles = filas.length ? filas : [{ trigger: "", required: "" }];
  const { options, loading } = useOpcionesDeVariable(variable);
  const conLista = options.length > 0;

  function guardar(siguientes: HierarchyRow[]) {
    const { hierarchy_map_text: _textoViejo, ...resto } = params;
    onParams({ ...resto, hierarchy_rows: siguientes, hierarchy_map: hierarchyMapFromRows(siguientes) });
  }
  function cambiar(i: number, cambio: Partial<HierarchyRow>) {
    guardar(visibles.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
  }
  function quitar(i: number) {
    const siguientes = visibles.filter((_, j) => j !== i);
    guardar(siguientes.length ? siguientes : [{ trigger: "", required: "" }]);
  }

  return (
    <>
      {visibles.map((fila, i) => (
        <div key={i} className="pulso-regla-fila pulso-regla-fila--jerarquia">
          <span className="pulso-regla-rotulo">Si incluye</span>
          {conLista ? (
            <PulsoSelect
              value={fila.trigger}
              onValueChange={(v) => cambiar(i, { trigger: v })}
              placeholder="Elegir opción"
              ariaLabel={`Relación ${i + 1}: opción marcada`}
              options={options.map((o) => ({ value: o.code, label: etiquetaDeOpcion(o, o.code), textValue: `${o.code} ${o.label}` }))}
            />
          ) : (
            <PulsoInput
              value={fila.trigger}
              onChange={(e) => cambiar(i, { trigger: e.target.value })}
              placeholder={loading ? "Cargando opciones" : "Código de la opción"}
              aria-label={`Relación ${i + 1}: opción marcada`}
            />
          )}
          <span className="pulso-regla-rotulo pulso-regla-rotulo--medio">también</span>
          <div className="pulso-regla-fila-ancha">
            {conLista ? (
              <ListaDeOpciones
                opciones={options.filter((o) => o.code !== fila.trigger)}
                valor={paramList(fila.required)}
                onCambio={(v) => cambiar(i, { required: v.join("\n") })}
                compacta
                ariaLabel={`Relación ${i + 1}: opciones que deben acompañarla`}
              />
            ) : (
              <PulsoInput
                value={fila.required.includes("\n") ? paramList(fila.required).join(", ") : fila.required}
                onChange={(e) => cambiar(i, { required: e.target.value })}
                placeholder="Códigos separados por coma"
                aria-label={`Relación ${i + 1}: opciones que deben acompañarla`}
              />
            )}
          </div>
          <PulsoButton variant="icon" size="sm" intent="remove" aria-label={`Quitar la relación ${i + 1}`} onClick={() => quitar(i)}>
            <X size={13} aria-hidden="true" />
          </PulsoButton>
        </div>
      ))}
      <div className="pulso-regla-fila-mas">
        <PulsoButton variant="ghost" size="sm" className="pulso-regla-mas" onClick={() => guardar([...visibles, { trigger: "", required: "" }])}>
          <Plus size={13} aria-hidden="true" />
          Añadir relación
        </PulsoButton>
      </div>
    </>
  );
}
