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
import { ChevronDown } from "../../../../vendor/lucide-react";
import { fmtInt } from "../../sharedCore";
import { Switch } from "./Switch";
import { usarPlegado } from "./usarPlegado";

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
/**
 * G39 · Qué cuesta la posición en la que está el control, ahora mismo.
 *
 * Gonzalo: «el slider está súper bien, pero no hay forma de saber cuántas CH
 * descartamos (y su porcentaje con que nos quedamos respecto al total) para
 * poder tomar una decisión más meditada, a ver si aplicamos más o menos
 * porcentaje mínimo».
 *
 * La cifra se **consulta** en la tabla que publica el motor, no se calcula: son
 * los descartes exactos en cada una de las 21 posiciones que el control puede
 * tomar. Sumar los cubos del histograma parecía equivalente y falla justo en el
 * umbral —son cerrados por la derecha, así que un curso-horario que está
 * exactamente en el corte caería del lado de los descartados aunque el criterio
 * lo admita— y en el extremo de la escala no hay convención que lo arregle.
 */
function CosteDelCorte({ tabla, umbral }: {
  tabla: { cortes: number[]; fuera: number[]; total: number } | null | undefined;
  umbral: number;
}) {
  if (!tabla || tabla.total <= 0) return null;
  const i = tabla.cortes.indexOf(umbral);
  if (i < 0) return null;
  const fuera = tabla.fuera[i];
  const quedan = tabla.total - fuera;
  const pct = Math.round((quedan / tabla.total) * 100);
  return (
    <p className="cmv2-crit-coste" role="status">
      Con <strong>{umbral}%</strong> descartas <strong>{fmtInt(fuera)}</strong> de {fmtInt(tabla.total)} cursos-horario
      <span className="cmv2-crit-coste-queda">te quedas con el {pct}%</span>
    </p>
  );
}

function EvidenciaPaso({ aporte, umbral }: { aporte: AporteCategoria | null; umbral: number }) {
  if (!aporte) return null;
  const conUmbral: AporteCategoria = { ...aporte, umbral: { valor: umbral } };
  // Regla 3 del ADR: la escala es del criterio. Aquí hay una sola caja, pero el
  // dominio se pide igual para que el eje salga de `escalaEje` cuando el motor
  // la publica y no del rango de esta única distribución.
  const dominio = dominioCategorias([conUmbral], umbral);
  if (!dominio) return null;
  return (
    <>
      <CosteDelCorte tabla={aporte.descartePorCorte} umbral={umbral} />
      <CategoriaEvidencia aporte={conUmbral} dominio={dominio} variante="proporcion" />
    </>
  );
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
   * G33 → G39 · De «no se pliega» a «se pliega, pero abierta».
   *
   * G33 quitó el plegado porque la métrica heredada vivía escondida tras un
   * control cerrado: quien no lo abría no sabía que existía, y una regla que
   * puede recortar el marco no puede depender de que alguien la descubra.
   *
   * Gonzalo ahora: «Composición del curso-horario es el único criterio que no
   * tiene la habilidad de comprimirse cuando debería; si bien todos están
   * abiertos por defecto, también deberían poder comprimirse». No es una
   * marcha atrás — es la distinción que faltaba: **plegado por defecto** esconde;
   * **plegable** es una herramienta del lector sobre una superficie larga. Lo
   * que la regla prohíbe es lo primero.
   *
   * Así que abre siempre y se puede cerrar, igual que los demás criterios.
   */
  const [abierto, setAbierto] = usarPlegado(true);
  const paso1 = config.require_faculty_prevalence ?? false;
  const paso2 = config.require_cycle_homogeneity ?? false;
  const activos = (paso1 ? 1 : 0) + (paso2 ? 1 : 0);
  const legacyOn = config.require_min_prevalence ?? false;

  return (
    <article className="cmv2-crit-card" data-scope="aula" data-kind="pasos" data-pending="false" data-open={abierto || undefined}>
      <button
        type="button"
        className="cmv2-crit-card-head cmv2-crit-card-head--plegable"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <div className="cmv2-crit-card-title">
          <span className="cmv2-crit-card-chevron" aria-hidden="true">
            <ChevronDown size={14} />
          </span>
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
      </button>

      {abierto ? (
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

        {/*
          * G39 · Qué es esta regla y por qué está aparte.
          *
          * Gonzalo: «no entiendo bien el propósito de referencial y gris».
          *
          * Tenía razón en las dos mitades. El texto decía lo que la regla **no
          * es** —«métrica referencial heredada», «no forma parte de la
          * composición»— y nunca lo que hace; y el gris la presentaba como
          * secundaria cuando, encendida, **recorta el marco igual que los otros
          * dos pasos**. Contar su procedencia en vez de su función es útil para
          * quien mantiene el código y no para quien decide.
          *
          * Va aparte porque mide otra cosa: los dos pasos preguntan si el curso
          * es homogéneo (misma facultad, mismo nivel); ésta pregunta cuánta de
          * su matrícula es elegible. No es un tercer paso de la composición —
          * aplicarla en orden con las otras no significa nada—, pero sí es un
          * criterio con su propio corte, y se presenta como tal.
          */}
        <div className="cmv2-crit-otra-regla">
          <p className="cmv2-crit-otra-regla-eyebrow">
            Otra regla · mide la matrícula, no la homogeneidad
          </p>
          {/*
            * Clase propia y no `cmv2-crit-paso`: comparte el layout pero **no es
            * un paso de la composición**, y decirlo con la clase importa. El
            * contrato geométrico cuenta los pasos por esa clase, así que
            * reusarla habría hecho que la superficie declarara tres pasos
            * mientras su propio rótulo dice que son dos y otra regla aparte.
            * Una clase es una afirmación sobre qué es la cosa (C1).
            */}
          <div className="cmv2-crit-otra-regla-fila" data-active={legacyOn ? "true" : "false"}>
            <div className="cmv2-crit-paso-copy">
              <strong>Prevalencia de elegibles</strong>
              <span>
                Descarta los cursos-horario donde los alumnos elegibles son menos del{" "}
                {pctDe(config.min_prevalence_pct, 0.8)}% de la matrícula total. Sirve para no
                trabajar cursos donde el público del estudio es una minoría; no dice nada sobre
                si el curso pertenece a una facultad o a un nivel.
              </span>
            </div>
            <InputPct
              value={config.min_prevalence_pct}
              fallback={0.8}
              disabled={!legacyOn}
              ariaLabel="Porcentaje mínimo de prevalencia de elegibles"
              onChange={(prop) => onPatch({ min_prevalence_pct: prop })}
            />
            <Switch
              checked={legacyOn}
              ariaLabel="Exigir prevalencia mínima de elegibles"
              onToggle={() => onPatch({ require_min_prevalence: !legacyOn })}
            />
            <EvidenciaPaso
              aporte={evidenciaDe?.("c7") ?? null}
              umbral={pctDe(config.min_prevalence_pct, 0.8)}
            />
          </div>
        </div>
      </div>
      ) : null}
    </article>
  );
}
