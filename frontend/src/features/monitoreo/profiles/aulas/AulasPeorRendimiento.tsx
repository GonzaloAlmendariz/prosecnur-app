import type { ReactNode } from "react";

import type { MonitoreoAulasPlanRow, MonitoreoAulasEfectividadSeguimiento } from "../../../../api/monitoreo";
import { facultadCorta } from "./facultadEnPalabras";
import { fmt, pctPerfil } from "./kpisDeAulas";
import { MINIMO_PARA_COMPARAR, peorRendimiento, type RendimientoDeFacultad } from "./peorRendimientoDeFacultad";
import "./aulasPeorRendimiento.css";

/**
 * **Dónde el campo rinde peor de lo que se preveía.**
 *
 * Gonzalo, 2026-09-11: «no hay contexto sobre cuáles son las facultades con
 * peor tasa observada vs tasa prevista o de diseño; podría ser hasta un KPI o
 * una tarjeta con el top 4 o 5, y que también se vaya ajustando cuando ya
 * empiezan a tener complementos o refuerzos».
 *
 * Lo que este panel añade sobre el ranking de deuda: aquél ordena por cuántas
 * respuestas faltan y éste por **qué tan lejos está cada facultad de su propia
 * previsión**. Deber mucho rindiendo bien es falta de terreno y se cierra
 * aplicando; rendir a la mitad es que algo no funciona, y meter más aulas sin
 * mirarlo repite el problema.
 */
