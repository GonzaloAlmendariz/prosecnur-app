/** Método primero como decisión comprensible; el comparador queda colapsado. */
import type {
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { AvisoModulo } from "../shared/AvisoModulo";
import { METODO_GOO_LEYENDA } from "../../didactica/MetodoGooEsquema";
import { fmtInt } from "../../sharedCore";
import { avisoDuracionComparacion } from "./duracionComparacion";
import { normalizeAulasSelectorEngine, normalizeUniversityAulasConfig } from "../shared/study";
import { DescuentoRepetidosControl } from "./DescuentoRepetidosControl";
import {
  ClassroomLabCommandBar,
  type ClassroomLabModel,
} from "./aulasParts";
import { ClassroomMethodComparator } from "./ClassroomMethodComparator";
import { ClassroomMethodDecisionHero, ClassroomMethodStories } from "./ClassroomMethodStories";
import { resolveClassroomMethodDecision } from "./classroomMethodStoriesModel";
import {
  AulasStageNotice,
  resolveAulasStageNotice,
  type AulasNavigate,
} from "./aulasSurfaceState";
import { ClassroomRiskList } from "./ClassroomRiskList";
import "../../didactica/didactica.css";
import "./aulas.css";

export function AulasMetodoTab({
  workspace,
  model,
  busy,
  onWorkspace,
  onCompare,
  onSelectMethod,
  onNavigate,
}: {
  workspace: CalcMuestraWorkspace;
  model: ClassroomLabModel;
  busy: string | null;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onCompare: (config: CalcMuestraWorkspaceAulasConfig, simulationRuns: number) => void | Promise<void>;
  onSelectMethod: (config: CalcMuestraWorkspaceAulasConfig, methodId?: string) => void | Promise<void>;
  onNavigate?: AulasNavigate;
}) {
  const { config, comparison, comparisonMethods, engineOption } = model;

  function setSelector(next: string) {
    const nextEngine = normalizeAulasSelectorEngine(next);
    onWorkspace({
      ...workspace,
      aulas_config: normalizeUniversityAulasConfig({
        ...config,
        selector: nextEngine,
        selector_engine: nextEngine,
        method_family: nextEngine === "pool_controlado" ? "probability_with_operational_optimization" : "balanced_probability",
      }),
    });
  }

  function runComparison() {
    void onCompare(config, config.simulation_runs ?? config.monte_carlo_n ?? 500);
  }

  // Decisión del usuario: vive en el workspace (autosave) y manda sobre el
  // eco de la última corrida (ver buildClassroomLabModel). Solo surte efecto
  // al ejecutar una selección nueva.
  function setSequentialDiscount(value: boolean) {
    onWorkspace({
      ...workspace,
      aulas_config: normalizeUniversityAulasConfig({ ...config, sequential_discount: value }),
    });
  }

  const hayComparacion = model.comparisonReady && Boolean(comparison && comparisonMethods.length);
  const stageNotice = resolveAulasStageNotice(model, "metodo");
  const decision = resolveClassroomMethodDecision({
    comparisonReady: model.comparisonReady,
    comparison,
    configuredMethodId: String(config.selector_engine ?? config.selector),
    configuredMethodLabel: engineOption.label,
  });

  // Cuánto va a tardar esto, ANTES de pulsar. Medido: con el reparto real por
  // 17 facultades una sola corrida del método balanceado pasa de ocho minutos
  // sobre 3.142 aulas, contra 57 s con objetivo global. Descubrirlo por el
  // contador, cuando ya arrancó, no es aviso: es sorpresa.
  // Las INCLUIDAS, no todas las filas del frame: la comparación trabaja sobre
  // el marco elegible. `frameRows` trae también las excluidas por criterios y
  // anunciar 5.269 donde se comparan 3.373 es exactamente el defecto que este
  // módulo lleva el día entero reparando — un rótulo con otro número.
  const aulasDelMarco = model.frameIncludedCount;
  const estratosConCuota = model.aulasPorEstrato.length;
  const duracion = avisoDuracionComparacion({ aulas: aulasDelMarco, facultades: estratosConCuota });

  return (
    <div
      className="cmv2-aulas-stack"
      // Sin esta declaración el gate visual auditaba sólo el resumen del
      // toolbar y devolvía «ok=true» sin haber mirado esta pestaña: verde por
      // ausencia. `intrinsic` porque sus bloques —el héroe de la decisión, el
      // aviso de duración, la comparación— tienen alturas propias.
      data-qa-geometry-group="calc-muestra/aulas-metodo"
      data-qa-geometry-contract="intrinsic"
    >
      <ClassroomMethodDecisionHero decision={decision} />

      {!hayComparacion && duracion.avisar && (
        <AvisoModulo tone="info" title="Comparar los cuatro métodos va a tardar" compact>
          <p>
            Con {fmtInt(aulasDelMarco)} cursos-horario repartidos en {fmtInt(estratosConCuota)} facultades, la comparación puede llevar horas: balancear
            respetando la cuota de cada facultad a la vez es mucho más caro que una cuota global.
            Nada la interrumpe y el progreso se conserva si navegas o recargas — pero cuenta con ese
            tiempo antes de lanzarla.
          </p>
        </AvisoModulo>
      )}

      {hayComparacion && (
        <ClassroomLabCommandBar
          mostrarRecomendado={false}
          model={model}
          busy={busy}
          acciones={["comparar"]}
          onCompare={onCompare}
        />
      )}

      {stageNotice && (
        <AulasStageNotice
          notice={stageNotice}
          onNavigate={onNavigate}
          onAction={stageNotice.localAction === "compare" ? runComparison : undefined}
          disabled={Boolean(stageNotice.localAction) && (Boolean(busy) || !model.frameReady || !model.hasCalculatedQuota)}
        />
      )}

      {/* El resumen de riesgos vivía en una columna lateral propia. Medido el
          2026-08-22 sobre HSVG2026: la columna izquierda 1.131 px y el aside
          126, un 11 %, con ~1.000 px de hueco muerto en una franja de 387 px de
          ancho. Y conceptualmente tampoco encajaba: es el ESTADO del cálculo,
          no material para aprender, así que se lee antes de bajar a las
          tarjetas, no al costado de ellas.

          El párrafo que lo acompañaba explicaba los cuatro métodos OTRA VEZ,
          con un juego de nombres propio —el quinto de la pestaña— que dejó de
          existir en pantalla al unificarse los nombres. Lo que decía ya está en
          las cuatro tarjetas; lo que cerraba —que la recomendación sale de
          medir contra este marco— lo dice la nota al pie del comparador. */}
      <div className="cmv2-classroom-lab-franja">
        <ClassroomRiskList risks={comparison?.risk_flags ?? []} audited={model.comparisonReady}
          resumen
          alcance="Riesgos que detectó la comparación"
          onVerDetalle={onNavigate ? () => onNavigate("aulas", "auditoria") : undefined}
        />
      </div>
      {/*
        * Los dos bloques de esta pestaña NO son dos comparaciones: uno dice qué
        * dio cada método con estos datos y el otro qué hace cada uno. Nada lo
        * decía, así que al bajar parecía que la comparación empezaba otra vez.
        * Gonzalo, 2026-08-22: «luego abajo te pide por comparación de métodos
        * otra vez […] no se entiende qué se está haciendo en cada una de las
        * etapas».
        *
        * Iban numerados como Paso 1 (didáctica) y Paso 2 (resultado). El orden
        * era correcto para la primera visita y un peaje a partir de la segunda:
        * 1.344 px de explicación abstracta —que la propia tarjeta declara
        * «esquema ilustrativo · no son aulas reales»— antes de ver lo propio.
        * Invertido con la aprobación de Gonzalo el 2026-08-22. Y se retira la
        * numeración: ya no son dos pasos de una secuencia, son la respuesta y
        * su material de consulta.
        */}
      <ClassroomMethodComparator
        ready={hayComparacion}
        comparison={comparison}
        methods={comparisonMethods}
        recommendedMethodId={decision.kind === "recommended" ? decision.methodId : ""}
        config={config}
        busy={busy}
        onSelectMethod={onSelectMethod}
      />

      <div className="cmv2-classroom-lab-grid cmv2-classroom-lab-grid--full">
        <div className="cmv2-classroom-lab-main">
          <div className="cmv2-subhead">
            <strong>Cómo funciona cada uno de los cuatro métodos</strong>
            <small>
              En qué se diferencian al elegir, para leer los resultados de arriba.{" "}
              {METODO_GOO_LEYENDA}
            </small>
          </div>
          <ClassroomMethodStories
            configuredMethodId={String(config.selector_engine ?? config.selector)}
            recommendedMethodId={decision.kind === "recommended" ? decision.methodId : undefined}
            relatoDisponible={model.selectionReady}
            onConfigure={setSelector}
          />

          <DescuentoRepetidosControl
            checked={config.sequential_discount ?? true}
            selectorEngine={String(config.selector_engine ?? config.selector)}
            onChange={setSequentialDiscount}
          />
        </div>
      </div>

    </div>
  );
}
