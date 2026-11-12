/** Campos propios de cada acción de limpieza. Salieron de `tabs/LimpiezaTab.tsx`. */
import { type Dispatch, type ReactNode, type SetStateAction, useMemo } from "react";
import { Inbox, Trash2 } from "../../../vendor/lucide-react";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { type ChoiceOption, type EditorForm, type HierarchyDecisionRow, choiceOptionLabel, choiceOptionsLabel, hierarchyRowsFromDecisionText, parseLineList } from "./modeloLimpieza";
import { inputStyle, secondaryButtonStyle } from "./estilosLimpieza";

export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: "var(--pulso-type-subtitle-size)", fontWeight: 700, color: "var(--pulso-text)" }}>{label}</span>
      {children}
    </label>
  );
}

export function HierarchyDecisionEditor({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ChoiceOption[];
}) {
  const rows = hierarchyRowsFromDecisionText(value);
  const visibleRows = rows.length ? rows : [{ trigger: "", required: "" }];
  const hasOptions = options.length > 0;
  const optionsByCode = useMemo(
    () => new Map(options.map((option) => [option.code, option])),
    [options],
  );

  function commit(nextRows: HierarchyDecisionRow[]) {
    const map: Record<string, string[]> = {};
    for (const row of nextRows) {
      const trigger = row.trigger.trim();
      const required = parseLineList(row.required).filter((code) => code !== trigger);
      if (trigger && required.length) map[trigger] = required;
    }
    onChange(Object.keys(map).length ? JSON.stringify(map, null, 2) : "");
  }

  function update(idx: number, patch: Partial<HierarchyDecisionRow>) {
    commit(visibleRows.map((row, i) => {
      if (i !== idx) return row;
      const next = { ...row, ...patch };
      if (patch.trigger != null) {
        next.required = parseLineList(next.required).filter((code) => code !== patch.trigger).join("\n");
      }
      return next;
    }));
  }

  function remove(idx: number) {
    const next = visibleRows.filter((_, i) => i !== idx);
    commit(next.length ? next : [{ trigger: "", required: "" }]);
  }

  function addRow() {
    const used = new Set(visibleRows.map((row) => row.trigger).filter(Boolean));
    const nextTrigger = options.find((option) => !used.has(option.code))?.code ?? "";
    commit([...visibleRows, { trigger: nextTrigger, required: "" }]);
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {visibleRows.map((row, idx) => (
        <div
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(130px, .8fr) minmax(180px, 1.2fr) 32px",
            gap: 8,
            alignItems: "start",
            padding: 10,
            border: "1px solid var(--pulso-border)",
            borderRadius: 10,
            background: "var(--pulso-surface-2)",
          }}
        >
          <FormField label="Cuando aparece">
            {hasOptions ? (
              <OptionRadioPicker
                options={options}
                value={row.trigger}
                onChange={(code) => update(idx, { trigger: code })}
                name={`limpieza-hierarchy-trigger-${idx}`}
                compact
              />
            ) : (
              <input
                value={row.trigger}
                onChange={(event) => update(idx, { trigger: event.target.value })}
                style={inputStyle}
                placeholder="Código u opción marcada"
              />
            )}
          </FormField>
          <FormField label="Completar también con">
            {hasOptions ? (
              <OptionChecklist
                options={options.filter((option) => option.code !== row.trigger)}
                value={parseLineList(row.required)}
                onChange={(codes) => update(idx, { required: codes.join("\n") })}
                compact
              />
            ) : (
              <textarea
                rows={2}
                value={row.required}
                onChange={(event) => update(idx, { required: event.target.value })}
                style={{ ...inputStyle, resize: "vertical" }}
                placeholder="Una opción por línea"
              />
            )}
          </FormField>
          <button
            type="button"
            onClick={() => remove(idx)}
            className="pulso-icon"
            aria-label="Quitar relación"
            title="Quitar relación"
            style={{ width: 30, height: 30, marginTop: 23, background: "white" }}
          >
            <Trash2 size={12} />
          </button>
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              padding: "7px 9px",
              borderRadius: 8,
              background: "white",
              border: "1px solid var(--pulso-border)",
              fontSize: "var(--pulso-type-caption-size)",
              color: "var(--pulso-text-soft)",
            }}
          >
            <span>Si aparece</span>
            <strong style={{ color: "var(--pulso-text)" }}>
              {choiceOptionLabel(row.trigger, optionsByCode, "opción marcada")}
            </strong>
            <span>se completará</span>
            <strong style={{ color: "var(--pulso-text)" }}>
              {choiceOptionsLabel(parseLineList(row.required), optionsByCode, "opciones esperadas")}
            </strong>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        style={{ ...secondaryButtonStyle, justifySelf: "start" }}
      >
        Agregar relación
      </button>
    </div>
  );
}

