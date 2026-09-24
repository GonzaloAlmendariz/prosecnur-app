import { Settings2 } from "lucide-react";

import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import { MatrizServiciosTable } from "../ComponenteTablas";
import { setTecnica, type ComponentePatch } from "../sharedCore";
import { METODOS_CLASICOS, productoLabel } from "./catalogos";
import { EstratosGeneral } from "./EstratosGeneral";
import { usaProporcionPorEstrato } from "./modeloEstratos";
import { patchDeParametro } from "./modeloParametros";
import { MemoriaCalculoGeneral } from "./MemoriaCalculoGeneral";
import { ParametrosTecnicaVista } from "./ParametrosTecnica";
import { useCatalogoParametros, type EstadoCatalogo } from "./useCatalogoParametros";
import { useMuestraGeneral } from "./useMuestraGeneral";
import "./general.css";

type PropsMetodo = {
  comp: CalcMuestraComponente;
  calculando: boolean;
  onCalcular: () => void;
  onComponente: (id: string, patch: ComponentePatch) => void;
  onReplaceComponente: (comp: CalcMuestraComponente) => void;
};

/**
 * Muestra general › Método: la técnica, los parámetros que esa técnica
 * consume y, debajo, la memoria que dice cómo sale el n con ellos.
 */
export function MetodoGeneral(props: PropsMetodo) {
  const { estado, reintentar } = useCatalogoParametros();
  // Los estratos con marco declarado salen del archivo: se espera su lectura.
  const { cargado } = useMuestraGeneral(props.comp.id);
  return <MetodoGeneralVista {...props} catalogo={estado} marcoLeido={cargado} onReintentar={reintentar} />;
}

/** Listo para el QA cuando el catálogo y el marco ya respondieron (bien o mal). */
export function metodoListo(catalogo: EstadoCatalogo, marcoLeido: boolean): boolean {
  return catalogo.fase !== "cargando" && marcoLeido;
}

/** La sección con el catálogo y el marco ya resueltos (separada para probarla sin efectos). */
export function MetodoGeneralVista({
  comp,
  calculando,
  onCalcular,
  onComponente,
  onReplaceComponente,
  catalogo,
  marcoLeido,
  onReintentar,
}: PropsMetodo & {
  catalogo: EstadoCatalogo;
  marcoLeido: boolean;
  onReintentar: () => void;
}) {
  const matrizMode = (comp.marco.matriz_operativa?.length ?? 0) > 0;
  // El estratificado lleva su tabla aunque aún no tenga estratos: es donde se agregan.
  const estratosMode = !matrizMode && ((comp.marco.estratos?.length ?? 0) > 0 || usaProporcionPorEstrato(comp.tecnica));
  return (
    // Sin pestaña que lo controle no es un tabpanel: es la región de la
    // sección, nombrada por el encabezado de la mesa (h2).
    <section
      id="cmv2-section-general-metodo"
      className="cmv2-tab-panel cmg-metodo-general"
      aria-labelledby="cmg-seccion-titulo"
      data-audit-ready={metodoListo(catalogo, marcoLeido) ? "true" : "false"}
      data-qa-geometry-group="calc-muestra/general-metodo"
      data-qa-geometry-contract="intrinsic"
    >
      <section className="cmv2-panel" aria-labelledby="cmg-tecnica-titulo">
        <div className="cmv2-panel-head">
          <div>
            <span className="cmv2-eyebrow">Técnica</span>
            <h3 className="cmg-panel-titulo" id="cmg-tecnica-titulo">Tipo de cálculo y parámetros</h3>
          </div>
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
        <ParametrosTecnicaVista
          comp={comp}
          estado={catalogo}
          onReintentar={onReintentar}
          onParametro={(clave, valor) => {
            const parametros = patchDeParametro(clave, valor);
            if (parametros) onComponente(comp.id, { parametros });
          }}
        />
      </section>
      <MemoriaCalculoGeneral comp={comp} calculando={calculando} onCalcular={onCalcular} />
      {matrizMode && <MatrizServiciosTable comp={comp} onComponente={onComponente} />}
      {estratosMode && <EstratosGeneral comp={comp} onComponente={onComponente} />}
    </section>
  );
}
