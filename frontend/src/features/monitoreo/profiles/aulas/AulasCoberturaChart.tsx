import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { coberturaPorAula } from "./coberturaPorAula";
import { fmt } from "./kpisDeAulas";
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

  // E22 — **barras CSS y no Plotly**, con el criterio del dictado del chart
  // de sexo: sin crosshair ni drag muerto, la etiqueta y la cifra como texto
  // real, el color del tramo como dato en línea. El orden en pantalla es el
  // MISMO que dibujaba el Plotly (peor arriba: «sin respuestas» encabeza,
  // que es lo que exige acción). El cero SÍ se escribe —describe la forma
  // del reparto— pero susurra (E10). Y muere la lógica de altura compacta:
  // cinco filas CSS se autodimensionan donde el Plotly pedía 360px fijos.
  const max = Math.max(1, ...tramos.map((t) => t.aulas));
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
          <li key={t.clave}>
            <span className="aulas-cobertura-etiqueta" title={t.etiqueta}>{t.etiqueta}</span>
            <span className="aulas-cobertura-pista">
              {t.aulas > 0 && (
                <i style={{ width: `${(100 * t.aulas) / max}%`, background: COLOR_RESULTADO[t.tono] }} />
              )}
            </span>
            <span className={`aulas-cobertura-n${t.aulas ? "" : " es-cero"}`}>{fmt(t.aulas)}</span>
          </li>
        ))}
      </ul>
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
