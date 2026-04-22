import { Navigate } from "react-router-dom";
import { useSession } from "../../lib/SessionContext";

// Entry point del módulo "Procesamiento de XLSForm".
//
// No tiene UI propia: redirige a la fase actionable actual basándose
// en el estado del estudio. La idea es que el usuario haga click en
// la tarjeta "Procesamiento" del Home y caiga exactamente donde
// corresponde seguir, sin tener que leer el topbar:
//
//   - Sin XLSForm  → /carga
//   - Con XLSForm, sin validar  → /validacion
//   - Validado, sin codificar  → /codificacion  (solo si tiene data)
//   - Codificado, sin preparar analítica  → /analitica
//   - Prep OK, sin exportar  → /graficos
//   - Todo listo  → /graficos (revisar / re-exportar)
//
// Si el Layout detecta que estamos en una ruta de "procesamiento"
// (ver `PROCESAMIENTO_PATHS` en Layout.tsx), despliega el topbar
// de las 5 fases arriba para que el usuario vea el contexto.

export default function ProcesamientoEntry() {
  const { state } = useSession();

  // Orden de fallback: si falta algo anterior, ahí va.
  if (!state?.xlsform || !state?.data) return <Navigate to="/carga" replace />;
  if (!state?.auditoria_run) return <Navigate to="/validacion" replace />;
  if (!state?.codif_aplicado) return <Navigate to="/codificacion" replace />;
  if (!state?.analitica_prep_ok) return <Navigate to="/analitica" replace />;
  return <Navigate to="/graficos" replace />;
}
