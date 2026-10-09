import { useMemo } from "react";

import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { avanceProyectado, celdasEvaluables, celdasQuePidenAccion, type CeldaAvance } from "./avanceProyectado";
import { fmt, fmtCuenta } from "./kpisDeAulas";

/**
 * Si cada celda de cuota **va a llegar**, y si el campo se comporta como el
 * modelo dice.
 *
 * Es la lectura que le faltaba al perfil. El resumen de cuotas dice dónde
 * estás; éste dice si vas a llegar — y para cuando «ya no llegaste» es visible,
 * no queda nada que hacer. En 2025 la única celda incumplida fue EE.GG. Letras
 * hombres, con un sesgo de composición de +3,4 pp hacia mujeres que estuvo ahí
 * todo el campo sin que nadie pudiera verlo.
 *
 * Va separado de los referenciales y encabeza por lo que exige una decisión hoy.
 * Decía «es el único panel del perfil que manda a alguien a un aula» y dejó de
 * serlo: `AulasReservaDirigida` va justo debajo y nombra códigos de aula
 * concretos del banco. Los dos se leen seguidos a propósito — éste dice qué
 * celda no llega, aquél a dónde ir por ella.
 *
 * Ninguna frase se redacta aquí: vienen del motor, que es donde vive el test
 * anti-jerga. Con dos redacciones vivas del mismo estado, la pantalla acaba
 * diciendo dos cosas y ningún test lo ve.
 */

const TONO: Record<string, string> = {
  deficit_no_subsanable: COLOR_RESULTADO.pendiente,
  deficit_proyectado: COLOR_RESULTADO.pendiente,
  ajustada: COLOR_RESULTADO.parcial,
  asegurada: COLOR_RESULTADO.efectiva,
};

/**
 * **Ni 100 % ni 0 %: el redondeo no puede fabricar certeza.**
 *
 * `Math.round(p * 100)` convierte 0,996 en «100 % de cerrar» y 0,004 en «0 %».
 * Las dos son afirmaciones absolutas que este número no puede sostener: sale de
 * una posterior Gamma-Poisson corregida por la dispersión medida, y su gracia
 * —lo dice el comentario de al lado— es justamente separar la celda que supera
 * su cuota por una encuesta de la que la supera por cien.
 *
 * Medido el 2026-08-30 en el estudio real: CIENCIAS E INGENIERIA / M llega con
 * `prob_cierre` 1 y **está 4 encuestas por debajo de su cuota hoy**. La pantalla
 * decía «100 % de cerrar» sobre una celda que aún no ha cerrado.
 */
export function pctDeCierre(p: number): string {
  if (p >= 0.995) return ">99 %";
  if (p > 0 && p < 0.005) return "<1 %";
  return `${Math.round(p * 100)} %`;
}

/**
 * ⚠ SIN MONTAR desde el 2026-09-08.
 *
 * Salió de la pestaña «Metas» con el resto de la predicción. Gonzalo, sobre la
 * pirámide: «lo nada que tenga que ver con predicción porque eso le pertenece a
 * otra pestaña»; y sobre estas filas: «pone que va a llegar con margen cuando
 * ni siquiera has calculado el avance real».
 *
 * Es una MUDANZA pendiente, no un borrado: el componente y su view-model
 * (`avanceProyectado.ts`) se quedan en el árbol esperando la pestaña de
 * predicción. Si esa pestaña no llega a existir, hay que decidir entre montarlo
 * allí o retirarlo — la entrada de `componentesSinMontar.test.ts` es la que
 * recuerda que la decisión está abierta.
 */
