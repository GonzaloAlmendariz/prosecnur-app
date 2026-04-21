import { useMemo, useState } from "react";
import * as Lucide from "lucide-react";
import { Search, X } from "lucide-react";
import { GraficadorMetadata } from "../../api/client";
import { useGraficosRegistry } from "./useGraficosRegistry";

// Picker visual de graficador. En vez de una lista textual, mostramos
// cada graficador como card con icono + titulo_humano + descripción,
// organizados por categoría (básicos vs dimensiones). El usuario ve de
// un vistazo cuál gráfico aplica a su caso.
//
// El catálogo sale del registry del backend (graficos_metadata.R), así
// que si se añade/quita un graficador, este componente lo refleja
// automáticamente sin cambios de código.

type Categoria = { label: string; predicate: (g: GraficadorMetadata) => boolean };

const CATEGORIAS: Categoria[] = [
  {
    label: "Distribución por categorías",
    predicate: (g) => ["p_barras_agrupadas", "p_barras_apiladas", "p_barras_multiapiladas", "p_pie", "p_donut"].includes(g.name),
  },
  {
    label: "Resumen numérico",
    predicate: (g) => ["p_numerico", "p_boxplot", "p_media_rango"].includes(g.name),
  },
  {
    label: "Comparación multi-variable",
    predicate: (g) => ["p_radar_tabla"].includes(g.name),
  },
  {
    label: "Dimensiones e índices",
    predicate: (g) => g.requisito === "dimensiones",
  },
];

export default function GraficadorPicker({
  onPick,
  onCancel,
}: {
  onPick: (meta: GraficadorMetadata) => void;
  onCancel: () => void;
}) {
  const { registry, loading, error } = useGraficosRegistry();
  const [query, setQuery] = useState("");

  const categoriasConItems = useMemo(() => {
    if (!registry) return [];
    const q = query.trim().toLowerCase();
    return CATEGORIAS.map((cat) => ({
      label: cat.label,
      items: registry.graficadores
        .filter(cat.predicate)
        .filter((g) => {
          if (!q) return true;
          return (
            g.name.toLowerCase().includes(q) ||
            g.titulo_humano.toLowerCase().includes(q) ||
            g.descripcion.toLowerCase().includes(q)
          );
        }),
    })).filter((c) => c.items.length > 0);
  }, [registry, query]);

  return (
    <div
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 10,
          width: "min(760px, 92vw)",
          maxHeight: "82vh",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          boxShadow: "var(--pulso-shadow-high, 0 10px 40px rgba(0,0,0,0.2))",
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--pulso-border)",
            display: "flex", alignItems: "center", gap: 12,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, flex: 1 }}>Elegir graficador</h3>
          <button
            type="button"
            onClick={onCancel}
            className="pulso-icon"
            aria-label="Cerrar"
            style={{ minWidth: 28, minHeight: 28 }}
          >
            <X size={14} />
          </button>
        </header>

        {/* Search */}
        <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--pulso-border)" }}>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "7px 10px", borderRadius: 6,
              border: "1px solid var(--pulso-border)",
              background: "var(--pulso-surface)",
            }}
          >
            <Search size={13} color="var(--pulso-text-soft)" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o descripción…"
              autoFocus
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13, background: "transparent" }}
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="pulso-icon" aria-label="Limpiar">
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
          {loading && (
            <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", textAlign: "center", padding: 18 }}>
              Cargando catálogo…
            </div>
          )}
          {error && (
            <div style={{ fontSize: 12, color: "#b91c1c", textAlign: "center", padding: 18 }}>
              Error cargando catálogo: {error}
            </div>
          )}

          {!loading && !error && categoriasConItems.length === 0 && query && (
            <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", textAlign: "center", padding: 18 }}>
              Sin resultados para "{query}".
            </div>
          )}

          {categoriasConItems.map((cat) => (
            <div key={cat.label} style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 10, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: 0.4,
                  color: "var(--pulso-text-soft)",
                  marginBottom: 7,
                }}
              >
                {cat.label}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 8,
                }}
              >
                {cat.items.map((g) => (
                  <GraficadorCard key={g.name} graf={g} onPick={onPick} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GraficadorCard({ graf, onPick }: { graf: GraficadorMetadata; onPick: (g: GraficadorMetadata) => void }) {
  const Icon = resolveLucide(graf.icono_ui);
  return (
    <button
      type="button"
      onClick={() => onPick(graf)}
      style={{
        textAlign: "left",
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid var(--pulso-border)",
        background: "white",
        cursor: "pointer",
        display: "flex", flexDirection: "column", gap: 6,
        transition: "background 120ms ease, border-color 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--pulso-primary-soft)";
        e.currentTarget.style.borderColor = "var(--pulso-primary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "white";
        e.currentTarget.style.borderColor = "var(--pulso-border)";
      }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <span
          style={{
            width: 30, height: 30, borderRadius: 6,
            background: "var(--pulso-primary-soft)",
            color: "var(--pulso-primary)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={16} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pulso-text)" }}>
          {graf.titulo_humano}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.45 }}>
        {graf.descripcion}
      </div>
      {graf.requisito === "dimensiones" && (
        <div
          style={{
            fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.4,
            color: "var(--tipo-int-fg, #6d28d9)",
            marginTop: 2,
          }}
        >
          Requiere dimensiones
        </div>
      )}
    </button>
  );
}

// Resuelve el nombre de un ícono lucide al componente real. Si no
// existe, fallback al BarChart.
type LucideIcon = (props: { size?: number; color?: string }) => JSX.Element;
function resolveLucide(name: string): LucideIcon {
  const registry = Lucide as unknown as Record<string, LucideIcon>;
  return registry[name] ?? registry["BarChart"] ?? registry["Square"];
}
