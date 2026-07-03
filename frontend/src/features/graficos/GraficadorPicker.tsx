import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart3, CheckCircle2, Layers3, Plus, Search, SearchX, X } from "lucide-react";
import { GraficadorMetadata } from "../../api/client";
import { useGraficosRegistry } from "./useGraficosRegistry";
import { LoadingBlock, ErrorBlock, EmptyState } from "../../components/States";
import { useSession } from "../../lib/SessionContext";
import { GraficadorTypeIcon } from "./GraficadorTypeIcon";

// Picker visual de graficador. En vez de una lista textual, mostramos
// cada graficador como card con icono + titulo_humano + descripción,
// organizados por categoría (básicos vs dimensiones). El usuario ve de
// un vistazo cuál gráfico aplica a su caso.
//
// El catálogo sale del registry del backend (graficos_metadata.R), así
// que si se añade/quita un graficador, este componente lo refleja
// automáticamente sin cambios de código.

type Categoria = { label: string; predicate: (g: GraficadorMetadata) => boolean };
type GrafCardKind = "distribution" | "numeric" | "multi" | "dimensions" | "territory";

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
    predicate: (g) => ["p_radar", "p_tabla", "p_radar_tabla"].includes(g.name),
  },
  {
    label: "Dimensiones e índices",
    predicate: (g) => g.requisito === "dimensiones",
  },
  {
    label: "Territorio y cobertura",
    predicate: (g) => g.requisito === "territorial_coverage" || g.feature_kind === "territorial_coverage",
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
    return CATEGORIAS
      .filter((cat) => dimOk || cat.label !== "Dimensiones e índices")
      .map((cat) => ({
        label: cat.label,
        items: registry.graficadores
          .filter((g) => g.available !== false)
          .filter(cat.predicate)
          .filter((g) => {
            if (!q) return true;
            return (
              g.name.toLowerCase().includes(q) ||
              g.titulo_humano.toLowerCase().includes(q) ||
              g.descripcion.toLowerCase().includes(q)
            );
          }),
      }))
      .filter((c) => c.items.length > 0);
  }, [registry, query, dimOk]);

  const catalogSummary = useMemo(() => {
    const visibleCount = categoriasConItems.reduce((total, cat) => total + cat.items.length, 0);
    const hiddenDimensionCount = registry?.graficadores.filter((g) => g.available !== false && g.requisito === "dimensiones").length ?? 0;
    return {
      visibleCount,
      categoryCount: categoriasConItems.length,
      hiddenDimensionCount,
    };
  }, [categoriasConItems, registry]);

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
          <div className="pulso-gv2-graf-picker-head-main">
            <span className="pulso-gv2-graf-picker-mark" aria-hidden="true">
              <BarChart3 size={17} />
            </span>
            <div>
              <div className="pulso-gv2-graf-picker-eyebrow">Biblioteca de graficadores</div>
              <h3 id="graf-picker-title" className="pulso-gv2-graf-picker-title">Elegir visual</h3>
              <div className="pulso-gv2-graf-picker-sub">Tipos por dato, comparación y salida del slide.</div>
            </div>
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
          {!loading && !error && (
            <div className="pulso-gv2-graf-picker-summary" aria-label="Estado del catálogo visible">
              <span>
                <Layers3 size={13} />
                {catalogSummary.visibleCount} modelos visibles
              </span>
              <span>
                <BarChart3 size={13} />
                {catalogSummary.categoryCount} familias activas
              </span>
              <span className={dimOk ? "is-ready" : "is-muted"}>
                <CheckCircle2 size={13} />
                {dimOk ? "Dimensiones habilitadas" : `${catalogSummary.hiddenDimensionCount} modelos de dimensión ocultos`}
              </span>
            </div>
          )}
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
  const requiereDim = graf.requisito === "dimensiones";
  const requiereTerritorio = graf.requisito === "territorial_coverage" || graf.feature_kind === "territorial_coverage";
  const dimReady = requiereDim && dimOk;
  const dimMissing = requiereDim && !dimOk;
  const kind = grafCardKind(graf);
  return (
    <button
      type="button"
      onClick={() => onPick(graf)}
      className={`pulso-gv2-graf-card ${requiereDim ? "requires-dimensions" : ""} ${requiereTerritorio ? "requires-territory" : ""}`}
      data-kind={kind}
    >
      <span className="pulso-gv2-graf-card-icon">
        <GraficadorTypeIcon name={graf.name} iconoUi={graf.icono_ui} size={25} />
      </span>
      <span className="pulso-gv2-graf-card-copy">
        <span className="pulso-gv2-graf-card-title">
          {graf.titulo_humano}
        </span>
        <span className="pulso-gv2-graf-card-tags" aria-label="Uso recomendado y salida">
          <span>{grafCardUsageLabel(graf)}</span>
          <span>{grafCardOutputLabel(kind)}</span>
        </span>
        <span className="pulso-gv2-graf-card-desc">{graf.descripcion}</span>
      </span>
      <span className="pulso-gv2-graf-card-footer">
        <span className="pulso-gv2-graf-card-action" aria-hidden="true">
          <Plus size={11} /> Usar modelo
        </span>
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
      {requiereTerritorio && (
        <span className="pulso-gv2-graf-card-badge is-ready">
          Hojas de Ruta + Monitoreo
        </span>
      )}
    </button>
  );
}

function grafCardUsageLabel(graf: GraficadorMetadata): string {
  switch (graf.name) {
    case "p_barras_apiladas":
      return "Escalas Likert";
    case "p_barras_agrupadas":
      return "Comparar segmentos";
    case "p_barras_multiapiladas":
      return "Varias preguntas";
    case "p_pie":
    case "p_donut":
      return "Pocas categorías";
    case "p_numerico":
      return "KPI ejecutivo";
    case "p_boxplot":
      return "Distribución numérica";
    case "p_media_rango":
      return "Promedios";
    case "p_radar":
    case "p_radar_tabla":
      return "Índices comparables";
    case "p_tabla":
      return "Tabla ejecutiva";
    default:
      return graf.feature_kind === "territorial_coverage" ? "Cobertura territorial" : "Visual estándar";
  }
}

function grafCardOutputLabel(kind: GrafCardKind): string {
  switch (kind) {
    case "numeric":
      return "Indicador";
    case "multi":
      return "Comparativo";
    case "dimensions":
      return "Analítica";
    case "territory":
      return "Mapa/tabla";
    default:
      return "Gráfico";
  }
}

function grafCardKind(graf: GraficadorMetadata): GrafCardKind {
  if (graf.requisito === "territorial_coverage" || graf.feature_kind === "territorial_coverage") return "territory";
  if (graf.requisito === "dimensiones") return "dimensions";
  if (["p_numerico", "p_boxplot", "p_media_rango"].includes(graf.name)) return "numeric";
  if (["p_radar", "p_tabla", "p_radar_tabla"].includes(graf.name)) return "multi";
  return "distribution";
}
