import { useEffect, useMemo, useState } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { PlotlyChart } from "../../../../lib/PlotlyChart";
import { altoDeclarado, fuenteDeCifraEnBarra, fuenteDeEjeAulas } from "./ejesDeAulas";
import { COLOR_ACUMULADO, COLOR_RESULTADO, tintaSobre } from "../../coloresDeResultado";
import { coberturaPorAula } from "./coberturaPorAula";
import { fmt } from "./kpisDeAulas";

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
const ALTO_COMPACTO = 820;
/* El alto amplio lo declara la hoja (`--aulas-cobertura-alto`), porque el tope
   de la lista de facultades se deriva de el y no puede haber dos copias. El 360
   es solo el respaldo. El compacto no participa de la pareja —a esa altura se
   apila— asi que se queda aqui. */
const ALTO_COMPACTO_DEL_GRAFICO = 220;

export function AulasCoberturaChart({ filas, resumen, sinMetaMotor, reservaMotor = 0, dormidasMotor = 0 }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /** El reparto del motor, sobre TODAS las filas y no sobre las 500 que viajan. */
  resumen?: ReadonlyArray<{ clave: string; aulas: number; etiqueta?: string }> | null;
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
}) {
  // Se mide una vez y se escucha el cambio: el usuario redimensiona y el grafico
  // tiene que encogerse con la ventana, no en la siguiente carga.
  const [compacto, setCompacto] = useState(
    () => typeof window !== "undefined" && window.innerHeight <= ALTO_COMPACTO,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-height: ${ALTO_COMPACTO}px)`);
    const alCambiar = () => setCompacto(mq.matches);
    alCambiar();
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);

  const { tramos, sinMeta, total } = useMemo(() => {
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
      if (totalMotor) return { tramos: tramosMotor, sinMeta: sinMetaMotor ?? 0, total: totalMotor };
    }
    return coberturaPorAula(filas);
  }, [filas, resumen, sinMetaMotor]);

  // `sinMeta` ya viene contado del motor: decir CUÁNTOS no declaran meta manda a
  // la columna que hay que rellenar, y distingue ese caso de no tener plan.
  if (!total) {
    return (
      // La anatomía del vacío del perfil (precedente en `AulasAvanceCuota`):
      // el wrap exento declara su capacidad y sus reglas ciñen el `p`.
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="mon-profile-muted">
          {sinMeta
            ? `Ninguno de los ${sinMeta.toLocaleString("es-PE")} cursos-horario del plan declara cuántas respuestas espera, así que no hay cobertura que repartir en tramos.`
            : "El plan todavía no trae cursos-horario."}
        </p>
      </div>
    );
  }

  const rellenos = tramos.map((t) => COLOR_RESULTADO[t.tono]).reverse();

  const data = [{
    type: "bar",
    orientation: "h",
    // De «meta cumplida» arriba a «sin respuestas» abajo: se lee de mejor a
    // peor, y lo que exige acción queda al pie, que es donde cae la vista.
    y: tramos.map((t) => t.etiqueta).reverse(),
    x: tramos.map((t) => t.aulas).reverse(),
    marker: { color: rellenos },
    // `String()` dejaba «1355» a dos centimetros del «1,259» del panel de al
    // lado: el mismo numero en dos formatos. Va por el formateador de la casa.
    // **El cero SÍ se escribe aquí**, y no es una contradicción con el gráfico
    // de acumulado, donde se omite a propósito. Allí el cero es un DÉFICIT
    // cubierto —buena noticia— y su etiqueta compite con las celdas que sí
    // piden algo. Aquí es cuántos cursos-horario cayeron en esa banda de
    // cobertura: que sean cero describe la forma del reparto, y sin número la
    // fila queda con su etiqueta al lado de nada, que se lee como un hueco de
    // renderizado. Medido en pantalla: «Muy por debajo (menos de la mitad)»
    // aparecía sin barra y sin cifra entre cuatro filas que sí las tenían.
    text: tramos.map((t) => fmt(t.aulas)).reverse(),
    // «auto» deja que Plotly saque la cifra fuera cuando la barra es corta, y
    // ahi el fondo es el papel, no el relleno. Por eso las dos tintas se
    // declaran por separado en vez de forzar una sola.
    // Un `auto` sobre una barra de ancho CERO no pinta nada: Plotly no tiene
    // dónde meter el texto dentro y no lo saca fuera por su cuenta. Comprobado
    // en pantalla — con el cero ya escrito, la fila seguía apareciendo vacía—.
    // Se le dice punto a punto: fuera cuando la barra no existe.
    textposition: tramos.map((t) => (t.aulas ? "auto" : "outside")).reverse(),
    cliponaxis: false,
    insidetextfont: fuenteDeCifraEnBarra(rellenos.map(tintaSobre)),
    outsidetextfont: fuenteDeCifraEnBarra(COLOR_ACUMULADO),
    hovertemplate: "%{y}: %{x} cursos-horario<extra></extra>",
  }];

  return (
    // El envoltorio reserva el alto: el panel es un grid y el div que Plotly
    // monta no empuja su fila, así que sin esto el panel medía 26 px —sólo su
    // cabecera— y el gráfico se dibujaba encima de la tabla de abajo.
    // C1: quién posee el espacio interior del panel. Sin declararlo, el gate
    // cae a la cabecera como dueña y reporta sus 4-5 px de holgura como
    // `capacity-drift`, que es un diagnóstico sobre el sitio equivocado: el
    // panel sólo tiene 1 px libre abajo y el hueco está dentro del head.
    <div className="aulas-cobertura-chart" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <PlotlyChart
        data={data}
        // Plotly no crece con su fila: el alto va en la prop, no en el CSS.
        height={compacto ? ALTO_COMPACTO_DEL_GRAFICO : altoDeclarado("--aulas-cobertura-alto", 360)}
        ariaLabel="Cursos-horario por nivel de cobertura de su meta"
        layout={{
          // La escala de eje del perfil, no el default compartido de Plotly.
          font: fuenteDeEjeAulas(),
          margin: { l: 110, r: 16, t: 8, b: 28 },
          xaxis: { title: { text: "cursos-horario" }, zeroline: false, fixedrange: true },
          yaxis: { automargin: true, fixedrange: true },
          showlegend: false,
          bargap: 0.28,
        }}
        config={{ displayModeBar: false, responsive: true }}
      />
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
