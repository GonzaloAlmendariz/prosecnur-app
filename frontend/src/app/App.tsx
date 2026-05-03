import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider } from "../lib/SessionContext";
import Layout from "./Layout";
import { SessionLostBanner } from "./SessionLostBanner";
import HomePage from "../features/home/HomePage";
import ProcesamientoEntry from "../features/home/ProcesamientoEntry";
import CargaPage from "../features/carga/CargaPage";
import ValidacionPage from "../features/validacion/ValidacionPage";
import CodificacionPage from "../features/codificacion/CodificacionPage";
import PreguntaDetalle from "../features/codificacion/PreguntaDetalle";
import AnaliticaPage from "../features/analitica/AnaliticaPage";
import GraficosPage from "../features/graficos/GraficosPage";
import HojasRutaPage from "../features/hojasRuta/HojasRutaPage";
import ProjectShell from "../features/project/ProjectShell";
import XlsformEditorPage from "../features/xlsformEditor/XlsformEditorPage";
import { AppErrorBoundary } from "../components/AppErrorBoundary";
import LogsPanel from "../components/LogsPanel";
import { LoadingBlock } from "../components/States";
import { install as installLogSink, note as logNote } from "../lib/logSink";
import { isPublicMode } from "../lib/runtime";

// Dashboard — code-split para no arrastrar plotly al bundle principal.
// Su payload solo se carga cuando el usuario entra a /tablero. La ruta
// se mantiene como `/tablero` por compatibilidad de URLs.
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage"));
const ROUTER_BASENAME =
  import.meta.env.BASE_URL && import.meta.env.BASE_URL !== "/"
    ? import.meta.env.BASE_URL.replace(/\/$/, "")
    : undefined;

// Instalar el log sink antes que cualquier render — captura console.*,
// window.error y unhandledrejection desde el primer momento.
installLogSink();

export default function App() {
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
            <Suspense fallback={<LoadingBlock label="Cargando dashboard…" />}>
              <DashboardPage publicMode />
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
              <Route path="/editor-xlsform" element={<XlsformEditorPage />} />
              <Route
                path="/tablero"
                element={
                  <Suspense fallback={<LoadingBlock label="Cargando dashboard…" />}>
                    <DashboardPage />
                  </Suspense>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
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
