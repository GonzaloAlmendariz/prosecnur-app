import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Layers,
  ListChecks,
  Paintbrush,
  Palette,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { IconAI } from "../../lib/icons";
import {
  apiGraficosPaletasSugeridas,
  PaletaSugeridaEntry,
} from "../../api/client";
import { usePlanStore } from "./store";
import { LoadingBlock, ErrorBlock, EmptyState, SectionEyebrow } from "../../components/States";
import "./v2/styles/paletas-suite.css";

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

// B38/G-7: preferencia reversible de "agrupar listas idénticas". Persistida
// para que la decisión sobreviva a cerrar el diálogo; por defecto activa —
// aplicar la misma paleta a todas las listas con las mismas opciones es lo
// que un informe consistente espera.
const AGRUPAR_IDENTICAS_KEY = "pulso.graficos.paletas.agruparIdenticas";

function loadAgruparIdenticas(): boolean {
  try {
    const raw = localStorage.getItem(AGRUPAR_IDENTICAS_KEY);
    return raw == null ? true : raw === "true";
  } catch {
    return true;
  }
}

function saveAgruparIdenticas(value: boolean) {
  try {
    localStorage.setItem(AGRUPAR_IDENTICAS_KEY, String(value));
  } catch {
    // localStorage restringido — la preferencia vive solo esta sesión.
  }
}

/** Bases dignas de mostrarse: más de una fuente real (multibase).
 *  jsonlite des-encaja los vectores de longitud 1 a escalar, así que
 *  `fuentes` puede llegar como string suelto — se normaliza a array. */
function fuentesVisibles(entry: PaletaSugeridaEntry): string[] {
  const raw = entry.fuentes as unknown;
  const fuentes = Array.isArray(raw)
    ? raw.filter((f): f is string => typeof f === "string" && f.length > 0)
    : typeof raw === "string" && raw.length > 0 ? [raw] : [];
  if (fuentes.length <= 1 && (fuentes.length === 0 || fuentes[0] === "default")) return [];
  return fuentes;
}

