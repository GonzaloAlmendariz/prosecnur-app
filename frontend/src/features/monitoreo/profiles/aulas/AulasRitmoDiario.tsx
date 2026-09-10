import { AulasAvanceDiario } from "./AulasAvanceDiario";
import { fmt, fmtCuenta } from "./kpisDeAulas";

/**
 * Cómo avanzó la recolección, día por día.
 *
 * Es el eje que le faltaba al perfil. Acreditación y telefónico llevan su ritmo
 * diario desde hace tiempo; aulas decía cuánto se lleva y cuánto falta, y en
 * ninguna pantalla se veía **cómo se llegó ahí**. Un tablero de monitoreo sin
 * tiempo no contesta la pregunta con la que se abre cada mañana —¿vamos al
 * ritmo que hace falta?— y es la razón de fondo de que Avance se leyera crudo
 * aun teniendo gráficos.
 *
 * Barras en CSS y no Plotly: son los días de un operativo —diez en este
 * estudio— y esta pestaña ya carga bastante. Es la misma decisión que la agenda
 * por día y que el histórico del cálculo de muestra.
 */

export type DiaDeRitmo = { fecha: string; validas: number; acumulado: number };

export type RitmoDiario = {
  dias: DiaDeRitmo[];
  dias_con_campo: number;
  mejor_dia?: { fecha: string; validas: number } | null;
  media_diaria: number;
  meta: number;
  /**
   * Lo que falta según el motor, que **no es `meta - acumulado`**: suma lo que
   * le debe cada grupo de facultad y sexo (ADR 0079). `null` en payloads
   * anteriores a que el motor la publicara.
   */
  brecha?: number | null;
};

/** «Lun 10/08», que es como se nombra un día de campo en el resto del perfil. */
function etiquetaDeDia(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const dia = d.toLocaleDateString("es-PE", { weekday: "short" });
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1, 3)} ${d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" })}`;
}

