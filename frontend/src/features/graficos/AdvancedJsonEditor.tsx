import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Code2, AlertCircle, Check } from "lucide-react";

// Editor de JSON avanzado para args de presets / overrides. Muestra el
// objeto actual (mezcla de args curados + args que el usuario escribió
// a mano) y permite editarlo libremente. Al aplicar, se valida que sea
// un objeto y se pasa al callback.
//
// Uso:
//   <AdvancedJsonEditor
//     value={presets[tipo] ?? {}}
//     onChange={(next) => setPresets({...presets, [tipo]: next})}
//     curatedArgNames={['font_family','size_titulo',...]}
//   />
//
// El prop `curatedArgNames` es opcional — si está, destacamos en el
// helper text que esos args también son editables arriba en los
// ArgGroups, para que el usuario entienda que ambas caras viven en el
// mismo objeto.
//
// Diseño:
//   - Por defecto colapsado para no saturar la UI.
//   - Textarea con el JSON formateado (indent 2).
//   - Validación local: si el texto no parsea a object, el botón
//     "Aplicar" se desactiva y se muestra el error.
//   - Botón "Reset al original" vuelve al `value` de entrada sin guardar.
//
// Nota: reemplaza el OBJETO COMPLETO del preset. Si el usuario borró
// una key, desaparece del store. Esto es intencional — el JSON avanzado
// es la vista autoritativa cuando está abierto.

export function AdvancedJsonEditor({
  value,
  onChange,
  curatedArgNames,
  label = "Edición JSON avanzada",
  hint = "Acceso directo a todos los args del preset. Lo que pongas acá se persiste tal cual.",
}: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  curatedArgNames?: string[];
  label?: string;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const initialJson = useMemo(() => JSON.stringify(value ?? {}, null, 2), [value]);
  const [draft, setDraft] = useState(initialJson);
  const [error, setError] = useState<string>("");
  const [flashSaved, setFlashSaved] = useState(false);

  // Parse eager — si es válido, sabemos que podemos habilitar "Aplicar".
  const parsedDraft = useMemo(() => {
    try {
      const p = draft.trim() === "" ? {} : JSON.parse(draft);
      if (p === null || typeof p !== "object" || Array.isArray(p)) {
        return { ok: false as const, error: "El JSON debe ser un objeto (no un array ni null)." };
      }
      return { ok: true as const, value: p as Record<string, unknown> };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [draft]);

  // Si el `value` del padre cambia (ej. porque otro setter tocó el preset),
  // y el textarea NO está sucio, re-sincronizamos. Si está sucio, no pisamos
  // el trabajo del usuario.
  const dirty = draft !== initialJson;

  function applyDraft() {
    if (!parsedDraft.ok) {
      setError(parsedDraft.error);
      return;
    }
    onChange(parsedDraft.value);
    setError("");
    setFlashSaved(true);
    setTimeout(() => setFlashSaved(false), 900);
  }

  function resetDraft() {
    setDraft(initialJson);
    setError("");
  }

  // Keys del draft que NO son args curados — son "extra" (lo que el JSON
  // avanzado desbloquea). Se muestran como chip al final para que el
  // analista vea qué está pisando más allá del catálogo.
  const extraKeys = useMemo(() => {
    if (!parsedDraft.ok || !curatedArgNames) return [];
    const curatedSet = new Set(curatedArgNames);
    return Object.keys(parsedDraft.value).filter((k) => !curatedSet.has(k));
  }, [parsedDraft, curatedArgNames]);

  return (
    <div
      style={{
        border: "1px dashed var(--pulso-border)",
        borderRadius: 7,
        background: "var(--pulso-surface)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex", alignItems: "center", gap: 8,
          padding: "9px 12px",
          border: "none", background: "transparent",
          cursor: "pointer", textAlign: "left",
          color: "var(--pulso-text-soft)",
        }}
      >
        <span style={{ display: "inline-flex", transition: "transform 120ms", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>
          <ChevronDown size={12} />
        </span>
        <Code2 size={13} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>
          {label}
        </span>
        {extraKeys.length > 0 && open && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10, padding: "2px 7px", borderRadius: 999,
              background: "var(--pulso-primary-soft)",
              color: "var(--pulso-primary)",
              fontWeight: 600,
            }}
          >
            {extraKeys.length} args extra
          </span>
        )}
      </button>
      {open && (
        <div
          style={{
            padding: "4px 12px 12px",
            borderTop: "1px solid var(--pulso-border)",
            display: "flex", flexDirection: "column", gap: 8,
          }}
        >
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
            {hint}
          </div>
          <textarea
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setError(""); }}
            rows={Math.min(16, Math.max(6, draft.split("\n").length))}
            spellCheck={false}
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 11,
              padding: "8px 10px",
              border: `1px solid ${parsedDraft.ok ? "var(--pulso-border)" : "var(--pulso-danger-border)"}`,
              borderRadius: 5,
              background: "white",
              resize: "vertical",
              outline: "none",
              lineHeight: 1.45,
            }}
          />
          {!parsedDraft.ok && (
            <div
              style={{
                display: "flex", alignItems: "flex-start", gap: 6,
                fontSize: 11, color: "var(--pulso-danger-fg)", lineHeight: 1.4,
                padding: "6px 9px", borderRadius: 5,
                background: "var(--pulso-danger-bg)", border: "1px solid var(--pulso-danger-border)",
              }}
            >
              <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              <span><strong>JSON inválido:</strong> {parsedDraft.error}</span>
            </div>
          )}
          {error && (
            <div style={{ fontSize: 11, color: "var(--pulso-danger-fg)" }}>{error}</div>
          )}
          {extraKeys.length > 0 && parsedDraft.ok && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", fontWeight: 600, marginRight: 4 }}>
                Args fuera del catálogo:
              </span>
              {extraKeys.map((k) => (
                <code
                  key={k}
                  style={{
                    fontSize: 10, padding: "2px 6px",
                    borderRadius: 4,
                    background: "var(--pulso-primary-soft)",
                    color: "var(--pulso-primary)",
                  }}
                  title={`Se persiste ${k} sin control visual arriba.`}
                >
                  {k}
                </code>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              type="button"
              className="pulso-primary"
              onClick={applyDraft}
              disabled={!parsedDraft.ok || !dirty}
              style={{
                fontSize: 11, padding: "5px 12px",
                display: "inline-flex", alignItems: "center", gap: 5,
                opacity: (!parsedDraft.ok || !dirty) ? 0.55 : 1,
              }}
            >
              {flashSaved ? <Check size={12} /> : null}
              {flashSaved ? "Aplicado" : "Aplicar cambios"}
            </button>
            {dirty && (
              <button
                type="button"
                onClick={resetDraft}
                style={{ fontSize: 11, padding: "5px 10px" }}
              >
                Descartar
              </button>
            )}
            <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", marginLeft: "auto" }}>
              {dirty ? "Cambios sin aplicar" : parsedDraft.ok ? "Sincronizado" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
