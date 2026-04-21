import { useState } from "react";
import { Info, Sparkles, PencilLine, Image as ImageIcon } from "lucide-react";
import { ArgMetadata, VarInfo } from "../../api/client";
import { usePlanStore } from "./store";
import { downloadUrl } from "../../api/client";
import VariablePicker from "./VariablePicker";
import VarsListPicker from "./VarsListPicker";

// Renderer universal de un argumento, según su `tipo_input` en el
// registry. Es la pieza que hace que podamos añadir nuevos args en
// graficos_metadata.R y que la UI los muestre sin tocar más código.
//
// Uso:
//   <ArgField meta={argMeta} value={x} onChange={(v) => ...} />
//
// Para cada `tipo_input` se renderiza el control apropiado:
//   - variable / variable_opt → VariablePicker
//   - variables_list          → VarsListPicker
//   - string                  → <input text>
//   - textarea                → <textarea>
//   - number                  → <input number>
//   - bool                    → toggle
//   - choice                  → radio pills
//   - codigos_list            → chips list (split por coma/espacio)
//   - icono                   → selector del catálogo de iconos subidos
//   - overrides / filtros / base_config / meta → placeholder (Fase 2B)

type ArgValue = unknown;

export function ArgField({
  meta,
  value,
  onChange,
  variables,
}: {
  meta: ArgMetadata;
  value: ArgValue;
  onChange: (v: ArgValue) => void;
  variables: VarInfo[];
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
      <FieldHeader meta={meta} />
      <FieldControl meta={meta} value={value} onChange={onChange} variables={variables} />
    </label>
  );
}

// ---- Header con label + tooltip info ------------------------------------

function FieldHeader({ meta }: { meta: ArgMetadata }) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}>
      <span style={{ fontWeight: 600, color: "var(--pulso-text)" }}>{meta.label}</span>
      {meta.descripcion && (
        <span
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "help" }}
        >
          <Info size={11} color="var(--pulso-text-soft)" />
          {showTooltip && (
            <span
              role="tooltip"
              style={{
                position: "absolute",
                left: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)",
                zIndex: 30,
                minWidth: 180, maxWidth: 280,
                padding: "7px 10px",
                background: "var(--pulso-text)",
                color: "white",
                fontSize: 11, fontWeight: 400,
                lineHeight: 1.45,
                borderRadius: 6,
                boxShadow: "var(--pulso-shadow-med)",
                whiteSpace: "normal",
                pointerEvents: "none",
              }}
            >
              {meta.descripcion}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

// ---- Control por tipo_input ---------------------------------------------

function FieldControl({
  meta,
  value,
  onChange,
  variables,
}: {
  meta: ArgMetadata;
  value: ArgValue;
  onChange: (v: ArgValue) => void;
  variables: VarInfo[];
}) {
  switch (meta.tipo_input) {
    case "variable":
      return <VariablePicker value={value as string} onChange={(v) => onChange(v ?? "")} />;

    case "variable_opt":
      return <VariablePicker value={value as string} onChange={(v) => onChange(v)} allowEmpty />;

    case "variables_list":
      return <VarsListPicker value={(value as string[]) ?? []} onChange={(v) => onChange(v)} />;

    case "string":
      return (
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={meta.descripcion ? undefined : "(opcional)"}
          style={inputStyle}
        />
      );

    case "textarea":
      return (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
        />
      );

    case "number":
      return (
        <input
          type="number"
          value={typeof value === "number" ? value : (value === undefined || value === null ? "" : Number(value))}
          onChange={(e) => {
            const n = e.target.value === "" ? null : Number(e.target.value);
            onChange(n);
          }}
          style={{ ...inputStyle, width: 120 }}
        />
      );

    case "bool":
      return <BoolToggle value={!!value} onChange={onChange} />;

    case "choice":
      return <ChoicePills meta={meta} value={value as string} onChange={onChange} />;

    case "codigos_list":
      return <CodigosList value={(value as (string | number)[]) ?? []} onChange={onChange} />;

    case "multiflag":
      // Fallback a texto libre si el registry no trajo opciones — mantiene
      // compat con args antiguos que quedaron declarados como multiflag
      // sin el catálogo cerrado.
      if (!meta.opciones || meta.opciones.length === 0) {
        return <CodigosList value={(value as string[]) ?? []} onChange={onChange} />;
      }
      return (
        <MultiFlag
          opciones={meta.opciones}
          value={(value as string[]) ?? []}
          onChange={onChange}
        />
      );

    case "icono":
      return <IconoSelect value={value as string | null} onChange={onChange} />;

    case "overrides":
    case "filtros":
    case "base_config":
    case "meta":
    default:
      return <AdvancedPlaceholder meta={meta} value={value} onChange={onChange} />;
  }
}

// ---- Estilos + sub-componentes ------------------------------------------

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 12,
  border: "1px solid var(--pulso-border)",
  borderRadius: 5,
  background: "white",
  outline: "none",
};

function BoolToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 10px", borderRadius: 999,
        border: `1px solid ${value ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
        background: value ? "var(--pulso-primary-soft)" : "white",
        color: value ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
        fontSize: 11, fontWeight: 600, cursor: "pointer",
        alignSelf: "flex-start",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      <span
        style={{
          width: 24, height: 12, borderRadius: 999,
          background: value ? "var(--pulso-primary)" : "var(--pulso-border)",
          position: "relative",
          transition: "background 120ms ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1, left: value ? 13 : 1,
            width: 10, height: 10, borderRadius: "50%",
            background: "white",
            transition: "left 120ms ease",
          }}
        />
      </span>
      {value ? "Sí" : "No"}
    </button>
  );
}

function ChoicePills({
  meta,
  value,
  onChange,
}: {
  meta: ArgMetadata;
  value: string;
  onChange: (v: string) => void;
}) {
  const choices = meta.choices ?? [];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {choices.map((c) => {
        const active = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            title={c.hint}
            style={{
              padding: "5px 10px", borderRadius: 999,
              border: `1px solid ${active ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
              background: active ? "var(--pulso-primary-soft)" : "white",
              color: active ? "var(--pulso-primary)" : "var(--pulso-text)",
              fontSize: 11, fontWeight: active ? 600 : 500,
              cursor: "pointer",
              transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
            }}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

function CodigosList({
  value,
  onChange,
}: {
  value: (string | number)[];
  onChange: (v: (string | number)[]) => void;
}) {
  // Input de texto donde el usuario escribe códigos separados por coma
  // o espacio. Lo parseamos a array de strings (algunos son numéricos,
  // pero el backend los acepta como string y convierte).
  const text = Array.isArray(value) ? value.join(", ") : "";
  return (
    <input
      type="text"
      value={text}
      onChange={(e) => {
        const parts = e.target.value.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
        onChange(parts);
      }}
      placeholder="ej. 88, 90, 96"
      style={inputStyle}
    />
  );
}

function IconoSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const iconos = usePlanStore((s) => s.iconos);
  const selected = iconos.find((i) => i.id === value);

  if (iconos.length === 0) {
    return (
      <div
        style={{
          padding: "8px 10px", borderRadius: 6,
          border: "1px dashed var(--pulso-border)",
          background: "var(--pulso-surface)",
          fontSize: 11, color: "var(--pulso-text-soft)",
        }}
      >
        <ImageIcon size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "-2px" }} />
        No tienes iconos subidos. Sube PNGs en <strong>Configuración global → Iconos</strong>.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        style={{ ...inputStyle, padding: "5px 8px" }}
      >
        <option value="">(ninguno)</option>
        {iconos.map((ic) => (
          <option key={ic.id} value={ic.id}>
            {ic.nombre}
          </option>
        ))}
      </select>
      {selected && (
        <div
          style={{
            marginTop: 4, padding: 6,
            background: "var(--pulso-surface)",
            border: "1px solid var(--pulso-border)",
            borderRadius: 5,
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <img
            src={downloadUrl(selected.file_id)}
            alt={selected.nombre}
            style={{ width: 34, height: 34, objectFit: "contain" }}
          />
          <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>{selected.nombre}</span>
        </div>
      )}
    </div>
  );
}

