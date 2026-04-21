import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, Trash2, X, Palette, ListChecks } from "lucide-react";
import {
  apiGraficosPaletasSugeridas,
  PaletaSugeridaEntry,
} from "../../api/client";
import { usePlanStore } from "./store";
import { LoadingBlock, ErrorBlock, EmptyState, SectionEyebrow } from "../../components/States";

// Editor de paletas de colores por `list_name` del XLSForm. Cada fila
// de la tabla es un value-label; el analista le asigna un color. Las
// paletas se mandan al backend vía autosave y prosecnur las consume al
// renderizar apiladas/agrupadas/pie/donut — el color por categoría
// respeta lo que configuró aquí.
//
// Diseño:
//   - Lista de listas del instrumento a la izquierda (con búsqueda).
//   - Panel derecho: tabla de labels con <input type="color"> y hex text.
//   - Botón "Paleta semáforo" sugiere una secuencia rojo→amarillo→verde
//     para listas ordinales (satisfaccion, acuerdo, etc.).
//   - Botón "Vaciar paleta" quita los colores de esa lista.

// Paleta "semáforo" sugerida para listas de 3-5 opciones (escalas ordinales).
// Misma filosofía que `paleta_satisfaccion` del QMD de GIZ.
const PALETA_SEMAFORO = [
  "#8B0000", // burdeos (muy malo)
  "#D9534F", // rojo suave
  "#F6C370", // arena (neutral)
  "#A8D08D", // verde suave
  "#4F8B46", // verde fuerte (muy bueno)
];

// Paleta "azules" (para categóricas sin orden, estilo estándar Pulso).
const PALETA_AZULES = ["#1B679D", "#4F82B8", "#93C4EB", "#BCDCEF", "#DEEDF8", "#39588B", "#062A63"];

// Paleta "categórica" variada (cuando no hay orden semántico).
const PALETA_CATEGORICA = ["#1B9E77", "#D95F02", "#7570B3", "#E7298A", "#66A61E", "#E6AB02", "#A6761D"];