function compactColors(colors: Array<string | undefined>) {
  return colors.filter((color): color is string => Boolean(color));
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
  const [agruparIdenticas, setAgruparIdenticas] = useState(loadAgruparIdenticas);
  const [aplicarAGrupo, setAplicarAGrupo] = useState(loadAgruparIdenticas);
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
  const totalPaletasPersonalizadas = useMemo(
    () => Object.values(paletas).filter((paleta) => Object.keys(paleta ?? {}).length > 0).length,
    [paletas],
  );
  const gruposCompatibles = useMemo(
    () => Array.from(listaFirmas.values()).filter((count) => count > 1).length,
    [listaFirmas],
  );

  // Al cambiar de lista, el toggle por-lista arranca en la preferencia
  // global (agrupar identicas): reversible en ambos sentidos.
  useEffect(() => {
    setAplicarAGrupo(agruparIdenticas);
  }, [activeListName, agruparIdenticas]);

  function toggleAgruparIdenticas(value: boolean) {
    setAgruparIdenticas(value);
    saveAgruparIdenticas(value);
  }

  // Listas destino de cualquier edición: el grupo de firma idéntica cuando
  // la agrupación está activa, solo la activa cuando no.
  const listasDestino = aplicarAGrupo && listasMismaFirma.length > 1
    ? listasMismaFirma
    : (activaData ? [activaData] : []);

  function aplicarPaletaSugerida(
    paleta: string[],
    invertir = false,
  ) {
    if (!activaData) return;
    const colors = invertir ? [...paleta].reverse() : paleta;
    listasDestino.forEach((lista) => {
      const nueva: Record<string, string> = {};
      lista.choices.forEach((c, i) => {
        nueva[c.label] = colors[i % colors.length];
      });
      setPaleta(lista.list_name, nueva);
    });
  }

  // B38/G-7: las ediciones manuales (color puntual, vaciar) también deben
  // respetar la agrupación — antes solo las sugeridas aplicaban al grupo y
  // el mapa por-etiqueta rompía la consistencia silenciosamente.
  function setColorEnGrupo(label: string, color: string) {
    listasDestino.forEach((lista) => setColorEnPaleta(lista.list_name, label, color));
  }

  function vaciarPaletaGrupo() {
    listasDestino.forEach((lista) => removePaleta(lista.list_name));
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
  const coloresActivos = activaData
    ? compactColors(activaData.choices.map((choice) => paletaActiva[choice.label]))
    : [];
  const coloresPersonalizados = Object.keys(paletaActiva).length;
  const coberturaActiva = activaData
    ? Math.round((Math.min(coloresActivos.length, activaData.choices.length) / Math.max(activaData.choices.length, 1)) * 100)
    : 0;

  return (
    <div className="pulso-gv2-paletas-editor">
      {/* Columna izquierda: lista de list_names */}
      <div className="pulso-gv2-paletas-sidebar">
        <SectionEyebrow
          label="Listas del instrumento"
          hint="Cada lista de respuestas puede tener su paleta. Si no le asignas colores, prosecnur usa su paleta azul por defecto."
        />

        {gruposCompatibles > 0 && (
          <label
            className="pulso-gv2-paletas-group-all"
            data-active={agruparIdenticas ? "true" : "false"}
            title="Con la agrupación activa, cualquier paleta o color que apliques se replica en todas las listas con exactamente las mismas opciones. Puedes desactivarla en cualquier momento; también por lista desde el panel derecho."
          >
            <input
              type="checkbox"
              checked={agruparIdenticas}
              onChange={(e) => toggleAgruparIdenticas(e.target.checked)}
            />
            <span>
              <Layers size={12} /> Agrupar listas idénticas
              <small>{gruposCompatibles} grupo{gruposCompatibles === 1 ? "" : "s"} con las mismas opciones</small>
            </span>
          </label>
        )}

        <div className="pulso-gv2-paletas-search">
          <Search size={13} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar lista…"
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
            const coloresFila = compactColors(l.choices.map((choice) => paletas[l.list_name]?.[choice.label])).slice(0, 7);
            return (
              <button
                key={l.list_name}
                type="button"
                onClick={() => setActiveListName(l.list_name)}
                className="pulso-gv2-paleta-row"
                data-active={active ? "true" : "false"}
                data-has-palette={tienePaleta ? "true" : "false"}
              >
                <span className="pulso-gv2-paleta-row-copy">
                  <code>{l.list_name}</code>
                  <small title={fuentesVisibles(l).join(", ") || undefined}>
                    {l.choices.length} {l.choices.length === 1 ? "opción" : "opciones"}
                    {firmasSimilares > 1 ? ` · ${firmasSimilares} listas compatibles` : ""}
                    {fuentesVisibles(l).length === 1
                      ? ` · ${fuentesVisibles(l)[0]}`
                      : fuentesVisibles(l).length > 1
                        ? ` · ${fuentesVisibles(l).length} bases`
                        : ""}
                  </small>
                </span>
                <span className="pulso-gv2-paleta-row-visual" title={tienePaleta ? "Paleta personalizada" : "Base predeterminada sin cambios"}>
                  <span className="pulso-gv2-paleta-row-strip" data-empty={coloresFila.length === 0 ? "true" : "false"}>
                    {coloresFila.length > 0
                      ? coloresFila.map((color, index) => (
                        <span key={`${l.list_name}-${color}-${index}`} style={{ background: color }} />
                      ))
                      : (
                        <>
                          <span />
                          <span />
                          <span />
                        </>
                      )}
                  </span>
                  <span className="pulso-gv2-paleta-row-state">
                    {tienePaleta ? "Personal" : "Base"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Columna derecha: editor de colores de la lista activa */}
      <div className="pulso-gv2-paletas-detail">
        {!activaData ? (
          <div className="pulso-gv2-paletas-empty-detail">
            Elige una lista a la izquierda para editar su paleta.
          </div>
        ) : (
          <>
            <header className="pulso-gv2-paleta-hero">
              <div className="pulso-gv2-paleta-hero-main">
                <span className="pulso-gv2-paleta-hero-mark">
                  <Paintbrush size={16} strokeWidth={2.15} />
                </span>
                <div className="pulso-gv2-paleta-hero-copy">
                  <span>Paleta activa</span>
                  <h3>
                    Colores de <code>{activaData.list_name}</code>
                  </h3>
                  <p>
                    La base predeterminada no marca cambios. Personaliza solo las categorías que necesitan un color fijo en reportes, slides y dashboards.
                  </p>
                  <div className="pulso-gv2-paleta-hero-chips">
                    <span><Palette size={12} /> {activaData.choices.length} categorías</span>
                    <span><CheckCircle2 size={12} /> {totalPaletasPersonalizadas}/{listasSugeridas.length} listas personalizadas</span>
                    <span><Layers size={12} /> {gruposCompatibles || 0} grupos compatibles</span>
                    {fuentesVisibles(activaData).length > 0 && (
                      <span title="Bases del estudio donde vive esta lista">
                        {fuentesVisibles(activaData).join(" · ")}
                      </span>
                    )}
                  </div>
                </div>
                {listasMismaFirma.length > 1 && (
                  <label
                    title={listasMismaFirma.map((lista) => lista.list_name).join(", ")}
                    className="pulso-gv2-paleta-group-toggle"
                    data-active={aplicarAGrupo ? "true" : "false"}
                  >
                    <input
                      type="checkbox"
                      checked={aplicarAGrupo}
                      onChange={(e) => setAplicarAGrupo(e.target.checked)}
                    />
                    <span>
                      <Layers size={12} />
                      Aplicar a {listasMismaFirma.length - 1} lista{listasMismaFirma.length - 1 === 1 ? "" : "s"} con las mismas opciones
                    </span>
                  </label>
                )}
              </div>
              <aside className="pulso-gv2-paleta-state-card" aria-label="Estado de la paleta seleccionada">
                <span>Estado</span>
                <strong>{coloresPersonalizados > 0 ? "Personalizada" : "Predeterminada"}</strong>
                <small>
                  {coloresPersonalizados > 0
                    ? `${coloresActivos.length}/${activaData.choices.length} categorías con color (${coberturaActiva}%)`
                    : "Usa la base predeterminada del sistema"}
                </small>
                <div
                  className="pulso-gv2-paleta-state-strip"
                  data-empty={coloresActivos.length === 0 ? "true" : "false"}
                >
                  {coloresActivos.length > 0
                    ? coloresActivos.slice(0, 8).map((color, index) => (
                      <span key={`${color}-${index}`} style={{ background: color }} />
                    ))
                    : (
                      <>
                        <span />
                        <span />
                        <span />
                        <span />
                      </>
                    )}
                </div>
                {coloresPersonalizados > 0 && (
                  <button
                    type="button"
                    onClick={() => vaciarPaletaGrupo()}
                    title={listasDestino.length > 1
                      ? `Quitar los colores personalizados de las ${listasDestino.length} listas agrupadas`
                      : "Quitar todos los colores personalizados de esta lista"}
                    className="pulso-gv2-paleta-clear-button"
                  >
                    <Trash2 size={12} /> Vaciar
                  </button>
                )}
              </aside>
            </header>

            {/* Paletas sugeridas */}
            <section className="pulso-gv2-paletas-suggestions">
              <header className="pulso-gv2-paletas-suggestions-head">
                <span className="pulso-gv2-paletas-suggestions-mark">
                  <Sparkles size={14} />
                </span>
                <div>
                  <strong><IconAI size={12} /> Paletas recomendadas</strong>
                  <small>{activaData.choices.length} categorías · {paletasSugeridas.length} propuestas calibradas</small>
                </div>
              </header>
              <div className="pulso-gv2-paletas-suggestions-grid">
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
            </section>

            {/* Tabla de labels con color picker */}
            <section className="pulso-gv2-paleta-map">
              <header className="pulso-gv2-paleta-map-head">
                <div>
                  <strong>Mapa de categorías</strong>
                  <small>Edita color por etiqueta. Los campos vacíos permanecen en la base predeterminada.</small>
                </div>
                <span>{coloresActivos.length}/{activaData.choices.length} definidos</span>
              </header>
              <div className="pulso-gv2-paleta-table-shell">
                <table className="pulso-gv2-paleta-table">
                  <thead>
                    <tr>
                      <Th style={{ width: 72 }}>Código</Th>
                      <Th>Etiqueta</Th>
                      <Th style={{ width: 92 }}>Color</Th>
                      <Th style={{ width: 132 }}>Hex</Th>
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
                          className="pulso-gv2-paleta-color-row"
                          data-assigned={color ? "true" : "false"}
                        >
                          <td className="pulso-gv2-paleta-code-cell">
                            <code>{c.name}</code>
                          </td>
                          <td className="pulso-gv2-paleta-label-cell">
                            {c.label}
                          </td>
                          <td className="pulso-gv2-paleta-color-cell">
                            <label
                              htmlFor={colorInputId}
                              className="pulso-gv2-paleta-color-trigger"
                              data-empty={color ? "false" : "true"}
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
                              <span style={{ background: colorValue }} />
                              <Paintbrush size={12} />
                            </label>
                            <input
                              id={colorInputId}
                              type="color"
                              value={colorValue}
                              onChange={(e) => setColorEnGrupo(c.label, e.target.value)}
                              className="pulso-gv2-paleta-native-color"
                            />
                          </td>
                          <td className="pulso-gv2-paleta-hex-cell">
                            <input
                              type="text"
                              value={color}
                              onChange={(e) => {
                                const v = e.target.value;
                                // Validar hex básico
                                if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) {
                                  setColorEnGrupo(c.label, v.startsWith("#") || v === "" ? v : `#${v}`);
                                }
                              }}
                              placeholder="#cccccc"
                              className="pulso-gv2-paleta-hex-input"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      className="pulso-gv2-paleta-th"
      style={{
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
    <div className="pulso-gv2-sugerido-card" data-inverted={isInverted ? "true" : "false"}>
      <button
        type="button"
        onClick={onApply}
        className="pulso-gv2-sugerido-apply"
        title={`Aplicar paleta ${label}${description ? ` — ${description}` : ""}`}
      >
        <span className="pulso-gv2-sugerido-swatches">
          {colores.slice(0, 7).map((c, i) => (
            <span
              key={i}
              style={{ background: c }}
            />
          ))}
        </span>
        <span className="pulso-gv2-sugerido-copy">
          <strong>
            {label}
          </strong>
          {description && <small>{description}</small>}
        </span>
        <span className="pulso-gv2-sugerido-mode">
          <CheckCircle2 size={11} />
          {isInverted ? "Inverso" : "Base"}
        </span>
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onInvert();
        }}
        className="pulso-gv2-sugerido-invert"
        aria-pressed={isInverted}
        title={`Invertir paleta ${label}`}
      >
        <RotateCcw size={11} />
        {isInverted ? "Inversa" : "Invertir"}
      </button>
    </div>
  );
}
