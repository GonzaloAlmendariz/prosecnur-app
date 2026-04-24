import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Save, X as XIcon } from "lucide-react";
import type { ExploradorVariable, ExploradorVariablesList, ReglaCustom, ReglaCustomTipo } from "../types";
import { RuleNarrative } from "./v2";
import type { VariableHoverData } from "./v2";
import { draftCustomToRule } from "../customRuleNarrative";

// =============================================================================
// ReglaEditor — wizard de 3 pasos para crear / editar una ReglaCustom
// =============================================================================
//  Paso 1: Tipo de regla (6 tipos predefinidos con descripción).
//  Paso 2: Variable(s) involucrada(s).
//  Paso 3: Parámetros específicos del tipo + nombre + mensaje.
//
// Onsubmit entrega un payload listo para POST /api/validacion/v2/reglas_custom
// o PUT /.../<id> (si inicial trae id).

type Props = {
  inv: ExploradorVariablesList;
  inicial?: ReglaCustom | null;
  onSubmit: (payload: Omit<ReglaCustom, "id" | "created_at"> & { id?: string }) => Promise<void>;
  onCancel: () => void;
};

type TipoMeta = {
  key: ReglaCustomTipo;
  label: string;
  descripcion: string;
  nVars: number | [number, number];
};

const TIPOS: TipoMeta[] = [
  { key: "no_nulo", label: "No nulo", descripcion: "Marca los casos donde la variable está vacía o es NA.", nVars: 1 },
  { key: "rango_num", label: "Rango numérico", descripcion: "Marca casos fuera de [min, max] en una variable numérica.", nVars: 1 },
  { key: "rango_fecha", label: "Rango de fecha", descripcion: "Marca casos fuera del rango de fechas (YYYY-MM-DD).", nVars: 1 },
  { key: "outliers_iqr", label: "Outliers (IQR)", descripcion: "Detecta casos fuera de [Q1 − k·IQR, Q3 + k·IQR].", nVars: 1 },
  { key: "outliers_z", label: "Outliers (Z-score)", descripcion: "Detecta casos con |z| > k.", nVars: 1 },
  { key: "duplicados", label: "Duplicados", descripcion: "Marca casos cuya tupla de variables se repite.", nVars: [1, 5] },
  { key: "fuera_catalogo", label: "Fuera de catálogo", descripcion: "Marca casos cuyo valor no está en la lista permitida.", nVars: 1 },
  { key: "coherencia_2v", label: "Coherencia entre 2 variables", descripcion: "Ej.: si X = 'a' entonces Y debe estar entre 1 y 5.", nVars: 2 },
];