export function PaletasEditor() {
  const paletas = usePlanStore((s) => s.paletas);
  const setPaleta = usePlanStore((s) => s.setPaleta);
  const setColorEnPaleta = usePlanStore((s) => s.setColorEnPaleta);
  const removePaleta = usePlanStore((s) => s.removePaleta);

  const [listasSugeridas, setListasSugeridas] = useState<PaletaSugeridaEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeListName, setActiveListName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await apiGraficosPaletasSugeridas();
        if (!cancelled) {
          setListasSugeridas(r.listas);
          // Pre-select la primera lista si no hay selección.
          if (r.listas.length > 0 && !activeListName) {
            setActiveListName(r.listas[0].list_name);
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listasFiltradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listasSugeridas;
    return listasSugeridas.filter((l) => l.list_name.toLowerCase().includes(q));
  }, [listasSugeridas, query]);

  const activaData = useMemo(
    () => listasSugeridas.find((l) => l.list_name === activeListName),
    [listasSugeridas, activeListName],
  );

  function aplicarPaletaSugerida(
    paleta: string[],
    invertir = false,
  ) {
    if (!activaData) return;
    const colors = invertir ? [...paleta].reverse() : paleta;
    const nueva: Record<string, string> = {};
    activaData.choices.forEach((c, i) => {
      nueva[c.label] = colors[i % colors.length];
    });
    setPaleta(activaData.list_name, nueva);
  }

  if (loading) {
    return <LoadingBlock label="Cargando listas del instrumento…" />;
  }

  if (error) {
    return <ErrorBlock label="Error cargando listas" detail={error} />;
  }

  if (listasSugeridas.length === 0) {
    return (
      <EmptyState
        icon={<ListChecks size={20} />}
        title="Sin listas de respuestas"
        hint="Carga un XLSForm en Fase 1 y prepara los datos en Fase 4 para que aparezcan acá."
      />
    );
  }

  const paletaActiva = (activeListName && paletas[activeListName]) || {};

  return (
    <div style={{ display: "flex", gap: 14, minHeight: 340 }}>
      {/* Columna izquierda: lista de list_names */}
      <div style={{ width: 220, display: "flex", flexDirection: "column", gap: 10, borderRight: "1px solid var(--pulso-border)", paddingRight: 12 }}>
        <SectionEyebrow
          label="Listas del instrumento"
          hint="Cada lista de respuestas puede tener su paleta. Si no le asignas colores, prosecnur usa su paleta azul por defecto."
        />

        <div
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 8px", borderRadius: 6,
            border: "1px solid var(--pulso-border)",
            background: "white",
          }}
        >
          <Search size={12} color="var(--pulso-text-soft)" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar lista…"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 11, padding: "2px 0" }}
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="pulso-icon" aria-label="Limpiar">
              <X size={10} />
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {listasFiltradas.map((l) => {
            const active = l.list_name === activeListName;
            const tienePaleta = !!paletas[l.list_name] && Object.keys(paletas[l.list_name] ?? {}).length > 0;
            return (
              <button
                key={l.list_name}
                type="button"
                onClick={() => setActiveListName(l.list_name)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                  padding: "6px 8px", borderRadius: 5,
                  border: "1px solid transparent",
                  background: active ? "var(--pulso-primary-soft)" : "transparent",
                  color: active ? "var(--pulso-primary)" : "var(--pulso-text)",
                  cursor: "pointer",
                  fontSize: 11,
                  textAlign: "left",
                  transition: "background 120ms ease",
                }}
              >
                <code style={{ fontFamily: "monospace", fontWeight: active ? 700 : 500, color: "inherit" }}>
                  {l.list_name}
                </code>
                <span
                  title={
                    tienePaleta
                      ? "Tiene paleta personalizada"
                      : `${l.choices.length} ${l.choices.length === 1 ? "opción" : "opciones"} sin paleta`
                  }
                  style={{
                    fontSize: 10, fontWeight: 600,
                    padding: "2px 7px", borderRadius: 999,
                    border: "1px solid",
                    borderColor: tienePaleta ? "var(--pulso-primary-border)" : "var(--pulso-border)",
                    background: tienePaleta ? "var(--pulso-primary-soft)" : "white",
                    color: tienePaleta ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
                    display: "inline-flex", alignItems: "center", gap: 3,
                    lineHeight: 1.4,
                  }}
                >
                  {tienePaleta && (
                    <span style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: "var(--pulso-primary)",
                    }} />
                  )}
                  {l.choices.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Columna derecha: editor de colores de la lista activa */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {!activaData ? (
          <div style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
            Elige una lista a la izquierda para editar su paleta.
          </div>
        ) : (
          <>
            <header style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span
                style={{
                  width: 30, height: 30, borderRadius: 7,
                  background: "var(--pulso-primary-soft)",
                  color: "var(--pulso-primary)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Palette size={15} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{
                  margin: 0, fontSize: 14, lineHeight: 1.3,
                  display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
                }}>
                  Paleta de <code style={{
                    fontFamily: "monospace", color: "var(--pulso-primary)",
                    background: "var(--pulso-primary-soft)",
                    padding: "1px 6px", borderRadius: 4, fontSize: 12,
                  }}>{activaData.list_name}</code>
                </h3>
                <p style={{
                  margin: "4px 0 0", fontSize: 11,
                  color: "var(--pulso-text-soft)", lineHeight: 1.5,
                  maxWidth: 540,
                }}>
                  {activaData.choices.length} {activaData.choices.length === 1 ? "opción" : "opciones"} en esta lista.
                  Cada color se aplica a su value-label en todos los gráficos que usen esta variable.
                </p>
              </div>
              {Object.keys(paletaActiva).length > 0 && (
                <button
                  type="button"
                  onClick={() => removePaleta(activaData.list_name)}
                  title="Quitar todos los colores personalizados de esta lista"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#fef2f2";
                    e.currentTarget.style.borderColor = "#fecaca";
                    e.currentTarget.style.color = "#991b1b";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "var(--pulso-border)";
                    e.currentTarget.style.color = "var(--pulso-text-soft)";
                  }}
                  style={{
                    fontSize: 11, padding: "5px 10px", borderRadius: 6,
                    border: "1px solid var(--pulso-border)",
                    background: "transparent", color: "var(--pulso-text-soft)",
                    cursor: "pointer", flexShrink: 0,
                    display: "inline-flex", alignItems: "center", gap: 5,
                    transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
                  }}
                >
                  <Trash2 size={11} /> Vaciar paleta
                </button>
              )}
            </header>

            {/* Paletas sugeridas */}
            <div style={{
              display: "flex", flexDirection: "column", gap: 6,
              padding: "10px 12px",
              background: "var(--pulso-surface)",
              border: "1px solid var(--pulso-border)",
              borderRadius: 8,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 0.4,
                color: "var(--pulso-text-soft)",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}>
                <Sparkles size={11} /> Aplicar paleta sugerida
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <SugeridoButton label="Semáforo" colores={PALETA_SEMAFORO} onClick={() => aplicarPaletaSugerida(PALETA_SEMAFORO)} />
                <SugeridoButton label="Semáforo inv." colores={[...PALETA_SEMAFORO].reverse()} onClick={() => aplicarPaletaSugerida(PALETA_SEMAFORO, true)} />
                <SugeridoButton label="Azules" colores={PALETA_AZULES} onClick={() => aplicarPaletaSugerida(PALETA_AZULES)} />
                <SugeridoButton label="Categórica" colores={PALETA_CATEGORICA} onClick={() => aplicarPaletaSugerida(PALETA_CATEGORICA)} />
              </div>
            </div>

            {/* Tabla de labels con color picker */}
            <div
              style={{
                border: "1px solid var(--pulso-border)",
                borderRadius: 6,
                background: "white",
                maxHeight: 340,
                overflowY: "auto",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr
                    style={{
                      position: "sticky", top: 0, zIndex: 1,
                      background: "var(--pulso-surface)",
                      borderBottom: "1px solid var(--pulso-border)",
                    }}
                  >
                    <Th style={{ width: 60 }}>Código</Th>
                    <Th>Etiqueta</Th>
                    <Th style={{ width: 80 }}>Color</Th>
                    <Th style={{ width: 120 }}>Hex</Th>
                  </tr>
                </thead>
                <tbody>
                  {activaData.choices.map((c) => {
                    const color = paletaActiva[c.label] ?? "";
                    return (
                      <tr
                        key={c.name}
                        style={{ borderBottom: "1px solid var(--pulso-border)" }}
                      >
                        <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "var(--pulso-text-soft)" }}>
                          {c.name}
                        </td>
                        <td style={{ padding: "6px 10px", color: "var(--pulso-text)" }}>
                          {c.label}
                        </td>
                        <td style={{ padding: "6px 10px" }}>
                          <input
                            type="color"
                            value={color || "#cccccc"}
                            onChange={(e) => setColorEnPaleta(activaData.list_name, c.label, e.target.value)}
                            style={{
                              width: 40, height: 24, padding: 0, border: "1px solid var(--pulso-border)",
                              borderRadius: 4, cursor: "pointer",
                              background: color || "transparent",
                            }}
                          />
                        </td>
                        <td style={{ padding: "6px 10px" }}>
                          <input
                            type="text"
                            value={color}
                            onChange={(e) => {
                              const v = e.target.value;
                              // Validar hex básico
                              if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) {
                                setColorEnPaleta(activaData.list_name, c.label, v.startsWith("#") || v === "" ? v : `#${v}`);
                              }
                            }}
                            placeholder="#cccccc"
                            style={{
                              width: "100%", fontSize: 11, fontFamily: "monospace",
                              padding: "3px 6px", borderRadius: 4,
                              border: "1px solid var(--pulso-border)",
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "6px 10px",
        fontSize: 10, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: 0.3,
        color: "var(--pulso-text-soft)",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function SugeridoButton({ label, colores, onClick }: { label: string; colores: string[]; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 11, padding: "4px 10px", borderRadius: 6,
        border: "1px solid var(--pulso-border)",
        background: "white",
        cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 7,
        transition: "background 120ms ease, border-color 120ms ease, transform 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--pulso-primary)";
        e.currentTarget.style.background = "white";
      }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--pulso-border)"; }}
      title={`Aplicar paleta ${label}`}
    >
      <span style={{ display: "inline-flex", gap: 1 }}>
        {colores.slice(0, 5).map((c, i) => (
          <span
            key={i}
            style={{
              display: "inline-block", width: 9, height: 14,
              background: c, borderRadius: 2,
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
            }}
          />
        ))}
      </span>
      <span style={{ fontWeight: 500 }}>{label}</span>
    </button>
  );
}