export function AulasAvanceProyectado({ celdas }: { celdas?: ReadonlyArray<CeldaAvance> | null }) {
  const filas = useMemo(() => avanceProyectado(celdas), [celdas]);
  const piden = celdasQuePidenAccion(filas);
  // El denominador son las celdas CON cuota, no todas: las que no tienen
  // objetivo declarado no van a llegar ni dejan de hacerlo. Contarlas hacía que
  // este panel y el KPI de arriba dijeran «10 de 30» significando lo contrario.
  const evaluables = celdasEvaluables(filas);
  // Sólo cuentan las celdas que declaran objetivo: las que no, no calibran nada.
  const origenes = filas.reduce(
    (acc, f) => {
      if (f.origen === "composicion_del_aula") acc.derivado += 1;
      else if (f.origen === "hoja_de_control") acc.hoja += 1;
      return acc;
    },
    { derivado: 0, hoja: 0 },
  );

  // **Nada verde por ausencia, pero un solo dueño del aviso.**
  //
  // La ausencia de celdas no significa que todo vaya bien: significa que no hay
  // con qué proyectar, y eso hay que decirlo. Pero ya lo dice `AulasCuotasResumen`
  // justo encima —«El plan no declara composición por sexo para estos
  // cursos-horario»— y verlo en la app lo dejó claro: la sección repetía el mismo
  // hecho cinco veces, entre los dos KPIs en «S/D» y tres párrafos casi
  // idénticos. Repetirlo una sexta no informa, tapa.
  //
  // Así que aquí se calla y el aviso queda donde ya vivía. Si algún día este
  // panel se monta sin ese vecino, hay que devolverle la frase: la regla es que
  // la ausencia se declare UNA vez, no ninguna.
  if (!filas.length) return null;

  return (
    <div className="aulas-avance-proyectado" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      {/* El titular dice cuántas piden decisión, no cuántas hay: el denominador
          a la vista y sin obligar a contar filas. Cero es cero, no «todo bien». */}
      {/* Se cuenta aquí y no en el normalizador: es una lectura del conjunto,
          no un campo de la celda. */}
      <p className="aulas-avance-titular">
        {evaluables === 0
          ? `Ninguno de los ${fmt(filas.length)} grupos declara objetivo, así que no hay proyección que hacer.`
          : piden === 0
            ? `Ninguno de los ${fmt(evaluables)} grupos con objetivo se queda corto con lo que falta por aplicar.`
            // Concordancia: con una sola celda decía «1 de 30 celdas … no VAN
            // a llegar». Visto con el simulacro `como_2025`, que es el primero
            // en el que este número baja a uno.
            : `${fmt(piden)} de ${fmt(evaluables)} grupos con objetivo no ${
              piden === 1 ? "va" : "van"} a llegar con lo que falta por aplicar.`}
        {/* Las que no se evalúan se dicen aparte, no se esconden en el
            denominador: son trabajo de gabinete, no de campo. */}
        {filas.length > evaluables
          ? ` ${fmt(filas.length - evaluables)} más no declaran objetivo.`
          : null}
      </p>
      {/* **De dónde sale «lo previsto», que es contra lo que se calibra.**
          El motor lo pide por escrito —«el origen viaja en el payload: una
          calibración sobre un previsto derivado mide el supuesto y el campo a la
          vez, y quien lea tiene que poder saberlo»— y el campo llegaba hasta el
          normalizador y ahí se quedaba: nadie lo pintaba.

          Va una vez al pie y no en cada celda porque es el mismo para todas
          —medido: 30 de 30 `composicion_del_aula`—, y repetirlo treinta veces
          sería ruido. Si algún día conviven las dos fuentes, esta línea lo dirá
          contando cuántas hay de cada una. */}
      {origenes.derivado > 0 ? (
        <p className="mon-profile-muted aulas-avance-origen">
          {origenes.hoja > 0
            ? `${fmt(origenes.derivado)} de ${fmt(origenes.derivado + origenes.hoja)} grupos calculan lo previsto repartiendo lo que promete cada curso-horario según la composición de sus elegibles`
            : "Lo previsto se calcula repartiendo lo que promete cada curso-horario según la composición de sus elegibles"}
          , que supone que la efectividad no depende del sexo. En 2025 la composición lograda se fue 3.4 puntos hacia las mujeres.
        </p>
      ) : null}

      <ul className="aulas-avance-lista">
        {filas.map((f, i) => {
          // La facultad es la unidad de lectura, así que se escribe UNA vez por
          // bloque y las filas siguientes sólo dicen su sexo. Repetirla en las
          // dos hacía que el ojo leyera treinta entradas sueltas en vez de
          // quince facultades con dos sexos cada una.
          const abreGrupo = i === 0 || filas[i - 1].facultad !== f.facultad;
          return (
          <li key={f.clave} className="aulas-avance-fila" data-estado={f.estado}
              data-grupo={abreGrupo ? "inicio" : "sigue"}>
            <span className="aulas-avance-celda">
              {/* El sexo viaja pegado a su separador: suelto, el `·` se quedaba
                  huérfano al final de la línea cuando el nombre de la facultad
                  ocupaba las dos. */}
              {abreGrupo ? <strong>{f.facultad}</strong> : null}
              {abreGrupo ? " " : null}
              <span className="aulas-avance-sexo">{abreGrupo ? "· " : ""}{f.sexo}</span>
            </span>
            <span className="aulas-avance-pista" role="img"
                  aria-label={`${f.facultad} ${f.sexo}: ${f.etiqueta}`}>
              <span style={{
                width: `${Math.min(100, f.cuota > 0 ? Math.round((f.proyeccion / f.cuota) * 100) : 0)}%`,
                background: TONO[f.estado] ?? COLOR_RESULTADO.pendiente,
              }} />
            </span>
            <span className="aulas-avance-dicho">
              <strong>{f.etiqueta}</strong>
              {/* **La misma pregunta, con la incertidumbre puesta.** El veredicto
                  de al lado sale de un umbral: «ajustada» es tanto una celda que
                  supera su cuota por una encuesta como una que la supera por
                  cien. La probabilidad separa esos dos casos.

                  Va PEGADA al veredicto y no en un panel aparte porque no es
                  otra pregunta: es la misma. Y el `title` lleva la salvedad,
                  porque un porcentaje sin decir qué supone es peor que no darlo. */}
              {f.probabilidad !== null ? (
                <b
                  className="aulas-avance-prob"
                  data-nivel={f.probabilidad >= 0.9 ? "alta" : f.probabilidad >= 0.6 ? "media" : "baja"}
                  title={f.dispersion
                    ? `Corregida por la dispersión medida en este estudio: los cursos-horario ya aplicados `
                      + `varían ×${f.dispersion.toFixed(1)} más de lo que supondría la independencia `
                      + `entre respuestas, medido sobre ${fmtCuenta(f.dispersionN)} cursos-horario con campo.`
                    : "Sin dispersión medida no se publica probabilidad."}
                >
                  {pctDeCierre(f.probabilidad)} de cerrar
                </b>
              ) : (
                /* Un `null` NO se pinta como 0 %: son cosas distintas y la
                   diferencia importa. Pasa cuando alguna aula pendiente de la
                   celda no declara su tasa. */
                <b className="aulas-avance-prob"
                   data-nivel={f.aportePendiente <= 0 ? "cerrada" : "sin-medir"}
                   title={f.aportePendiente <= 0
                     // **«Ya cerró» no es «no se pudo medir».** Estas celdas
                     // decían «sin medir · Alguno de los cursos-horario que
                     // faltan no declara su tasa», y era falso por partida
                     // doble: no falta ninguno —`aporte_pendiente` es 0— y no
                     // hay nada que calcular porque ya llegaron. Medido el
                     // 2026-08-30: **12 de las 30 celdas**, todas con logrado
                     // por encima de su cuota, mostrando como problema lo que
                     // es el mejor resultado posible.
                     ? "Ya llegó a su cuota y no queda ningún curso-horario por aplicar: no hay nada que proyectar."
                     : f.dispersionN < 20
                     ? `Todavía no hay bastante campo para medir cuánto varía el rendimiento de un `
                       + `curso-horario a otro (${fmtCuenta(f.dispersionN)} aplicados). Sin eso, un porcentaje `
                       + `fingiría una precisión que no hay.`
                     : "Alguno de los cursos-horario que faltan no declara su tasa de efectividad, así que no se puede calcular."}>
                  {f.aportePendiente <= 0 ? "ya llegó" : "sin medir"}
                </b>
              )}
              {/* La causa, sólo donde hay algo que explicar. */}
              {f.porque ? <em>{f.porque}</em> : null}
              {/* Y cómo se está comportando el campo, que es otra pregunta. */}
              {f.etiquetaCalibracion ? <small>{f.etiquetaCalibracion}</small> : null}
            </span>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
