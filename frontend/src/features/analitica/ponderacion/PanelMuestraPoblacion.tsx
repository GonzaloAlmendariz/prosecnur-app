// Columna izquierda de Ponderación (prototipo: "Muestra frente a población"):
// las metas de la población frente a la muestra. En la cabecera, cuántas
// variables ajustan y las acciones "Añadir variable" y "Metas del censo"; en el
// cuerpo, la leyenda con la población de referencia, las metas del censo
// cuando se abren, la población por estrato si el peso base es un estrato y la
// tabla de metas. El origen del peso y los ajustes viven en el panel "Ajustes".

import { useMemo, useState } from "react";

import type { PonderMarginCompare } from "../../../api/analitica";
import type { VariableInstrumento } from "../../../api/client";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { Landmark, Plus, Scale } from "../../../vendor/lucide-react";
import { useProjectModules } from "../../project/ProjectModulesContext";
import { MetasCpv2025 } from "../panes/MetasCpv2025";
import { PoblacionDeReferencia } from "../panes/PoblacionDeReferencia";
import { poblacionVigente } from "../panes/poblacionReferenciaModel";
import type { LecturaVariables } from "../panes/variablesDeLaBase";
import { origenPesoBase } from "../ponderacionConfigModel";
import { useAnaliticaStore } from "../store";
import { VariableSelect } from "../VariableSelect";
import { aperturaDelCenso } from "./aperturaDelCenso";
import { variablesQueAjustan } from "./cifrasDePonderacion";
import { conEtiquetas } from "./etiquetasDeCategorias";
import { TablaDeMetas } from "./TablaDeMetas";
import { useCategoriasDeVariables } from "./useCategoriasDeVariables";
import { useEtiquetasDelFormulario } from "./useEtiquetasDelFormulario";

const ID_CENSO = "pond-metas-del-censo";
const ID_ELEGIR = "pond-elegir-variable";

