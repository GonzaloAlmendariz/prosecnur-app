import { X, Keyboard } from "lucide-react";

// Modal de referencia rápida de los atajos disponibles en Gráficos.
// Se abre con `?` o desde un botón futuro en el header. Pequeño y
// frontal — el analista lo consulta y cierra.

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? "⌘" : "Ctrl";

  const shortcuts: { keys: string[]; label: string }[] = [
    { keys: [mod, "Z"], label: "Deshacer el último cambio" },
    { keys: [mod, "Shift", "Z"], label: "Rehacer" },
    { keys: [mod, "D"], label: "Duplicar el slide activo" },
    { keys: ["?"], label: "Abrir esta ayuda (en teclados US: Shift + /)" },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Atajos de teclado"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(15, 23, 42, 0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, 100%)",
          background: "white", borderRadius: 10,
          boxShadow: "var(--pulso-shadow-high)",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--pulso-border)",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <Keyboard size={16} color="var(--pulso-primary)" />
          <h2 style={{ margin: 0, fontSize: 14, flex: 1 }}>Atajos de teclado</h2>
          <button
            type="button"
            onClick={onClose}
            className="pulso-icon"
            aria-label="Cerrar"
          >
            <X size={13} />
          </button>
        </header>
        <div style={{ padding: 16 }}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {shortcuts.map((s, i) => (
              <li
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  fontSize: 12,
                }}
              >
                <div style={{ display: "inline-flex", gap: 3 }}>
                  {s.keys.map((k, j) => (
                    <kbd
                      key={j}
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 11, fontWeight: 600,
                        padding: "3px 7px",
                        border: "1px solid var(--pulso-border)",
                        borderBottomWidth: 2,
                        borderRadius: 4,
                        background: "var(--pulso-surface)",
                        color: "var(--pulso-text)",
                        minWidth: 20, textAlign: "center",
                      }}
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
                <span style={{ color: "var(--pulso-text)" }}>{s.label}</span>
              </li>
            ))}
          </ul>
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 11, color: "var(--pulso-text-soft)",
              lineHeight: 1.5,
            }}
          >
            Los atajos se ignoran mientras tipeas en un input, textarea o campo
            editable — ahí {isMac ? "⌘" : "Ctrl"}+Z usa el undo nativo del texto.
          </p>
        </div>
      </div>
    </div>
  );
}
