// Columna izquierda de Ponderación: lo que se declara. De arriba abajo, el
// origen del peso, la población de referencia, el peso base y las variables de
// ajuste con sus metas. Es un solo `Panel` y su cuerpo es el dueño del scroll.

import { useMemo, useState } from "react";

import type { PonderMarginCompare } from "../../../api/analitica";
import type { VariableInstrumento } from "../../../api/client";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { Panel } from "../../../components/Panel";
import { PulsoButton } from "../../../components/PulsoButton";
import { Landmark, Scale } from "../../../vendor/lucide-react";
import { useProjectModules } from "../../project/ProjectModulesContext";
import { MetasCpv2025 } from "../panes/MetasCpv2025";
import { PesoPorColumna } from "../panes/PesoPorColumna";
import { PoblacionDeReferencia } from "../panes/PoblacionDeReferencia";
import { poblacionVigente } from "../panes/poblacionReferenciaModel";
import { PonderacionPesoBase } from "../panes/PonderacionPesoBase";
import type { LecturaVariables } from "../panes/variablesDeLaBase";
import { conOrigenPesoBase, origenPesoBase } from "../ponderacionConfigModel";
import { useAnaliticaStore } from "../store";
import { AgregarVariable } from "./AgregarVariable";
import { aperturaDelCenso } from "./aperturaDelCenso";
import { conEtiquetas } from "./etiquetasDeCategorias";
import { TablaDeMetas } from "./TablaDeMetas";
import { useCategoriasDeVariables } from "./useCategoriasDeVariables";
import { useEtiquetasDelFormulario } from "./useEtiquetasDelFormulario";

const ID_CENSO = "pond-metas-del-censo";

export function PanelMuestraPoblacion({ lecturaVariables, variables, baseActiva, comparacion, recalculando = false }: {
  lecturaVariables: LecturaVariables;
  variables: VariableInstrumento[];
  baseActiva: string | null;
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
  const margenes = pond.rake?.margins ?? [];
  const estrato = pond.design?.var ?? "";
  const origen = origenPesoBase(pond);
  const poblacion = poblacionVigente(pond, overview);
  const delCenso = margenes.filter((m) => m.fuente?.tipo === "cpv2025").length;
  const { categorias: valores, fallidas, pedir } = useCategoriasDeVariables([...margenes.map((m) => m.var), estrato]);
  // Lo que se lee es la etiqueta de la categoría; el código sigue siendo la llave.
  const etiquetas = useEtiquetasDelFormulario(pond.enabled && !porColumna);
  const categorias = useMemo(
    () => Object.fromEntries(Object.entries(valores).map(([nombre, v]) => [nombre, conEtiquetas(v, etiquetas[nombre])])),
    [valores, etiquetas],
  );
  const categoricas = useMemo(() => variables.filter((v) => !!v.categorica), [variables]);
  const etiquetaDe = (nombre: string) => variables.find((v) => v.name === nombre)?.label || nombre;
  const lecturaDe = (nombre: string) => categorias[nombre] ?? (fallidas.includes(nombre) ? "error" as const : null);

  // Las metas del censo son trabajo principal mientras un estudio territorial
  // no las ha traído: van a la vista. Con metas ya puestas, el botón las abre.
  // La apertura se fija al abrirse (aperturaDelCenso.ts): aplicar un margen no
  // la cierra, y cerrada sigue montada con su consulta y su selección.
  const [censoElegido, setCensoElegido] = useState<boolean | null>(null);
  const ofreceCenso = pond.enabled && !porColumna && poblacion.valor === "territorio";
  const censo = aperturaDelCenso(censoElegido, ofreceCenso, delCenso);
  if (censo.elegido !== censoElegido) setCensoElegido(censo.elegido);

  return (
    <Panel
      noPadding
      data-entra="sube"
      className="pond-panel pond-panel-declarado"
      title={<><Scale size={16} aria-hidden="true" /><span>Muestra frente a población</span></>}
      actions={ofreceCenso ? (
        <PulsoButton
          variant="secondary"
          size="sm"
          aria-expanded={censo.abierto}
          aria-controls={censo.montado ? ID_CENSO : undefined}
          onClick={() => setCensoElegido(!censo.abierto)}
        >
          <Landmark size={14} aria-hidden="true" /> Metas del censo
        </PulsoButton>
      ) : undefined}
    >
      {!pond.enabled ? (
        <div className="pond-panel-cuerpo" data-qa-geometry-capacity="owned">
          <EstadoVacio
            tamano="normal"
            icono={<Scale size={20} />}
            titulo="Ponderación apagada"
            descripcion="Cada caso cuenta con peso 1 en frecuencias, cruces y dimensiones."
            accion={<PulsoButton variant="primary" onClick={() => setPonderacion({ enabled: true })}>Activar ponderación</PulsoButton>}
          />
        </div>
      ) : (
        /* C1: secciones independientes de alto intrínseco, separadas por una línea. */
        <div
          className="pond-panel-cuerpo pond-secciones"
          data-qa-geometry-group="analitica/ponderacion-declarado"
          data-qa-geometry-contract="intrinsic"
          data-qa-geometry-capacity="owned"
        >
          {/* Los controles previos a las metas comparten una columna de rótulos. */}
          <div className="pond-seccion pond-controles">
            <PesoPorColumna
              modo={porColumna ? "columna" : "calibracion"}
              pesoColumna={pond.peso_columna ?? ""}
              lectura={lecturaVariables}
              baseActiva={baseActiva}
              onModo={(modo) => setPonderacion(modo === "columna" ? { modo } : { modo: undefined, peso_columna: undefined })}
              onColumna={(peso_columna) => setPonderacion({ modo: "columna", peso_columna })}
            />
            {!porColumna ? (
              <>
              <PoblacionDeReferencia
                valor={poblacion.valor}
                inferida={poblacion.inferida}
                metasDelCenso={delCenso}
                onCambio={(p) => setPonderacion({ poblacion: p })}
              />
              <PonderacionPesoBase
                origen={origen}
                columna={pond.design?.peso_columna ?? ""}
                variables={variables}
                variablesLeidas={lecturaVariables.tipo === "lista"}
                onOrigen={(o) => setPonderacion(conOrigenPesoBase(pond, o))}
                onColumna={(peso_columna) => setDesign({ peso_columna })}
              />
              {origen === "estrato" && estrato ? (
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
              ) : null}
              {origen === "estrato" && !estrato ? (
                <AgregarVariable
                  variables={categoricas.filter((v) => !margenes.some((m) => m.var === v.name))}
                  rotulo="Elegir la variable del estrato"
                  onElegir={(nombre) => { pedir(nombre); setDesign({ var: nombre, pop_sizes: {} }); }}
                />
              ) : null}
              </>
            ) : null}
          </div>

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

          {!porColumna ? (
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
                    descripcion="Agrega una variable categórica y escribe la meta de cada categoría."
                  />
                }
              />
              <AgregarVariable
                variables={categoricas.filter((v) => !margenes.some((m) => m.var === v.name) && v.name !== estrato)}
                rotulo="Agregar variable de ajuste"
                onElegir={(nombre) => { pedir(nombre); upsertMargin({ var: nombre, targets: {} }); }}
              />
              {margenes.length > 0 ? (
                <p className="pond-nota">
                  Los porcentajes se calculan entre los casos cuya categoría tiene meta; no cuentan los casos sin dato ni las
                  categorías sin meta. Las metas se llevan a 100 %.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
