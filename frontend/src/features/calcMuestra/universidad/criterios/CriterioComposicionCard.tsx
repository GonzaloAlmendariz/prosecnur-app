/**
 * Tarjeta de la composición homogénea del curso-horario, en DOS
 *
 * G33 · Ya no se llama «criterio 8»: el orden del embudo lo fija el motor y
 * cambió (G30). Un número de orden escrito a mano en el rótulo sobrevive al
 * orden que nombra y acaba mintiendo — pasó igual con «criterio 7» en el
 * mínimo, que hoy es el primero.
 *
 * pasos ordenados (reunión con el asesor muestral, 2026-07-15):
 *   1. ≥ pct de los matriculados pertenecen a la MISMA FACULTAD del curso
 *      (require_faculty_prevalence + min_faculty_prevalence_pct),
 *   2. ≥ pct cursan el MISMO NIVEL del curso
 *      (require_cycle_homogeneity + min_cycle_homogeneity_pct).
 * El orden importa: el paso de nivel solo tiene sentido sobre cursos ya
 * anclados a su facultad; aplicado solo, "vuela" el marco (los cursos con
 * mezcla natural de facultades desaparecen).
 *
 * El toggle legacy require_min_prevalence (elegibles/matrícula) queda como
 * métrica REFERENCIAL, visualmente secundaria: no es la composición.
 *
 * Persistencia: edita aulas_config directo con autosave inmediato (mismo
 * patrón que teacher_type_orden); no pasa por el borrador confirmable porque
 * no vive en criterios_seleccion.
 */
import type { CalcMuestraWorkspaceAulasConfig } from "../../../../api/client";
import { CategoriaEvidencia, dominioCategorias } from "./CategoriaEvidencia";
import type { AporteCategoria } from "./controles";
import { ControlUmbral } from "./ControlUmbral";
import { Switch } from "./Switch";

/**
 * G38 · La evidencia de cada paso, dentro del paso.
 *
 * Gonzalo: «en Composición del curso-horario no hay forma de saber cuántos
 * perdemos por el porcentaje que estamos aplicando». Los dos pasos se decidían
 * con un deslizador y una frase, sin ver sobre qué se está cortando — el único
 * criterio del embudo sin su tarjeta estándar.
 *
 * Su variante es `proporcion`: el motor publica la señal en porcentaje con
 * escala 0–100, así que la caja y la densidad describen la composición misma,
 * no los alumnos elegibles.
 */
function EvidenciaPaso({ aporte, umbral }: { aporte: AporteCategoria | null; umbral: number }) {
  if (!aporte) return null;
  const conUmbral: AporteCategoria = { ...aporte, umbral: { valor: umbral } };
  // Regla 3 del ADR: la escala es del criterio. Aquí hay una sola caja, pero el
  // dominio se pide igual para que el eje salga de `escalaEje` cuando el motor
  // la publica y no del rango de esta única distribución.
  const dominio = dominioCategorias([conUmbral], umbral);
  if (!dominio) return null;
  return <CategoriaEvidencia aporte={conUmbral} dominio={dominio} variante="proporcion" />;
}

/** Proporción 0–1 → porcentaje entero para el input. */
function pctDe(prop: number | undefined, fallback: number): number {
  const v = typeof prop === "number" && Number.isFinite(prop) ? prop : fallback;
  return Math.round(Math.min(1, Math.max(0, v)) * 100);
}

/** Input de porcentaje (50–100) que persiste proporción 0–1. */
/**
 * G24 · El nivelador, también en las proporciones.
 *
 * Era un campo numérico suelto con flechas de 5 en 5. Fijar un 80 % se escribe
 * bien, pero **buscar** el umbral no: hay que teclear, mirar qué recorta,
 * teclear otra vez. El deslizador recorre la escala; el campo la clava. Es el
 * mismo par que en umbral y por la misma razón — quitar cualquiera de los dos
 * deja media tarea sin herramienta.
 *
 * El rango arranca en 50: por debajo, exigir «al menos la mitad» deja de ser una
 * regla de composición y pasa a ser otra cosa. Ese tope inferior ya estaba en el
 * campo anterior y se conserva.
 */
