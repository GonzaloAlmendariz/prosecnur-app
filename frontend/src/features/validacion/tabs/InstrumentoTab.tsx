import { AlertTriangle } from "../../../vendor/lucide-react";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../../components/States";
import { VacioListo } from "../components/VacioListo";
import { useInstrumento } from "../instrumento/useInstrumento";
import PlanDelFormulario from "../instrumento/PlanDelFormulario";
import AuditoriaDelFormulario from "../instrumento/AuditoriaDelFormulario";
import ResultadosDelFormulario from "../instrumento/ResultadosDelFormulario";
import DetalleDeRegla from "../instrumento/DetalleDeRegla";

// =============================================================================
// InstrumentoTab: "Reglas del formulario"
// =============================================================================
// 3 pasos secuenciales:
//  1) Construir plan desde XLSForm (con include flags por defecto).
//  2) Ejecutar auditoría (async job).
//  3) Ver dashboard: KPIs + top reglas + heatmap + drill por regla.
//
// Composición delgada (rebanada V1 de P6): el estado vive en
// `instrumento/useInstrumento.ts` y cada paso en su pieza de `instrumento/`.
// El deep-link desde Limpieza (prefill.instrumento.id_regla) se consume
// al montar el tab: abre el drill de esa regla automáticamente.

export default function InstrumentoTab() {
  const inst = useInstrumento();
  const { loading, estado, resultado, busy, error } = inst;

  if (loading) return <LoadingBlock label="Cargando estado…" />;
  if (!estado) {
    return (
      <VacioListo marca="validacion-instrumento">
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="Sin estado"
          hint="Carga una base primero."
        />
      </VacioListo>
    );
  }

  const panelContent = (
    <>
      <PlanDelFormulario inst={inst} estado={estado} />

      {/* --- Paso 2: Ejecutar auditoría --- */}
      {estado.plan_construido && <AuditoriaDelFormulario inst={inst} estado={estado} />}

      {/* --- Paso 3: Dashboard de resultado --- */}
      {estado.auditoria_corrida && resultado && <ResultadosDelFormulario inst={inst} resultado={resultado} />}

      <DetalleDeRegla inst={inst} />

      {busy && (
        <div style={{ marginTop: 4 }}>
          <LoadingBlock variant="inline" label={busy} />
        </div>
      )}
      {error && <ErrorBlock label="Error" detail={error} />}
    </>
  );

  if (error) {
    return <div className="pulso-instrumento-workbench">{panelContent}</div>;
  }

  return (
    <div className="pulso-instrumento-workbench" data-audit-ready="validacion-instrumento">
      {panelContent}
    </div>
  );
}