export function OptionRadioPicker({
  options,
  value,
  onChange,
  name,
  compact = false,
}: {
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  name: string;
  compact?: boolean;
}) {
  return (
    <div className={`pulso-option-picker${compact ? " is-compact" : ""}`}>
      <div className="pulso-option-picker-list">
        {options.map((option) => {
          const checked = value === option.code;
          return (
            <label key={option.code} className={`pulso-option-picker-row${checked ? " is-selected" : ""}`}>
              <input
                type="radio"
                name={name}
                checked={checked}
                onChange={() => onChange(option.code)}
              />
              <span>
                <strong>{option.label || option.code}</strong>
                {option.code !== option.label && <small>{option.code}</small>}
              </span>
              {option.n != null && <em>n={option.n}</em>}
            </label>
          );
        })}
        {!options.length && (
          <EstadoVacio icono={<Inbox size={16} />} titulo="Sin opciones del catálogo." />
        )}
      </div>
    </div>
  );
}

export function OptionChecklist({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: ChoiceOption[];
  value: string[];
  onChange: (value: string[]) => void;
  compact?: boolean;
}) {
  const selected = new Set(value);
  function toggle(code: string) {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(Array.from(next));
  }

  return (
    <div className={`pulso-option-picker${compact ? " is-compact" : ""}`}>
      <div className="pulso-option-picker-list" data-qa-geometry-group="validacion/limpieza-opciones" data-qa-geometry-contract="equal">
        {options.map((option) => {
          const checked = selected.has(option.code);
          return (
            <label key={option.code} className={`pulso-option-picker-row${checked ? " is-selected" : ""}`}>
              <PulsoSwitch size="sm" ariaLabel={option.label || option.code} checked={checked} onCheckedChange={() => toggle(option.code)} />
              <span>
                <strong>{option.label || option.code}</strong>
                {option.code !== option.label && <small>{option.code}</small>}
              </span>
              {option.n != null && <em>n={option.n}</em>}
            </label>
          );
        })}
        {!options.length && (
          <EstadoVacio icono={<Inbox size={16} />} titulo="Sin opciones disponibles." />
        )}
      </div>
    </div>
  );
}

