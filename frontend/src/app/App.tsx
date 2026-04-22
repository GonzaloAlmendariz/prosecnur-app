import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider } from "../lib/SessionContext";
import Layout from "./Layout";
import { SessionLostBanner } from "./SessionLostBanner";
import HomePage from "../features/dashboard/HomePage";
import CargaPage from "../features/carga/CargaPage";
import ValidacionPage from "../features/validacion/ValidacionPage";
import CodificacionPage from "../features/codificacion/CodificacionPage";
import PreguntaDetalle from "../features/codificacion/PreguntaDetalle";
import AnaliticaPage from "../features/analitica/AnaliticaPage";
import GraficosPage from "../features/graficos/GraficosPage";

export default function App() {
  return (
    <SessionProvider>
      <SessionLostBanner />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/carga" element={<CargaPage />} />
            <Route path="/validacion" element={<ValidacionPage />} />
            <Route path="/codificacion" element={<CodificacionPage />} />
            <Route path="/codificacion/preguntas/:parent" element={<PreguntaDetalle />} />
            <Route path="/analitica" element={<AnaliticaPage />} />
            <Route path="/graficos" element={<GraficosPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
