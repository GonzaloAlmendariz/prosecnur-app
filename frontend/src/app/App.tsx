import { Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider } from "../lib/SessionContext";
import Layout from "./Layout";
import { SessionLostBanner } from "./SessionLostBanner";
import ProjectShell from "../features/project/ProjectShell";
import { AppErrorBoundary } from "../components/AppErrorBoundary";
import LogsPanel from "../components/LogsPanel";
import { LoadingBlock } from "../components/States";
import MonitoreoPage from "virtual:monitoreo-page";
import { install as installLogSink, note as logNote } from "../lib/logSink";
import { lazyWithReload } from "../lib/lazyWithReload";
import { isPublicMode } from "../lib/runtime";
import { useApplyLayoutPreset } from "../lib/layoutPreference";

// Dashboard — code-split para no arrastrar plotly al bundle principal.
// Su payload solo se carga cuando el usuario entra a /tablero. La ruta
// se mantiene como `/tablero` por compatibilidad de URLs.
const DashboardPage = lazyWithReload(
  () => import("../features/dashboard/DashboardPage"),
  "DashboardPage",
);
const PublicArtifactApp = lazyWithReload(
  () => import("./PublicArtifactApp"),
  "PublicArtifactApp",
);
const ROUTER_BASENAME =
  import.meta.env.BASE_URL && import.meta.env.BASE_URL !== "/"
    ? import.meta.env.BASE_URL.replace(/\/$/, "")
    : undefined;

// Instalar el log sink antes que cualquier render — captura console.*,
// window.error y unhandledrejection desde el primer momento.
installLogSink();

const HomePage = lazyWithReload(
  () => import("../features/home/HomePage"),
  "HomePage",
);
const ProcesamientoEntry = lazyWithReload(
  () => import("../features/home/ProcesamientoEntry"),
  "ProcesamientoEntry",
);
const CargaPage = lazyWithReload(
  () => import("../features/carga/CargaPage"),
  "CargaPage",
);
const ValidacionPage = lazyWithReload(
  () => import("../features/validacion/ValidacionPage"),
  "ValidacionPage",
);
const CodificacionPage = lazyWithReload(
  () => import("../features/codificacion/CodificacionPage"),
  "CodificacionPage",
);
const PreguntaDetalle = lazyWithReload(
  () => import("../features/codificacion/PreguntaDetalle"),
  "PreguntaDetalle",
);
const AnaliticaPage = lazyWithReload(
  () => import("../features/analitica/AnaliticaPage"),
  "AnaliticaPage",
);
const GraficosPage = lazyWithReload(
  () => import("../features/graficos/GraficosPage"),
  "GraficosPage",
);
const HojasRutaPage = lazyWithReload(
  () => import("../features/hojasRuta/HojasRutaPage"),
  "HojasRutaPage",
);
const MuestraHub = lazyWithReload(
  () => import("../features/muestra/MuestraHub"),
  "MuestraHub",
);
const EnciclopediaHome = lazyWithReload(
  () => import("../features/enciclopedia/EnciclopediaHome"),
  "EnciclopediaHome",
);
const FichaMetodologica = lazyWithReload(
  () => import("../features/enciclopedia/FichaMetodologica"),
  "FichaMetodologica",
);
const CalcMuestraPage = lazyWithReload(
  () => import("../features/calcMuestra/CalcMuestraPage"),
  "CalcMuestraPage",
);
const XlsformEditorPage = lazyWithReload(
  () => import("../features/xlsformEditor/XlsformEditorPage"),
  "XlsformEditorPage",
);

export default function App() {
  useApplyLayoutPreset();

  useEffect(() => {
    logNote("App montado", "info");
  }, []);

  // Modo público (deploy web a HF Spaces / Fly): backend Plumber real
  // pero UI sin shell admin. Sí necesita SessionProvider porque arma
  // el sid vía /api/system/bootstrap (el server arranca con
  // PULSO_BOOTSTRAP_PROJECT y todos los visitantes comparten el sid).
  if (isPublicMode()) {
    return (
      <AppErrorBoundary>
        <SessionProvider>
          <SessionLostBanner />
          <div className="pulso-public-shell">
            <Suspense fallback={<LoadingBlock label="Cargando publicacion..." />}>
              <PublicArtifactApp />
            </Suspense>
            <footer className="pulso-public-footer">
              <span>Elaborado con Prosecnur</span>
              <span className="pulso-public-footer-dot" aria-hidden="true" />
              <span>Pulso PUCP {new Date().getFullYear()}</span>
            </footer>
          </div>
        </SessionProvider>
        <LogsPanel />
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
      <SessionProvider>
        <ProjectShell>
          <SessionLostBanner />
          <BrowserRouter basename={ROUTER_BASENAME}>
            <Suspense fallback={<LoadingBlock label="Abriendo modulo..." />}>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<HomePage />} />
                  {/* Entry point del módulo "Procesamiento" — redirige a la
                      fase actionable según el estado del estudio. */}
                  <Route path="/procesamiento" element={<ProcesamientoEntry />} />
                  <Route path="/carga" element={<CargaPage />} />
                  <Route path="/validacion" element={<ValidacionPage />} />
                  <Route path="/codificacion" element={<CodificacionPage />} />
                  <Route path="/codificacion/preguntas/:parent" element={<PreguntaDetalle />} />
                  <Route path="/analitica" element={<AnaliticaPage />} />
                  <Route path="/graficos" element={<GraficosPage />} />
                  <Route path="/hojas-ruta" element={<HojasRutaPage />} />
                  <Route path="/calc-muestra" element={<CalcMuestraPage />} />
                  <Route path="/diseno-muestra" element={<Navigate to="/calc-muestra" replace />} />
                  <Route path="/diseno-muestra/metodologia/:metodologia" element={<Navigate to="/calc-muestra" replace />} />
                  <Route path="/enciclopedia" element={<EnciclopediaHome />} />
                  <Route path="/enciclopedia/metodologia/:id" element={<FichaMetodologica />} />
                  <Route path="/muestra" element={<MuestraHub />} />
                  <Route path="/muestra-aulas" element={<Navigate to="/calc-muestra" replace />} />
                  <Route path="/monitoreo" element={<MonitoreoPage />} />
                  <Route path="/editor-xlsform" element={<XlsformEditorPage />} />
                  <Route path="/tablero" element={<DashboardPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ProjectShell>
      </SessionProvider>
      {/* Panel de logs accesible siempre con Cmd/Ctrl+Shift+L. Vive fuera
          del router/SessionProvider para que también esté disponible
          cuando la sesión está rota. */}
      <LogsPanel />
    </AppErrorBoundary>
  );
}