export function renderActionSpecificFields(
  form: EditorForm,
  setForm: Dispatch<SetStateAction<EditorForm>>,
  choiceOptions: ChoiceOption[],
  /** La pregunta es numérica: los ejemplos de los campos son cifras (V3, Hallazgos). */
  numerica = false,
) {
  if (form.action_type === "replace_value") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <FormField label="Valor actual (opcional)">
          <input
            value={form.replace_from}
            onChange={(event) => {
              const replaceFrom = event.target.value;
              setForm((current) => ({ ...current, replace_from: replaceFrom }));
            }}
            style={inputStyle}
            placeholder={numerica ? "Ej. 17" : "Ej. Sii"}
          />
        </FormField>
        <FormField label="Valor corregido">
          <input
            value={form.replace_to}
            onChange={(event) => {
              const replaceTo = event.target.value;
              setForm((current) => ({ ...current, replace_to: replaceTo }));
            }}
            style={inputStyle}
            placeholder={numerica ? "Ej. 18" : "Ej. Sí"}
          />
        </FormField>
      </div>
    );
  }

  if (form.action_type === "set_value") {
    return (
      <FormField label="Valor a asignar">
        <input
          value={form.set_value}
          onChange={(event) => {
            const setValue = event.target.value;
            setForm((current) => ({ ...current, set_value: setValue }));
          }}
          style={inputStyle}
          placeholder={numerica ? "Ej. 99" : "Ej. No aplica"}
        />
      </FormField>
    );
  }

  if (form.action_type === "recode_map") {
    return (
      <FormField label="Mapa de recodificación">
        <textarea
          rows={6}
          value={form.recode_map_json}
          onChange={(event) => {
            const recodeMapJson = event.target.value;
            setForm((current) => ({ ...current, recode_map_json: recodeMapJson }));
          }}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "ui-monospace, monospace" }}
          placeholder={'{\n  "Sii": "Sí",\n  "N": "No"\n}'}
        />
        <span style={{ fontSize: "var(--pulso-type-caption-size)", color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
          Usa JSON: cada clave es el valor actual y cada valor es la recodificación.
        </span>
      </FormField>
    );
  }

  if (form.action_type === "nullify_fields") {
    return (
      <FormField label="Variables a anular">
        <textarea
          rows={4}
          value={form.nullify_variables_text}
          onChange={(event) => {
            const nullifyVariablesText = event.target.value;
            setForm((current) => ({ ...current, nullify_variables_text: nullifyVariablesText }));
          }}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "ui-monospace, monospace" }}
          placeholder={`Deja vacío para anular solo la variable objetivo.\nO escribe una variable por línea.`}
        />
      </FormField>
    );
  }

  if (form.action_type === "normalize_value") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <FormField label="Etiqueta a normalizar">
          <input
            value={form.normalize_from}
            onChange={(event) => {
              const normalizeFrom = event.target.value;
              setForm((current) => ({ ...current, normalize_from: normalizeFrom }));
            }}
            style={inputStyle}
            placeholder="Ej. SI / si / Sí"
          />
        </FormField>
        <FormField label="Etiqueta estándar">
          <input
            value={form.normalize_to}
            onChange={(event) => {
              const normalizeTo = event.target.value;
              setForm((current) => ({ ...current, normalize_to: normalizeTo }));
            }}
            style={inputStyle}
            placeholder="Ej. Sí"
          />
        </FormField>
      </div>
    );
  }

  if (form.action_type === "impute_value") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <FormField label="Método">
          <select
            value={form.impute_method}
            onChange={(event) => {
              const imputeMethod = event.target.value as EditorForm["impute_method"];
              setForm((current) => ({ ...current, impute_method: imputeMethod }));
            }}
            style={inputStyle}
          >
            <option value="fixed">Valor fijo</option>
            <option value="mode">Moda</option>
            <option value="median">Mediana</option>
          </select>
        </FormField>
        {form.impute_method === "fixed" && (
          <FormField label="Valor fijo">
            <input
              value={form.impute_fixed_value}
              onChange={(event) => {
                const imputeFixedValue = event.target.value;
                setForm((current) => ({ ...current, impute_fixed_value: imputeFixedValue }));
              }}
              style={inputStyle}
              placeholder="Escribe el valor"
            />
          </FormField>
        )}
      </div>
    );
  }

  if (form.action_type === "complete_select_multiple_hierarchy") {
    return (
      <FormField label="Relación de opciones">
        <HierarchyDecisionEditor
          value={form.hierarchy_map_json}
          options={choiceOptions}
          onChange={(hierarchyMapJson) => {
            setForm((current) => ({ ...current, hierarchy_map_json: hierarchyMapJson }));
          }}
        />
        <span style={{ fontSize: "var(--pulso-type-caption-size)", color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
          Se lee así: cuando aparece la opción de la izquierda, también deben aparecer las de la derecha.
        </span>
      </FormField>
    );
  }

  if (form.action_type === "adjust_select_multiple") {
    const addCodes = parseLineList(form.sm_add_codes);
    const removeCodes = parseLineList(form.sm_remove_codes);
    const optionsByCode = new Map(choiceOptions.map((option) => [option.code, option]));
    if (choiceOptions.length > 0) {
      return (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <FormField label="Agregar">
              <OptionChecklist
                options={choiceOptions.filter((option) => !removeCodes.includes(option.code))}
                value={addCodes}
                onChange={(codes) => {
                  setForm((current) => ({ ...current, sm_add_codes: codes.join("\n") }));
                }}
                compact
              />
            </FormField>
            <FormField label="Quitar">
              <OptionChecklist
                options={choiceOptions.filter((option) => !addCodes.includes(option.code))}
                value={removeCodes}
                onChange={(codes) => {
                  setForm((current) => ({ ...current, sm_remove_codes: codes.join("\n") }));
                }}
                compact
              />
            </FormField>
          </div>
          <div style={{ fontSize: "var(--pulso-type-caption-size)", color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
            {addCodes.length > 0 && (
              <span>
                Agregar: <strong style={{ color: "var(--pulso-text)" }}>{choiceOptionsLabel(addCodes, optionsByCode, "opciones")}</strong>.
              </span>
            )}
            {addCodes.length > 0 && removeCodes.length > 0 && <span> </span>}
            {removeCodes.length > 0 && (
              <span>
                Quitar: <strong style={{ color: "var(--pulso-text)" }}>{choiceOptionsLabel(removeCodes, optionsByCode, "opciones")}</strong>.
              </span>
            )}
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <FormField label="Opciones a agregar">
          <textarea
            rows={4}
            value={form.sm_add_codes}
            onChange={(event) => {
              const smAddCodes = event.target.value;
              setForm((current) => ({ ...current, sm_add_codes: smAddCodes }));
            }}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "ui-monospace, monospace" }}
            placeholder="Una opción por línea"
          />
        </FormField>
        <FormField label="Opciones a quitar">
          <textarea
            rows={4}
            value={form.sm_remove_codes}
            onChange={(event) => {
              const smRemoveCodes = event.target.value;
              setForm((current) => ({ ...current, sm_remove_codes: smRemoveCodes }));
            }}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "ui-monospace, monospace" }}
            placeholder="Una opción por línea"
          />
        </FormField>
      </div>
    );
  }

  return null;
}
