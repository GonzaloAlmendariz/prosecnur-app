import { Navigate } from "react-router-dom";

// Ruta heredada. El modulo de muestra ahora vive como una herramienta unica
// de diagnostico y diseno muestral profesional.
export default function MuestraHub() {
  return <Navigate to="/calc-muestra" replace />;
}
