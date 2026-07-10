import { type ReactNode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Power, Settings2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLayoutPreset } from "../../lib/layoutPreference";
import { useSession } from "../../lib/SessionContext";
import { useProjectShell } from "../project/ProjectShell";
import { useProjectModules } from "../project/ProjectModulesContext";
import { GlobalSettingsDialog } from "./GlobalSettingsDialog";
import { MissionControl, type ProcState } from "./MissionControl";
import { ModuleCarousel } from "./ModuleCarousel";
import { ModulePickerDialog } from "./ModulePickerDialog";
import {
  type ReleaseNote,
} from "./ReleaseNotesDrawer";
import "./home-v2.css";

// Home — menú principal de Prosecnur.
//
// Los 8 módulos son herramientas independientes (no fases obligatorias
// de un flujo): un usuario puede usar Hojas de Ruta sin haber tocado
// Procesamiento. El layout y el peso visual reflejan esa independencia.
//
// Layout:
//   1. ModulesDeck — carrusel cinematográfico con detalle visible.
//   2. Footer — atribución, notas, cerrar.
//   3. Drawer lateral derecho — historial completo de release notes.
//
// Los estilos viven en `app/theme.css` con prefijo `.home-*`.
// El motion reusa los tokens centralizados (--motion-dur-*, --motion-ease-out).

