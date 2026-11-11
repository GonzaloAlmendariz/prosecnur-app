/**
 * Pestaña Hallazgos de Validación (ADR 0142, rebanada V2 de P6).
 *
 * Montaje de transición, con las piezas de V1 sin rehacer:
 *   1. La auditoría (antes paso 2 de "Reglas del formulario"): variables fuera
 *      de auditoría y el botón que corre el plan.
 *   2. La mesa de decisión (antes "Cierre de base"): la banda de estado, que
 *      aquí filtra la cola por tipo de decisión y no cierra la base, los avisos
 *      y la cola con el editor de la decisión.
 *   3. Los resultados de la auditoría (antes paso 3): cifras, gráficos y las
 *      reglas agrupadas, cada una con su panel (`panel=regla&foco=<id>`).
 * V4 rehace esta pestaña con la vista según el tipo de hallazgo.
 *
 * El plan y la mesa cargan por separado: ninguna espera a la otra para
 * pintarse. La marca de la pestaña va en la raíz y la carga de bloque del kit
 * (`CargaDeBloque`) la retiene mientras cualquiera de las dos carga.
 */
import { useRef } from "react";
import { AlertTriangle, ListChecks } from "../../../vendor/lucide-react";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../../components/States";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { useInstrumento } from "../instrumento/useInstrumento";
import AuditoriaDelFormulario from "../instrumento/AuditoriaDelFormulario";
import ResultadosDelFormulario from "../instrumento/ResultadosDelFormulario";
import DetalleDeRegla from "../instrumento/DetalleDeRegla";
import { useMesaDeLimpieza } from "../limpieza/useMesaDeLimpieza";
import { StatusBar } from "../limpieza/CierreDeBase";
import ColaYDecision from "../limpieza/ColaYDecision";
import AvisosDeLimpieza from "../limpieza/AvisosDeLimpieza";
import { usePestanaValidacion } from "../pestanaDireccionable";

export default function PestanaHallazgos() {
  // Al terminar la auditoría, la banda y la cola se vuelven a leer sin salir de
  // la pestaña: dependen de la evaluación que la auditoría acaba de escribir.
  // La ref conserva el orden de los hooks (y de los pedidos) de antes.
  const recargarMesa = useRef<() => void>(() => undefined);
  const inst = useInstrumento({ alTerminarAuditoria: () => recargarMesa.current() });
  const mesa = useMesaDeLimpieza();
  recargarMesa.current = () => void mesa.loadLimpieza({ quiet: true });
  const { irAPestana } = usePestanaValidacion();
  const { estado, resultado } = inst;
  const auditReady = !!mesa.data?.progreso.auditoria_corrida;

  return (
    <div
      className="pulso-validacion-pestana-hallazgos"
      data-audit-ready="validacion-hallazgos"
      style={{ display: "flex", flexDirection: "column", gap: "var(--pulso-space-4)", minWidth: 0 }}
    >
      {inst.loading ? (
        <CargaDeBloque label="Cargando la auditoría" />
      ) : !estado ? (
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="Sin estado"
          hint="Carga una base primero."
        />
      ) : !estado.plan_construido ? (
        <EstadoVacio
          tamano="normal"
          icono={<ListChecks size={20} />}
          titulo="Sin plan de reglas"
          descripcion="La auditoría corre el plan de reglas del formulario, que se construye en Reglas."
          accion={(
            <button type="button" className="pulso-secondary" onClick={() => irAPestana("reglas")}>
              Ir a Reglas
            </button>
          )}
        />
      ) : (
        <div className="pulso-instrumento-workbench">
          <AuditoriaDelFormulario inst={inst} estado={estado} onIrAReglas={() => irAPestana("reglas")} />
          {inst.busy && <LoadingBlock variant="inline" label={inst.busy} />}
          {inst.error && <ErrorBlock label="Error" detail={inst.error} />}
        </div>
      )}

      {mesa.loading ? (
        <CargaDeBloque label="Cargando hallazgos" />
      ) : mesa.error ? (
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="No se pudo cargar la sección"
          hint={mesa.error}
        />
      ) : mesa.data ? (
        // Envoltorio propio: la banda de estado es sticky y se pega solo
        // mientras la cola está a la vista; al bajar a los resultados se va con
        // ella en vez de tapar un tercio de la pantalla a 1024x600.
        <div className="pulso-validacion-mesa" style={{ display: "flex", flexDirection: "column", gap: "var(--pulso-space-4)", minWidth: 0 }}>
          <StatusBar
            pegajosa={false}
            accionListo={(
              <button type="button" className="pulso-secondary" onClick={() => irAPestana("cierre")}>
                Ir a Cierre
              </button>
            )}
            auditReady={auditReady}
            canFinalize={mesa.canFinalize}
            finalizedAt={mesa.artifacts?.finalized_at}
            refreshBusy={mesa.refreshBusy}
            finalizeBusy={mesa.finalizeBusy}
            decisionCounts={mesa.decisionCounts}
            activeFilterKind={mesa.activeFilterKind}
            onFilterKind={mesa.setActiveFilterKind}
            onRefresh={() => void mesa.loadLimpieza({ quiet: true })}
          />
          <AvisosDeLimpieza mesa={mesa} auditReady={auditReady} conPreservadas />
          <ColaYDecision mesa={mesa} auditReady={auditReady} />
        </div>
      ) : null}

      {estado?.auditoria_corrida && resultado && <ResultadosDelFormulario inst={inst} resultado={resultado} />}

      <DetalleDeRegla inst={inst} />
    </div>
  );
}
