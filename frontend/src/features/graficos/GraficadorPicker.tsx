import { useState } from "react";

export type GraficadorMeta = {
  name: string;
  label: string;
  descripcion: string;
  defaultArgs: Record<string, unknown>;
};

export const GRAFICADOR_CATALOG: { categoria: string; items: GraficadorMeta[] }[] = [
  {
    categoria: "Distribución categórica",
    items: [
      { name: "p_barras_agrupadas", label: "Barras agrupadas", descripcion: "1 variable · cruces opcional · distribución %",
        defaultArgs: { var: "", cruces: null, titulo: "" } },
      { name: "p_barras_apiladas", label: "Barras 100% apiladas", descripcion: "1 variable · cruces opcional · distribución 100%",
        defaultArgs: { var: "", cruces: null, titulo: "" } },
      { name: "p_pie", label: "Pie (torta)", descripcion: "1 variable dicotómica o con pocas categorías",
        defaultArgs: { var: "", titulo: "" } },
      { name: "p_donut", label: "Donut", descripcion: "1 variable · rosquilla con valor central",
        defaultArgs: { var: "", titulo: "" } },
    ],
  },
  {
    categoria: "Resumen numérico",
    items: [
      { name: "p_numerico", label: "Resumen numérico", descripcion: "N, %, media o mediana por grupo",
        defaultArgs: { var: "", metrica: "mean", cruce: null, titulo: "" } },
      { name: "p_boxplot", label: "Boxplot", descripcion: "Distribución numérica por grupo (cuartiles + outliers)",
        defaultArgs: { var: "", cruce: null, titulo: "" } },
      { name: "p_media_rango", label: "Media + rango", descripcion: "Media con intervalos por grupo",
        defaultArgs: { var: "", cruce: null, titulo: "" } },
    ],
  },
];

export default function GraficadorPicker({ onPick, onCancel }: { onPick: (meta: GraficadorMeta) => void; onCancel: () => void }) {
  const [query, setQuery] = useState("");

  const filtered = GRAFICADOR_CATALOG.map((cat) => ({
    ...cat,
    items: cat.items.filter((g) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return g.name.toLowerCase().includes(q) || g.label.toLowerCase().includes(q) || g.descripcion.toLowerCase().includes(q);
    }),
  })).filter((cat) => cat.items.length > 0);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 8, padding: "1rem 1.25rem", width: 520, maxHeight: "80vh", overflow: "auto" }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h3 style={{ margin: 0 }}>Elegir graficador</h3>
          <button onClick={onCancel} style={{ fontSize: 12 }}>Cancelar</button>
        </header>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar…"
          autoFocus
          style={{ width: "100%", padding: "6px 8px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 4, marginBottom: "0.75rem" }}
        />
        {filtered.map((cat) => (
          <div key={cat.categoria} style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{cat.categoria}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 4 }}>
              {cat.items.map((g) => (
                <button
                  key={g.name}
                  onClick={() => onPick(g)}
                  style={{
                    textAlign: "left", padding: "8px 10px",
                    border: "1px solid #e3e3e8", borderRadius: 6,
                    background: "#f9fafb", cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{g.label} <code style={{ color: "#6b7280", fontWeight: 400, fontSize: 11 }}>{g.name}</code></div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{g.descripcion}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
