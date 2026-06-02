import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import * as Lucide from "lucide-react";
import { Search, SearchX, X } from "lucide-react";
import { GraficadorMetadata } from "../../api/client";
import { useGraficosRegistry } from "./useGraficosRegistry";
import { LoadingBlock, ErrorBlock, EmptyState } from "../../components/States";
import { useSession } from "../../lib/SessionContext";

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
  const { state } = useSession();
  const dimOk = !!state?.analitica_dim_ok;

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

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="graf-picker-title"
      className="pulso-gv2-graf-picker-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pulso-gv2-graf-picker"
      >
        <header className="pulso-gv2-graf-picker-head">
          <div>
            <h3 id="graf-picker-title" className="pulso-gv2-graf-picker-title">Elegir graficador</h3>
            <div className="pulso-gv2-graf-picker-sub">Selecciona el tipo de visualización para este slot.</div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="pulso-gv2-graf-picker-close"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </header>

        <div className="pulso-gv2-graf-picker-search-wrap">
          <div className="pulso-gv2-graf-picker-search">
            <Search size={15} className="pulso-gv2-graf-picker-search-icon" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o descripción…"
              autoFocus
              aria-label="Buscar graficador"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="pulso-gv2-graf-picker-clear" aria-label="Limpiar búsqueda">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="pulso-gv2-graf-picker-body">
          {loading && <LoadingBlock label="Cargando catálogo…" />}
          {error && <ErrorBlock label="Error cargando catálogo" detail={error} />}

          {!loading && !error && categoriasConItems.length === 0 && query && (
            <EmptyState
              icon={<SearchX size={20} />}
              title={`Sin resultados para "${query}"`}
              hint="Prueba con otro nombre o limpia el buscador para ver todos los graficadores."
            />
          )}

          {!loading && !error && categoriasConItems.length === 0 && !query && (
            <EmptyState
              icon={<SearchX size={20} />}
              title="Catálogo vacío"
              hint="El registry del backend no devolvió graficadores. Revisa la consola del API."
            />
          )}

          {categoriasConItems.map((cat) => (
            <section key={cat.label} className="pulso-gv2-graf-picker-section">
              <div className="pulso-gv2-graf-picker-section-head">
                <span>{cat.label}</span>
                <span>{cat.items.length}</span>
              </div>
              <div className="pulso-gv2-graf-picker-grid">
                {cat.items.map((g) => (
                  <GraficadorCard key={g.name} graf={g} dimOk={dimOk} onPick={onPick} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function GraficadorCard({
  graf,
  dimOk,
  onPick,
}: {
  graf: GraficadorMetadata;
  dimOk: boolean;
  onPick: (g: GraficadorMetadata) => void;
}) {
  const Icon = resolveLucide(graf.icono_ui);
  const requiereDim = graf.requisito === "dimensiones";
  const dimReady = requiereDim && dimOk;
  const dimMissing = requiereDim && !dimOk;
  return (
    <button
      type="button"
      onClick={() => onPick(graf)}
      className={`pulso-gv2-graf-card ${requiereDim ? "requires-dimensions" : ""}`}
    >
      <span className="pulso-gv2-graf-card-icon">
        <Icon size={16} />
      </span>
      <span className="pulso-gv2-graf-card-copy">
        <span className="pulso-gv2-graf-card-title">
          {graf.titulo_humano}
        </span>
        <span className="pulso-gv2-graf-card-desc">{graf.descripcion}</span>
      </span>
      {dimReady && (
        <span className="pulso-gv2-graf-card-badge is-ready">
          Dimensiones listas
        </span>
      )}
      {dimMissing && (
        <span className="pulso-gv2-graf-card-badge">
          Requiere dimensiones · ve a Analítica
        </span>
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
