import { useEffect, useRef, useState } from "react";
import { Info, Sparkles, PencilLine, Image as ImageIcon, Palette, Pipette, X as XIcon } from "lucide-react";
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

    case "color":
      return (
        <ColorField
          value={(value as string | null | undefined) ?? ""}
          defaultValue={typeof meta.default === "string" ? meta.default : undefined}
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

// ---- Color picker -------------------------------------------------------

// Presets generales — cubren los casos más comunes sin forzar al
// analista a abrir el color wheel. Ordenados: neutros → primary → acento.
const COLOR_PRESETS: { value: string; label: string }[] = [
  { value: "#000000", label: "Negro" },
  { value: "#222222", label: "Casi negro" },
  { value: "#555555", label: "Gris oscuro" },
  { value: "#888888", label: "Gris medio" },
  { value: "#BBBBBB", label: "Gris claro" },
  { value: "#FFFFFF", label: "Blanco" },
  { value: "#002457", label: "Azul Prosecnur" },
  { value: "#0B3A67", label: "Azul profundo" },
  { value: "#39588B", label: "Azul acero" },
  { value: "#B33A3A", label: "Rojo" },
  { value: "#2E7D32", label: "Verde" },
  { value: "#F5A623", label: "Ámbar" },
];

// Palabras clave CSS que los graficadores R también aceptan y que no
// tienen representación hex — se muestran como chip literal en vez
// de swatch.
const COLOR_KEYWORDS = ["transparent", "white", "black"];

function isValidColor(v: string): boolean {
  if (!v) return true; // vacío = hereda
  if (COLOR_KEYWORDS.includes(v.toLowerCase())) return true;
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim());
}

