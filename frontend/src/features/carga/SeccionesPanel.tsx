import { Seccion } from "../../api/client";

function sustituir_refs(expr: string): string {
  return expr.replace(/\$\{([^}]+)\}/g, "$1");
}

export default function SeccionesPanel({ secciones }: { secciones: Seccion[] }) {
  if (!secciones || secciones.length === 0) {
    return <em style={{ color: "#888" }}>Sin secciones detectadas.</em>;
  }
  return (
    <div style={{ marginTop: "0.5rem" }}>
      <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
        Cada fila es una sección del XLSForm. Las etiquetas a la derecha indican su tipo y su lógica de visibilidad
        (<code>relevant</code>). Una flecha conecta cada sección con la lógica que la activa.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {secciones.map((s, i) => {
          const cond = s.relevant ? sustituir_refs(s.relevant) : null;
          return (
            <div
              key={s.name}
              style={{
                display: "grid",
                gridTemplateColumns: "40px minmax(220px, 1fr) auto 1fr",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                background: i % 2 === 0 ? "#fafafa" : "#fff",
                border: "1px solid #eee",
                borderRadius: 6,
              }}
              title={s.name}
            >
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "#eef2ff",
                  color: "#3730a3",
                  fontWeight: 600,
                  textAlign: "center",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {s.prefix || "—"}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: "#888", fontFamily: "ui-monospace, monospace" }}>{s.name}</div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {s.is_repeat && (
                  <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#fef3c7", color: "#92400e" }}>
                    repeat
                  </span>
                )}
                {s.is_conditional ? (
                  <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#dcfce7", color: "#166534" }}>
                    condicional
                  </span>
                ) : (
                  <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#f3f4f6", color: "#4b5563" }}>
                    siempre visible
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "#555", fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {cond ? <><span style={{ color: "#9ca3af" }}>si</span> {cond}</> : <span style={{ color: "#ccc" }}>—</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
