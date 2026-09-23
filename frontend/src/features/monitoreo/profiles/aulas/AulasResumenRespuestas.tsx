import type { ReactNode } from "react";

import { fmt, pctPerfil } from "./kpisDeAulas";
import { AulasBolsasDelAvance } from "./AulasBolsasDelAvance";
import type { TotalDeAvanceCuota } from "./avanceCuota";
import type { MonitoreoAulasRespuestasCuenta } from "../../../../api/monitoreo";
import "./aulasResumenRespuestas.css";

/**
 * De cuántas respuestas cuentan, y por qué no cuentan las demás.
 *
 * **Las dos razones van separadas, y ése es el bloque entero.** «944 de 1 049»
 * dejaba 105 en una resta muda, y esas 105 son dos cosas que piden lo
 * contrario: 37 que no son del operativo —otra ola, una prueba, un aula que no
 * está en el plan, y no piden nada— y 68 que sí lo son y no pasan el criterio,
 * que es trabajo hecho que no suma. Es el mismo error que el rótulo
 * «descartadas por el filtro», retirado del perfil el 2026-09-07.
 *
 * Por eso son DOS barras y no una de tres tramos: la segunda reparte sólo lo
 * que no cuenta, así que 68 sobre 105 se lee como dos tercios en vez de como el
 * 6 % del total, que es donde el problema desaparecía de la vista.
 */