// Normaliza shorthand (#abc → #aabbcc) y keyword → hex, para que el
// <input type="color"> nativo siempre reciba un hex de 7 chars.
function toHex7(v: string): string {
  const s = (v || "").trim().toLowerCase();
  if (s === "white") return "#ffffff";
  if (s === "black" || s === "transparent" || s === "") return "#000000";
  const m = s.match(/^#([0-9a-f]{3})$/);
  if (m) {
    const [r, g, b] = m[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{8}$/.test(s)) return s.slice(0, 7);
  return "#000000";
}

function ColorField({
  value, defaultValue, onChange,
}: {
  value: string;
  defaultValue?: string;
  onChange: (v: string | null) => void;
}) {
  const paletas = usePlanStore((s) => s.paletas);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  // Sync draft con prop externo (ej. al cambiar de preset seleccionado).
  useEffect(() => { setDraft(value); }, [value]);

  // Click fuera → cerrar popover.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function commit(v: string | null) {
    const clean = v == null ? null : v.trim();
    if (clean === "" || clean == null) onChange(null);
    else onChange(clean);
    setDraft(clean ?? "");
  }

  function pickSwatch(hex: string) {
    commit(hex);
    setOpen(false);
  }

  const effective = value || defaultValue || "";
  const valid = isValidColor(draft);

  // Todos los colores únicos extraídos de las paletas del estudio.
  // Agrupados por paleta para que el analista reconozca de dónde viene
  // cada color (importante para mantener consistencia con los gráficos).
  const paletasEntries = Object.entries(paletas)
    .map(([name, mapa]) => ({
      name,
      colores: Array.from(new Set(Object.values(mapa))).filter(Boolean),
    }))
    .filter((p) => p.colores.length > 0);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6 }}>
      {/* Swatch clickeable */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Elegir color"
        style={{
          width: 28, height: 28, borderRadius: 6,
          border: "1px solid var(--pulso-border)",
          background:
            effective && effective !== "transparent"
              ? effective
              : "repeating-linear-gradient(45deg, #eee 0 4px, #fff 4px 8px)",
          cursor: "pointer", padding: 0, flexShrink: 0,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.4)",
        }}
        aria-label="Abrir selector de color"
      />
      {/* Input hex con validación visual */}
      <input
        type="text"
        value={draft}
        placeholder={defaultValue || "#RRGGBB o 'white'"}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { commit(draft); (e.target as HTMLInputElement).blur(); }
          if (e.key === "Escape") { setDraft(value); (e.target as HTMLInputElement).blur(); }
        }}
        style={{
          ...inputStyle,
          width: 130,
          fontFamily: "ui-monospace, monospace",
          fontSize: 11,
          borderColor: valid ? "var(--pulso-border)" : "#f59f9f",
          background: valid ? "white" : "#fef7f7",
        }}
      />
      {draft && (
        <button
          type="button"
          onClick={() => commit(null)}
          className="pulso-icon"
          aria-label="Borrar color (heredar)"
          title="Borrar (hereda del preset padre)"
          style={{ padding: 3, minWidth: 22, minHeight: 22 }}
        >
          <XIcon size={11} />
        </button>
      )}

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0,
            zIndex: 30,
            minWidth: 280,
            background: "white",
            border: "1px solid var(--pulso-border)",
            borderRadius: 8,
            boxShadow: "var(--pulso-shadow-med)",
            padding: 10,
            display: "flex", flexDirection: "column", gap: 10,
          }}
        >
          {/* Presets comunes */}
          <PopoverSection icon={<Palette size={11} />} label="Comunes">
            <SwatchRow colors={COLOR_PRESETS} active={effective} onPick={pickSwatch} />
          </PopoverSection>

          {/* Paletas del estudio */}
          {paletasEntries.length > 0 && (
            <PopoverSection icon={<Palette size={11} />} label="Tus paletas">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {paletasEntries.map((p) => (
                  <div key={p.name} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 10, color: "var(--pulso-text-soft)" }}>{p.name}</span>
                    <SwatchRow
                      colors={p.colores.map((c) => ({ value: c, label: c }))}
                      active={effective}
                      onPick={pickSwatch}
                    />
                  </div>
                ))}
              </div>
            </PopoverSection>
          )}

          {/* Color wheel nativo + keywords */}
          <PopoverSection icon={<Pipette size={11} />} label="Personalizado">
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <label
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 11, cursor: "pointer",
                }}
              >
                <input
                  type="color"
                  value={toHex7(draft || effective)}
                  onChange={(e) => commit(e.target.value)}
                  style={{
                    width: 28, height: 28, padding: 0,
                    border: "1px solid var(--pulso-border)",
                    borderRadius: 6, cursor: "pointer",
                  }}
                />
                Abrir rueda
              </label>
              {COLOR_KEYWORDS.map((kw) => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => pickSwatch(kw)}
                  style={{
                    fontSize: 10, padding: "3px 8px", borderRadius: 999,
                    border: `1px solid ${effective === kw ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                    background: effective === kw ? "var(--pulso-primary-soft)" : "white",
                    color: effective === kw ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
                    fontFamily: "ui-monospace, monospace",
                    cursor: "pointer",
                  }}
                >
                  {kw}
                </button>
              ))}
            </div>
          </PopoverSection>
        </div>
      )}
    </div>
  );
}

function PopoverSection({ icon, label, children }: {
  icon: JSX.Element;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <h5
        style={{
          margin: 0, fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: 0.4,
          color: "var(--pulso-text-soft)",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}
      >
        {icon}
        {label}
      </h5>
      {children}
    </section>
  );
}

function SwatchRow({
  colors, active, onPick,
}: {
  colors: { value: string; label: string }[];
  active: string;
  onPick: (hex: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {colors.map((c) => {
        const isActive = active.toLowerCase() === c.value.toLowerCase();
        return (
          <button
            key={c.value + c.label}
            type="button"
            onClick={() => onPick(c.value)}
            title={`${c.label} · ${c.value}`}
            style={{
              width: 22, height: 22, borderRadius: 5,
              background: c.value,
              border: isActive
                ? "2px solid var(--pulso-primary)"
                : "1px solid var(--pulso-border)",
              boxShadow: isActive
                ? "0 0 0 2px var(--pulso-primary-soft)"
                : "inset 0 0 0 1px rgba(255,255,255,0.35)",
              cursor: "pointer", padding: 0,
              transition: "transform 120ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          />
        );
      })}
    </div>
  );
}
