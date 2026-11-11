/**
 * Pestaña Reglas de Validación (ADR 0142, rebanada V2 de P6).
 *
 * Montaje de transición: arriba el plan de reglas del formulario (con los
 * controles del operativo y los roles), tal como era el paso 1 de "Reglas del
 * formulario"; debajo, las reglas propias, tal como eran "Criterios de
 * revisión". La auditoría y sus resultados pasaron a Hallazgos, y el paquete
 * metodológico a Cierre. V3 rehace esta pestaña con su catálogo y su panel.
 *
 * Readiness: la marca de la pestaña va en la raíz; mientras el plan o las
 * reglas propias cargan, la carga de bloque del kit (`CargaDeBloque`) la retiene.
 */
import { useEffect } from "react";
import { AlertTriangle } from "../../../vendor/lucide-react";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../../components/States";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { useInstrumento } from "../instrumento/useInstrumento";
import PlanDelFormulario from "../instrumento/PlanDelFormulario";
import ReglasCustomTab from "../tabs/ReglasCustomTab";
import { useValidacionStore } from "../store";

export default function PestanaReglas() {
  // Reglas no dibuja la auditoría: no pide su resultado ni las variables fuera de auditoría.
  const inst = useInstrumento({ conAuditoria: false });
  const { loading, estado, busy, error } = inst;
  // El inventario compartido (`inventarioDeBase.ts`) vale mientras la pestaña
  // está montada: al salir se olvida, para no servir uno viejo si Carga cambió
  // las variables entretanto.
  const setInventario = useValidacionStore((s) => s.setInventario);
  useEffect(() => () => setInventario(null), [setInventario]);

  return (
    <div
      className="pulso-validacion-pestana-reglas"
      data-audit-ready="validacion-reglas"
      style={{ display: "flex", flexDirection: "column", gap: "var(--pulso-space-4)", minWidth: 0 }}
    >
      {loading ? (
        <CargaDeBloque label="Cargando el plan de reglas" />
      ) : !estado ? (
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="Sin estado"
          hint="Carga una base primero."
        />
      ) : (
        <div className="pulso-instrumento-workbench">
          <PlanDelFormulario inst={inst} estado={estado} />
          {busy && <LoadingBlock variant="inline" label={busy} />}
          {error && <ErrorBlock label="Error" detail={error} />}
        </div>
      )}

      <ReglasCustomTab />
    </div>
  );
}
