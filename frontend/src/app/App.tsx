import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider } from "../lib/SessionContext";
import Layout from "./Layout";
import CargaPage from "../features/carga/CargaPage";
import ValidacionPage from "../features/validacion/ValidacionPage";

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/carga" replace />} />
            <Route path="/carga" element={<CargaPage />} />
            <Route path="/validacion" element={<ValidacionPage />} />
            <Route path="*" element={<Navigate to="/carga" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