// ---- Notas de la versión --------------------------------------------
const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "0.4.0",
    date: "2026-06-22",
    highlights: [
      "Cálculo de muestra: amplía el flujo de marcos, aulas, acreditación y escenarios con persistencia más robusta.",
      "Carga: suma entradas directas desde plataformas, mejor soporte para ZIP/SAV y controles de fuentes multibase.",
      "Codificación y reportes: incorpora importación Excel de categorizaciones y ficha técnica metodológica exportable.",
      "Dashboard, Analítica, Gráficos y Hojas de ruta: consolida mejoras visuales y operativas acumuladas para el nuevo corte.",
      "Monitoreo: este corte mantiene fuera los últimos cambios en desarrollo del módulo.",
    ],
  },
  {
    version: "3.3.4",
    date: "2026-06-11",
    highlights: [
      "Carga: mantiene la actualizacion incremental SurveyMonkey por fuente principal y campanas/canales persistidos.",
      "Consentimiento: conserva el conteo de registros validos bajo pregunta y opcion aprobatoria.",
      "Monitoreo: ajusta la nomenclatura territorial a registros validos, no validos y casos por revisar.",
      "Monitoreo: pule visualmente los indicadores GPS, duracion y resumen territorial.",
      "Deploy: estabiliza el empaquetado macOS local sin firma/notarizacion automatica.",
    ],
  },
  {
    version: "3.3.3",
    date: "2026-06-11",
    highlights: [
      "Carga: actualiza respuestas SurveyMonkey de bases ya trabajadas sin reemplazar datos locales y reporta registros validos nuevos.",
      "SurveyMonkey multibase: permite agregar campanas/canales a una base existente, persistirlas y refrescarlas junto con la fuente principal.",
      "Consentimiento: muestra la pregunta y opcion aprobatoria que definen los registros validos en Carga/Bases.",
      "Codificacion: conserva el avance y relanza la reaplicacion cuando entran respuestas nuevas.",
      "Monitoreo: incorpora Google Sheets como superficie operativa controlada para publicar salidas Prosecnur sin modificar la hoja viva de campo.",
      "Monitoreo: refuerza taxonomia de estados, consultas internas, fuentes multiples y documentacion arquitectonica del centro operativo.",
    ],
  },
  {
    version: "3.3.1",
    date: "2026-06-05",
    highlights: [
      "Graficos: muestra el selector de iconos en Contenido para los slides con icono y toma los PNG subidos en Configuracion global.",
      "Graficos: evita que etiquetas o titulos guardados como objetos vacios rompan la pantalla al volver a /graficos.",
      "Graficos: estabiliza titulos automaticos y manuales para que el titulo del grafico se mantenga en preview, PPT y Word.",
      "Editor visual: corrige la X del canvas dinamico para que no compita con separadores ni cambie de icono al hacer click.",
      "Paletas: aplica colores por lista en preview/export y muestra listas de todas las fuentes en proyectos multibase.",
      "Word/PPT: refuerza presets, leyendas y composicion de graficos apilados, agrupados, numericos, pie, radar y reportes Word.",
      "Analitica multibase: mejora la seleccion y recuperacion de bases procesadas para reducir estados incompletos.",
    ],
  },
  {
    version: "0.3.2",
    date: "2026-06-04",
    highlights: [
      "Hojas de ruta: corrige el layout del PDF integrado para que la tabla de recorrido no se corte ni choque con el pie de pagina.",
      "Revision final: evita que las tablas anchas atrapen el scroll vertical cuando se revisan titulares y reemplazos.",
      "Inspector de zonas: estabiliza las tarjetas de zonas para que viviendas, personas, estado y accion no se superpongan.",
    ],
  },
  {
    version: "0.3.1",
    date: "2026-06-04",
    highlights: [
      "Carga multibase: aplica la logica XLSForm de una base plantilla a hermanas compatibles, incluyendo relevant, constraint, required, choice_filter y calculation.",
      "SurveyMonkey multibase: importa hermanas independientes desde una o varias campañas, con estrategia de recoleccion y exclusiones de validacion por fuente.",
      "Validacion: enmascara reglas por fila/fuente para evitar falsos positivos cuando preguntas administrativas no aplican a fuentes autoadministradas.",
      "Hojas de ruta: separa fases piloto y campo real, refuerza el resumen de fuentes/configuracion y conserva snapshots mas trazables.",
      "Drilldown y visualizacion: mejora la inspeccion de reglas, el panel de detalle y el render Plotly para flujos de validacion mas exigentes.",
      "Graficos: recupera fuentes procesadas validas cuando el cache queda incompleto y evita que listas invalidas lleguen al motor de reportes.",
      "Reportes Word/PPT: usa etiquetas XLSForm como titulos por defecto y limpia sufijos de variables recodificadas en el indice Word.",
      "Documentacion y pruebas: agrega ADR 0009, actualiza arquitectura multibase y suma cobertura R/React para los nuevos contratos.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-06-02",
    highlights: [
      "Arquitectura canonica: guia principal y ADRs para app local, formato .pulso, secretos fuera del proyecto, modulos por dominio, integraciones salientes y auditoria reproducible.",
      "Auditoria canonica: nuevo proyecto .pulso sintetico, comandos Make y smoke de Electron para diagnosticar regresiones con capturas, sid, puerto y checksum aislados.",
      "Conexiones: Configuracion centraliza SurveyMonkey, Kobo y Google Sheets, guarda credenciales fuera del .pulso, soporta perfiles SurveyMonkey y solo expone mascaras al frontend.",
      "Multibase y monitoreo: mejor importacion de familias SurveyMonkey, bases hermanas independientes, sincronizacion de fuentes, seleccion de base activa y motores mas defensivos.",
      "Home y shell: nuevo deck de modulos, Ajustes con notas/creditos/conexiones, catalogo de modulos compartido y estados de proyecto mas claros.",
      "Calidad del release: mas pruebas frontend/R para cliente API, carga multibase, codificacion, analitica, persistencia .pulso, secretos y auditoria.",
    ],
  },
  {
    version: "0.14",
    date: "2026-05-03",
    highlights: [
      "Nuevo módulo Hojas de ruta: valida columnas de campo, arma cuotas por UMP, previsualiza mapas faltantes y genera un ZIP con PDFs listos para impresión.",
      "Editor XLSForm + SurveyMonkey: importación API-only más fiel, matrices y opciones “Otro” mejor interpretadas, lógica avanzada aplicable al formulario actual y nuevo asistente visual de saltos.",
      "Gráficos: inspector V2 reorganizado, controles visuales para colores por serie y criterios, presets Word sin JSON crudo, auto-layout/canvas más estable y leyendas configurables arriba/abajo/lados.",
      "Analítica: frecuencias y cruces ganan opciones para ocultar títulos/secciones, mejor manejo de categorías y select_multiple, filtros nombrados más robustos y UI de configuración más clara.",
      "Carga y normalización: aliases q→p, padding de opciones y reconstrucción de select_multiple se muestran en la vista previa; columnas extra quedan identificadas.",
      "Codificación y validación: textos abiertos independientes se pueden recodificar, la base adaptada alimenta Analítica automáticamente y las reglas/preview toleran mejor labels, fechas, regex y expresiones select_multiple.",
    ],
  },
  {
    version: "0.13",
    date: "2026-05-02",
    highlights: [
      "Independencia entre proyectos: fix de fuga de estado al cambiar de .pulso (Dashboard/Analítica/Gráficos/Wizard de Dimensiones se resetean al cambiar sid).",
      "StartModal rediseñado: solo Nuevo proyecto + Abrir proyecto + lista de Recientes con papelera (no borra el archivo, solo lo quita de la lista).",
      "Modo navegador desbloqueado: abrir/crear .pulso por path manual sin Electron.",
      "Editor de XLSForms: el export se guarda automáticamente en la carpeta del proyecto en vez de ~/Downloads.",
      "Home: grid de módulos 3×2 con sexto slot reservado.",
      "Fix Limpieza y normalización: el endpoint ya no se cae con E_INTERNAL al serializar evaluacion_final.",
      "Fix Codificación: preview de respuestas con un solo elemento ya no rompe la UI.",
      "Fix bootstrap: la app adopta el .pulso preload aunque jsonlite serialice NULL como `{}`.",
    ],
  },
  {
    version: "0.12",
    date: "2026-04-28",
    highlights: [
      "Dashboard exporta como HTML autosuficiente con WebR (R en el navegador, sin servidor).",
      "Bridge WebR para modo standalone: cómputo R nativo dentro del .html exportado.",
    ],
  },
  {
    version: "0.11",
    date: "2026-04-28",
    highlights: [
      "Dashboard: vista previa, paleta UI, recodificación por variable, override de vars.",
      "Revamp UX: toolbar afuera del canvas, marca con múltiples logos, sidebar Dimensiones rediseñado.",
      "Vista FODA Lectura como modo pedagógico.",
      "Avances en analítica/dimensiones, gráficos v2 y router del proyecto en R API.",
    ],
  },
  {
    version: "0.10",
    date: "2026-04-27",
    highlights: [
      "Dashboard fullscreen transversal, con skeleton de filtros y tests del semáforo.",
      "Barras h/v/facet, radar polygonal con modos/animado, FODA polish.",
      "Semáforo configurable, leyendas centradas, IterStepper, % fuera de barra.",
      "Chip rectangular al final de cada barra, FODA legacy preservado.",
      "Plotly como un solo chunk compartido (~4.6 MB) entre features.",
      "SessionChip resiliente a sessionId no-string + setter defensivo.",
    ],
  },
  {
    version: "0.9",
    date: "2026-04-26",
    highlights: [
      "Dashboard /tablero independiente, con paletas y reglas de diseño Emil aplicadas.",
      "Pestañas Relaciones y Base de datos con persistencia en el .pulso.",
      "Pestaña Dimensiones con heatmap semáforo, radar y barras.",
      "FODA scatter flotante + barras ordenadas con chip semáforo.",
      "Pasada de fidelidad al legacy reporte_interactivo.",
      "Curaduría preservada al reabrir un .pulso.",
    ],
  },
  {
    version: "0.8",
    date: "2026-04-21",
    highlights: [
      "Home rediseñado como menú de módulos — Prosecnur como suite multi-propósito.",
      "Notas de versión integradas con historial colapsable.",
      "Confirmación al cerrar la app para no perder progreso.",
    ],
  },
  {
    version: "0.7",
    date: "2026-04-20",
    highlights: [
      "Sistema de diseño unificado: tokens de status, primitivos compartidos, sin hex hardcoded en Fases 3/4/5.",
      "Color picker integrado en presets con paletas del estudio.",
      "Textos en negrita con multi-select de chips.",
      "Hot-reload del engine R sin reiniciar el proceso.",
    ],
  },
  {
    version: "0.6",
    date: "2026-04-18",
    highlights: [
      "Overrides defaults persistentes simétricos a presets defaults.",
      "DefaultsModal accesible desde el engranaje de Configuración global.",
    ],
  },
];