export default function ReglaEditor({ inv, inicial, onSubmit, onCancel }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<ReglaCustomTipo | null>(
    inicial?.tipo ?? null,
  );
  const [variables, setVariables] = useState<string[]>(inicial?.variables ?? []);
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [mensaje, setMensaje] = useState(inicial?.mensaje ?? "");
  const [params, setParams] = useState<Record<string, unknown>>(
    inicial?.params ?? {},
  );
  const [activa, setActiva] = useState<boolean>(inicial?.activa ?? true);
  const [error, setError] = useState<string>("");

  const tipoMeta = TIPOS.find((t) => t.key === tipo) ?? null;
  // flatVars estabilizado: sin useMemo se recalcula en cada keystroke y
  // dispara re-renders en cascada que acumulan portals de los hovercards
  // de variable (crashes en bases grandes).
  const flatVars: ExploradorVariable[] = useMemo(
    () => inv.secciones.flatMap((s) => s.variables),
    [inv.secciones],
  );

  // Plano variable → sección para el hover lookup del preview.
  const varSections = useMemo(() => {
    const map = new Map<string, string>();
    for (const sec of inv.secciones) {
      for (const v of sec.variables) map.set(v.name, sec.nombre);
    }
    return map;
  }, [inv.secciones]);

  // Regla draft (para preview narrativo). Se actualiza reactivamente cuando
  // el usuario avanza por los pasos o cambia cualquier parámetro.
  const draftRule = useMemo(
    () => draftCustomToRule({ tipo, variables, nombre, mensaje, params }),
    [tipo, variables, nombre, mensaje, params],
  );

  const variableHoverLookup = useMemo(
    () => (varName: string): VariableHoverData | undefined => {
      const v = flatVars.find((x) => x.name === varName);
      if (!v) return undefined;
      return { label: v.label ?? null, seccion: varSections.get(varName) ?? null };
    },
    [flatVars, varSections],
  );

  const labelLookup = useMemo(
    () => (v: string) => flatVars.find((x) => x.name === v)?.label ?? null,
    [flatVars],
  );

  function validateStep(s: number): string {
    if (s === 1 && !tipo) return "Elige un tipo de regla.";
    if (s === 2) {
      if (!tipoMeta) return "Tipo no definido.";
      const needed = typeof tipoMeta.nVars === "number" ? tipoMeta.nVars : tipoMeta.nVars[0];
      if (variables.length < needed) return `Necesitas al menos ${needed} variable(s).`;
    }
    if (s === 3) {
      if (!nombre.trim()) return "Agrega un nombre descriptivo a la regla.";
      // Validaciones por tipo.
      if (tipo === "rango_num") {
        const mn = params.min as string | undefined;
        const mx = params.max as string | undefined;
        if (!mn && !mx) return "Define al menos min o max.";
      }
      if (tipo === "rango_fecha") {
        const mn = params.min as string | undefined;
        const mx = params.max as string | undefined;
        if (!mn && !mx) return "Define al menos min o max (YYYY-MM-DD).";
      }
      if (tipo === "outliers_iqr" || tipo === "outliers_z") {
        const k = Number(params.k);
        if (!isFinite(k) || k <= 0) return "k debe ser un número > 0.";
      }
      if (tipo === "fuera_catalogo") {
        const vals = (params.valores as string[] | undefined) ?? [];
        if (!vals.length) return "Lista 'valores' vacía.";
      }
      if (tipo === "coherencia_2v") {
        if (!params.op_x || !params.op_y) return "Define operadores para ambas variables.";
        if (params.valor_x === undefined || params.valor_y === undefined) return "Define valor_x y valor_y.";
      }
    }
    return "";
  }

  function goNext() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    if (step < 3) setStep((step + 1) as 1 | 2 | 3);
    else void handleSave();
  }

  function goBack() {
    setError("");
    if (step > 1) setStep((step - 1) as 1 | 2 | 3);
  }

  async function handleSave() {
    if (!tipo) return;
    const err = validateStep(3);
    if (err) { setError(err); return; }
    setSaving(true);
    try {
      await onSubmit({
        id: inicial?.id,
        activa,
        nombre,
        tipo,
        variables,
        params,
        mensaje: mensaje || nombre,
        severidad: (inicial?.severidad ?? "error"),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      style={{
        background: "white",
        border: "1px solid var(--pulso-primary)",
        borderRadius: 12,
        boxShadow: "var(--pulso-shadow-med)",
        padding: "18px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Header + stepper */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>
          {inicial ? "Editar regla" : "Nueva regla personalizada"} · Paso {step} de 3
        </div>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <input
            type="checkbox"
            checked={activa}
            onChange={(e) => setActiva(e.target.checked)}
          />
          Activa
        </label>
        <button
          type="button"
          onClick={onCancel}
          className="pulso-icon"
          aria-label="Cerrar"
          title="Cerrar"
        >
          <XIcon size={13} />
        </button>
      </div>

      <StepIndicator step={step} />

      {/* Preview narrativo en vivo: aparece en cuanto hay tipo + ≥1 variable.
          Visibilidad: step 2 y 3. En step 1 aún no hay datos suficientes y
          sería ruido. */}
      {step >= 2 && draftRule && (
        <NarrativePreview
          rule={draftRule}
          variableHoverLookup={variableHoverLookup}
          labelLookup={labelLookup}
        />
      )}

      {/* Contenido del paso */}
      {step === 1 && (
        <Step1 tipo={tipo} setTipo={setTipo} />
      )}
      {step === 2 && tipoMeta && (
        <Step2
          tipoMeta={tipoMeta}
          variables={variables}
          setVariables={setVariables}
          inv={inv}
          flatVars={flatVars}
        />
      )}
      {step === 3 && tipo && (
        <Step3
          tipo={tipo}
          nombre={nombre}
          setNombre={setNombre}
          mensaje={mensaje}
          setMensaje={setMensaje}
          params={params}
          setParams={setParams}
          variables={variables}
          flatVars={flatVars}
        />
      )}

      {error && (
        <div
          style={{
            fontSize: 11,
            color: "var(--pulso-danger-fg)",
            background: "var(--pulso-danger-bg)",
            border: "1px solid var(--pulso-danger-border)",
            padding: "6px 10px",
            borderRadius: 6,
          }}
        >
          {error}
        </div>
      )}

      {/* Footer con nav */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={goBack}
          disabled={step === 1}
          style={{
            fontSize: 12,
            padding: "7px 14px",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            opacity: step === 1 ? 0.4 : 1,
          }}
        >
          <ChevronLeft size={12} /> Anterior
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ fontSize: 12, padding: "7px 14px" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="pulso-primary"
            onClick={goNext}
            disabled={saving}
            style={{
              fontSize: 12,
              padding: "7px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {step === 3 ? (
              <>
                <Save size={12} /> Guardar regla
              </>
            ) : (
              <>
                Siguiente <ChevronRight size={12} />
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// Step indicator
// =============================================================================
function StepIndicator({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: s <= step ? "var(--pulso-primary)" : "var(--pulso-border)",
          }}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Step 1 — tipo
// =============================================================================
function Step1({
  tipo,
  setTipo,
}: {
  tipo: ReglaCustomTipo | null;
  setTipo: (t: ReglaCustomTipo) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 10,
      }}
    >
      {TIPOS.map((t) => {
        const active = tipo === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => setTipo(t.key)}
            style={{
              textAlign: "left",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${active ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
              background: active ? "var(--pulso-primary-soft)" : "white",
              cursor: "pointer",
              transition: "all 120ms ease",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: active ? "var(--pulso-primary)" : "var(--pulso-text)",
              }}
            >
              {t.label}
            </div>
            <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 4, lineHeight: 1.4 }}>
              {t.descripcion}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// Step 2 — variables
// =============================================================================
function Step2({
  tipoMeta,
  variables,
  setVariables,
  flatVars,
}: {
  tipoMeta: TipoMeta;
  variables: string[];
  setVariables: (v: string[]) => void;
  inv: ExploradorVariablesList;
  flatVars: ExploradorVariable[];
}) {
  const [query, setQuery] = useState("");
  const needed = typeof tipoMeta.nVars === "number" ? tipoMeta.nVars : tipoMeta.nVars[0];
  const max = typeof tipoMeta.nVars === "number" ? tipoMeta.nVars : tipoMeta.nVars[1];

  const candidatas = flatVars
    .filter((v) => !query || v.name.toLowerCase().includes(query.toLowerCase()) || v.label.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 300);

  function toggle(name: string) {
    if (variables.includes(name)) {
      setVariables(variables.filter((x) => x !== name));
    } else {
      if (variables.length >= max) {
        // En vez de reemplazar, ignoramos — el usuario primero debe quitar.
        return;
      }
      setVariables([...variables, name]);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
        Elige {needed === max ? `${needed}` : `entre ${needed} y ${max}`} variable{needed === 1 ? "" : "s"}. Seleccionadas: <strong>{variables.length}</strong>.
      </div>
      <input
        type="text"
        placeholder="Buscar por nombre o label…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          fontSize: 12,
          padding: "7px 10px",
          borderRadius: 6,
          border: "1px solid var(--pulso-border)",
          outline: "none",
        }}
      />
      <div
        style={{
          maxHeight: 260,
          overflowY: "auto",
          border: "1px solid var(--pulso-border)",
          borderRadius: 6,
        }}
      >
        {candidatas.map((v) => {
          const checked = variables.includes(v.name);
          return (
            <label
              key={v.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px",
                borderBottom: "1px solid var(--pulso-surface-2)",
                cursor: "pointer",
                background: checked ? "var(--pulso-primary-soft)" : "white",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(v.name)}
              />
              <code style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "var(--pulso-text)" }}>
                {v.name}
              </code>
              <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {v.label}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "var(--pulso-surface-2)", color: "var(--pulso-text-soft)", fontFamily: "ui-monospace, monospace" }}>
                {v.tipo.toUpperCase()}
              </span>
            </label>
          );
        })}
        {!candidatas.length && (
          <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
            Sin variables que coincidan.
          </div>
        )}
      </div>

      {/* Chips de variables seleccionadas */}
      {variables.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {variables.map((v, i) => (
            <span
              key={v}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 999,
                background: "var(--pulso-primary-soft)",
                color: "var(--pulso-primary)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {i + 1}. {v}
              <button
                type="button"
                onClick={() => toggle(v)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  display: "inline-flex",
                  padding: 2,
                }}
              >
                <XIcon size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Step 3 — parámetros específicos
// =============================================================================
function Step3({
  tipo,
  nombre,
  setNombre,
  mensaje,
  setMensaje,
  params,
  setParams,
  variables,
  flatVars,
}: {
  tipo: ReglaCustomTipo;
  nombre: string;
  setNombre: (v: string) => void;
  mensaje: string;
  setMensaje: (v: string) => void;
  params: Record<string, unknown>;
  setParams: (p: Record<string, unknown>) => void;
  variables: string[];
  flatVars: ExploradorVariable[];
}) {
  const setParam = (k: string, v: unknown) => setParams({ ...params, [k]: v });
  const labelVar = (v: string) => flatVars.find((x) => x.name === v)?.label ?? v;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <FieldRow label="Nombre de la regla">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={
            tipo === "no_nulo" ? `${variables[0]} no puede estar vacío` :
            tipo === "rango_num" ? `${variables[0]} plausible` :
            `Regla ${tipo}`
          }
          style={inputStyle}
        />
      </FieldRow>
      <FieldRow label="Mensaje (aparece en el objetivo)" hint="Texto que se verá al auditar esta regla.">
        <input
          type="text"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder={`Mensaje descriptivo (si vacío, usa el nombre).`}
          style={inputStyle}
        />
      </FieldRow>

      {/* Parámetros por tipo */}
      {(tipo === "rango_num" || tipo === "rango_fecha") && (
        <>
          <FieldRow label={tipo === "rango_num" ? "Mínimo (opcional)" : "Desde (YYYY-MM-DD)"}>
            <input
              type={tipo === "rango_num" ? "number" : "date"}
              value={(params.min as string) ?? ""}
              onChange={(e) => setParam("min", e.target.value)}
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label={tipo === "rango_num" ? "Máximo (opcional)" : "Hasta (YYYY-MM-DD)"}>
            <input
              type={tipo === "rango_num" ? "number" : "date"}
              value={(params.max as string) ?? ""}
              onChange={(e) => setParam("max", e.target.value)}
              style={inputStyle}
            />
          </FieldRow>
          {tipo === "rango_num" && (
            <FieldRow label="Inclusivo (marca x < min o x > max)">
              <label style={{ fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={(params.inclusive as boolean) ?? true}
                  onChange={(e) => setParam("inclusive", e.target.checked)}
                />{" "}
                Inclusivo — los límites están permitidos.
              </label>
            </FieldRow>
          )}
        </>
      )}

      {(tipo === "outliers_iqr" || tipo === "outliers_z") && (
        <FieldRow
          label={`k (${tipo === "outliers_iqr" ? "típico 1.5" : "típico 3"})`}
          hint={tipo === "outliers_iqr"
            ? "Detecta fuera de [Q1 − k·IQR, Q3 + k·IQR]."
            : "Detecta |z-score| > k."}
        >
          <input
            type="number"
            step="0.1"
            min="0"
            value={(params.k as number) ?? (tipo === "outliers_iqr" ? 1.5 : 3)}
            onChange={(e) => setParam("k", parseFloat(e.target.value))}
            style={inputStyle}
          />
        </FieldRow>
      )}

      {tipo === "fuera_catalogo" && (
        <FieldRow label="Valores permitidos (uno por línea)">
          <textarea
            rows={4}
            value={((params.valores as string[]) ?? []).join("\n")}
            onChange={(e) => setParam("valores", e.target.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean))}
            placeholder={`1\n2\n3`}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "ui-monospace, monospace" }}
          />
        </FieldRow>
      )}

      {tipo === "coherencia_2v" && (
        <>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
            Si <code>{variables[0]}</code> ({labelVar(variables[0])}) cumple la condición X,
            entonces <code>{variables[1]}</code> ({labelVar(variables[1])}) debe cumplir la condición Y.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <OpValor
              title={`Condición sobre ${variables[0]}`}
              op={params.op_x as string}
              valor={params.valor_x as string | string[]}
              onOp={(o) => setParam("op_x", o)}
              onValor={(v) => setParam("valor_x", v)}
            />
            <OpValor
              title={`Entonces ${variables[1]}`}
              op={params.op_y as string}
              valor={params.valor_y as string | string[]}
              onOp={(o) => setParam("op_y", o)}
              onValor={(v) => setParam("valor_y", v)}
            />
          </div>
        </>
      )}

      {tipo === "no_nulo" && (
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
          Sin parámetros adicionales: cada caso con NA o vacío se marca como inconsistencia.
        </div>
      )}
      {tipo === "duplicados" && (
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
          Sin parámetros adicionales: se marcan casos cuya tupla ({variables.join(", ")}) aparezca más de una vez.
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
function OpValor({
  title,
  op,
  valor,
  onOp,
  onValor,
}: {
  title: string;
  op: string | undefined;
  valor: string | string[] | undefined;
  onOp: (o: string) => void;
  onValor: (v: string | string[]) => void;
}) {
  const isList = op === "in" || op === "not_in";
  return (
    <div
      style={{
        padding: "10px 12px",
        border: "1px solid var(--pulso-border)",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {title}
      </div>
      <select
        value={op ?? ""}
        onChange={(e) => onOp(e.target.value)}
        style={inputStyle}
      >
        <option value="">— Operador —</option>
        <option value="==">=</option>
        <option value="!=">≠</option>
        <option value=">">&gt;</option>
        <option value=">=">&ge;</option>
        <option value="<">&lt;</option>
        <option value="<=">&le;</option>
        <option value="in">está en</option>
        <option value="not_in">no está en</option>
      </select>
      {isList ? (
        <textarea
          rows={2}
          value={Array.isArray(valor) ? valor.join("\n") : valor ?? ""}
          onChange={(e) => onValor(e.target.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean))}
          placeholder="Un valor por línea"
          style={{ ...inputStyle, resize: "vertical" }}
        />
      ) : (
        <input
          type="text"
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => onValor(e.target.value)}
          placeholder="valor"
          style={inputStyle}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </span>
      {children}
      {hint && <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>{hint}</span>}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid var(--pulso-border)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

// =============================================================================
// NarrativePreview — "Así se va a leer esta regla" en tiempo real.
// Usa RuleNarrative en variant hero para que el usuario vea el mismo
// formato con el que aparecerá en listas / cola de limpieza / drills.
// =============================================================================
function NarrativePreview({
  rule,
  variableHoverLookup,
  labelLookup,
}: {
  rule: ReturnType<typeof draftCustomToRule>;
  variableHoverLookup: (varName: string) => VariableHoverData | undefined;
  labelLookup: (varName: string) => string | null;
}) {
  if (!rule) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 12px 12px",
        background: "var(--pulso-surface)",
        borderRadius: 10,
        border: "1px dashed var(--pulso-primary-border)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "var(--pulso-primary)",
        }}
      >
        Así se va a leer esta regla
      </div>
      <RuleNarrative
        rule={rule}
        variant="hero"
        variableHoverLookup={variableHoverLookup}
        labelLookup={labelLookup}
        // Hovercards de variable desactivados en el preview: con cada
        // keystroke el preview se re-renderiza y los portals del hover
        // hacían que la app se cayera en bases grandes (acumulación de
        // listeners + re-pos calcs en scroll). Además no aportan info
        // aquí — el usuario está justo eligiendo las variables en el
        // mismo wizard.
        disableVariableHover
      />
    </div>
  );
}
