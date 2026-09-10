import { useMemo, useState } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { coberturaPorAula } from "./coberturaPorAula";
import { AulasCursosDeUnTramo } from "./AulasCursosDeUnTramo";
import { tasasDeLaCobertura } from "./tasasDeLaCobertura";
import { balanceDeLaCobertura } from "./balanceDeLaCobertura";
import { fmt, pctPerfil } from "./kpisDeAulas";
import { MINIMO_PARA_COMPARAR } from "./rendimientoPorFacultad";
import "./aulasCoberturaChart.css";

/**
 * Cuántos cursos-horario hay en cada nivel de cobertura.
 *
 * El promedio esconde la forma: sesenta aulas al 50 % y sesenta al 100 % dan el
 * mismo avance global que ciento veinte al 75 %, y piden decisiones opuestas.
 * Este es el único gráfico del catálogo que no existe en los otros perfiles,
 * porque sólo aquí la unidad lleva su propia meta.
 */
/**
 * Alto del grafico segun el sitio que haya.
 *
 * En grande va **al lado** de «Dónde falta más» y sube a 360 para que la pareja
 * quede pareja —antes eran 311 contra 1 050, con 739 px de columna muerta—. En
 * un viewport bajo la pareja **se apila**, asi que no hay nada que equilibrar y
 * 360 px de cinco barras se comen el 60 % de una pantalla de 600.
 *
 * La clausula lo dice: al cambiar de regimen responsive el alto objetivo puede
 * cambiar, pero cambia para todo el grupo. Aqui el grupo se deshace, y con el la
 * razon de ser del alto grande.
 */
/* El alto amplio lo declara la hoja (`--aulas-cobertura-alto`), porque el tope
   de la lista de facultades se deriva de el y no puede haber dos copias. El 360
   es solo el respaldo. El compacto no participa de la pareja —a esa altura se
   apila— asi que se queda aqui. */

