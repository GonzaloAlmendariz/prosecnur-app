import type {
  CalcMuestraAulasMethodComparison,
  CalcMuestraAulasMethodSummary,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { ComparadorMetodosVisual } from "../../didactica/ComparadorMetodosVisual";
import { fmtPct } from "../../sharedCore";
import { ClassroomBalanceTable } from "./ClassroomMethodPanels";
import { classroomMethodLabel, classroomScore } from "./classroomLabels";

export function ClassroomMethodComparator({
  ready,
  comparison,
  methods,
  recommendedMethodId,
  config,
  busy,
  onSelectMethod,
}: {
  ready: boolean;
  comparison: CalcMuestraAulasMethodComparison | null;
  methods: CalcMuestraAulasMethodSummary[];
  recommendedMethodId: string;
  config: CalcMuestraWorkspaceAulasConfig;
  busy: string | null;
  onSelectMethod: (config: CalcMuestraWorkspaceAulasConfig, methodId?: string) => void | Promise<void>;
}) {
  return (
    <section className="cmv2-method-comparator" aria-label="Comparación de métodos de selección">
      {/* F102 · Esto era un `<details>` cerrado rotulado «Abrir comparador
          vigente». Detrás del click no había información de apoyo: estaban los
          botones «Usar método», que cambian el método de muestreo de la corrida.
          Y dentro, a un segundo click, la evidencia visual para elegirlo.

          La etiqueta además escribía la afordancia —«Abrir…»— en el único hueco
          donde cabía decir de qué trata. Ahora el encabezado nombra la pieza y
          publica cuántos métodos se compararon. */}
      <header className="cmv2-method-comparator-head">
        {/* «Comparación de métodos» a secas, después de un bloque que también
            habla de los cuatro métodos, se leía como una segunda comparación.
            El título dice qué añade: aquí están los NÚMEROS de este marco, no la
            explicación de los métodos. Llevó un «Paso 2» mientras la didáctica
            iba encima; al invertirse el orden la numeración dejó de describir
            nada, porque ya no son dos pasos de una secuencia. */}
        <strong>Qué dio cada método con este marco</strong>
        {ready ? (
          <span>
            {methods.length} {methods.length === 1 ? "método evaluado" : "métodos evaluados"} sobre
            las mismas aulas
          </span>
        ) : null}
      </header>
      {!ready || !comparison ? (
        // Decía «Sin comparación vigente · El método configurado no se
        // presenta como recomendación hasta comparar el marco y el objetivo
        // actuales»: un matiz técnico, sin nombrar el botón que lo llena. Al
        // invertirse el orden de la pestaña este bloque pasó a ser LO PRIMERO
        // que se ve, así que su vacío es la primera frase de la pestaña para
        // quien llega sin haber comparado. Y desde f2623619 comparar dejó de
        // ser requisito para sortear, así que el vacío también lo dice.
        <div className="cmv2-classroom-empty is-compact">
          <div>
            <strong>Todavía no has comparado los métodos</strong>
            <em>
              Pulsa <b>Comparar los cuatro métodos</b> arriba para ver qué da cada uno con este
              marco. No es obligatorio: también puedes sortear directamente con el método que
              tengas configurado.
            </em>
          </div>
        </div>
      ) : (
        <div className="cmv2-method-comparator-body">
          <div
            className="cmv2-classroom-method-grid"
            data-qa-geometry-group="aulas-metodo-comparador"
            data-qa-geometry-contract="equal"
          >
            {methods.map((method) => {
              const recommended = method.method_id === recommendedMethodId;
              return (
                <article key={method.method_id} className={`cmv2-classroom-method-card${recommended ? " is-recommended" : ""}`} data-qa-geometry-member>
                  <small>{recommended ? "Recomendado" : "Resultado comparado"}</small>
                  <strong>{classroomMethodLabel(String(method.method_id)) || method.method_label}</strong>
                  <div className="cmv2-classroom-quality-metrics">
                    <span><strong>{classroomScore(method.representativity_score ?? method.overall_score)}</strong> representatividad</span>
                    <span><strong>{classroomScore(method.balance_score)}</strong> balance</span>
                    <span><strong>{fmtPct(method.duplicate_loss ?? 0)}</strong> repetidos</span>
                    <span><strong>{fmtPct(method.coverage_unique_pct ?? 0)}</strong> cobertura</span>
                  </div>
                  {/* Cuatro botones «Usar método» seguidos son indistinguibles
                      con teclado o lector de pantalla: se oye el mismo nombre
                      cuatro veces sin saber cuál método es cuál. El nombre
                      accesible dice de cuál se trata; el visible se queda corto
                      porque la tarjeta ya lo lleva encima. */}
                  <button
                    type="button"
                    className={recommended ? "cmv2-primary" : "cmv2-ghost"}
                    aria-label={`Usar ${classroomMethodLabel(String(method.method_id))}`}
                    onClick={() => void onSelectMethod(config, String(method.method_id))}
                    disabled={Boolean(busy)}
                  >
                    Usar método
                  </button>
                </article>
              );
            })}
          </div>
          <ClassroomBalanceTable rows={comparison.balance ?? []} methodId={recommendedMethodId} />
          {/* Anidado dentro del anterior, esto quedaba a DOS clicks. Es la
              lectura visual de la misma comparación que la tabla da en cifras:
              la evidencia con la que se elige método. Medido antes de abrirlo,
              porque el coste es la única razón legítima para plegar algo: 187
              líneas de DOM, sin Plotly. */}
          <ComparadorMetodosVisual comparison={comparison} />
        </div>
      )}
    </section>
  );
}
