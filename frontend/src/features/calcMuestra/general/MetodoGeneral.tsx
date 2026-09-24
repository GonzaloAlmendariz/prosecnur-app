import { Settings2 } from "lucide-react";

import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import { MatrizServiciosTable } from "../ComponenteTablas";
import { setTecnica, type ComponentePatch } from "../sharedCore";
import { METODOS_CLASICOS, productoLabel } from "./catalogos";
import { EstratosGeneral } from "./EstratosGeneral";
import { usaProporcionPorEstrato } from "./modeloEstratos";
import { MemoriaCalculoGeneral } from "./MemoriaCalculoGeneral";
import { ParametrosTecnica } from "./ParametrosTecnica";

/**
 * Muestra general › Método: la técnica, los parámetros que esa técnica
 * consume y, debajo, la memoria que dice cómo sale el n con ellos.
 */
export function MetodoGeneral({
  comp,
  calculando,
  onCalcular,
  onComponente,
  onReplaceComponente,
}: {
  comp: CalcMuestraComponente;
  calculando: boolean;
  onCalcular: () => void;
  onComponente: (id: string, patch: ComponentePatch) => void;
  onReplaceComponente: (comp: CalcMuestraComponente) => void;
}) {
  const matrizMode = (comp.marco.matriz_operativa?.length ?? 0) > 0;
  // El estratificado lleva su tabla aunque aún no tenga estratos: es donde se agregan.
  const estratosMode = !matrizMode && ((comp.marco.estratos?.length ?? 0) > 0 || usaProporcionPorEstrato(comp.tecnica));
  return (
    <div id="cmv2-section-general-metodo" className="cmv2-tab-panel" role="tabpanel" aria-label="Método" data-qa-geometry-group="calc-muestra/general-metodo" data-qa-geometry-contract="intrinsic">
      <section className="cmv2-panel" aria-labelledby="cmg-tecnica-titulo">
        <div className="cmv2-panel-head">
          <span className="cmv2-eyebrow">Técnica</span>
          <strong id="cmg-tecnica-titulo">Tipo de cálculo y parámetros</strong>
        </div>
        <div className="cmv2-method-grid" role="group" aria-label="Técnica de muestreo" data-qa-geometry-group="calc-muestra/general-tecnicas" data-qa-geometry-contract="equal">
          {METODOS_CLASICOS.map((metodo) => (
            <button
              key={metodo.id}
              type="button"
              className={`cmv2-method ${comp.tecnica === metodo.id ? "is-active" : ""}`}
              aria-pressed={comp.tecnica === metodo.id}
              onClick={() => onReplaceComponente(setTecnica(comp, metodo.id))}
            >
              <span><Settings2 size={14} aria-hidden="true" /> {productoLabel(metodo.producto)}</span>
              <strong>{metodo.label}</strong>
              <small>{metodo.marco}</small>
            </button>
          ))}
        </div>
        <ParametrosTecnica comp={comp} onComponente={onComponente} />
      </section>
      <MemoriaCalculoGeneral comp={comp} calculando={calculando} onCalcular={onCalcular} />
      {matrizMode && <MatrizServiciosTable comp={comp} onComponente={onComponente} />}
      {estratosMode && <EstratosGeneral comp={comp} onComponente={onComponente} />}
    </div>
  );
}
