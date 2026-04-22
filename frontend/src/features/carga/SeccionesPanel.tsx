import { FolderClosed } from "lucide-react";
import { Seccion } from "../../api/client";
import { EmptyState } from "../../components/States";

// Lista de secciones del XLSForm con sus flags (repeat / condicional) y
// la condición `relevant` traducida a texto humano.
//
// Visualmente: cada sección es una fila con 4 columnas:
//   [prefix monospace pill]  [label + name mono]  [chips repeat/condicional]  [relevant expresión]
// Las filas alternan fondo surface/white para facilitar lectura.

function sustituir_refs(expr: string): string {
  // Los XLSForm usan `${variable}` para referirse a otras preguntas.
  // Lo simplificamos a `variable` para hacer la expresión más legible.
  return expr.replace(/\$\{([^}]+)\}/g, "$1");
}

export default function SeccionesPanel({ secciones }: { secciones: Seccion[] }) {
  if (!secciones || secciones.length === 0) {
    return (
      <EmptyState
        variant="inline"
        icon={<FolderClosed size={18} />}
        title="Sin secciones detectadas"
        hint="Verifica que tu XLSForm tenga grupos (begin_group / end_group)."
      />
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {secciones.map((s, i) => {
        const cond = s.relevant ? sustituir_refs(s.relevant) : null;
        return (
          <div
            key={s.name}
            style={{
              display: "grid",
              gridTemplateColumns: "52px minmax(220px, 1fr) auto 1fr",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              background: i % 2 === 0 ? "var(--pulso-surface-2)" : "white",
              border: "1px solid var(--pulso-border)",
              borderRadius: 7,
            }}
            title={s.name}
          >
            <span
              style={{
                fontSize: 10, fontWeight: 700,
                padding: "3px 7px",
                borderRadius: 4,
                background: "var(--pulso-primary-soft)",
                color: "var(--pulso-primary)",
                textAlign: "center",
                fontFamily: "ui-monospace, monospace",
                border: "1px solid var(--pulso-primary-border)",
              }}
            >
              {s.prefix || "—"}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 13, fontWeight: 600, color: "var(--pulso-text)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {s.label}
              </span>
              <code
                style={{
                  fontSize: 11,
                  color: "var(--pulso-text-soft)",
                  fontFamily: "ui-monospace, monospace",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {s.name}
              </code>
            </div>
            <div style={{ display: "inline-flex", gap: 4 }}>
              {s.is_repeat && (
                <span
                  style={{
                    fontSize: 10, fontWeight: 700,
                    padding: "2px 8px", borderRadius: 999,
                    background: "var(--pulso-warn-bg)",
                    color: "var(--pulso-warn-fg)",
                    border: "1px solid var(--pulso-warn-border)",
                    textTransform: "uppercase", letterSpacing: 0.3,
                    whiteSpace: "nowrap",
                  }}
                >
                  repeat
                </span>
              )}
              {s.is_conditional ? (
                <span
                  style={{
                    fontSize: 10, fontWeight: 700,
                    padding: "2px 8px", borderRadius: 999,
                    background: "var(--pulso-success-bg)",
                    color: "var(--pulso-success-fg)",
                    border: "1px solid var(--pulso-success-border)",
                    textTransform: "uppercase", letterSpacing: 0.3,
                    whiteSpace: "nowrap",
                  }}
                >
                  condicional
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 10, fontWeight: 600,
                    padding: "2px 8px", borderRadius: 999,
                    background: "var(--pulso-surface-2)",
                    color: "var(--pulso-text-soft)",
                    border: "1px solid var(--pulso-border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  siempre visible
                </span>
              )}
            </div>
            <code
              style={{
                fontSize: 11,
                color: "var(--pulso-text)",
                fontFamily: "ui-monospace, monospace",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {cond ? (
                <>
                  <span style={{ color: "var(--pulso-text-soft)", marginRight: 4 }}>si</span>
                  {cond}
                </>
              ) : (
                <span style={{ color: "var(--pulso-text-soft)", opacity: 0.4 }}>—</span>
              )}
            </code>
          </div>
        );
      })}
    </div>
  );
}