export function AulasCoberturaChart({
  filas, resumen, sinMetaMotor, reservaMotor = 0, dormidasMotor = 0, totalDelPlan,
  sinAplicarMotor = 0, cuota = null,
}: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /** El reparto del motor, sobre TODAS las filas y no sobre las 500 que viajan. */
  resumen?: ReadonlyArray<{ clave: string; aulas: number; etiqueta?: string }> | null;
  /**
   * Cuántos cursos-horario tiene el plan entero (`course_status_total`). Sólo
   * se usa para saber si `filas` llegó recortado: con el bloque del motor
   * presente no hace falta, y sin él evita dibujar una forma falsa.
   */
  totalDelPlan?: number;
  /** Las aulas sin meta declarada, también del motor. */
  sinMetaMotor?: number;
  /**
   * De la reserva adicional, que el motor ya NO reparte en tramos: son aulas
   * adicionales esperando en su estrato, no aulas que alguien vaya a visitar, y
   * contarlas como «sin respuestas» convertía la reserva adicional en alarma
   * —73 de las 121 que salían ahí—. Se recibe para poder NOMBRARLAS: sacarlas
   * del reparto y no decir dónde fueron deja al lector con dos totales que no
   * cuadran entre la cabecera del panel y este pie.
   */
  reservaMotor?: number;
  /**
   * Reservas de cadena que todavia esperan a que caiga su titular.
   *
   * Son otra población que la reserva adicional y hay que nombrarlas aparte:
   * si no, el pie deja dos totales que no cuadran —el reparto cuenta 30, la
   * reserva adicional 2 108 y el encabezado dice 2 468— y las 330 que faltan
   * no aparecen en ninguna frase.
   */
  dormidasMotor?: number;
  /**
   * Cuántos cursos-horario de este conjunto tienen meta y todavía no se han
   * aplicado. Es lo que hay que decir cuando el reparto llega entero y a cero:
   * no es que falte el dato, es que aún no se ha ido a ninguna.
   */
  sinAplicarMotor?: number;
  /**
   * La cuota de respuestas contra la que se mide si con lo agendado se llega.
   * La del estudio, o la de la facultad en foco. `null` si no viaja.
   */
  cuota?: number | null;
}) {
  // Cuántas filas hay DE VERDAD frente a las que llegaron. Sin el dato se
  // asume completo: un payload viejo sin `course_status_total` se comporta
  // como antes.
  const recortado = typeof totalDelPlan === "number" && totalDelPlan > filas.length;
  const { tramos, sinMeta, total, repartoLlego } = useMemo(() => {
    // El reparto del MOTOR primero, por la misma razón que el de estado: la
    // vista lo sumaba sobre las 500 filas que viajan de 2 615, y ésas están
    // ordenadas por tramo del circuito.
    if (resumen?.length) {
      const porClave = new Map(resumen.map((e) => [e.clave, e]));
      // **Por clave, nunca por posición.** Antes esto pareaba una lista local de
      // claves con los tramos por índice: dos definiciones en dos lenguajes que
      // tenían que coincidir en orden sin que nada lo obligara, así que recortar
      // una banda habría movido los números de etiqueta sin romper un test.
      //
      // **Y la etiqueta también viene del motor.** El texto local se queda sólo
      // como respaldo para el cálculo sin payload: con dos redacciones vivas, la
      // del gráfico y la del motor, la pantalla acabaría diciendo dos cosas del
      // mismo tramo y ningún test lo vería.
      const base = coberturaPorAula([]);
      const tramosMotor = base.tramos.map((t) => {
        const e = porClave.get(t.clave);
        const delMotor = typeof e?.etiqueta === "string" ? e.etiqueta.trim() : "";
        return { ...t, aulas: Number(e?.aulas) || 0, etiqueta: delMotor || t.etiqueta };
      });
      const totalMotor = tramosMotor.reduce((n, t) => n + t.aulas, 0);
      // **Un reparto que llegó y suma cero NO es un reparto que no llegó.**
      // Caían los dos por el mismo sitio y el panel acusaba al payload —«el
      // reparto por tramos no llegó y aquí sólo hay 6 de los 1 392»— cuando lo
      // que pasaba era que Psicología no tiene todavía ningún curso-horario
      // aplicado con meta. El motor lo publicaba correctamente: seis tramos en
      // cero y cuatro aulas por aplicar.
      return {
        tramos: tramosMotor,
        sinMeta: sinMetaMotor ?? 0,
        total: totalMotor,
        repartoLlego: true,
      };
    }
    // **Sin el bloque del motor, sólo se calcula si llegó el plan ENTERO.**
    // `course_status` viaja recortado a 500 filas de 1 392 y el recorte no es
    // una muestra al azar: va ordenado por tramo del circuito. Repartir esas
    // 500 dibuja una forma falsa con aire de cierta, que es peor que no
    // dibujar. Medido el 2026-09-09: el motor reparte 174 titulares y las
    // filas que viajan son 500 de otro universo.
    if (recortado) return { tramos: [], sinMeta: sinMetaMotor ?? 0, total: 0, repartoLlego: false };
    return { ...coberturaPorAula(filas), repartoLlego: false };
  }, [filas, resumen, sinMetaMotor, recortado]);

  /**
   * Qué tramo está desplegado.
   *
   * **Con `useState` y no con la dirección, a sabiendas.** La gramática tiene
   * cinco dimensiones y ninguna encaja: `panel` es booleano —un panel abierto o
   * cerrado, no cuál de seis— y `foco` ya lo ocupa la facultad, que desde
   * `c5d92a02` filtra toda la pestaña. Meter el tramo en `foco` obligaría a
   * elegir entre mirar una facultad y abrir un tramo, y él quiere las dos.
   *
   * El coste es que este despliegue no sobrevive a una recarga ni se puede
   * enviar por enlace. Es un detalle DENTRO de un panel, no una vista, así que
   * el coste es pequeño — pero está declarado, no olvidado.
   */
  const [abierto, setAbierto] = useState("");

  // **ARRIBA DE LA GUARDA, y no junto a su uso.** Vivía pegado a la tabla que lo
  // consume, doscientas líneas más abajo, y por tanto DESPUÉS del `if (!total)`.
  // Mientras la cobertura siempre tuviera filas no pasaba nada; al filtrar por
  // facultad, una sin reparto entra por el vacío, React cuenta un hook menos que
  // en el render anterior y la aplicación entera cae con el #300. Se ve poniendo
  // una facultad en el selector, no en un test que monta el componente una vez.

  // `sinMeta` ya viene contado del motor: decir CUÁNTOS no declaran meta manda a
  // la columna que hay que rellenar, y distingue ese caso de no tener plan.
  if (!total) {
    return (
      // La anatomía del vacío del perfil (precedente en `AulasAvanceCuota`):
      // el wrap exento declara su capacidad y sus reglas ciñen el `p`.
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="mon-profile-muted">
          {repartoLlego
            ? `Todavía no se ha aplicado ningún curso-horario con meta aquí, así que no hay cobertura que repartir${sinAplicarMotor ? `: ${fmt(sinAplicarMotor)} esperan aplicación` : ""}.`
            : recortado
            ? `El reparto por tramos no llegó con los datos y aquí sólo hay ${fmt(filas.length)} de los ${fmt(totalDelPlan ?? 0)} cursos-horario del plan: repartir ese recorte dibujaría una forma que no es la del operativo. Recarga para volver a pedirlo.`
            : sinMeta
              ? `Ninguno de los ${fmt(sinMeta)} cursos-horario del plan declara cuántas respuestas espera, así que no hay cobertura que repartir en tramos.`
              : "El plan todavía no trae cursos-horario."}
        </p>
      </div>
    );
  }

  // E22 — **barras CSS y no Plotly**, con el criterio del dictado del chart
  // de sexo: sin crosshair ni drag muerto, la etiqueta y la cifra como texto
  // real, el color del tramo como dato en línea. El orden en pantalla es el
  // MISMO que dibujaba el Plotly (peor arriba: «sin respuestas» encabeza,
  // que es lo que exige acción). El cero SÍ se escribe —describe la forma
  // del reparto— pero susurra (E10). Y muere la lógica de altura compacta:
  // cinco filas CSS se autodimensionan donde el Plotly pedía 360px fijos.
  const max = Math.max(1, ...tramos.map((t) => t.aulas));
  const tasas = tasasDeLaCobertura(filas);
  // El balance en personas: lo de hoy y lo que da la agenda. Sobre las MISMAS
  // filas que el resto del panel, así que con una facultad en foco es la suya.
  const balance = balanceDeLaCobertura(filas, cuota ?? null);
  const detalle = tramos.map((t) => `${t.etiqueta}: ${fmt(t.aulas)}`).join(" · ");

  return (
    // C1: quién posee el espacio interior del panel (ver AulasEstadoChart).
    <div className="aulas-cobertura-chart aulas-cobertura-css" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <ul
        className="aulas-cobertura-filas"
        role="img"
        aria-label={`Cursos-horario por nivel de cobertura de su meta: ${detalle}`}
      >
        {tramos.map((t) => (
          <li key={t.clave} className={t.clave === abierto ? "es-abierto" : undefined}>
            {/* **La fila entera es el botón.** Gonzalo, 2026-09-10: «sería
                interesante que yo pudiera hacer clic en uno de ellos —"se quedó
                a medias"— y que abajo se mostrara cuáles son esos CH». Un tramo
                sin aulas no se puede abrir: enseñaría una tabla vacía y el
                gesto se aprendería como que a veces no responde. */}
            <button
              type="button"
              className="aulas-cobertura-fila"
              disabled={t.aulas === 0}
              aria-expanded={t.clave === abierto}
              onClick={() => setAbierto(t.clave === abierto ? "" : t.clave)}
              /* **Qué significa cada tramo, no sólo su nombre.** Gonzalo, sobre
                 el primero: «no entiendo por qué la categoría sin respuestas
                 sigue; si es necesario tenerla ahí, la dejamos». Es necesaria y
                 es la más grave del reparto —el gráfico sólo reparte los YA
                 APLICADOS, así que «sin respuestas» no es uno pendiente: es uno
                 al que se fue y del que no llegó nada—, pero eso no se podía
                 saber leyendo la fila. */
              title={[
                t.clave === "nulo"
                  ? "Se aplicó y no llegó ninguna respuesta: el enlace no funcionó, nadie escaneó o el parte no cuadra."
                  : t.etiqueta,
                t.aulas === 0 ? "" : "— ver los cursos-horario",
              ].filter(Boolean).join(" ")}
            >
              <span className="aulas-cobertura-etiqueta">{t.etiqueta}</span>
              <span className="aulas-cobertura-pista">
                {t.aulas > 0 && (
                  <i style={{ width: `${(100 * t.aulas) / max}%`, background: COLOR_RESULTADO[t.tono] }} />
                )}
              </span>
              <span className={`aulas-cobertura-n${t.aulas ? "" : " es-cero"}`}>{fmt(t.aulas)}</span>
            </button>
          </li>
        ))}
      </ul>
      {/* **Las dos tasas, que son la lectura que faltaba.** Gonzalo, 2026-09-10:
          «sería bueno en este gráfico también integrarlo con algo de efectividad
          y rendimiento, que son conceptos relacionados: el rendimiento esperado
          y el rendimiento observado hasta ahora». El gráfico repartía en tramos
          de cumplimiento sin decir contra qué tasa se les pedía rendir.

          Las dos comparten denominador —los elegibles— que es lo que las hace
          comparables, y van ponderadas por tamaño: promediar tasas le daría el
          mismo peso a un aula de doce que a una de ochenta. */}
      {tasas.esperada != null ? (
        <p className="aulas-cobertura-tasas">
          Se les pedía <strong>{pctPerfil(tasas.esperada)}</strong> de sus{" "}
          {fmt(tasas.elegibles)} elegibles
          {tasas.observada != null ? (
            <>
              {" "}y están rindiendo <strong>{pctPerfil(tasas.observada)}</strong>
              {tasas.desvio != null && Math.abs(tasas.desvio) >= 0.1 ? (
                <em className={tasas.desvio < 0 ? "es-corto" : "es-sobra"}>
                  {tasas.desvio > 0 ? "+" : "−"}{pctPerfil(Math.abs(tasas.desvio))} pts
                </em>
              ) : null}
            </>
          ) : (
            /* No se calla la ausencia ni se rellena con la prevista: con dos
               aulas aplicadas no hay tasa observada, y decir cuál es el umbral
               es lo que evita que el hueco se lea como un fallo. */
            <>{" "}· todavía sin tasa propia: hacen falta al menos{" "}
            {fmt(MINIMO_PARA_COMPARAR)} cursos-horario aplicados y hay {fmt(tasas.aulas)}</>
          )}
        </p>
      ) : null}
      {balance ? (
        /* **El balance en PERSONAS, y si con lo agendado se llega.** Gonzalo:
           «esto está súper bien, pero no nos dice si estamos en déficit o
           superávit de lo esperado a fecha de hoy con las aplicadas hasta ahora,
           y si con las esperadas agendadas llegamos». La línea de arriba da las
           dos TASAS; «+6,1 puntos» obliga a multiplicar por los elegibles para
           saber si son diez personas o doscientas. */
        <p className="aulas-cobertura-balance">
          <span className="aulas-cob-bal-hoy">
            De {fmt(balance.aplicados)} {balance.aplicados === 1 ? "aplicado" : "aplicados"}
            {/* **Dos universos en la misma zona del panel.** El gráfico reparte
                sólo los que declaran meta y el balance cuenta todos los
                aplicados: en Ciencias Sociales el reparto decía «3» y esta línea
                «De 5», a cuatro centímetros y sin nada que lo explicara. Se dice
                cuando difieren, y no siempre, porque en el caso normal coinciden
                y la aclaración sería ruido. */}
            {balance.aplicados !== total ? (
              <em className="aulas-cob-bal-nota">
                {" "}—el gráfico de arriba reparte {fmt(total)}, los que declaran su meta—
              </em>
            ) : null}{" "}se
            esperaban <strong>{fmt(balance.esperadasHoy)}</strong> respuestas y han
            llegado <strong>{fmt(balance.efectivas)}</strong>
            {balance.balance === 0 ? (
              <em>: justo lo previsto</em>
            ) : (
              <em className={balance.balance < 0 ? "es-corto" : "es-sobra"}>
                : {balance.balance > 0 ? "+" : "−"}{fmt(Math.abs(balance.balance))}{" "}
                {balance.balance > 0 ? "de superávit" : "de déficit"}
              </em>
            )}
          </span>
          {balance.agendados ? (
            <span className="aulas-cob-bal-agenda">
              {/* **Las dos tasas, porque la respuesta puede cambiar de una a
                  otra.** Es su instrucción de fondo: «contrastando siempre que
                  tenemos un rendimiento diferenciado entre el planificado y el
                  que vamos encontrando». */}
              Con {fmt(balance.agendados)} ya {balance.agendados === 1 ? "agendado" : "agendados"} se
              llegaría a <strong>{fmt(balance.conAgendaPrevisto)}</strong> a la tasa del diseño
              {balance.conAgendaObservado != null ? (
                <> y a <strong>{fmt(balance.conAgendaObservado)}</strong> al ritmo que se está dando</>
              ) : null}
              {balance.cuota != null ? (
                <em className={
                  (balance.conAgendaObservado ?? balance.conAgendaPrevisto) >= balance.cuota
                    ? "es-sobra" : "es-corto"
                }>
                  {" "}· la cuota es {fmt(balance.cuota)}
                  {(balance.conAgendaObservado ?? balance.conAgendaPrevisto) >= balance.cuota
                    ? ": se cierra"
                    : `: faltarían ${fmt(balance.cuota - (balance.conAgendaObservado ?? balance.conAgendaPrevisto))}`}
                </em>
              ) : null}
            </span>
          ) : (
            /* Sin nada agendado no se calla: es justo la situación que pide
               acción, y decirla aquí evita leer el superávit de hoy como que ya
               está resuelto. */
            <span className="aulas-cob-bal-agenda">
              No hay ningún curso-horario agendado sin aplicar, así que lo de hoy
              es todo lo que hay hasta que se agenden más.
            </span>
          )}
        </p>
      ) : null}
      {abierto ? (
        <AulasCursosDeUnTramo
          filas={filas}
          tramo={abierto}
          etiqueta={tramos.find((t) => t.clave === abierto)?.etiqueta ?? abierto}
          // Lo que dice la BARRA sobre la que se acaba de hacer clic, para que
          // la lista no afirme un total que la barra contradice.
          enElTramo={tramos.find((t) => t.clave === abierto)?.aulas ?? null}
          onCerrar={() => setAbierto("")}
        />
      ) : null}
      {sinMeta || reservaMotor || dormidasMotor ? (
        // No se esconde ni se reparte: un aula sin meta no cabe en una escala
        // relativa, y decir cuántas son es parte de lo que el gráfico informa.
        <p className="mon-profile-table-recorte">
          {sinMeta ? (
            <>
              {sinMeta} {sinMeta === 1 ? "curso-horario no declara" : "cursos-horario no declaran"} su
              meta, así que {sinMeta === 1 ? "queda" : "quedan"} fuera del reparto.
            </>
          ) : null}
          {reservaMotor ? (
            <>
              {sinMeta ? " " : ""}
              {fmt(reservaMotor)} {reservaMotor === 1 ? "es de la reserva adicional y tampoco entra" : "son de la reserva adicional y tampoco entran"}:
              {/* «esperan en su estrato» exigía saber qué es un estrato del
                  sorteo. El perfil ya dice esto mismo en palabras llanas cuando
                  habla de la reserva adicional —«sin un titular al que
                  respalden»— y ésta es la otra mitad: para qué esperan. */}
              {" "}esperan disponibles para su facultad y sexo, y contarlas como «sin respuestas»
              las volvería una alarma.
            </>
          ) : null}
          {dormidasMotor ? (
            <>
              {sinMeta || reservaMotor ? " " : ""}
              {fmt(dormidasMotor)}{" "}
              {dormidasMotor === 1
                ? "es un reemplazo que todavía espera a su titular"
                : "son reemplazos que todavía esperan a su titular"}
              , y sólo salen a campo si ese curso-horario se cae.
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
