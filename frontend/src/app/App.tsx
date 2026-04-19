import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider } from "../lib/SessionContext";
import Layout from "./Layout";
import CargaPage from "../features/carga/CargaPage";
import ValidacionPage from "../features/validacion/ValidacionPage";
import CodificacionPage from "../features/codificacion/CodificacionPage";
import AnaliticaPage from "../features/analitica/AnaliticaPage";

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/carga" replace />} />
            <Route path="/carga" element={<CargaPage />} />
            <Route path="/validacion" element={<ValidacionPage />} />
            <Route path="/codificacion" element={<CodificacionPage />} />
            <Route path="/analitica" element={<AnaliticaPage />} />
            <Route path="*" element={<Navigate to="/carga" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
