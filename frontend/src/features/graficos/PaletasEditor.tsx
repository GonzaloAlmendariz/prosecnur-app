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

export const PULSO_PUCP_COLORS = {
  azul: "#081F5C",
  rojo: "#CA5651",
  verde: "#85BB85",
  amarillo: "#EFD25E",
  gris: "#BFBFBF",
  naranja: "#E4A34C",
  azulSecundario: "#7594CC",
  morado: "#9688D3",
  grisSecundario: "#D8D8D8",
  blanco: "#FFFFFF",
} as const;

const SUGERIDAS_PALETAS: PaletasPorCantidad = {
  2: [
    { label: "Pulso principal", description: "Azul institucional y rojo principal.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.rojo] },
    { label: "Pulso aprobación", description: "Contraste directo para dos estados evaluativos.", colors: [PULSO_PUCP_COLORS.rojo, PULSO_PUCP_COLORS.verde] },
    { label: "Pulso neutro", description: "Azul institucional con gris para categorías de soporte.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.gris] },
  ],
  3: [
    { label: "Pulso principal", description: "Tres categorías con colores principales.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.rojo, PULSO_PUCP_COLORS.verde] },
    { label: "Pulso semáforo", description: "Rojo, amarillo y verde para niveles de aprobación.", colors: [PULSO_PUCP_COLORS.rojo, PULSO_PUCP_COLORS.amarillo, PULSO_PUCP_COLORS.verde] },
    { label: "Pulso frecuencias", description: "Azules y gris para frecuencias o distribución.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.azulSecundario, PULSO_PUCP_COLORS.gris] },
  ],
  4: [
    { label: "Pulso aprobación", description: "Rojo, amarillo, verde y gris/plomo.", colors: [PULSO_PUCP_COLORS.rojo, PULSO_PUCP_COLORS.amarillo, PULSO_PUCP_COLORS.verde, PULSO_PUCP_COLORS.gris] },
    { label: "Pulso principal", description: "Cuatro categorías con fuerte presencia institucional.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.rojo, PULSO_PUCP_COLORS.verde, PULSO_PUCP_COLORS.amarillo] },
    { label: "Pulso secundarios", description: "Soporte para categorías adicionales sin repetir principales.", colors: [PULSO_PUCP_COLORS.naranja, PULSO_PUCP_COLORS.azulSecundario, PULSO_PUCP_COLORS.morado, PULSO_PUCP_COLORS.grisSecundario] },
  ],
  5: [
    { label: "Pulso principales", description: "La secuencia principal completa de la guía.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.rojo, PULSO_PUCP_COLORS.verde, PULSO_PUCP_COLORS.amarillo, PULSO_PUCP_COLORS.gris] },
    { label: "Pulso Likert", description: "De desacuerdo a acuerdo con amarillo medio y gris neutro.", colors: [PULSO_PUCP_COLORS.rojo, PULSO_PUCP_COLORS.naranja, PULSO_PUCP_COLORS.amarillo, PULSO_PUCP_COLORS.verde, PULSO_PUCP_COLORS.gris] },
    { label: "Pulso secundarios", description: "Paleta secundaria para series o cortes extensos.", colors: [PULSO_PUCP_COLORS.naranja, PULSO_PUCP_COLORS.azulSecundario, PULSO_PUCP_COLORS.morado, PULSO_PUCP_COLORS.grisSecundario, PULSO_PUCP_COLORS.blanco] },
  ],
  6: [
    { label: "Pulso extendida", description: "Principales más naranja secundario.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.rojo, PULSO_PUCP_COLORS.verde, PULSO_PUCP_COLORS.amarillo, PULSO_PUCP_COLORS.gris, PULSO_PUCP_COLORS.naranja] },
    { label: "Pulso secundarios", description: "Categorías extra con secundarios y gris claro.", colors: [PULSO_PUCP_COLORS.naranja, PULSO_PUCP_COLORS.azulSecundario, PULSO_PUCP_COLORS.morado, PULSO_PUCP_COLORS.grisSecundario, PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.gris] },
    { label: "Pulso aprobación", description: "Escala evaluativa amplia con neutros.", colors: [PULSO_PUCP_COLORS.rojo, PULSO_PUCP_COLORS.naranja, PULSO_PUCP_COLORS.amarillo, PULSO_PUCP_COLORS.verde, PULSO_PUCP_COLORS.azulSecundario, PULSO_PUCP_COLORS.gris] },
  ],
  7: [
    { label: "Pulso completa", description: "Principales y secundarios sin repetir blanco.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.rojo, PULSO_PUCP_COLORS.verde, PULSO_PUCP_COLORS.amarillo, PULSO_PUCP_COLORS.gris, PULSO_PUCP_COLORS.naranja, PULSO_PUCP_COLORS.azulSecundario] },
    { label: "Pulso extendida", description: "Incluye morado y gris claro para más cortes.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.rojo, PULSO_PUCP_COLORS.verde, PULSO_PUCP_COLORS.amarillo, PULSO_PUCP_COLORS.naranja, PULSO_PUCP_COLORS.azulSecundario, PULSO_PUCP_COLORS.morado] },
    { label: "Pulso neutra", description: "Más discreta para tablas y cortes con categorías auxiliares.", colors: [PULSO_PUCP_COLORS.azul, PULSO_PUCP_COLORS.azulSecundario, PULSO_PUCP_COLORS.gris, PULSO_PUCP_COLORS.grisSecundario, PULSO_PUCP_COLORS.naranja, PULSO_PUCP_COLORS.morado, PULSO_PUCP_COLORS.rojo] },
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
                letterSpacing: 0,
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
        letterSpacing: 0,
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
            letterSpacing: 0,
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