export function AulasPeorRendimiento({ bloque, porSexo, plan, facultadEnFoco }: {
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined;
  porSexo: ReadonlyArray<Record<string, unknown>> | null | undefined;
  /** El plan, para contar los complementos y refuerzos que ya rindieron. */
  plan?: ReadonlyArray<MonitoreoAulasPlanRow>;
  /**
   * La facultad puesta en el filtro. El ranking sigue siendo el del estudio
   * entero —una facultad sola no se compara con nadie—, pero se marca dónde
   * cae la suya, y si no está entre las peores se añade al pie para que el
   * panel conteste igual con el filtro puesto.
   */
  facultadEnFoco?: string | null;
}): ReactNode {
  const { peores, comparables, porDebajo, apartadas, apoyosEnElEstudio, todas } =
    peorRendimiento(bloque, porSexo, plan, 5);

  if (!peores.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        {comparables === 0
          ? <>Ninguna facultad llega todavía a {fmt(MINIMO_PARA_COMPARAR)} cursos-horario
              aplicados: con menos, la distancia entre lo observado y lo previsto es
              ruido y ordenarlas sería inventar un diagnóstico.
              {apartadas ? ` Hay ${fmt(apartadas)} con campo empezado.` : ""}</>
          // **El caso bueno también se publica.** Un panel vacío se lee como que
          // el dato no llegó; aquí el vacío ES el hallazgo.
          : <>Ninguna de las {fmt(comparables)} facultades con campo suficiente rinde
              por debajo de lo que su propio diseño preveía.
              {apartadas
                ? apartadas === 1
                  ? ` Otra facultad todavía no llega a ${fmt(MINIMO_PARA_COMPARAR)} cursos-horario aplicados.`
                  : ` Otras ${fmt(apartadas)} facultades todavía no llegan a ${fmt(MINIMO_PARA_COMPARAR)} cursos-horario aplicados.`
                : ""}</>}
      </p>
    );
  }

  const foco = (facultadEnFoco ?? "").trim();
  const enLista = peores.some((f) => f.facultad === foco);
  const suya = foco && !enLista ? todas.find((f) => f.facultad === foco) ?? null : null;
  const puestoDeLaSuya = suya ? todas.findIndex((f) => f.facultad === foco) + 1 : 0;

  // El peor marca la escala de las barras: lo que se compara es la distancia
  // entre ellas, no el valor absoluto contra un 100 % que nadie alcanza.
  const suelo = Math.min(0.4, peores[peores.length - 1].razon, suya?.razon ?? 1);

  const fila = (f: RendimientoDeFacultad, puesto: number, esFoco: boolean) => {
    const cumple = Math.min(1, f.razon);
    const ancho = Math.max(4, ((cumple - suelo) / (1 - suelo)) * 100);
    const tono = f.razon < 0.6 ? "es-grave" : f.razon < 0.85 ? "es-bajo" : "es-cerca";
    return (
      <li key={f.clave || f.facultad} className={`${tono}${esFoco ? " es-foco" : ""}`}>
        <span className="aulas-peor-puesto">{fmt(puesto)}</span>
        <span className="aulas-peor-quien">
          <b>{facultadCorta(f.facultad)}</b>
          <em>
            {fmt(f.aulas)} aplicados
            {/* **Por qué puede haber mejorado.** La tasa observada sube en
                cuanto un complemento o un refuerzo rinde; sin decirlo, esa
                mejora parece espontánea. */}
            {f.apoyosAplicados ? (
              <> · con {fmt(f.apoyosAplicados)}{" "}
                {f.apoyosAplicados === 1 ? "apoyo aplicado" : "apoyos aplicados"}</>
            ) : null}
          </em>
        </span>
        <span className="aulas-peor-carril" aria-hidden="true">
          <b style={{ width: `${ancho}%` }} />
        </span>
        <span className="aulas-peor-cifras">
          <b>{pctPerfil((f.observada ?? 0) * 100)}</b>
          <em>de {pctPerfil((f.prevista ?? 0) * 100)}</em>
        </span>
        {/* La distancia en una cifra: «rinde el 81 % de lo previsto» es lo que
            ordena la lista, y sin ella hay que dividir a ojo. */}
        <span className="aulas-peor-razon">{pctPerfil(f.razon * 100)}</span>
      </li>
    );
  };

  return (
    <div className="aulas-peor" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-peor-lectura">
        {/* **La lista es sólo de las que van por debajo, y su base se dice.**
            Con el corte del 2026-09-11 el «top 5» traía tres facultades al
            100,1 %, 102,1 % y 102,3 %: llenar el tope metía en un panel de
            alarma a las que iban bien. */}
        <strong>{fmt(porDebajo)}</strong> de <strong>{fmt(comparables)}</strong> facultades
        con campo suficiente {porDebajo === 1 ? "rinde" : "rinden"} por debajo de lo
        que su diseño preveía{porDebajo > peores.length ? <>; aquí van las {fmt(peores.length)} que más se alejan</> : null}.
        {apartadas ? (
          // Apartarlas en silencio haría creer que el ranking mira a todas. Y el
          // verbo concuerda con el número que se PINTA, no con el interno.
          <> {apartadas === 1
            ? <>Otra facultad queda</>
            : <>Otras <strong>{fmt(apartadas)}</strong> facultades quedan</>} fuera por
            tener menos de {fmt(MINIMO_PARA_COMPARAR)} cursos-horario aplicados.</>
        ) : null}
      </p>

      <ol className="aulas-peor-lista">
        {peores.map((f, i) => fila(f, i + 1, f.facultad === foco))}
        {suya ? (
          // Con el filtro puesto, el ranking sin su facultad no contesta la
          // pregunta con la que se entra: se añade en su puesto real.
          <li className="aulas-peor-corte" aria-hidden="true"><span /></li>
        ) : null}
        {suya ? fila(suya, puestoDeLaSuya, true) : null}
      </ol>

      <p className="aulas-peor-pie">
        La última columna es lo observado sobre lo previsto: por debajo del 100 %
        la facultad rinde menos de lo que su propio diseño esperaba.
        {/* **Por qué hoy no se ve ningún apoyo.** Sin esta frase, una lista
            entera sin apoyos se lee como que el cruce con el plan falla. */}
        {apoyosEnElEstudio
          ? ` Se recalcula con cada curso-horario aplicado: el operativo lleva ${fmt(apoyosEnElEstudio)} ${apoyosEnElEstudio === 1 ? "apoyo" : "apoyos"} entre complementos y refuerzos, y cada uno que rinde mueve la tasa de su facultad.`
          : " Se recalcula con cada curso-horario aplicado; todavía no ha rendido ningún complemento ni refuerzo, así que lo que se ve es sólo campo de titulares."}
        {suya ? ` ${facultadCorta(suya.facultad)} va ${fmt(puestoDeLaSuya)}.ª de ${fmt(comparables)}.` : ""}
      </p>
    </div>
  );
}