// ---- Atribución ------------------------------------------------------
const PULSO_FULL_NAME =
  "Instituto de Analítica Social e Inteligencia Estratégica de la Pontificia Universidad Católica del Perú (PULSO PUCP)";

// ---- Estado del módulo "Procesamiento" ------------------------------
function useProcesamientoState(): ProcState {
  const { state } = useSession();
  const phases = [
    { done: !!state?.xlsform && !!state?.data },
    { done: !!state?.auditoria_run },
    { done: !!state?.codif_aplicado },
    { done: !!state?.analitica_prep_ok },
    { done: !!state?.graficos_ppt_ok || !!state?.graficos_word_ok },
  ];
  let done = 0;
  for (const phase of phases) {
    if (!phase.done) break;
    done += 1;
  }
  // Sub-salidas de Analítica generadas (progreso característico dentro de la fase).
  const analiticaFlags = [
    state?.analitica_codebook_ok,
    state?.analitica_frecuencias_ok,
    state?.analitica_cruces_ok,
    state?.analitica_dim_ok,
    state?.analitica_panel_ok,
    state?.analitica_ficha_tecnica_ok,
    state?.analitica_spss_ok,
    state?.analitica_enumeradores_ok,
    state?.analitica_multibase_ok,
  ];
  return {
    done,
    total: phases.length,
    analiticaDone: analiticaFlags.filter(Boolean).length,
    analiticaTotal: analiticaFlags.length,
    ppt: !!state?.graficos_ppt_ok,
    word: !!state?.graficos_word_ok,
  };
}

