/**
 * Detalle por-facultad de un criterio de curso-horario de tipo set (flat o
 * jerárquico): toggles de las categorías de ESA facultad con su CH/elegibles y
 * el botón «Volver a heredar el global». Extraído de TipoSesionPorFacultad para
 * reusarse tanto ahí (tabla por facultad del tipo de sesión) como en la vista
 * integrada facultad-primaria (decisión de session/condition/teacher junto a la
 * radiografía). Presentacional: la compilación a `exceptions[facKey]` (op
 * "replace") vive en tipoSesionModel.ts (testeada). Toda edición pasa por `onSel`
 * (respeta el borrador→confirmar de la superficie que lo embebe).
 */
import { useState } from "react";
import type { CriterioSeleccion, CriterioVariable } from "../../../../api/client";
import { fmtInt, fmtPct } from "../../sharedCore";
import { Switch } from "./Switch";
import { heredarFacultad, toggleTipoEnFacultad, type FilaFacultad } from "./tipoSesionModel";
import { CategoriaEvidencia, dominioCategorias, EjeCategorias } from "./CategoriaEvidencia";
import type { AporteCategoria } from "./controles";

/** A partir de tantas categorías se pliega el ruido (0 CH aquí y no activo). */

export function FacultadCategoriaToggles({
  fila,
  variable,
  sel,
  onSel,
  ariaLabel,
  sinBarra = false,
  evidencia,
}: {
  /** Fila con las categorías de la facultad (CH/elegibles + activo efectivo). */
  fila: FilaFacultad;
  variable: CriterioVariable;
  sel: CriterioSeleccion;
  /** Emite la selección siguiente (compila a op "replace" de la facultad). */
  onSel: (next: CriterioSeleccion) => void;
  ariaLabel: string;
  /** Oculta la mini-barra de proporción (cuando el criterio ya muestra su
   *  distribución en una tabla propia, p.ej. tipo de sesión): evita el % doble. */
  sinBarra?: boolean;
  /**
   * ADR 0057 · La evidencia de cada categoría, en su mismo contenedor.
   *
   * Devuelve CH, alumnos, distribución y tasa para una categoría de ESTA
   * facultad. Sin ella el conmutador vuelve a decidirse contra una cifra suelta,
   * que es lo que el ADR corrige.
   */
  evidencia?: (categoriaKey: string) => AporteCategoria | null;
}) {
  // Domar listas largas (p.ej. condición del curso trae ~52 valores DTI, casi
  // todos ruido): muestra las que tienen CH en la facultad (o están activas) y
  // pliega el resto. Si el catálogo no trae distribución, no pliega nada.
  const hayDistribucion = fila.tipos.some((t) => t.ch != null);
  // F109 · El filtro era `ch > 0 || activo`, y `ch` cuenta sólo los CH que
  // **siguen incluidos**. Una categoría que el criterio excluye tiene `ch = 0` y
  // el conmutador apagado, así que se plegaba — y el botón la contaba como «sin
  // cursos en esta facultad» teniéndolos.
  //
  // Es la misma confusión que F105 reparó DENTRO de la tarjeta, gobernando aquí
  // **qué tarjetas llegas a ver**: lo que un criterio deja fuera desaparecía de
  // la lista rotulado como inexistente. `contraste_total` viene filtrado por
  // facultad (`evidenciaPorCategoria` cruza por facultad Y segmento), así que
  // dice si la categoría tiene cursos AQUÍ estén incluidos o no.
  //
  // El domado original sobrevive: las ~52 categorías de DTI que son ruido no
  // tienen cursos en esta facultad, su contraste es 0 y siguen plegadas.
  const tieneCursosAqui = (t: { key: string; ch?: number | null }) => {
    const contraste = evidencia?.(t.key)?.chContraste;
    return contraste != null ? contraste > 0 : (t.ch ?? 0) > 0;
  };
  const relevantes = hayDistribucion
    ? fila.tipos.filter((t) => tieneCursosAqui(t) || t.activo)
    : fila.tipos;
  const ocultasN = fila.tipos.length - relevantes.length;
  // Las categorías sin cursos aquí no reciben tarjeta: se nombran abajo.
  const sinOrdenar = hayDistribucion && ocultasN > 0 ? relevantes : fila.tipos;
  /*
   * G37 · Las categorías con más cursos-horario, primero.
   *
   * Gonzalo: «las categorías con mayor cantidad de CH siempre van primero en su
   * criterio». El orden del catálogo es el de la columna de origen —alfabético o
   * de aparición—, que no dice nada sobre qué decisión pesa: la categoría que se
   * lleva la mitad del marco podía quedar quinta, debajo de cuatro residuales.
   *
   * Ordena por **`chContraste`** —los cursos-horario que la categoría tiene en
   * esta facultad, estén incluidos o no—, no por `ch` —los que siguen dentro—.
   * Con `ch` la lista se reordenaría sola a cada conmutador: apagas una y salta
   * al fondo, y la siguiente que querías tocar ya no está donde la dejaste.
   * `chContraste` no cambia al decidir, así que el orden es el mismo durante
   * toda la sesión de ajuste.
   *
   * Desempate por etiqueta para que dos categorías del mismo tamaño no bailen
   * entre renders.
   */
  const pesoDe = (t: { key: string; ch?: number | null }) => {
    const contraste = evidencia?.(t.key)?.chContraste;
    return contraste ?? t.ch ?? 0;
  };
  const visibles = [...sinOrdenar].sort(
    (a, b) => pesoDe(b) - pesoDe(a) || a.label.localeCompare(b.label, "es"),
  );
  // Regla 3 del ADR: la escala es del criterio en esta facultad, no de cada caja.
  const dominio = dominioCategorias(visibles.map((t) => evidencia?.(t.key) ?? null));
  return (
    <div className="cmv2-crit-tsf-detalle" role="group" aria-label={ariaLabel}>
      {!hayDistribucion ? (
        // F50 · Decir de dónde sale la lista, porque explica lo que se ve.
        //
        // Sin distribución por facultad, el catálogo publica **cada valor
        // distinto de la columna** y aquí se ofrece uno a uno como decisión. Si
        // la columna mezcla la categoría del docente con su nombre —caso
        // reportado, con «PRADO LOAYZA, ANDRES» junto a «DOCENTE ORDINARIO -
        // PRINCIPAL»—, los nombres aparecen como si fueran categorías. La app
        // no puede adivinar cuál es cuál sin inventarse una heurística que
        // fallaría con categorías legítimas, pero sí puede decir qué está
        // mirando el usuario y que el problema está en el dato.
        <p className="cmv2-crit-empty-note" data-sin-distribucion="true">
          El catálogo no trae distribución por facultad para este criterio, así que la lista
          son <strong>todos los valores distintos de la columna</strong>. Si aparecen valores
          que no son categorías —nombres, códigos sueltos—, la columna de origen los mezcla:
          revísala en Datos › Variables antes de decidir con ella.
        </p>
      ) : null}
      {dominio ? <EjeCategorias dominio={dominio} /> : null}
      <ul
        className="cmv2-crit-tsf-tipos"
        data-qa-geometry-group="calc-muestra/categorias-criterio-facultad"
        data-qa-geometry-contract="intrinsic"
      >
        {visibles.map((t) => {
          const pct = fila.chTotal > 0 && t.ch != null ? t.ch / fila.chTotal : null;
          return (
            <li
              key={t.key}
              className="cmv2-crit-tsf-tipo"
              data-checked={t.activo}
              data-qa-geometry-member
              data-qa-geometry-capacity="owned"
            >
              <div className="cmv2-crit-item-main">
                <Switch
                  checked={t.activo}
                  ariaLabel={`${t.label} en ${fila.facLabel}`}
                  onToggle={() => onSel(toggleTipoEnFacultad(variable, sel, fila.facKey, t.key))}
                />
                <span className="cmv2-crit-item-label">{t.label}</span>
              </div>
              {!sinBarra && pct != null ? (
                <span className="cmv2-crit-item-share" title={`${fmtPct(pct)} de los CH de la facultad`}>
                  <span className="cmv2-crit-item-bar" aria-hidden="true">
                    <i style={{ width: `${Math.max(2, pct * 100)}%` }} />
                  </span>
                  <span className="cmv2-crit-item-pct">{fmtPct(pct)}</span>
                </span>
              ) : null}
              {(() => {
                const dato = evidencia?.(t.key) ?? null;
                return dato && dato.distribucion && dominio ? (
                  <CategoriaEvidencia aporte={dato} dominio={dominio} />
                ) : null;
              })()}
              {/* F98 · Esta columna sólo se dibuja cuando la categoría NO trae
                  su evidencia completa. Con ella, mostraba un «849 CH» suelto al
                  borde derecho mientras la evidencia decía «639 CH» dos dedos a
                  la izquierda: dos cifras distintas de cursos-horario para la
                  misma categoría, y la de la derecha sin decir de qué era —el
                  contraste contra el total, que la evidencia ya nombra—. */}
              {evidencia?.(t.key)?.distribucion ? null : (
                <span className="cmv2-crit-item-count">
                  {t.ch != null ? (
                    <>
                      {fmtInt(t.ch)} <em>CH</em>
                    </>
                  ) : hayDistribucion ? (
                    <em>sin distribución</em>
                  ) : null}
                  {t.elegibles != null ? (
                    <>
                      {" · "}
                      {fmtInt(t.elegibles)} <em>elegibles</em>
                    </>
                  ) : null}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {/* G33 · Ya no se pliegan. Gonzalo: «quedamos en que ya ninguno se
          colapsa».

          Aquí había un «Ver todas (42 sin cursos en esta facultad)» que
          escondía las categorías sin ningún curso-horario. El argumento era
          real —42 tarjetas diciendo «sin cursos aquí» son ruido— pero la salida
          no es plegar: es **no darles tarjeta**. No tienen distribución, ni
          cifras, ni decisión que ofrecer; sólo su nombre.

          Así nada queda oculto y nada ocupa espacio que no merece. */}
      {ocultasN > 0 && hayDistribucion ? (
        <p className="cmv2-crit-tsf-sincursos">
          <span>
            Sin cursos-horario en esta facultad ({fmtInt(ocultasN)}):
          </span>{" "}
          {fila.tipos
            .filter((t) => !relevantes.some((r) => r.key === t.key))
            .map((t) => t.label)
            .join(" · ")}
        </p>
      ) : null}
      {fila.decision === "propia" ? (
        <button
          type="button"
          className="cmv2-crit-tsf-heredar"
          onClick={() => onSel(heredarFacultad(sel, fila.facKey))}
        >
          Quitar la restricción de esta facultad
        </button>
      ) : (
        <p className="cmv2-crit-empty-note">
          Entran todas las categorías. Ajusta una para decidir sólo en esta facultad.
        </p>
      )}
    </div>
  );
}
