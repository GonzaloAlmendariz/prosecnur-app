import { Layers3, Settings2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import { EmptyState } from "../../../components/States";
import { searchConNivel } from "../../../lib/navegacion/useDireccion";
import { MatrizServiciosTable } from "../ComponenteTablas";
import { setTecnica, type ComponentePatch } from "../sharedCore";
import { FlujoVertical } from "../universidad/ui";
import { AccionCalcular } from "./AccionCalcular";
import { nDelMarco } from "./bandaDisenoModelo";
import { cadenaDelN } from "./cadenaDelN";
import { METODOS_CLASICOS, productoLabel } from "./catalogos";
import { EstratosGeneral } from "./EstratosGeneral";
import { esTecnicaDeElementos } from "./modelo";
import { usaProporcionPorEstrato } from "./modeloEstratos";
import { patchDeParametro } from "./modeloParametros";
import { MemoriaCalculoGeneral } from "./MemoriaCalculoGeneral";
import { ParametrosTecnicaVista } from "./ParametrosTecnica";
import { useCatalogoParametros, type EstadoCatalogo } from "./useCatalogoParametros";
import { useMuestraGeneral } from "./useMuestraGeneral";
import "./general.css";

type PropsMetodo = {
  comp: CalcMuestraComponente;
  /** La pestaña activa de Método (E15 · P2); sin ella, «Técnica». */
  pestana?: string;
  calculando: boolean;
  onCalcular: () => void;
  onComponente: (id: string, patch: ComponentePatch) => void;
  onReplaceComponente: (comp: CalcMuestraComponente) => void;
};

/**
 * Muestra general › Método, partido en pestañas como aulas (E15 · P2): la
 * técnica, los parámetros que consume (y el botón que calcula con ellos),
 * cómo sale el n —fórmula viva y cadena— y el reparto por estratos.
 */
export function MetodoGeneral(props: PropsMetodo) {
  const { estado, reintentar } = useCatalogoParametros();
  // Los estratos con marco declarado salen del archivo: se espera su lectura.
  const { cargado, marco } = useMuestraGeneral(props.comp.id);
  return (
    <MetodoGeneralVista
      {...props}
      catalogo={estado}
      marcoLeido={cargado}
      marcoN={nDelMarco(props.comp, marco)}
      onReintentar={reintentar}
    />
  );
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
  marcoN,
  onReintentar,
  pestana = "metodo-tecnica",
}: PropsMetodo & {
  catalogo: EstadoCatalogo;
  marcoLeido: boolean;
  /** N vigente (archivo declarado o marco del estudio) para la cadena. */
  marcoN?: number;
  onReintentar: () => void;
}) {
  const matrizMode = (comp.marco.matriz_operativa?.length ?? 0) > 0;
  // El estratificado lleva su tabla aunque aún no tenga estratos: es donde se agregan.
  const estratosMode = !matrizMode && ((comp.marco.estratos?.length ?? 0) > 0 || usaProporcionPorEstrato(comp.tecnica));
  return (
    // El tabpanel es el de `PestanasMesa`, nombrado por su tab; esto es la
    // región de la sección, nombrada por el encabezado de la mesa (h2).
    <section
      id="cmv2-section-general-metodo"
      className="cmv2-tab-panel cmg-metodo-general"
      aria-labelledby="cmg-seccion-titulo"
      data-audit-ready={metodoListo(catalogo, marcoLeido) ? "true" : "false"}
      data-qa-geometry-group="calc-muestra/general-metodo"
      data-qa-geometry-contract="intrinsic"
    >
      {pestana === "metodo-tecnica" && (
        <section className="cmv2-panel" aria-labelledby="cmg-tecnica-titulo">
          <div className="cmv2-panel-head">
            <div>
              <span className="cmv2-eyebrow">Técnica</span>
              <h3 className="cmg-panel-titulo" id="cmg-tecnica-titulo">Tipo de cálculo</h3>
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
        </section>
      )}
      {pestana === "metodo-parametros" && (
        <section className="cmv2-panel" aria-labelledby="cmg-parametros-titulo">
          <div className="cmv2-panel-head">
            <div>
              <span className="cmv2-eyebrow">Parámetros</span>
              <h3 className="cmg-panel-titulo" id="cmg-parametros-titulo">Los que usa esta técnica</h3>
            </div>
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
          <AccionCalcular
            calculado={Boolean(comp.resultado)}
            calculando={calculando}
            onCalcular={onCalcular}
            nota="Calcula el n con estos parámetros; cambiar uno borra el resultado anterior."
            motivo={marcoN === 0 ? "Declara primero el N del marco en Marco." : null}
          />
        </section>
      )}
      {pestana === "metodo-memoria" && (
        <>
          <section className="cmv2-panel cmg-cadena-n" aria-labelledby="cmg-cadena-titulo">
            <div className="cmv2-panel-head">
              <div>
                <span className="cmv2-eyebrow">Cadena</span>
                <h3 className="cmg-panel-titulo" id="cmg-cadena-titulo">Del marco al n a campo</h3>
              </div>
            </div>
            <FlujoVertical etapas={cadenaDelN(comp, marcoN ?? 0)} orientacion="horizontal" ariaLabel="Del marco al n a campo" geometryGroup="calc-muestra/general-cadena-del-n" />
          </section>
          {esTecnicaDeElementos(comp.tecnica) ? (
            <MemoriaCalculoGeneral comp={comp} calculando={calculando} onCalcular={onCalcular} />
          ) : (
            <section className="cmv2-panel" aria-label="Memoria de cálculo">
              <EmptyState
                variant="inline"
                icon={<Settings2 size={18} aria-hidden="true" />}
                title="Esta técnica no tiene fórmula de n"
                hint="Sólo las muestras de elementos llevan memoria con fórmula; esta técnica fija el n por cobertura o por cuotas."
              />
            </section>
          )}
        </>
      )}
      {pestana === "metodo-estratos" && (
        matrizMode ? <MatrizServiciosTable comp={comp} onComponente={onComponente} />
          : estratosMode ? <EstratosGeneral comp={comp} onComponente={onComponente} />
            : <EstratosNoAplican />
      )}
    </section>
  );
}

/** Vacío legítimo (C3/C5): la técnica no reparte por estratos; se cambia en Técnica. */
function EstratosNoAplican() {
  const location = useLocation();
  return (
    <section className="cmv2-panel" aria-labelledby="cmg-estratos-vacio-titulo">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Estratos</span>
          <h3 className="cmg-panel-titulo" id="cmg-estratos-vacio-titulo">Reparto entre capas</h3>
        </div>
      </div>
      <EmptyState
        variant="inline"
        icon={<Layers3 size={18} aria-hidden="true" />}
        title="Esta técnica no reparte por estratos"
        hint="El n sale de una sola población. Para repartirlo entre capas, elige una técnica estratificada."
        cta={(
          <Link className="cmv2-ghost" to={`${location.pathname}${searchConNivel(location.search, "pestana", "metodo-tecnica")}`}>
            Ir a Técnica
          </Link>
        )}
      />
    </section>
  );
}