function InputPct({
  value,
  fallback,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: number | undefined;
  fallback: number;
  disabled: boolean;
  ariaLabel: string;
  onChange: (prop: number) => void;
}) {
  return (
    <ControlUmbral
      valor={pctDe(value, fallback)}
      min={50}
      max={100}
      paso={5}
      sufijo="%"
      etiqueta={ariaLabel}
      deshabilitado={disabled}
      onCambio={(v) => onChange(Math.min(100, Math.max(1, Math.round(v))) / 100)}
    />
  );
}

export function CriterioComposicionCard({
  config,
  onPatch,
  evidenciaDe,
}: {
  /** Config de aulas ya normalizado (la tab lo deriva del workspace). */
  config: CalcMuestraWorkspaceAulasConfig;
  /** Persiste el patch en aulas_config (autosave inmediato del workspace). */
  onPatch: (patch: Partial<CalcMuestraWorkspaceAulasConfig>) => void;
  /**
   * G38 · Aporte publicado por el motor para cada paso (`c8_facultad`, `c8`,
   * `c7`). Sin él la tarjeta se dibuja igual, sin evidencia: la superficie no
   * inventa una distribución que el motor no publicó.
   */
  evidenciaDe?: (criterioId: string) => AporteCategoria | null;
}) {
  // ADR 0057 · Una regla ACTIVA no puede estar plegada.
  //
  // Esta métrica heredada normalmente está apagada, y por eso vivía tras un
  // control cerrado. Pero cuando está encendida **recorta el marco**, y hacerlo
  // desde detrás de un plegado es la peor versión del defecto que este ADR
  // combate: no es que cueste encontrarla, es que el usuario no sabe que está
  /*
   * G33 · Ya no se pliega. Gonzalo: «quedamos en que ya ninguno se colapsa».
   *
   * El argumento anterior —«apagada sigue contenida, no es contenido oculto,
   * es una opción inactiva»— es exactamente la racionalización que la regla
   * prohíbe: quien no la abre no sabe que existe, y una métrica que puede
   * cambiar un denominador no puede depender de que alguien la descubra.
   *
   * Se queda visible y apagada, que es lo que de verdad significa «inactiva».
   */
  const paso1 = config.require_faculty_prevalence ?? false;
  const paso2 = config.require_cycle_homogeneity ?? false;
  const activos = (paso1 ? 1 : 0) + (paso2 ? 1 : 0);
  const legacyOn = config.require_min_prevalence ?? false;

  return (
    <article className="cmv2-crit-card" data-scope="aula" data-kind="pasos" data-pending="false">
      <header className="cmv2-crit-card-head">
        <div className="cmv2-crit-card-title">
          <strong>Composición del curso-horario</strong>
          <span className="cmv2-crit-card-meta">
            <span className="cmv2-crit-col">regla común · dos pasos en orden</span>
          </span>
        </div>
        <div className="cmv2-crit-card-state">
          <span className="cmv2-crit-head-count">
            {activos === 0 ? "apagado · no filtra" : `${activos} de 2 pasos activos`}
          </span>
        </div>
      </header>

      <div className="cmv2-crit-card-body">
        <p className="cmv2-crit-paso-intro">
          Exige que cada curso-horario esté compuesto por estudiantes de la facultad y el nivel del curso. Se aplica
          en este orden: <strong>primero facultad, luego nivel</strong>. Activar solo el paso de nivel recorta el
          marco de forma drástica: los cursos con mezcla natural de facultades (transversales, electivos) quedarían
          fuera sin haber fijado antes a quién pertenece el curso.
        </p>

        <ol
          className="cmv2-crit-pasos"
          data-qa-geometry-group="calc-muestra/composicion-ch-pasos"
          data-qa-geometry-contract="intrinsic"
        >
          <li
            className="cmv2-crit-paso"
            data-active={paso1 ? "true" : "false"}
            data-qa-geometry-member
            data-qa-geometry-capacity="owned"
          >
            <span className="cmv2-crit-paso-rank" aria-hidden="true">1</span>
            <div className="cmv2-crit-paso-copy">
              <strong>Misma facultad del curso</strong>
              <span>
                Al menos el {pctDe(config.min_faculty_prevalence_pct, 0.8)}% de los matriculados pertenece a la
                facultad que dicta el curso.
              </span>
            </div>
            <InputPct
              value={config.min_faculty_prevalence_pct}
              fallback={0.8}
              disabled={!paso1}
              ariaLabel="Porcentaje mínimo de la misma facultad"
              onChange={(prop) => onPatch({ min_faculty_prevalence_pct: prop })}
            />
            <Switch
              checked={paso1}
              ariaLabel="Exigir misma facultad del curso (paso 1 de la composición)"
              onToggle={() => onPatch({ require_faculty_prevalence: !paso1 })}
            />
            <EvidenciaPaso
              aporte={evidenciaDe?.("c8_facultad") ?? null}
              umbral={pctDe(config.min_faculty_prevalence_pct, 0.8)}
            />
          </li>
          <li
            className="cmv2-crit-paso"
            data-active={paso2 ? "true" : "false"}
            data-qa-geometry-member
            data-qa-geometry-capacity="owned"
          >
            <span className="cmv2-crit-paso-rank" aria-hidden="true">2</span>
            <div className="cmv2-crit-paso-copy">
              <strong>Mismo nivel del curso</strong>
              <span>
                Al menos el {pctDe(config.min_cycle_homogeneity_pct, 0.8)}% de los matriculados cursa el nivel del
                curso (no el ciclo individual del estudiante).
              </span>
            </div>
            <InputPct
              value={config.min_cycle_homogeneity_pct}
              fallback={0.8}
              disabled={!paso2}
              ariaLabel="Porcentaje mínimo del mismo nivel del curso"
              onChange={(prop) => onPatch({ min_cycle_homogeneity_pct: prop })}
            />
            <Switch
              checked={paso2}
              ariaLabel="Exigir mismo nivel del curso (paso 2 del criterio 8)"
              onToggle={() => onPatch({ require_cycle_homogeneity: !paso2 })}
            />
            <EvidenciaPaso
              aporte={evidenciaDe?.("c8") ?? null}
              umbral={pctDe(config.min_cycle_homogeneity_pct, 0.8)}
            />
          </li>
        </ol>
        <span className="cmv2-crit-num-hint">
          Se guarda al instante; recalcula el marco (botón de arriba) para ver su efecto en los cursos-horario.
        </span>

        <div className="cmv2-crit-legacy">
          {/* G33 · Era un botón que plegaba. Sin nada que plegar es un rótulo:
              un control que no controla nada invita a un click que no hace
              nada. */}
          <p className="cmv2-crit-legacy-titulo">
            Prevalencia de elegibles (referencial){legacyOn ? " · activa" : ""}
          </p>
          {true ? (
            <div className="cmv2-crit-legacy-body">
              <div className="cmv2-crit-legacy-row">
                <div className="cmv2-crit-paso-copy">
                  <strong>Prevalencia de elegibles (referencial)</strong>
                  <span>
                    Proporción de elegibles sobre la matrícula total del curso-horario. Es una métrica referencial
                    heredada: <strong>no forma parte de la composición</strong> y normalmente queda apagada.
                  </span>
                </div>
                <InputPct
                  value={config.min_prevalence_pct}
                  fallback={0.8}
                  disabled={!legacyOn}
                  ariaLabel="Porcentaje mínimo de prevalencia de elegibles (referencial)"
                  onChange={(prop) => onPatch({ min_prevalence_pct: prop })}
                />
                <Switch
                  checked={legacyOn}
                  ariaLabel="Exigir prevalencia de elegibles (métrica referencial legacy)"
                  onToggle={() => onPatch({ require_min_prevalence: !legacyOn })}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
