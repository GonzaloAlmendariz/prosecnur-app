import { useEffect, useId, useMemo, useState } from "react";
import {
  PULSO_PUCP_COLORS,
  SUGERIDAS_PALETAS,
  type SugeridaPalette,
} from "./paletasSugeridas";
import {
  CheckCircle2,
  Layers,
  Link2,
  Link2Off,
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
import {
  clavesHuerfanas,
  coloresPorEtiqueta,
  etiquetaEquivalente,
  firmaOpciones,
  listasQueUsan,
  resolverPaleta,
  type ResolucionPaleta,
} from "./paletasResolver";
import { LoadingBlock, ErrorBlock, EmptyState, SectionEyebrow } from "../../components/States";
import "./v2/styles/paletas-suite.css";
import "./paletasHuerfanas.css";

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

// ADR 0097: dos listas son «idénticas» si tienen el mismo CONJUNTO de etiquetas normalizadas (sin caja, tildes ni
// espacios repetidos), que es la misma firma con la que el motor reparte una paleta. Antes se comparaba `name::label`
// exacto y una mayúscula o un código distinto partía el grupo.
function opcionesKey(choices: ReadonlyArray<{ label: string }>) {
  return firmaOpciones(choices.map((item) => item.label));
}

/** Rótulo corto de dónde toma sus colores una lista (fila del listado). */
function rotuloOrigen(r: ResolucionPaleta | null): string {
  if (!r) return "Base";
  if (r.origen === "propia") return "Propia";
  if (r.origen === "vinculo") return "Vínculo";
  return "Opciones";
}

/** Frase completa de dónde toma sus colores una lista (detalle). */
function fraseOrigen(r: ResolucionPaleta | null, listName: string): string {
  if (!r) return "Sin paleta: usa la de por defecto.";
  if (r.origen === "propia") {
    return r.clave === listName ? "Toma sus colores de su paleta propia." : `Toma sus colores de su paleta propia («${r.clave}»).`;
  }
  if (r.origen === "vinculo") return `Toma sus colores del vínculo con «${r.clave}».`;
  return `Toma sus colores por sus opciones: coinciden con «${r.clave}».`;
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


// Identidad de una entrada del catálogo. El backend separa las escalas que
// comparten `list_name` entre bases y las desambigua con `escala_id`; un
// backend viejo no manda el campo y ahí el nombre sigue siendo la identidad.
function escalaIdDe(lista: PaletaSugeridaEntry): string {
  return lista.escala_id ?? lista.list_name;
}

export function PaletasEditor() {
  const paletas = usePlanStore((s) => s.paletas);
  const setColorEnPaleta = usePlanStore((s) => s.setColorEnPaleta);
  const removeColoresDePaleta = usePlanStore((s) => s.removeColoresDePaleta);
  const paletasVinculos = usePlanStore((s) => s.paletasVinculos);
  const setPaletaVinculo = usePlanStore((s) => s.setPaletaVinculo);

  const [listasSugeridas, setListasSugeridas] = useState<PaletaSugeridaEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeEscalaId, setActiveEscalaId] = useState<string | null>(null);
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
          if (r.listas.length > 0 && !activeEscalaId) {
            setActiveEscalaId(escalaIdDe(r.listas[0]));
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
    () => listasSugeridas.find((l) => escalaIdDe(l) === activeEscalaId),
    [listasSugeridas, activeEscalaId],
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
  // Numerador y denominador tienen que hablar de lo MISMO. `paletas` se guarda
  // por `list_name` y el catálogo lista ESCALAS, que en multibase son más: leer
  // el largo de `paletas` daba «34/74», donde el 34 contaba nombres y el 74
  // contaba escalas. Se cuentan las escalas con al menos una etiqueta coloreada,
  // que es el mismo criterio con el que cada fila se marca como personalizada.
  const totalPaletasPersonalizadas = useMemo(
    () => listasSugeridas.filter(
      (lista) => lista.choices.some((choice) => !!paletas[lista.list_name]?.[choice.label]),
    ).length,
    [listasSugeridas, paletas],
  );
  // Nombres de lista del instrumento (únicos: en multibase varias escalas comparten nombre) y paletas que no son de
  // ninguno: las de un perfil o de otro proyecto, que antes quedaban invisibles (ADR 0097).
  const listNames = useMemo(
    () => Array.from(new Set(listasSugeridas.map((l) => l.list_name))),
    [listasSugeridas],
  );
  const huerfanas = useMemo(() => clavesHuerfanas(paletas, listNames), [paletas, listNames]);
  const huerfanasFiltradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? huerfanas.filter((clave) => clave.toLowerCase().includes(q)) : huerfanas;
  }, [huerfanas, query]);
  const resoluciones = useMemo(() => {
    const out = new Map<string, ResolucionPaleta | null>();
    listasSugeridas.forEach((l) => out.set(escalaIdDe(l), resolverPaleta(l, paletas, paletasVinculos)));
    return out;
  }, [listasSugeridas, paletas, paletasVinculos]);
  const gruposCompatibles = useMemo(
    () => Array.from(listaFirmas.values()).filter((count) => count > 1).length,
    [listaFirmas],
  );

  // Al cambiar de lista, el toggle por-lista arranca en la preferencia
  // global (agrupar identicas): reversible en ambos sentidos.
  useEffect(() => {
    setAplicarAGrupo(agruparIdenticas);
  }, [activeEscalaId, agruparIdenticas]);

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
    // El color se decide sobre el ORDEN de la lista activa y se reparte a las del grupo por etiqueta normalizada: con
    // la firma por conjunto (ADR 0097) otra lista del grupo puede traer las mismas opciones en otro orden o con otra
    // caja, y repartir por posición le daba a «Muy de acuerdo» el color de «Nada de acuerdo».
    const porEtiqueta: Record<string, string> = {};
    activaData.choices.forEach((c, i) => { porEtiqueta[c.label] = colors[i % colors.length]; });
    // Se escribe etiqueta por etiqueta —que MERGEA— en vez de reemplazar el
    // mapa entero: bajo un mismo `list_name` puede vivir otra escala de otra
    // base, y reemplazar le borraba los colores sin avisar.
    listasDestino.forEach((lista) => {
      coloresPorEtiqueta(porEtiqueta, lista.choices).forEach(({ label, color }) => {
        setColorEnPaleta(lista.list_name, label, color);
      });
    });
  }

  // B38/G-7: las ediciones manuales (color puntual, vaciar) también deben
  // respetar la agrupación — antes solo las sugeridas aplicaban al grupo y
  // el mapa por-etiqueta rompía la consistencia silenciosamente.
  function setColorEnGrupo(label: string, color: string) {
    listasDestino.forEach((lista) => {
      const propia = etiquetaEquivalente(lista, label);
      if (propia) setColorEnPaleta(lista.list_name, propia, color);
    });
  }

  function vaciarPaletaGrupo() {
    listasDestino.forEach((lista) => removeColoresDePaleta(
      lista.list_name,
      lista.choices.map((c) => c.label),
    ));
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

  const paletaActiva = (activaData && paletas[activaData.list_name]) || {};
  const resolucionActiva = activaData ? (resoluciones.get(escalaIdDe(activaData)) ?? null) : null;
  const vinculoActivo = activaData ? paletasVinculos[activaData.list_name] : undefined;
  const coloresActivos = activaData
    ? compactColors(activaData.choices.map((choice) => paletaActiva[choice.label]))
    : [];
  // Solo las etiquetas de ESTA escala: el mapa guardado puede traer además las
  // de una escala homónima de otra base, y contarlas daba coberturas por
  // encima del 100 % («2/17 con color» sobre una lista que no existe).
  const coloresPersonalizados = activaData
    ? activaData.choices.filter((choice) => !!paletaActiva[choice.label]).length
    : 0;
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
            const escalaId = escalaIdDe(l);
            const active = escalaId === activeEscalaId;
            // «Tiene paleta» es de la ESCALA, no del nombre: bajo un mismo
            // `list_name` puede haber otra escala ya coloreada y marcar esta
            // como personalizada sería mentir.
            const tienePaleta = l.choices.some((choice) => !!paletas[l.list_name]?.[choice.label]);
            const firmasSimilares = listaFirmas.get(opcionesKey(l.choices)) ?? 1;
            // La tira muestra los colores con los que la lista SALE, vengan de su paleta, de un vínculo o de sus opciones.
            const resolucion = resoluciones.get(escalaId) ?? null;
            const coloresFila = (resolucion
              ? coloresPorEtiqueta(paletas[resolucion.clave] ?? {}, l.choices).map((x) => x.color)
              : []).slice(0, 7);
            return (
              <button
                key={escalaId}
                type="button"
                onClick={() => setActiveEscalaId(escalaId)}
                className="pulso-gv2-paleta-row"
                data-active={active ? "true" : "false"}
                data-has-palette={tienePaleta ? "true" : "false"}
                data-origen={resolucion?.origen ?? "recetario"}
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
                <span className="pulso-gv2-paleta-row-visual" title={fraseOrigen(resolucion, l.list_name)}>
                  <span className="pulso-gv2-paleta-row-strip" data-empty={coloresFila.length === 0 ? "true" : "false"}>
                    {coloresFila.length > 0
                      ? coloresFila.map((color, index) => (
                        <span key={`${escalaId}-${color}-${index}`} style={{ background: color }} />
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
                    {rotuloOrigen(resolucion)}
                  </span>
                </span>
              </button>
            );
          })}
          <PaletasHuerfanas
            claves={huerfanasFiltradas}
            total={huerfanas.length}
            paletas={paletas}
            vinculos={paletasVinculos}
            listas={listasSugeridas}
            listNames={listNames}
            onVincular={setPaletaVinculo}
          />
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
                  <p className="pulso-gv2-paleta-origen" data-origen={resolucionActiva?.origen ?? "recetario"}>
                    <span>{fraseOrigen(resolucionActiva, activaData.list_name)}</span>
                    {vinculoActivo && (
                      <button
                        type="button"
                        className="pulso-gv2-paleta-origen-quitar"
                        onClick={() => setPaletaVinculo(activaData.list_name, null)}
                        title={resolucionActiva?.origen === "propia"
                          ? `Su paleta propia manda; el vínculo con «${vinculoActivo}» no se usa.`
                          : undefined}
                      >
                        <Link2Off size={12} aria-hidden="true" /> Quitar vínculo con «{vinculoActivo}»
                      </button>
                    )}
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

/**
 * Paletas «sin lista en este instrumento» (ADR 0097): vienen de un perfil o de otro proyecto y ninguna lista las usa
 * por su nombre. Se muestran con sus colores, con qué listas las toman (vínculo u opciones) y con «Vincular a…», que
 * escribe `paletas_vinculos[list_name] = clave` en un paso deshacible. El vacío vive dentro del grupo (C3).
 */
export function PaletasHuerfanas({
  claves,
  total,
  paletas,
  vinculos,
  listas,
  listNames,
  onVincular,
}: {
  claves: string[];
  total: number;
  paletas: Record<string, Record<string, string>>;
  vinculos: Record<string, string>;
  listas: PaletaSugeridaEntry[];
  listNames: string[];
  onVincular: (listName: string, clave: string | null) => void;
}) {
  const tituloId = useId();
  return (
    <section
      className="pulso-gv2-paletas-huerfanas"
      aria-labelledby={tituloId}
      data-qa-geometry-group="graficos/paletas-huerfanas"
      data-qa-geometry-contract="equal"
    >
      <h4 id={tituloId} className="pulso-gv2-paletas-huerfanas-titulo">
        Sin lista en este instrumento
        <small>{total}</small>
      </h4>
      {claves.length === 0 ? (
        <p className="pulso-gv2-paletas-huerfanas-vacio" data-qa-geometry-capacity="owned">
          {total === 0
            ? "Todas las paletas guardadas son de listas de este instrumento."
            : "Ninguna paleta sin lista coincide con la búsqueda."}
        </p>
      ) : claves.map((clave) => {
        const paleta = paletas[clave] ?? {};
        const colores = Object.values(paleta).filter((c) => typeof c === "string" && c.trim() !== "");
        const usos = listasQueUsan(clave, listas, paletas, vinculos);
        const vinculadas = listNames.filter((ln) => vinculos[ln] === clave);
        const porOpciones = Array.from(new Set(usos.filter((u) => u.origen === "firma").map((u) => u.lista.list_name)));
        const disponibles = listNames.filter((ln) => vinculos[ln] !== clave);
        const selectId = `${tituloId}-${clave}`;
        return (
          <article key={clave} className="pulso-gv2-paleta-huerfana" data-qa-geometry-member>
            <header className="pulso-gv2-paleta-huerfana-cabeza">
              <code title={clave}>{clave}</code>
              <small>{colores.length} {colores.length === 1 ? "color" : "colores"}</small>
            </header>
            <span className="pulso-gv2-paleta-row-strip" aria-hidden="true">
              {colores.slice(0, 8).map((color, index) => (
                <span key={`${clave}-${index}`} style={{ background: color }} />
              ))}
            </span>
            {porOpciones.length > 0 && (
              <small className="pulso-gv2-paleta-huerfana-uso" title={porOpciones.join(", ")}>
                Por sus opciones: {porOpciones.join(", ")}
              </small>
            )}
            {vinculadas.length > 0 && (
              <ul className="pulso-gv2-paleta-huerfana-vinculos" aria-label={`Listas vinculadas a ${clave}`}>
                {vinculadas.map((ln) => (
                  <li key={ln}>
                    <Link2 size={11} aria-hidden="true" />
                    <code title={ln}>{ln}</code>
                    <button
                      type="button"
                      className="pulso-gv2-paleta-huerfana-quitar"
                      onClick={() => onVincular(ln, null)}
                      aria-label={`Quitar vínculo de ${ln} con ${clave}`}
                    >
                      <Link2Off size={11} aria-hidden="true" /> Quitar vínculo
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {disponibles.length > 0 && (
              <label className="pulso-gv2-paleta-huerfana-vincular" htmlFor={selectId}>
                <span className="pulso-sr-only">Vincular {clave} a una lista</span>
                <select
                  id={selectId}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) onVincular(e.target.value, clave);
                  }}
                >
                  <option value="">Vincular a…</option>
                  {disponibles.map((ln) => (
                    <option key={ln} value={ln}>
                      {ln}{vinculos[ln] ? ` (hoy con «${vinculos[ln]}»)` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </article>
        );
      })}
    </section>
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
