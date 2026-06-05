import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, X, ListChecks, Paintbrush } from "lucide-react";
import { IconAI } from "../../lib/icons";
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

type SugeridaPalette = {
  label: string;
  description: string;
  colors: string[];
};

function opcionesKey(choices: Array<{ name: string; label: string }>) {
  return choices.map((item) => `${item.name}::${item.label}`).join("|");
}

type PaletasPorCantidad = Record<number, SugeridaPalette[]>;

const SUGERIDAS_PALETAS: PaletasPorCantidad = {
  2: [
    { label: "Binario", description: "Rojo y azul para decisiones dicotómicas.", colors: ["#B91C1C", "#1D4ED8"] },
    { label: "Verificación", description: "Contraste sobrio para cumplimiento y auditoría.", colors: ["#DC2626", "#059669"] },
    { label: "Bipolar", description: "Tonos neutros para reportes ejecutivos.", colors: ["#0F172A", "#94A3B8"] },
    { label: "Dual contraste", description: "Combinación contrastada para lectura rápida.", colors: ["#065F46", "#B91C1C"] },
    { label: "Dual institucional", description: "Tonos institucionales para operación diaria.", colors: ["#065F46", "#1E3A8A"] },
    { label: "Resultado", description: "Escenarios financieros con señal de alerta.", colors: ["#16A34A", "#DC2626"] },
    { label: "Estado", description: "Aplicable a estados de sistema o servicio.", colors: ["#047857", "#0EA5E9"] },
    { label: "Bicolor sobrio", description: "Versión neutra para material institucional.", colors: ["#1F2937", "#F3F4F6"] },
    { label: "Bicolor con gris", description: "Incluye gris para categoría sin dato.", colors: ["#DC2626", "#9CA3AF"] },
    { label: "Bicolor técnico", description: "Alto contraste para pantallas claras.", colors: ["#B91C1C", "#1F2937"] },
  ],
  3: [
    { label: "Semáforo", description: "Rojo, ámbar y verde para escala corta.", colors: ["#DC2626", "#F59E0B", "#22C55E"] },
    { label: "Semáforo con neutro", description: "Versión con gris para categoría sin dato.", colors: ["#DC2626", "#EAB308", "#A3A3A3"] },
    { label: "Likert", description: "Baja, media y alta en un formato profesional.", colors: ["#B91C1C", "#F97316", "#22C55E"] },
    { label: "Riesgo", description: "Escala de incidente por nivel.", colors: ["#991B1B", "#F59E0B", "#15803D"] },
    { label: "Progreso", description: "Azules de baja a alta adopción.", colors: ["#1E3A8A", "#3B82F6", "#93C5FD"] },
    { label: "Desempeño", description: "Lectura técnica de rendimiento.", colors: ["#0F766E", "#14B8A6", "#A7F3D0"] },
    { label: "Operación", description: "Frecuente en monitoreo operativo.", colors: ["#4C1D95", "#8B5CF6", "#A78BFA"] },
    { label: "Calidad", description: "Diferenciación media-alta clara.", colors: ["#1D4ED8", "#94A3B8", "#16A34A"] },
    { label: "Priorización", description: "Alertas sin saturación visual.", colors: ["#DC2626", "#F59E0B", "#0EA5E9"] },
    { label: "Direccional", description: "Técnico, con valor negativo y positivo.", colors: ["#4338CA", "#E5E7EB", "#15803D"] },
  ],
  4: [
    { label: "Cuartiles", description: "Bajo, medio-bajo, medio-alto y alto.", colors: ["#DC2626", "#F97316", "#EAB308", "#16A34A"] },
    { label: "Cuartiles con neutro", description: "Incluye gris para respuestas neutrales.", colors: ["#6B7280", "#F59E0B", "#3B82F6", "#0D9488"] },
    { label: "Corporativo", description: "Azul y grises para entornos ejecutivos.", colors: ["#1E3A8A", "#0EA5E9", "#60A5FA", "#93C5FD"] },
    { label: "Azul secuencial", description: "Escala limpia para madurez.", colors: ["#0F172A", "#1E3A8A", "#2563EB", "#93C5FD"] },
    { label: "Verde secuencial", description: "Monocromo para seguimiento temporal.", colors: ["#14532D", "#15803D", "#22C55E", "#86EFAC"] },
    { label: "Frío estable", description: "Ideal en dashboards con fondo claro.", colors: ["#1F2937", "#3B82F6", "#93C5FD", "#BFDBFE"] },
    { label: "Riesgo por nivel", description: "Para evaluación por niveles de impacto.", colors: ["#991B1B", "#B45309", "#D97706", "#15803D"] },
    { label: "Dual mixto", description: "Alta legibilidad en móviles y tablets.", colors: ["#B91C1C", "#9CA3AF", "#60A5FA", "#0369A1"] },
    { label: "Monocromo", description: "Tonos ordenados de una familia.", colors: ["#111827", "#374151", "#9CA3AF", "#D1D5DB"] },
    { label: "Divergente", description: "Contraste para cuatro clases.", colors: ["#2563EB", "#93C5FD", "#FCA5A5", "#DC2626"] },
  ],
  5: [
    { label: "Likert 5", description: "Escala clásica de cinco niveles.", colors: ["#B91C1C", "#F97316", "#EAB308", "#22C55E", "#15803D"] },
    { label: "Semáforo 5", description: "Escala con gris de referencia intermedio.", colors: ["#DC2626", "#F59E0B", "#E5E7EB", "#93C5FD", "#22C55E"] },
    { label: "Encuesta", description: "Frecuente en cuestionarios de opinión.", colors: ["#7F1D1D", "#F97316", "#FACC15", "#22C55E", "#166534"] },
    { label: "Monocromo", description: "Escala sobria para revisiones técnicas.", colors: ["#0F172A", "#334155", "#64748B", "#94A3B8", "#BFDBFE"] },
    { label: "Dual corporativo", description: "Dos familias para agrupaciones relacionadas.", colors: ["#1E3A8A", "#3B82F6", "#93C5FD", "#FCA5A5", "#DC2626"] },
    { label: "Rendimiento", description: "Indicador para KPIs de resultados progresivos.", colors: ["#312E81", "#4F46E5", "#818CF8", "#A78BFA", "#C4B5FD"] },
    { label: "Riesgo completo", description: "De crítico a excelente en continuidad.", colors: ["#7F1D1D", "#B91C1C", "#F97316", "#22C55E", "#166534"] },
    { label: "Tendencia", description: "Útil para curvas de tendencia discretas.", colors: ["#0F766E", "#0EA5E9", "#93C5FD", "#FBBF24", "#F59E0B"] },
    { label: "Divergente", description: "Alterna contraste de matiz para cinco clases.", colors: ["#2563EB", "#7C3AED", "#DB2777", "#F59E0B", "#16A34A"] },
    { label: "Neutro analítico", description: "Cuando el cliente exige sobriedad.", colors: ["#1F2937", "#6B7280", "#9CA3AF", "#CBD5E1", "#86EFAC"] },
  ],
  6: [
    { label: "Seis niveles", description: "Escala de severidad con ritmo uniforme.", colors: ["#7F1D1D", "#DC2626", "#F97316", "#F59E0B", "#22C55E", "#166534"] },
    { label: "Progreso técnico", description: "Azules y verdes por nivel de avance.", colors: ["#172554", "#1D4ED8", "#3B82F6", "#60A5FA", "#93C5FD", "#A7F3D0"] },
    { label: "Madurez", description: "Útil para indicadores por tramo.", colors: ["#0F172A", "#1D4ED8", "#3B82F6", "#60A5FA", "#93C5FD", "#34D399"] },
    { label: "Clínico", description: "Escala frecuente en salud y riesgo.", colors: ["#7F1D1D", "#DC2626", "#F97316", "#65A30D", "#16A34A", "#0F766E"] },
    { label: "Análisis técnico", description: "Contraste direccional para variables técnicas.", colors: ["#4338CA", "#6366F1", "#8B5CF6", "#C4B5FD", "#F9A8D4", "#F43F5E"] },
    { label: "Neutro", description: "Con poca saturación para informes finos.", colors: ["#111827", "#334155", "#64748B", "#94A3B8", "#CBD5E1", "#E2E8F0"] },
    { label: "Azul institucional", description: "Muy usada en analítica institucional.", colors: ["#172554", "#1D4ED8", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE"] },
    { label: "Prioridad operacional", description: "Separa seis grados de prioridad.", colors: ["#7F1D1D", "#C2410C", "#D97706", "#65A30D", "#16A34A", "#0F766E"] },
    { label: "Dual + neutro", description: "Alterna familia fría y cálida.", colors: ["#1E40AF", "#6B7280", "#F59E0B", "#0D9488", "#C026D3", "#16A34A"] },
    { label: "Técnico moderno", description: "Paleta moderna para gráficas avanzadas.", colors: ["#0F172A", "#0369A1", "#0EA5E9", "#22C55E", "#A3E635", "#FDE047"] },
  ],
  7: [
    { label: "Siete niveles", description: "Combinación amplia para siete clases.", colors: ["#7F1D1D", "#DC2626", "#F97316", "#FACC15", "#22C55E", "#16A34A", "#166534"] },
    { label: "Encuesta extensa", description: "Base para encuestas con muchas opciones.", colors: ["#B91C1C", "#F97316", "#FBBF24", "#84CC16", "#22C55E", "#14B8A6", "#0EA5E9"] },
    { label: "Matriz de riesgo", description: "Progresión clara de severidad.", colors: ["#7F1D1D", "#B91C1C", "#F97316", "#F59E0B", "#22C55E", "#15803D", "#0F766E"] },
    { label: "Institucional", description: "Alta variedad para categorías múltiples.", colors: ["#1E3A8A", "#3B82F6", "#60A5FA", "#38BDF8", "#2DD4BF", "#4ADE80", "#84CC16"] },
    { label: "Equilibrado", description: "Cálidos y fríos con separación.", colors: ["#312E81", "#4F46E5", "#6366F1", "#A78BFA", "#F472B6", "#F59E0B", "#0D9488"] },
    { label: "Categorías abiertas", description: "Útil para dimensiones largas.", colors: ["#0F766E", "#0EA5E9", "#22C55E", "#A855F7", "#F97316", "#D97706", "#9333EA"] },
    { label: "Monocromo extendido", description: "Conservadora para reportes ejecutivos.", colors: ["#111827", "#334155", "#64748B", "#94A3B8", "#CBD5E1", "#E2E8F0", "#F8FAFC"] },
    { label: "Tabla técnica", description: "Divergencia moderada para múltiples clases.", colors: ["#1E40AF", "#60A5FA", "#818CF8", "#C4B5FD", "#F9A8D4", "#FCA5A5", "#7F1D1D"] },
    { label: "Radar", description: "Comodidad visual para categorías cercanas.", colors: ["#1E40AF", "#60A5FA", "#818CF8", "#C4B5FD", "#F9A8D4", "#FCA5A5", "#7F1D1D"] },
    { label: "Verde-azul", description: "Tonalidad estable para seguimiento.", colors: ["#052E16", "#14532D", "#166534", "#22C55E", "#86EFAC", "#93C5FD", "#3B82F6"] },
  ],
};

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
  const [aplicarAGrupo, setAplicarAGrupo] = useState(false);
  const [paletaInvertidaPreviews, setPaletaInvertidaPreviews] = useState<Record<string, boolean>>({});

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
  const paletasSugeridas = useMemo(() => {
    if (!activaData) return [];
    const total = activaData.choices.length;
    if (total >= 2 && total <= 7) return SUGERIDAS_PALETAS[total];
    return SUGERIDAS_PALETAS[7];
  }, [activaData]);
  const listasMismaFirma = useMemo(() => {
    if (!activaData) return [];
    const firma = opcionesKey(activaData.choices);
    return listasSugeridas.filter((l) => opcionesKey(l.choices) === firma);
  }, [activaData, listasSugeridas]);
  const listaFirmas = useMemo(() => {
    const byFirma = new Map<string, number>();
    listasSugeridas.forEach((lista) => {
      const key = opcionesKey(lista.choices);
      byFirma.set(key, (byFirma.get(key) ?? 0) + 1);
    });
    return byFirma;
  }, [listasSugeridas]);

  useEffect(() => {
    setAplicarAGrupo(false);
  }, [activeListName]);

  function aplicarPaletaSugerida(
    paleta: string[],
    invertir = false,
  ) {
    if (!activaData) return;
    const targetLists = aplicarAGrupo && listasMismaFirma.length > 1
      ? listasMismaFirma
      : [activaData];
    const colors = invertir ? [...paleta].reverse() : paleta;
    targetLists.forEach((lista) => {
      const nueva: Record<string, string> = {};
      lista.choices.forEach((c, i) => {
        nueva[c.label] = colors[i % colors.length];
      });
      setPaleta(lista.list_name, nueva);
    });
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
    <div className="pulso-gv2-paletas-editor">
      {/* Columna izquierda: lista de list_names */}
      <div className="pulso-gv2-paletas-sidebar">
        <SectionEyebrow
          label="Listas del instrumento"
          hint="Cada lista de respuestas puede tener su paleta. Si no le asignas colores, prosecnur usa su paleta azul por defecto."
        />

        <div
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 10px", borderRadius: 8,
            border: "1px solid var(--pulso-border)",
            background: "var(--pulso-surface)",
            boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.04)",
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

        <div className="pulso-gv2-paletas-list">
          {listasFiltradas.map((l) => {
            const active = l.list_name === activeListName;
            const tienePaleta = !!paletas[l.list_name] && Object.keys(paletas[l.list_name] ?? {}).length > 0;
            const firmasSimilares = listaFirmas.get(opcionesKey(l.choices)) ?? 1;
            return (
              <button
                key={l.list_name}
                type="button"
                onClick={() => setActiveListName(l.list_name)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                  padding: "7px 9px", borderRadius: 8,
                  border: `1px solid ${active ? "var(--pulso-primary-border)" : "transparent"}`,
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
                  {firmasSimilares > 1 && (
                    <span style={{ marginLeft: 4, color: "var(--pulso-text-soft)" }}>
                      · {firmasSimilares}×
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Columna derecha: editor de colores de la lista activa */}
      <div className="pulso-gv2-paletas-detail">
        {!activaData ? (
          <div style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
            Elige una lista a la izquierda para editar su paleta.
          </div>
        ) : (
          <>
            <header style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span
                style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: "var(--pulso-primary-soft)",
                  color: "var(--pulso-primary)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Paintbrush size={15} strokeWidth={2.1} />
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
                {listasMismaFirma.length > 1 && (
                  <label
                    title={listasMismaFirma.map((lista) => lista.list_name).join(", ")}
                    style={{
                      marginTop: 6,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      color: "var(--pulso-text-soft)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={aplicarAGrupo}
                      onChange={(e) => setAplicarAGrupo(e.target.checked)}
                    />
                    Aplicar a {listasMismaFirma.length - 1} lista{listasMismaFirma.length - 1 === 1 ? "" : "s"} con las mismas opciones
                  </label>
                )}
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
                <IconAI size={11} /> Paletas sugeridas por categorías
              </span>
              <span style={{ fontSize: 10, color: "var(--pulso-text-soft)" }}>
                {activaData.choices.length} categorías · {paletasSugeridas.length} propuestas
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(176px, 1fr))", gap: 8 }}>
                {paletasSugeridas.map((palette) => {
                  const previewKey = `${activaData.list_name}:${palette.label}`;
                  const isInverted = !!paletaInvertidaPreviews[previewKey];
                  const previewColors = isInverted ? [...palette.colors].reverse() : palette.colors;

                  return (
                    <SugeridoButton
                      key={previewKey}
                      label={palette.label}
                      colores={previewColors}
                      description={palette.description}
                      isInverted={isInverted}
                      onApply={() => {
                        setPaletaInvertidaPreviews((prev) => ({ ...prev, [previewKey]: false }));
                        aplicarPaletaSugerida(palette.colors);
                      }}
                      onInvert={() => {
                        setPaletaInvertidaPreviews((prev) => ({ ...prev, [previewKey]: !isInverted }));
                        if (isInverted) {
                          aplicarPaletaSugerida(palette.colors);
                        } else {
                          aplicarPaletaSugerida(palette.colors, true);
                        }
                      }}
                    />
                  );
                })}
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
                  {activaData.choices.map((c, rowIndex) => {
                    const color = paletaActiva[c.label] ?? "";
                    const colorValue = color || "#cbd5e1";
                    const colorInputId = `palette-color-${rowIndex}`;
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
                          <label
                            htmlFor={colorInputId}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 7,
                              padding: "0 9px",
                              minWidth: 74,
                              height: 26,
                              borderRadius: 999,
                              border: "1px solid var(--pulso-border)",
                              background: "white",
                              cursor: "pointer",
                              boxShadow: "0 1px 1px rgba(15, 23, 42, 0.03)",
                            }}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              const input = document.getElementById(colorInputId) as (HTMLInputElement & { showPicker?: () => void }) | null;
                              if (!input) return;
                              if (typeof input.showPicker === "function") {
                                input.showPicker();
                                return;
                              }
                              input.click();
                            }}
                          >
                            <span style={{
                              width: 14,
                              height: 14,
                              borderRadius: 999,
                              border: "1px solid rgba(15, 23, 42, 0.1)",
                              background: colorValue,
                              boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.25)",
                            }} />
                            <Paintbrush size={12} color="var(--pulso-text-soft)" />
                          </label>
                          <input
                            id={colorInputId}
                            type="color"
                            value={colorValue}
                            onChange={(e) => setColorEnPaleta(activaData.list_name, c.label, e.target.value)}
                            style={{
                              position: "absolute",
                              width: 0,
                              height: 0,
                              opacity: 0,
                              border: "none",
                              padding: 0,
                              margin: 0,
                              pointerEvents: "none",
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

function SugeridoButton({
  label,
  colores,
  isInverted = false,
  onApply,
  onInvert,
  description,
}: {
  label: string;
  colores: string[];
  isInverted?: boolean;
  onApply: () => void;
  onInvert: () => void;
  description?: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        border: "1px solid var(--pulso-border)",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <button
        type="button"
        onClick={onApply}
        style={{
          width: "100%",
          fontSize: 11,
          padding: "8px 34px 8px 10px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          transition: "background 120ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(14, 165, 233, 0.03)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
        title={`Aplicar paleta ${label}${description ? ` — ${description}` : ""}`}
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
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontWeight: 600, color: "var(--pulso-text)" }}>
            {label}
          </span>
          <span style={{
            fontSize: 9,
            color: isInverted ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
            letterSpacing: 0.2,
            textTransform: "uppercase",
          }}>
            {isInverted ? "Inversa" : "Base"}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onInvert();
        }}
        style={{
          position: "absolute",
          top: 5,
          right: 5,
          border: `1px solid ${isInverted ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
          background: isInverted ? "var(--pulso-primary-soft)" : "var(--pulso-surface)",
          color: isInverted ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
          borderRadius: 999,
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: 0.1,
          padding: "2px 7px",
          lineHeight: 1.2,
          cursor: "pointer",
          boxShadow: isInverted ? "inset 0 0 0 1px rgba(59, 130, 246, 0.25)" : "none",
          transition: "border-color 120ms ease, color 120ms ease, background 120ms ease",
        }}
        aria-pressed={isInverted}
        onMouseEnter={(event) => {
          event.currentTarget.style.borderColor = "var(--pulso-primary)";
          event.currentTarget.style.color = "var(--pulso-primary)";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.borderColor = isInverted
            ? "var(--pulso-primary)"
            : "var(--pulso-border)";
          event.currentTarget.style.color = isInverted
            ? "var(--pulso-primary)"
            : "var(--pulso-text-soft)";
        }}
        title={`Invertir paleta ${label}`}
      >
        {isInverted ? "Inversa" : "Invertir"}
      </button>
    </div>
  );
}