// =====================================================================
// Componente principal
// =====================================================================
export default function HomePage() {
  const { version } = useSession();
  const { requestAppExit } = useProjectShell();
  const location = useLocation();
  const navigate = useNavigate();
  const proc = useProcesamientoState();
  const [layoutPreset] = useLayoutPreset();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { overview, loading, addedSlugs, addModule, removeModule } = useProjectModules();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("settings") === "connections" || params.get("settings") === "configuracion") {
      setSettingsOpen(true);
    }
    if (params.get("agregar") === "1") setPickerOpen(true);
  }, [location.search]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closePicker();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen]);

  const hasModules = addedSlugs.length > 0;

  const picker = useMemo(
    () => ({
      isAdded: (slug: string) => addedSlugs.includes(slug),
      onAdd: addModule,
      onRemove: removeModule,
    }),
    [addedSlugs, addModule, removeModule],
  );

  function closePicker() {
    setPickerOpen(false);
    const params = new URLSearchParams(location.search);
    if (params.has("agregar")) {
      params.delete("agregar");
      navigate({ pathname: "/", search: params.toString() ? `?${params.toString()}` : "" }, { replace: true });
    }
  }

  let content: ReactNode;
  if (loading && !overview) {
    content = <div className="home-suite"><MissionControlSkeleton /></div>;
  } else if (hasModules && overview) {
    content = (
      <div className="home-suite">
        <MissionControl
          overview={overview}
          proc={proc}
          addedSlugs={addedSlugs}
          onAddModule={() => setPickerOpen(true)}
          onRemoveModule={removeModule}
        />
      </div>
    );
  } else {
    content = (
      <div className="home-setup">
        <header className="home-setup-head">
          <p className="home-setup-kicker">Nuevo proyecto</p>
          <h1>Arma tu proyecto</h1>
          <p className="home-setup-sub">
            Elige los módulos que vas a usar. Puedes sumar o quitar módulos cuando quieras.
          </p>
        </header>
        <ModuleCarousel picker={picker} />
      </div>
    );
  }

  return (
    <div className="home-wrap" data-layout-preset={layoutPreset} data-home-mode={hasModules ? "mission" : "setup"}>
      {content}

      <HomeFooter
        version={version}
        onClose={requestAppExit}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <GlobalSettingsDialog
        open={settingsOpen}
        notes={RELEASE_NOTES}
        pulsoName={PULSO_FULL_NAME}
        onClose={() => setSettingsOpen(false)}
      />

      {pickerOpen && hasModules && createPortal(
        <ModulePickerDialog picker={picker} onClose={closePicker} />,
        document.body,
      )}
    </div>
  );
}

// Placeholder discreto mientras resuelve el overview (solo cuando la señal
// optimista ya indicó proyecto en curso, para no parpadear al carrusel).
function MissionControlSkeleton() {
  return (
    <section className="home-mission is-loading" aria-hidden="true">
      <div className="home-mission-metrics">
        {[0, 1, 2, 3].map((i) => (
          <div className="home-mc-stat is-skeleton" key={i} />
        ))}
      </div>
      <div className="home-mission-grid">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div className="home-mc-card is-skeleton" key={i} />
        ))}
      </div>
    </section>
  );
}

// =====================================================================
// Footer — versión + autor + abrir notas + cerrar app
// =====================================================================
function HomeFooter({
  version,
  onClose,
  onOpenSettings,
}: {
  version: string;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <footer className="home-footer">
      <div className="home-footer-attr">
        <span>Prosecnur{version && version !== "…" ? ` · ${version}` : ""}</span>
        <span aria-hidden="true">·</span>
        <span>Hecho para el {PULSO_FULL_NAME}</span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="home-footer-notes"
          onClick={onOpenSettings}
        >
          <Settings2 size={11} /> Configuración
        </button>
        <button type="button" className="home-footer-quit" onClick={onClose}>
          <Power size={11} /> Cerrar aplicación
        </button>
      </div>
    </footer>
  );
}