export function AulasResumenRespuestas({
  cuenta, sinAula, rotulo = "", grupo = "", enLaMuestra = null,
}: {
  cuenta: MonitoreoAulasRespuestasCuenta | null | undefined;
  /** Respuestas sin aula identificable. Se declara; no se esconde. */
  sinAula?: number;
  /** La facultad en foco, si la hay. Vacío = el conjunto. */
  rotulo?: string;
  /**
   * Cómo se llama lo que agrupa el bloque de abajo —«Facultad», «Carrera»—.
   * La nota dice «en ninguna ‹eso›» y tiene que nombrar el mismo grupo que la
   * tabla que el lector acaba de mirar. Vacío: «facultad».
   */
  grupo?: string;
  /**
   * **El último tramo del embudo: de las efectivas, cuántas cuentan.**
   *
   * Gonzalo, 2026-09-23: «la información es incoherente» — la tarjeta decía
   * «Efectivas 171» y este bloque «228 efectivas», dos cifras con un nombre y
   * ninguna explicación entre ellas. Las 57 del medio son de un nivel que el
   * diseño no mide, sin identificar o duplicadas, y las nombra la misma pieza
   * que Metas (`AulasBolsasDelAvance`). Sólo del estudio entero: las bolsas no
   * se reparten por facultad.
   */
  enLaMuestra?: TotalDeAvanceCuota | null;
}): ReactNode {
  if (!cuenta) return null;
  // Con una facultad en foco SÍ se pinta el cero: es su respuesta —«esta
  // facultad no tiene ninguna»— y callarla dejaría el bloque anterior en
  // pantalla como si fuera suyo. Sin foco, un cero es que no hay nada que
  // contar todavía.
  //
  // **Pero «nada que contar» se DICE, no se calla** (cláusula C3: una
  // superficie contiene su propio vacío). Devolviendo `null` a secas, el panel
  // de fuera seguía montándose y quedaba una caja con el título «Respuestas ·
  // cuáles cuentan, y por qué no cuentan las demás» y nada debajo. Visto el
  // 2026-09-20 sobre el proyecto con el que arranca CCSS: es literalmente lo
  // primero que ve el coordinador el martes por la mañana, antes de la primera
  // respuesta. No se pintan las barras —no hay cifras— pero sí la frase.
  if (!cuenta.observadas && !rotulo) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        Todavía no ha llegado ninguna respuesta. Cuando lleguen, aquí se separa
        lo que cuenta de lo que no, y por qué.
      </p>
    );
  }
  const noCuentan = cuenta.fuera_del_operativo + cuenta.no_pasan_criterio;
  const ancho = (v: number, total: number) => `${total > 0 ? (100 * v) / total : 0}%`;
  return (
    // Sin declararse miembro, el gate cae al encabezado del panel y canta
    // `capacity-drift` sobre sus 5 px de padding: un síntoma que no se parece
    // en nada a su causa. Los paneles sanos del grupo lo declaran así.
    <div className="aulas-resp" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      {/* **Aquí hubo una tira de pastillas de facultad y se retiró el
          2026-09-09**: «se ve horrible y debería ser un selector como el que ya
          está en el header» (Gonzalo). Y lo estaba — `AulasSelectorDeFacultad`
          vive en la cabecera de la sección, pone `foco=facultad:…` en la
          dirección y este bloque ya lo lee. Las pastillas eran un segundo mando
          para lo mismo, quince nombres en dos filas, compitiendo con el que ya
          había. El bloque sigue filtrando por facultad; lo hace desde arriba. */}
      <p className="aulas-resp-titular">
        <strong>{fmt(cuenta.efectivas)}</strong> efectivas de {fmt(cuenta.observadas)} respuestas
        {cuenta.observadas > 0 ? (
          <span className="aulas-resp-pct">
            {pctPerfil((100 * cuenta.efectivas) / cuenta.observadas)}
          </span>
        ) : null}
        {rotulo ? <span className="aulas-resp-pct">en {rotulo}</span> : null}
      </p>
      <div className="aulas-resp-pila">
        <i
          className="aulas-resp-tramo" data-tramo="efectivas"
          style={{ width: ancho(cuenta.efectivas, cuenta.observadas) }}
        />
        <i
          className="aulas-resp-tramo" data-tramo="no-cuentan"
          style={{ width: ancho(noCuentan, cuenta.observadas) }}
        />
      </div>
      {noCuentan > 0 ? (
        <>
          <div className="aulas-resp-sub">
            <div className="aulas-resp-pila aulas-resp-pila-sub">
              <i
                className="aulas-resp-tramo" data-tramo="fuera"
                style={{ width: ancho(cuenta.fuera_del_operativo, noCuentan) }}
              />
              <i
                className="aulas-resp-tramo" data-tramo="criterio"
                style={{ width: ancho(cuenta.no_pasan_criterio, noCuentan) }}
              />
            </div>
            <span>de las <strong>{fmt(noCuentan)}</strong> que no cuentan</span>
          </div>
          <p className="aulas-resp-leyenda">
            <span>
              <i className="aulas-resp-swatch" data-tramo="fuera" />
              Fuera del operativo <strong>{fmt(cuenta.fuera_del_operativo)}</strong>
            </span>
            <span>
              <i className="aulas-resp-swatch" data-tramo="criterio" />
              No pasan el criterio <strong>{fmt(cuenta.no_pasan_criterio)}</strong>
            </span>
          </p>
        </>
      ) : null}
      {enLaMuestra && !rotulo && enLaMuestra.validas < cuenta.efectivas ? (
        <div className="aulas-resp-muestra">
          <p className="aulas-resp-titular">
            <strong>{fmt(enLaMuestra.validas)}</strong> de las {fmt(cuenta.efectivas)} efectivas
            cuentan para la muestra
          </p>
          <AulasBolsasDelAvance total={enLaMuestra} />
        </div>
      ) : null}
      {/* Se dice siempre que las haya: son respuestas que están en el total y
          en ninguna facultad, así que quien sume las facultades y no llegue al
          total tiene aquí la explicación en vez de un descuadre. */}
      {sinAula && sinAula > 0 ? (
        <p className="aulas-resp-nota">
          {fmt(sinAula)} sin curso-horario identificable: cuentan en el total y en{" "}
          ninguna {(grupo ?? "").trim().toLocaleLowerCase("es") || "facultad"}.
        </p>
      ) : null}
    </div>
  );
}
