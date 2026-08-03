import type { CalcMuestraCriteriosCascada } from "../../../../api/calcMuestraCriteriosI18b";
import { fmtInt } from "../../sharedCore";
import {
  construirMatrizCascada,
  cuadraConElMotor,
  type CeldaEnEdicion,
  type FilaMatriz,
} from "./matrizCascadaModel";
import "./matrizCascadaCriterios.css";

/**
 * ADR 0058 · La matriz de criterios cuenta cómo llegamos al marco.
 *
 * Gonzalo: «tiene que hablar de la historia al revés. Los criterios no hablan de
 * cuántos casos agregamos, sino de cuántos quitamos: cómo pasamos de un corte
 * universal de cursos-horario y, conformando cada criterio, vamos quitando más.
 * Al final, con cuántos nos quedamos por facultad. Eso se suma la columna final
 * con la fila final y nos da los cursos-horario elegibles.»
 *
 * Va **después** de los criterios, no antes: primero se decide en una facultad y
 * luego se mira el acumulado. Casos como «el mínimo se lleva 36 de los 45
 * cursos-horario de Gastronomía» sólo aparecen aquí — cada tarjeta mira un
 * criterio y lo que pesa es la suma.
 */

const pct = (v: number | null) =>
  v == null ? "—" : `${Math.round(v * 100)}%`;

function Celda({ quita, aplica, estado }: FilaMatriz["celdas"][number]) {
  const vacia = quita === 0;
  return (
    <td
      className="cmv2-mtz-celda"
      data-estado={estado}
      data-vacia={vacia || undefined}
      // El realce del embudo vivo entra sólo por color (ADR 0057, patrón 12).
      data-recalculado={estado === "editando" ? "true" : undefined}
      title={
        vacia
          ? aplica
            ? "Este criterio se aplicó aquí y no quitó ningún curso-horario"
            : "Este criterio no aplica en esta facultad"
          : undefined
      }
    >
      {/* La celda en cero distingue dos cosas que se ven igual si no se dicen:
          un criterio que corrió y no encontró nada, y uno que esta facultad no
          usa. El punto medio es «corrió y no quitó»; el guion, «no aplica». */}
      {vacia ? (aplica ? "·" : "—") : `−${fmtInt(quita)}`}
    </td>
  );
}

function Fila({ fila, total = false }: { fila: FilaMatriz; total?: boolean }) {
  const enEdicion = fila.celdas.some((c) => c.estado === "editando");
  return (
    <tr
      className={total ? "cmv2-mtz-total" : undefined}
      data-fila-edicion={enEdicion || undefined}
    >
      <th scope="row">{fila.label}</th>
      <td className="cmv2-mtz-universo">{fmtInt(fila.universo)}</td>
      {fila.celdas.map((c) => (
        <Celda key={c.criterioId} {...c} />
      ))}
      <td className="cmv2-mtz-quedan" data-recalculado={enEdicion ? "true" : undefined}>
        <b>{fmtInt(fila.quedan)}</b>
        <span>{pct(fila.supervivencia)}</span>
      </td>
    </tr>
  );
}

export function MatrizCascadaCriterios({
  cascada,
  edicion = null,
}: {
  cascada: CalcMuestraCriteriosCascada | null | undefined;
  /** Celda en edición: un criterio EN una facultad (ADR 0057, regla 1). */
  edicion?: CeldaEnEdicion;
}) {
  const matriz = construirMatrizCascada(cascada, edicion);

  if (!matriz) {
    // C3 · La superficie contiene su propio vacío, y dice qué hacer.
    return (
      <p className="cmv2-mtz-vacia">
        La cascada de criterios no está publicada en este marco. Reconstruye el marco para ver de
        dónde salen los cursos-horario elegibles.
      </p>
    );
  }

  const cuadra = cascada ? cuadraConElMotor(matriz, cascada) : true;

  return (
    <div className="cmv2-mtz">
      {/* El scroll vive en la tabla, no en la página (No Scroll Jail): con
          quince facultades y ocho criterios la tabla es ancha, y la
          alternativa —recortar columnas— escondería criterios. */}
      <div className="cmv2-mtz-scroll">
        <table className="cmv2-mtz-tabla">
          <caption className="cmv2-mtz-caption">
            Cada celda es lo que ese criterio <strong>quita</strong> en esa facultad. La última
            columna dice con cuántos cursos-horario nos quedamos y la última fila los suma.
          </caption>
          <thead>
            <tr>
              <th scope="col">Facultad</th>
              <th scope="col">Universo</th>
              {matriz.criterios.map((c) => (
                <th scope="col" key={c.id}>{c.label}</th>
              ))}
              <th scope="col">Quedan</th>
            </tr>
          </thead>
          <tbody>
            {matriz.filas.map((f) => (
              <Fila key={f.facultadKey} fila={f} />
            ))}
          </tbody>
          <tfoot>
            <Fila fila={matriz.total} total />
          </tfoot>
        </table>
      </div>

      <p className="cmv2-mtz-leyenda">
        <span><i data-m="quita" />lo que el criterio quitó</span>
        <span><i data-m="cero" />se aplicó y no quitó ninguno</span>
        <span><i data-m="noaplica" />no aplica en esa facultad</span>
        {edicion ? <span><i data-m="edit" />en edición · su fila espera confirmación</span> : null}
      </p>

      {/* Un descuadre no es un fallo de la matriz: significa que algún paso no
          publicó todas sus facultades. Decirlo es mejor que dejar al lector
          sumando una columna que no cierra. */}
      {!cuadra ? (
        <p className="cmv2-mtz-descuadre" role="note">
          La suma de las facultades no coincide con el total del motor: algún criterio no publicó
          todas sus facultades. Reconstruye el marco para cuadrarla.
        </p>
      ) : null}
    </div>
  );
}
