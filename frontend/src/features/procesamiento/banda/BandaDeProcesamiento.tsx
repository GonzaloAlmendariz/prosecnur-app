// Piezas propias de la banda de Procesamiento (prototipo `tmp/revamp-procesamiento/shell.js`):
// la cifra de casos que cuentan junto al selector de base y el acceso a "Estado
// del estudio" en la zona de acciones. El selector de base sigue siendo el que
// cada sección publica en la ranura de contexto (`ChromeBaseSelector`) y las
// secciones son el `SectionPillbar` del shell: aquí no se duplica ninguno.

import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { apiV2Limpieza } from "../../../api/validacion";
import { normalizarCierre } from "../../../api/validacionCierre";
import { useSession } from "../../../lib/SessionContext";
import { LayoutGrid } from "../../../vendor/lucide-react";
import { casosQueCuentan, type CasosQueCuentan } from "./casosQueCuentanModel";
import "./banda.css";

type Lectura = { fase: "cargando" } | { fase: "lista"; casos: CasosQueCuentan | null };

/**
 * Lee la cadena de casos de la base activa. Vive en el shell, que no se remonta
 * al cambiar de sección: se relee al cambiar de base, de sesión o de sección
 * (en Validación las decisiones cambian la cifra).
 */
function useCasosQueCuentan(habilitado: boolean): Lectura {
  const { state } = useSession();
  const { pathname } = useLocation();
  const [lectura, setLectura] = useState<Lectura>({ fase: "cargando" });
  const [version, setVersion] = useState(0);
  const turno = useRef(0);
  const conDatos = Boolean(state?.xlsform && state?.data);
  const baseActiva = state?.active_base ?? null;
  // La auditoría abre la cadena de casos: al terminar, la sesión lo marca y la cifra se relee.
  const auditada = Boolean(state?.auditoria_run);

  useEffect(() => {
    const releer = () => setVersion((v) => v + 1);
    window.addEventListener("pulso:active-base-changed", releer);
    window.addEventListener("pulso:session-changed", releer);
    return () => {
      window.removeEventListener("pulso:active-base-changed", releer);
      window.removeEventListener("pulso:session-changed", releer);
    };
  }, []);

  useEffect(() => {
    const mio = ++turno.current;
    if (!habilitado || !conDatos) {
      setLectura({ fase: "lista", casos: null });
      return;
    }
    void (async () => {
      try {
        const data = await apiV2Limpieza(baseActiva);
        if (mio !== turno.current) return;
        const cierre = normalizarCierre(data.cierre);
        setLectura({ fase: "lista", casos: casosQueCuentan(cierre?.cadena_casos ?? null) });
      } catch {
        // Sin limpieza legible la cifra no se afirma: la pieza no se dibuja.
        if (mio === turno.current) setLectura({ fase: "lista", casos: null });
      }
    })();
  }, [habilitado, conDatos, baseActiva, auditada, pathname, version]);

  return lectura;
}

export function CasosQueCuentanEnBanda({ visible }: { visible: boolean }) {
  const lectura = useCasosQueCuentan(visible);
  if (!visible || lectura.fase !== "lista" || !lectura.casos) return null;
  const { cuentanTexto, deRecibidos, cola, detalle } = lectura.casos;
  return (
    <span className="pulso-banda-casos" role="status" title={detalle} aria-label={detalle} data-banda-casos="lista">
      <b aria-hidden="true">{cuentanTexto}</b>
      <span className="pulso-banda-casos-de" aria-hidden="true">{deRecibidos}</span>
      <span className="pulso-banda-casos-resto" aria-hidden="true">{cola}</span>
    </span>
  );
}

export function EstadoDelEstudioEnBanda() {
  return (
    <NavLink
      to="/procesamiento"
      end
      className={({ isActive }) => [
        "pulso-button pulso-button--secondary pulso-button--sm pulso-banda-estado",
        isActive ? "is-active" : "",
      ].filter(Boolean).join(" ")}
      title="Estado del estudio"
    >
      <LayoutGrid size={14} aria-hidden="true" />
      <span className="pulso-banda-estado-texto">Estado del estudio</span>
    </NavLink>
  );
}
