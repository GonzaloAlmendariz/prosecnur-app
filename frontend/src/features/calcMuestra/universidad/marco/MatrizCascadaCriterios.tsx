import { useEffect, useRef, useState } from "react";

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

/**
 * G12 · Qué celdas se movieron en el último recálculo.
 *
 * Gonzalo: «estos criterios, estos gráficos, de forma animada y fluida tienen
 * que actualizarse conforme vayamos confirmando cada uno de los criterios
 * previos». El realce es lo que convierte ese recálculo en algo legible: sin
 * marca, hay que recordar los números de antes para saber qué pasó.
 *
 * El primer render **no cuenta como cambio**: si lo hiciera, la matriz entera
 * parpadearía al abrir y el realce dejaría de significar «esto se movió».
 */
function useCeldasCambiadas(matriz: ReturnType<typeof construirMatrizCascada>): ReadonlySet<string> {
  const previo = useRef<Map<string, number> | null>(null);
  const [cambiadas, setCambiadas] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (!matriz) return;
    const actual = new Map<string, number>();
    for (const fila of [...matriz.filas, matriz.total]) {
      for (const c of fila.celdas) actual.set(`${fila.facultadKey}:${c.criterioId}`, c.quita);
      actual.set(`${fila.facultadKey}:__quedan__`, fila.quedan);
    }
    const antes = previo.current;
    previo.current = actual;
    if (!antes) return;

    const movidas = new Set<string>();
    for (const [k, v] of actual) {
      const anterior = antes.get(k);
      if (anterior !== undefined && anterior !== v) movidas.add(k);
    }
    if (!movidas.size) return;
    setCambiadas(movidas);
    // El realce dura lo que la animación; después la cifra vuelve a ser una
    // cifra más. Dejarlo fijo lo convertiría en un estado, que es otra cosa.
    const t = setTimeout(() => setCambiadas(new Set()), 950);
    return () => clearTimeout(t);
  }, [matriz]);

  return cambiadas;
}

const pct = (v: number | null) =>
  v == null ? "—" : `${Math.round(v * 100)}%`;

function Celda({
  quita,
  aplica,
  estado,
  operativo,
  recalculado,
}: FilaMatriz["celdas"][number] & { operativo: boolean; recalculado: boolean }) {
  const vacia = quita === 0;
  return (
    <td
      className="cmv2-mtz-celda"
      data-estado={estado}
      data-operativo={operativo || undefined}
      data-vacia={vacia || undefined}
      /*
       * G12 · El realce del embudo vivo.
       *
       * Se enciende cuando la cifra **cambió respecto del render anterior**, no
       * cuando la celda está en edición: confirmar un criterio no mueve nada
       * hasta que el marco se reconstruye, y marcar antes anunciaría un cambio
       * que todavía no ocurrió.
       *
       * Sólo color y opacidad. Nada que codifique un valor se anima con
       * `transform` (ADR 0057, patrón 12): en F55 un `scaleX` dejó una barra
       * clavada en su primer fotograma con el ancho computado correcto.
       */
      data-recalculado={recalculado ? "true" : undefined}
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

function Fila({
  fila,
  operativos,
  cambiadas,
  total = false,
}: {
  fila: FilaMatriz;
  /** Qué columnas son pasos operativos, no criterios. */
  operativos: boolean[];
  /** Celdas cuya cifra se movió en el último recálculo. */
  cambiadas: ReadonlySet<string>;
  total?: boolean;
}) {
  const enEdicion = fila.celdas.some((c) => c.estado === "editando");
  const quedanCambio = cambiadas.has(`${fila.facultadKey}:__quedan__`);
  return (
    <tr
      className={total ? "cmv2-mtz-total" : undefined}
      data-fila-edicion={enEdicion || undefined}
    >
      <th scope="row">{fila.label}</th>
      <td className="cmv2-mtz-universo">{fmtInt(fila.universo)}</td>
      {fila.celdas.map((c, i) => (
        <Celda
          key={c.criterioId}
          {...c}
          operativo={operativos[i]}
          recalculado={cambiadas.has(`${fila.facultadKey}:${c.criterioId}`)}
        />
      ))}
      <td className="cmv2-mtz-quedan" data-recalculado={quedanCambio ? "true" : undefined}>
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

  const cambiadas = useCeldasCambiadas(matriz);
  const cuadra = cascada ? cuadraConElMotor(matriz, cascada) : true;
  const operativos = matriz.criterios.map((c) => c.operativo);
  const hayOperativos = operativos.some(Boolean);

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
            {/* G8 · La fila de grupos declara QUÉ FILTRA cada tramo. Sin ella el
                eje mezcla criterios de estudiante con criterios de curso-horario
                aunque la celda mida lo mismo, y cinco columnas en cero se leen
                como ruido en vez de como «ninguno vació un curso». */}
            <tr className="cmv2-mtz-grupos">
              <td colSpan={2} />
              {matriz.grupos.map((g) => (
                <th key={`${g.scope}-${g.desde}`} scope="colgroup" colSpan={g.ancho} data-scope={g.scope}>
                  {g.label}
                </th>
              ))}
              <td />
            </tr>
            <tr>
              <th scope="col">Facultad</th>
              <th scope="col">Universo</th>
              {matriz.criterios.map((c) => (
                <th scope="col" key={c.id} data-operativo={c.operativo || undefined}>
                  {c.label}
                </th>
              ))}
              <th scope="col">Quedan</th>
            </tr>
          </thead>
          <tbody>
            {matriz.filas.map((f) => (
              <Fila key={f.facultadKey} fila={f} operativos={operativos} cambiadas={cambiadas} />
            ))}
          </tbody>
          <tfoot>
            <Fila fila={matriz.total} operativos={operativos} cambiadas={cambiadas} total />
          </tfoot>
        </table>
      </div>

      <p className="cmv2-mtz-leyenda">
        <span><i data-m="quita" />lo que el criterio quitó</span>
        <span><i data-m="cero" />se aplicó y no quitó ninguno</span>
        <span><i data-m="noaplica" />no aplica en esa facultad</span>
        {hayOperativos ? (
          <span><i data-m="operativo" />paso operativo, no un criterio</span>
        ) : null}
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