export function AulasRitmoDiario({ ritmo }: { ritmo: RitmoDiario | null }) {
  if (!ritmo || !ritmo.dias.length) {
    return (
      // El vacío dice de dónde saldría el dato: sin marca de envío no hay
      // calendario, y eso es una propiedad de la fuente, no un fallo de la
      // vista. Inventar un solo día con todo dentro sería peor que no dibujar.
      // Va dentro de `.mon-profile-table-wrap` y no como `p` suelto: es la
      // anatomía del vacío del perfil (precedente en `AulasAvanceCuota`) — el
      // wrap exento declara su capacidad y las reglas del perfil matan el
      // margen del `p`, en cualquier pestaña donde este componente se monte.
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="mon-profile-muted">
          Las respuestas de este estudio no traen fecha de envío, así que no se
          puede reconstruir el día a día de la recolección.
        </p>
      </div>
    );
  }

  const { dias, dias_con_campo: conCampo, mejor_dia: mejor, media_diaria: media, meta } = ritmo;
  const tope = dias.reduce((max, d) => Math.max(max, d.validas), 0);
  const total = dias[dias.length - 1]?.acumulado ?? 0;
  // **La meta se muestra REDONDEADA y el faltante se calcula sobre esa misma
  // cifra**, para que la resta cuadre y para que coincida con el resto de la
  // app.
  //
  // Al pasar el pie a `fmtCuenta` —que redondea hacia arriba, y para «lo que
  // falta» es lo correcto— la meta salió **3.492** mientras Cuotas y Salidas
  // dicen **3.491**: la misma cantidad (3.491,4) con dos redondeos. Eso no son
  // dos granos legítimos, es una inconsistencia, y la introduje yo.
  //
  // Una meta no es «lo que hace falta conseguir de más»: es una cantidad ya
  // fijada, y el motor la publica redondeada al entero más cercano en
  // `avance_cuota$total$cuota`. Se muestra igual aquí. Y el faltante se saca de
  // la meta MOSTRADA, así que 667 + 2.824 = 3.491 cuadra a la vista y da el
  // mismo número que la banda de KPIs y que la tabla del cliente.
  const metaEntera = Math.round(meta);
  /**
   * **Lo que falta lo dice el motor, no esta resta.**
   *
   * `metaEntera - total` da CERO en cuanto el acumulado supera la cuota, y sobre
   * este corte eso pasa con 2.668 sobre 2.500 mientras siguen faltando 170
   * personas en los grupos que no cierran. El pie entero está tras un
   * `falta > 0`, así que el panel no publicaba una cifra equivocada: **se
   * callaba**, que es más difícil de ver.
   *
   * La resta se queda como respaldo para un payload que aún no traiga la
   * brecha; con ella, manda la del motor.
   */
  // `Number(null)` es CERO, no `NaN`: comprobar sólo `isFinite` hacía que un
  // payload sin brecha se leyera como brecha cero y apagara el pie entero, que
  // es justo el silencio que esta reparación viene a quitar. El `== null` va
  // primero y cubre `null` y `undefined` de una vez.
  const brechaDelMotor = ritmo.brecha == null ? Number.NaN : Number(ritmo.brecha);
  const falta = Number.isFinite(brechaDelMotor)
    ? Math.max(0, brechaDelMotor)
    : Math.max(0, metaEntera - total);
  /**
   * **Cuando el total ya cubre la meta y aun así falta gente, la brecha es de
   * composición y no de volumen**: las respuestas que quedan tienen que caer en
   * los grupos cortos, no en cualquiera. Prometer «N días más al ritmo de» sería
   * falso —al ritmo medio no se cierra una cuota por sexo—, así que ahí el pie
   * dice lo que falta y de qué se trata, y se calla los días.
   */
  const brechaDeComposicion = falta > 0 && total >= metaEntera;
  // Cuántos días más al ritmo medio. Es una división, no un pronóstico, y por
  // eso se dice «al ritmo de» y no «terminará el».
  const diasAlRitmo = media > 0 && falta > 0 && !brechaDeComposicion ? Math.ceil(falta / media) : 0;

  return (
    <div className="aulas-ritmo">
      <p className="aulas-cadenas-lectura">
        {/* **«de recolección», no «de campo».** Este panel cuenta los días con
            RESPUESTAS en la plataforma —del 1/9 al 5/9 en el estudio real— y
            «Encuestas por día de cada facultad», dos pestañas más allá, decía
            «2 días de campo, de 01/09 a 02/09» contando los días con PARTE.
            Los dos números son correctos y son dos ejes; lo que no puede ser es
            que compartan las mismas tres palabras. Medido el 2026-08-29: 5
            contra 2. */}
        <strong>{fmt(total)}</strong> respuestas en <strong>{fmt(conCampo)}</strong>{" "}
        {conCampo === 1 ? "día de recolección" : "días de recolección"}
        {/* `fmt` conserva el decimal del dato y aquí son RESPUESTAS: «139,8 al
            día» son personas partidas. Tercera vez que aparece el mismo defecto
            en una jornada, así que va con `fmtCuenta`, que redondea y no
            inventa medias encuestas. */}
        {media > 0 ? <> · {fmtCuenta(media)} al día</> : null}
        {mejor ? <> · el mejor, {etiquetaDeDia(mejor.fecha)} con <strong>{fmt(mejor.validas)}</strong></> : null}
      </p>
      {/* **El gráfico del boceto, no la tabla que lo sustituía.** Aquí había
          una lista de diez filas —fecha, barra, cifra del día y acumulado en una
          celda— con exactamente estos datos. La cifra estaba y la CURVA no, que
          es lo que dice si el ritmo se sostiene. Gonzalo, 2026-09-10: «no estás
          tomando en cuenta mi artefacto donde dejé varios gráficos a utilizar,
          como el avance diario».

          Su forma: barras del día en el eje izquierdo, acumulado en línea sobre
          el derecho, y cada rótulo de eje del color de su serie. El valor de
          cada día se conserva encima de su barra, que es lo único que la tabla
          daba y el boceto no. */}
      <AulasAvanceDiario dias={dias} />
      {falta > 0 ? (
        <p className="mon-profile-table-recorte">
          {/* «para la meta TOTAL». Sin esa palabra, este pie dice «faltan 43» a
              dos dedos de un panel que dice «3 743 faltan», y los dos hablan de
              la meta de 3 743. Las dos son ciertas y de granos distintos: acá se
              cuentan las respuestas del estudio entero, y allá sólo las que se
              pueden colgar de un aula —que sobre este corte son cero, porque
              llegan sin identificar su curso-horario—. Una de las dos tenía que
              decir cuál es la suya. */}
          {/* `fmtCuenta` y NO `fmt`: son RESPUESTAS y aquí salían con decimal
              —«Faltan 2.824,4 para la meta total de 3.491,4»—. Es exactamente
              el defecto que el comentario de arriba dice haber cazado ya tres
              veces, y estaba **una línea más abajo del sitio donde lo
              arreglaron**: se corrigió la media diaria y no este pie. Hacia
              arriba en los dos, que es la regla de una meta y de lo que falta
              para cumplirla: quedarse a 0,4 de una persona es quedarse corto. */}
          {brechaDeComposicion ? (
            <>
              Faltan <strong>{fmtCuenta(falta)}</strong> en los grupos de facultad y sexo que
              aún no cierran, aunque el total ya pasa la meta de {fmtCuenta(metaEntera)}
            </>
          ) : (
            <>
              Faltan <strong>{fmtCuenta(falta)}</strong> para la meta total de {fmtCuenta(metaEntera)}
            </>
          )}
          {diasAlRitmo
            ? ` · ${diasAlRitmo} ${diasAlRitmo === 1 ? "día más" : "días más"} al ritmo de estos ${fmt(conCampo)}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