// Fallback para tipos avanzados (overrides, filtros, base_config, meta).
// Por ahora permite editar el JSON crudo para power-users; la UI
// dedicada vive en Fase 2B.
function AdvancedPlaceholder({
  meta,
  value,
  onChange,
}: {
  meta: ArgMetadata;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const jsonText = JSON.stringify(value ?? (meta.tipo_input === "overrides" || meta.tipo_input === "filtros" || meta.tipo_input === "base_config" ? {} : null), null, 2);
  const [draft, setDraft] = useState(jsonText);

  const hasValue =
    value !== null && value !== undefined &&
    !(typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) &&
    !(Array.isArray(value) && value.length === 0);

  if (!editing) {
    return (
      <div
        style={{
          padding: "7px 10px", borderRadius: 6,
          border: "1px dashed var(--pulso-border)",
          background: "var(--pulso-surface)",
          fontSize: 11, color: "var(--pulso-text-soft)",
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        {hasValue ? <PencilLine size={12} color="var(--pulso-primary)" /> : <Sparkles size={12} />}
        <span style={{ flex: 1 }}>
          {hasValue ? `${meta.label} personalizado` : "Defaults del preset global"}
        </span>
        <button
          type="button"
          onClick={() => { setDraft(jsonText); setEditing(true); }}
          style={{ fontSize: 10, padding: "3px 7px" }}
        >
          Editar JSON
        </button>
        {hasValue && (
          <button
            type="button"
            onClick={() => onChange(meta.tipo_input === "overrides" || meta.tipo_input === "filtros" || meta.tipo_input === "base_config" ? {} : null)}
            style={{ fontSize: 10, padding: "3px 7px", color: "#991b1b" }}
          >
            Limpiar
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={5}
        style={{ ...inputStyle, fontFamily: "ui-monospace, monospace", fontSize: 11, resize: "vertical" }}
      />
      <div style={{ display: "flex", gap: 4 }}>
        <button
          type="button"
          className="pulso-primary"
          onClick={() => {
            try {
              const parsed = draft.trim() === "" ? null : JSON.parse(draft);
              onChange(parsed);
              setEditing(false);
            } catch (e) {
              alert(`JSON inválido: ${(e as Error).message}`);
            }
          }}
          style={{ fontSize: 11, padding: "4px 10px" }}
        >
          Aplicar
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          style={{ fontSize: 11, padding: "4px 10px" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// Multi-select cerrado de tokens — usado por `textos_negrita` y
// similares. Renderiza chips toggleables con las `opciones` que el
// preset declara soportar. El valor es un array de strings.
//
// Diseñado para que el analista NO escriba tokens a mano y NO tenga
// que memorizar qué elementos del gráfico acepta cada preset.
function MultiFlag({
  opciones, value, onChange,
}: {
  opciones: { value: string; label: string; hint?: string }[];
  value: string[];
  onChange: (v: string[] | null) => void;
}) {
  const set = new Set(value);

  function toggle(v: string) {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    const arr = Array.from(next);
    // Null en vez de [] para que el store normalice y no persista un
    // array vacío innecesariamente (mismo patrón que otros inputs).
    onChange(arr.length === 0 ? null : arr);
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {opciones.map((opt) => {
        const on = set.has(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            role="switch"
            aria-checked={on}
            title={opt.hint}
            onClick={() => toggle(opt.value)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 999,
              border: `1px solid ${on ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
              background: on ? "var(--pulso-primary-soft)" : "white",
              color: on ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
              fontSize: 11, fontWeight: on ? 700 : 500,
              cursor: "pointer",
              transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
            }}
          >
            {on && (
              <span
                aria-hidden="true"
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "var(--pulso-primary)",
                  display: "inline-block",
                }}
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
