/**
 * Franja de resultados del diseño muestral: N, marco, n, sobremuestra, aulas
 * y cobertura, recalculados en vivo ante cualquier cambio de datos, criterio
 * o parámetro. Visible en todas las secciones del desk — el estado del diseño
 * acompaña cada decisión.
 */
import { RotateCcw } from "lucide-react";
import { fmtInt, fmtPct } from "../sharedCore";
import { useMotorStore } from "./store";
import type { MotorEfectivo } from "./usePerfilEfectivo";
import "./motor.css";

export function ResumenDiseno({ motor }: { motor: MotorEfectivo }) {
  const resetCanon = useMotorStore((s) => s.resetCanon);
  const { perfil, e1, cob } = motor;

  return (
    <div className="rec-resumen-shell" data-audit-ready="calc-muestra-motor">
      <div className="rec-resumen" role="status" aria-label="Resultados del diseño">
        <div className="rec-resumen-item">
          <small>Población (N)</small>
          <strong>{e1.N > 0 ? fmtInt(e1.N) : "—"}</strong>
        </div>
        <div className="rec-resumen-item">
          <small>Marco de aulas</small>
          <strong>{perfil.marcoAulas != null ? fmtInt(perfil.marcoAulas) : "—"}</strong>
        </div>
        <div className="rec-resumen-item" data-hero>
          <small>Muestra (n)</small>
          <strong>{e1.N > 0 ? fmtInt(e1.nDiseno) : "—"}</strong>
        </div>
        <div className="rec-resumen-item">
          <small>Sobremuestra</small>
          <strong>{e1.N > 0 ? fmtInt(e1.sobremuestraTotal) : "—"}</strong>
        </div>
        <div className="rec-resumen-item" data-hero>
          <small>Aulas</small>
          <strong>{e1.N > 0 && e1.aulasConBolsa > 0 ? fmtInt(e1.aulasConBolsa) : "—"}</strong>
        </div>
        <div className="rec-resumen-item">
          <small>Cobertura</small>
          <strong>{cob.pctGlobal != null ? fmtPct(cob.pctGlobal) : "—"}</strong>
        </div>
      </div>
      <div className="rec-resumen-meta">
        {perfil.esEjemplo && <span className="rec-badge-ejemplo">EJEMPLO</span>}
        <span className="rec-cabecera-perfil" data-fuente={motor.usaProyecto ? "proyecto" : "manual"}>
          {motor.marcaFuente} · {perfil.nombre}
        </span>
        {motor.tocado && (
          <button type="button" className="rec-link" onClick={resetCanon}>
            <RotateCcw size={12} aria-hidden="true" /> Restaurar parámetros
          </button>
        )}
      </div>
    </div>
  );
}
