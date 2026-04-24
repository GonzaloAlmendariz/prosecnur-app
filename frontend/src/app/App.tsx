import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider } from "../lib/SessionContext";
import Layout from "./Layout";
import { SessionLostBanner } from "./SessionLostBanner";
import HomePage from "../features/dashboard/HomePage";
import ProcesamientoEntry from "../features/dashboard/ProcesamientoEntry";
import CargaPage from "../features/carga/CargaPage";
import ValidacionPage from "../features/validacion/ValidacionPage";
import CodificacionPage from "../features/codificacion/CodificacionPage";
import PreguntaDetalle from "../features/codificacion/PreguntaDetalle";
import AnaliticaPage from "../features/analitica/AnaliticaPage";
import GraficosPage from "../features/graficos/GraficosPage";
import ProjectShell from "../features/project/ProjectShell";
import XlsformEditorPage from "../features/xlsformEditor/XlsformEditorPage";
import { AppErrorBoundary } from "../components/AppErrorBoundary";
import LogsPanel from "../components/LogsPanel";
import { install as installLogSink, note as logNote } from "../lib/logSink";

// Instalar el log sink antes que cualquier render — captura console.*,
// window.error y unhandledrejection desde el primer momento.
installLogSink();

export default function App() {
  useEffect(() => {
    logNote("App montado", "info");
  }, []);

  return (
    <AppErrorBoundary>
      <SessionProvider>
        <ProjectShell>
          <SessionLostBanner />
          <BrowserRouter>
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
              <Route path="/editor-xlsform" element={<XlsformEditorPage />} />
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
