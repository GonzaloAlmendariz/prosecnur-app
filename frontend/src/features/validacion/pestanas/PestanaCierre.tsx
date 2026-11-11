/**
 * Pestaña Cierre de Validación (ADR 0142, rebanada V2 de P6).
 *
 * Montaje de transición: la banda de cierre de "Cierre de base" ("Cerrar y
 * generar base", con su barra de decisiones solo informativa), los archivos
 * del cierre, el efecto de las decisiones y la promoción de la base, y debajo
 * el paquete metodológico, que antes era un botón del paso 1 de "Reglas del
 * formulario". V5 rehace esta pestaña con la cadena de casos.
 */
import { AlertTriangle } from "../../../vendor/lucide-react";
import { EmptyState, LoadingBlock } from "../../../components/States";
import { useMesaDeLimpieza } from "../limpieza/useMesaDeLimpieza";
import CierreDeBase from "../limpieza/CierreDeBase";
import AvisosDeLimpieza from "../limpieza/AvisosDeLimpieza";
import PaqueteMetodologico from "../limpieza/PaqueteMetodologico";
import { useValidacionStore } from "../store";
import { usePestanaValidacion } from "../pestanaDireccionable";
import CabeceraDeTransicion from "./CabeceraDeTransicion";
import { cabeceraDeCierre } from "./cabeceraDeValidacion";

const COLUMNA = { display: "flex", flexDirection: "column", gap: "var(--pulso-space-4)", minWidth: 0 } as const;

export default function PestanaCierre() {
  const mesa = useMesaDeLimpieza();
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const { irAPestana } = usePestanaValidacion();
  const { loading, error, data } = mesa;

  // Mientras carga, la cabecera ya está y el bloque de carga ocupa el cuerpo.
  // Sin marca de readiness: la pestaña todavía no tiene contenido.
  if (loading) {
    return (
      <div className="pulso-validacion-pestana-cierre" style={COLUMNA}>
        <CabeceraDeTransicion pestana="cierre" {...cabeceraDeCierre(null)} />
        <LoadingBlock label="Cargando el cierre" />
      </div>
    );
  }

  const auditReady = !!data?.progreso.auditoria_corrida;

  return (
    <div
      className="pulso-validacion-pestana-cierre"
      data-audit-ready="validacion-cierre"
      style={COLUMNA}
    >
      <CabeceraDeTransicion pestana="cierre" {...cabeceraDeCierre(data)} />
      {error ? (
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="No se pudo cargar la sección"
          hint={error}
        />
      ) : data ? (
        <>
          <CierreDeBase mesa={mesa} auditReady={auditReady} />
          <AvisosDeLimpieza
            mesa={mesa}
            auditReady={auditReady}
            conPreservadas={false}
            onIrAHallazgos={() => irAPestana("hallazgos")}
          />
        </>
      ) : null}
      <PaqueteMetodologico baseNombre={baseNombre} planConstruido={!!data?.progreso.plan_construido} />
    </div>
  );
}