export function PanelMuestraPoblacion({ variables, comparacion, recalculando = false }: {
  /** Se conserva por compatibilidad de quien lo monta; el origen del peso pasó al panel "Ajustes". */
  lecturaVariables?: LecturaVariables;
  variables: VariableInstrumento[];
  baseActiva?: string | null;
  /** Lo que el motor devuelve por variable y categoría; `undefined` sin cálculo. */
  comparacion: Record<string, PonderMarginCompare[]> | undefined;
  /** Hay un cálculo en curso: lo que muestra `comparacion` es del resultado anterior. */
  recalculando?: boolean;
}) {
  const pond = useAnaliticaStore((s) => s.config.ponderacion);
  const setPonderacion = useAnaliticaStore((s) => s.setPonderacion);
  const upsertMargin = useAnaliticaStore((s) => s.upsertPonderMargin);
  const removeMargin = useAnaliticaStore((s) => s.removePonderMargin);
  const setDesign = useAnaliticaStore((s) => s.setPonderDesign);
  const { overview } = useProjectModules();

  const porColumna = pond.modo === "columna";
  const calibra = pond.enabled && !porColumna;
  const margenes = pond.rake?.margins ?? [];
  const estrato = pond.design?.var ?? "";
  const origen = origenPesoBase(pond);
  const poblacion = poblacionVigente(pond, overview);
  const delCenso = margenes.filter((m) => m.fuente?.tipo === "cpv2025").length;
  const { categorias: valores, fallidas, pedir } = useCategoriasDeVariables([...margenes.map((m) => m.var), estrato]);
  // Lo que se lee es la etiqueta de la categoría; el código sigue siendo la llave.
  const etiquetas = useEtiquetasDelFormulario(calibra);
  const categorias = useMemo(
    () => Object.fromEntries(Object.entries(valores).map(([nombre, v]) => [nombre, conEtiquetas(v, etiquetas[nombre])])),
    [valores, etiquetas],
  );
  const categoricas = useMemo(() => variables.filter((v) => !!v.categorica), [variables]);
  const disponibles = categoricas.filter((v) => !margenes.some((m) => m.var === v.name) && v.name !== estrato);
  const etiquetaDe = (nombre: string) => variables.find((v) => v.name === nombre)?.label || nombre;
  const lecturaDe = (nombre: string) => categorias[nombre] ?? (fallidas.includes(nombre) ? "error" as const : null);
  const [eligiendo, setEligiendo] = useState(false);

  // Las metas del censo son trabajo principal mientras un estudio territorial
  // no las ha traído: van a la vista. Con metas ya puestas, el botón las abre.
  // La apertura se fija al abrirse (aperturaDelCenso.ts): aplicar un margen no
  // la cierra, y cerrada sigue montada con su consulta y su selección.
  const [censoElegido, setCensoElegido] = useState<boolean | null>(null);
  const ofreceCenso = calibra && poblacion.valor === "territorio";
  const censo = aperturaDelCenso(censoElegido, ofreceCenso, delCenso);
  if (censo.elegido !== censoElegido) setCensoElegido(censo.elegido);

  const ajustan = variablesQueAjustan(pond);
  const acciones = calibra ? (
    <>
      <PulsoButton
        variant="secondary"
        size="sm"
        aria-expanded={eligiendo}
        aria-controls={eligiendo ? ID_ELEGIR : undefined}
        onClick={() => setEligiendo((v) => !v)}
      >
        <Plus size={14} aria-hidden="true" /> Añadir variable
      </PulsoButton>
      {ofreceCenso ? (
        <PulsoButton
          variant="secondary"
          size="sm"
          aria-expanded={censo.abierto}
          aria-controls={censo.montado ? ID_CENSO : undefined}
          onClick={() => setCensoElegido(!censo.abierto)}
        >
          <Landmark size={14} aria-hidden="true" /> Metas del censo
        </PulsoButton>
      ) : null}
    </>
  ) : undefined;

  return (
    <PanelDeMesa
      zona="metas"
      titulo="Muestra frente a población"
      icono={<Scale size={16} aria-hidden="true" />}
      conteo={calibra ? `${ajustan} ${ajustan === 1 ? "variable" : "variables"}` : undefined}
      acciones={acciones}
      ocupado={recalculando}
    >
      {!pond.enabled ? (
        <div className="pond-panel-cuerpo">
          <EstadoVacio
            tamano="normal"
            icono={<Scale size={20} />}
            titulo="Ponderación apagada"
            descripcion="Cada caso cuenta con peso 1 en frecuencias, cruces y dimensiones."
            accion={<PulsoButton variant="primary" onClick={() => setPonderacion({ enabled: true })}>Activar ponderación</PulsoButton>}
          />
        </div>
      ) : porColumna ? (
        <div className="pond-panel-cuerpo">
          <EstadoVacio
            tamano="normal"
            icono={<Scale size={20} />}
            titulo="Sin metas que comparar"
            descripcion="El peso se toma de una columna de la base. Para calibrar con metas de la población, elige Calcular pesos en Ajustes."
          />
        </div>
      ) : (
        /* C1: secciones independientes de alto intrínseco, separadas por una línea. */
        <div
          className="pond-secciones"
          data-qa-geometry-group="analitica/ponderacion-declarado"
          data-qa-geometry-contract="intrinsic"
        >
          {/* La leyenda de las barras y contra qué población se compara, como en el prototipo. */}
          <div className="pond-seccion pond-referencia">
            <span className="pond-leyenda">
              <span><i className="pond-barra is-muestra" aria-hidden="true" />Muestra</span>
              <span><i className="pond-barra is-meta" aria-hidden="true" />Población</span>
            </span>
            <PoblacionDeReferencia
              valor={poblacion.valor}
              inferida={poblacion.inferida}
              metasDelCenso={delCenso}
              onCambio={(p) => setPonderacion({ poblacion: p })}
            />
          </div>

          {eligiendo ? (
            <div className="pond-seccion pond-elegir" id={ID_ELEGIR}>
              <div className="pond-agregar-selector">
                <VariableSelect
                  variables={disponibles}
                  value=""
                  placeholder="Variable categórica"
                  onChange={(nombre) => {
                    if (nombre) { pedir(nombre); upsertMargin({ var: nombre, targets: {} }); }
                    setEligiendo(false);
                  }}
                />
                <PulsoButton variant="secondary" onClick={() => setEligiendo(false)}>Cancelar</PulsoButton>
              </div>
            </div>
          ) : null}

          {censo.montado ? (
            <div className="pond-seccion" id={ID_CENSO} hidden={!censo.abierto}>
              <MetasCpv2025
                categoricas={categoricas}
                catCache={categorias}
                ensureCats={pedir}
                margenes={margenes}
                guardado={pond.metas_cpv2025}
                onAplicar={upsertMargin}
                onGuardarPedido={(metas_cpv2025) => setPonderacion({ metas_cpv2025 })}
              />
            </div>
          ) : null}

          {origen === "estrato" && estrato ? (
            <div className="pond-seccion pond-seccion-metas">
              <TablaDeMetas
                modo="estrato"
                nombre="Población por estrato"
                grupos={[{
                  variable: estrato,
                  etiqueta: etiquetaDe(estrato),
                  categorias: lecturaDe(estrato),
                  metas: pond.design?.pop_sizes ?? {},
                  onMetas: (pop_sizes) => setDesign({ pop_sizes }),
                  onQuitar: () => setDesign({ var: "", pop_sizes: {} }),
                }]}
              />
            </div>
          ) : null}

          <div className="pond-seccion pond-seccion-metas">
            <TablaDeMetas
              modo="ajuste"
              nombre="Variables de ajuste y sus metas"
              recalculando={recalculando}
              grupos={margenes.map((m) => ({
                variable: m.var,
                etiqueta: etiquetaDe(m.var),
                categorias: lecturaDe(m.var),
                metas: m.targets,
                fuente: m.fuente ? "CPV 2025" : null,
                comparacion: comparacion?.[m.var],
                // Teclear una meta suelta la fuente: deja de ser la del censo.
                onMetas: (targets) => upsertMargin({ var: m.var, targets }),
                onQuitar: () => removeMargin(m.var),
              }))}
              vacio={
                <EstadoVacio
                  icono={<Scale size={16} />}
                  titulo="Sin variables de ajuste"
                  descripcion="Añade una variable categórica y escribe la meta de cada categoría."
                />
              }
            />
            {margenes.length > 0 ? (
              <p className="pond-nota">
                Los porcentajes se calculan entre los casos cuya categoría tiene meta; no cuentan los casos sin dato ni las
                categorías sin meta. Las metas se llevan a 100 %.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </PanelDeMesa>
  );
}
