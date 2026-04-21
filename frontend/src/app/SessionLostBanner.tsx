import { useEffect, useState } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { useSession } from "../lib/SessionContext";

// Banner global que aparece cuando el backend deja de reconocer el `sid`
// que el browser tiene en localStorage. Típicamente pasa cuando el backend
// se reinició (sesiones viven en memoria, no se persisten) y el browser
// sigue mandando el sid viejo.
//
// Visualmente ocupa todo el ancho arriba de la app, con un botón de
// "Recargar página" prominente. Recargar ejecuta `apiCreateSession()`
// de cero, lo que le da un sid nuevo — el usuario tendrá que re-subir
// XLSForm + data desde Fase 1, pero al menos la app vuelve a responder.
//
// No cerrable: mientras la sesión siga inválida, cualquier request
// falla, no tiene sentido ocultar el banner.

export function SessionLostBanner() {
  const { sessionLost } = useSession();
  const [mounted, setMounted] = useState(false);

  // Pequeño delay para que el banner slide-in suavemente cuando aparece.
  useEffect(() => {
    if (sessionLost) {
      const t = setTimeout(() => setMounted(true), 20);
      return () => clearTimeout(t);
    }
    setMounted(false);
  }, [sessionLost]);

  if (!sessionLost) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "sticky", top: 0, zIndex: 50,
        width: "100%",
        background: "#fef2f2",
        borderBottom: "1px solid #fecaca",
        color: "#991b1b",
        padding: "10px 18px",
        display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        transform: mounted ? "translateY(0)" : "translateY(-6px)",
        opacity: mounted ? 1 : 0,
        transition: "transform 180ms ease, opacity 180ms ease",
      }}
    >
      <AlertTriangle size={16} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.5 }}>
        <strong>Tu sesión se reinició.</strong>{" "}
        El backend no reconoce el identificador de tu sesión actual (quizá se
        reinició el servidor, o la sesión expiró). Recarga la página y vuelve
        a cargar XLSForm + data en la Fase 1 para continuar.
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 12, fontWeight: 700,
          padding: "7px 14px",
          border: "1px solid #991b1b",
          borderRadius: 6,
          background: "#991b1b",
          color: "white",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <RotateCw size={13} />
        Recargar página
      </button>
    </div>
  );
}
