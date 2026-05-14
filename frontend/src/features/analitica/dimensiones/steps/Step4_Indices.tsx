import { Pencil, Plus, Trash2 } from "lucide-react";
import { IconAI } from "../../../../lib/icons";
import { useEffect, useRef, useState } from "react";
import { useDimensionesWizardStore } from "../store";

// Step 4 — Combinar bloques en índices compuestos. Más simple que step 3:
// cada índice es una card horizontal con un picker de bloques (chips
// clickeables). El usuario selecciona qué bloques aportan a cada índice.
// El default sugiere "Índice General" con todos los bloques.

export function Step4_Indices() {
  const draft = useDimensionesWizardStore((s) => s.draft);
  const setIndices = useDimensionesWizardStore((s) => s.setIndices);

  const bloquesDisponibles = draft.subindices;
  const [indiceAFocus, setIndiceAFocus] = useState<string | null>(null);

  function agregarIndice() {
    const idx = draft.indices.length + 1;
    const nombre = `indice_${idx}`;
    setIndices([
      ...draft.indices,
      { nombre, etiqueta: "", subindices: [] },
    ]);
    setIndiceAFocus(nombre);
    window.setTimeout(() => setIndiceAFocus(null), 100);
  }

  function sugerirComunes() {
    // Si no existe "Índice General", lo agregamos con todos los bloques.
    const yaExisten = new Set(draft.indices.map((i) => i.nombre));
    const nuevos = [...draft.indices];
    if (!yaExisten.has("indice_general")) {
      nuevos.push({
        nombre: "indice_general",
        etiqueta: "Índice General",
        subindices: bloquesDisponibles.map((b) => b.nombre),
      });
    }
    setIndices(nuevos);
  }

  function actualizarIndice(i: number, patch: Partial<(typeof draft.indices)[number]>) {
    setIndices(draft.indices.map((idx, k) => (k === i ? { ...idx, ...patch } : idx)));
  }

  function eliminarIndice(i: number) {
    setIndices(draft.indices.filter((_, k) => k !== i));
  }

  function toggleBloque(i: number, bloqueNombre: string) {
    const idx = draft.indices[i];
    const yaIncluido = idx.subindices.includes(bloqueNombre);
    actualizarIndice(i, {
      subindices: yaIncluido
        ? idx.subindices.filter((s) => s !== bloqueNombre)
        : [...idx.subindices, bloqueNombre],
    });
  }

  if (bloquesDisponibles.length === 0) {
    return (
      <div
        style={{
          padding: 30,
          borderRadius: 12,
          border: "1px dashed var(--pulso-border)",
          background: "var(--pulso-surface)",
          textAlign: "center",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Aún no hay bloques</h2>
        <p style={{ marginTop: 6, fontSize: 12, color: "var(--pulso-text-soft)" }}>
          Vuelve al paso anterior para crear al menos un bloque temático antes de
          definir índices compuestos.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
            Combina bloques en índices compuestos
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13,
              color: "var(--pulso-text-soft)",
              lineHeight: 1.5,
              maxWidth: 720,
            }}
          >
            Cada <strong>índice</strong> es un promedio 0-100 de los bloques que
            elijas. Típicamente hay un "Índice General" que combina todos, y
            opcionalmente índices parciales por temática (Pertinencia, Eficiencia, …).
          </p>
        </div>
        <button
          type="button"
          onClick={sugerirComunes}
          className="pulso-secondary"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <IconAI size={13} /> Sugerir Índice General
        </button>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {draft.indices.map((idx, i) => (
          <div
            key={i}
            style={{
              padding: 14,
              borderRadius: 12,
              border: "1px solid var(--pulso-border)",
              background: "white",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              animation: `pulso-lens-slide-in-kf var(--anim-dur-med) var(--anim-ease-expressive) both`,
              animationDelay: `${i * 50}ms`,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                    color: "var(--pulso-text-soft)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <Pencil size={9} /> Nombre del índice
                </span>
                <IndiceEtiquetaInput
                  value={idx.etiqueta}
                  autoFocus={indiceAFocus === idx.nombre}
                  onChange={(v) => actualizarIndice(i, { etiqueta: v })}
                />
              </div>
              <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 22 }}>
                {idx.subindices.length} de {bloquesDisponibles.length} bloques
              </span>
              <button
                type="button"
                onClick={() => eliminarIndice(i)}
                aria-label="Eliminar índice"
                title="Eliminar índice"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 4,
                  color: "var(--pulso-text-soft)",
                  marginTop: 18,
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {bloquesDisponibles.map((b) => {
                const incluido = idx.subindices.includes(b.nombre);
                return (
                  <button
                    key={b.nombre}
                    type="button"
                    onClick={() => toggleBloque(i, b.nombre)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      border: `1px solid ${incluido ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                      background: incluido ? "var(--pulso-primary-soft)" : "white",
                      color: incluido ? "var(--pulso-primary)" : "var(--pulso-text)",
                      fontSize: 12,
                      fontWeight: incluido ? 700 : 500,
                      cursor: "pointer",
                      transition:
                        "background var(--anim-dur-short), border-color var(--anim-dur-short)",
                    }}
                  >
                    {incluido ? "✓ " : "+ "}
                    {b.etiqueta}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={agregarIndice}
        className="pulso-secondary"
        style={{
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px",
          border: "1px dashed var(--pulso-border)",
          borderRadius: 10,
          background: "var(--pulso-surface)",
          cursor: "pointer",
          fontSize: 13,
          color: "var(--pulso-text-soft)",
        }}
      >
        <Plus size={14} /> Agregar índice
      </button>
    </div>
  );
}

// Input de etiqueta con affordance editable claro: borde sutil que se
// resalta en hover/focus, placeholder explícito, soporte para auto-focus
// al montar (cuando el padre acaba de agregar un índice nuevo).
function IndiceEtiquetaInput({
  value,
  autoFocus,
  onChange,
}: {
  value: string;
  autoFocus?: boolean;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const activo = hover || focus;

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        marginTop: 2,
        padding: "4px 8px",
        borderRadius: 6,
        border: `1px solid ${focus ? "var(--pulso-primary)" : activo ? "var(--pulso-border)" : "transparent"}`,
        background: focus ? "var(--pulso-primary-soft)" : activo ? "var(--pulso-surface-2, #f4f5f9)" : "transparent",
        transition:
          "background var(--anim-dur-short) var(--anim-ease-smooth), border-color var(--anim-dur-short) var(--anim-ease-smooth)",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        placeholder="ej. Índice General, Pertinencia, Eficiencia…"
        aria-label="Nombre del índice"
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          fontSize: 16,
          fontWeight: 700,
          color: "var(--pulso-text)",
          padding: 0,
          minWidth: 0,
          outline: "none",
        }}
      />
    </div>
  );
}
