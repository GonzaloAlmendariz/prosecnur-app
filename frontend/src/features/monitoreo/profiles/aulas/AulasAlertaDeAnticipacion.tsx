import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import type { FacultadDelBanco } from "./AulasBancoExtras";
import { etiquetaDeSexo } from "./etiquetaDeSexo";
import {
  DIAS_DE_ANTICIPACION,
  TASA_DE_CAIDA,
  type AlertaDeFacultad,
  alertaDeAnticipacion,
} from "./alertaDeAnticipacion";
import { proyeccionPorAgenda } from "./proyeccionPorAgenda";
import { caidaObservada } from "./tasaDeCaida";
import { NombreDeFacultad } from "./NombreDeFacultad";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import { fmt } from "./kpisDeAulas";

/**
 * A quién hay que salir a agendar, cuántas aulas y hasta qué día se puede esperar.
 *
 * El resto del perfil dice cómo va el campo; esto dice **qué hacer hoy con el
 * teléfono**. Por eso no es un gráfico: es una lista de facultades ordenada por
 * urgencia, con el número de aulas a pedir en cada una.
 *
 * La columna «Cuándo» lleva una **fecha**, no un adjetivo. Un «hay margen» no se
 * puede agendar; un «antes del 24/08» sí, y es lo que pidió Gonzalo al decir que
 * hay que poder predecirlo con antelación.
 *
 * Y «Reserva adicional» va pegada a «Pedir» porque la comparación es
 * exactamente entre esas dos. Cuando la reserva adicional de la facultad no
 * llega, la lista deja de pedir llamadas: no hay de dónde sacar esas aulas y
 * el problema vuelve a Cálculo de muestra. Decir «pide 14» sin mirar si
 * existen es mandar a llamar al vacío.
 */

/** `2026-08-24` → `24/08`. En UTC: con hora local sale el día anterior. */
function diaCorto(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}` : iso;
}

/** Lo que se lee en la columna «Cuándo» para cada facultad. */
function cuando(f: AlertaDeFacultad): string {
  if (f.urgencia === "sin agenda") return "sin agenda";
  if (f.urgencia === "pedir ahora") return "ahora";
  return f.pedirAntesDe ? `antes del ${diaCorto(f.pedirAntesDe)}` : "hay margen";
}

/**
 * Cuando lo que falta está tan cargado a un lado que hay que decirlo al pedir.
 *
 * **Dos tercios.** Por debajo de ahí los dos lados pesan parecido y nombrar uno
 * mandaría a pedir sesgado; por encima, pedir aulas cualesquiera deja abierta la
 * celda que falla. Medido sobre el corte: las ocho facultades con más brecha
 * están cargadas a mujeres, hasta 53 contra 20.
 */
const CARGA_QUE_MANDA = 2 / 3;

/** `0.235` → `24 %`. */
const pctCorto = (n: number) => `${Math.round(n * 100)} %`;

export function AulasAlertaDeAnticipacion({ partes, agenda = [], cuotas = [], banco = [], facultadEnFoco, onFoco }: {
  partes: ReadonlyArray<MonitoreoRow>;
  agenda?: ReadonlyArray<MonitoreoRow>;
  cuotas?: ReadonlyArray<MonitoreoRow>;
  /** `banco_extras.por_facultad`, para saber si las aulas que se piden existen. */
  banco?: ReadonlyArray<FacultadDelBanco>;
  /**
   * La facultad enfocada, si la hay. **No filtra: resalta.**
   *
   * `foco` es una dimensión declarada de la gramática de navegación y viaja en
   * la URL (`?foco=facultad:Derecho`), pero lo obedecía UNA sola superficie: la
   * tabla de cuotas. El perfil tiene **seis listas de las mismas veinte
   * facultades**, así que para saber cómo va Derecho había que cazar su fila
   * seis veces.
   *
   * Resaltar y no filtrar es deliberado: estas listas son rankings —«a quién
   * llamar», «qué rinde más», «dónde falta más»— y dejarlas en una sola fila
   * destruiría justo lo que aportan, que es dónde cae esa facultad entre las
   * otras. El detalle sí se filtra; el control, no. Es la misma regla que ya
   * gobierna la pirámide.
   */
  facultadEnFoco?: string;
  /** Pulsar un nombre pone el foco. Sin esto, los nombres son sólo texto. */
  onFoco?: (foco: FocoDeCuota) => void;
}) {
  const filas = useMemo(
    () => alertaDeAnticipacion(proyeccionPorAgenda(agenda, partes, cuotas), banco),
    [agenda, partes, cuotas, banco],
  );

  const conBrecha = filas.filter((f) => f.urgencia !== "sin brecha");
  // Sólo se suma lo que tiene cifra. Las facultades cuyo pedido no se puede
  // dimensionar todavía —brecha conocida, rendimiento por aula aún no— se
  // cuentan aparte y se dicen: sumarlas como 0 hacía que la lectura declarara
  // «hay que pedir 0 en total» encima de una tabla con 983 y 1.340 en FALTAN.
  const dimensionadas = conBrecha.filter((f) => f.aulasAPedir != null);
  const sinDimensionar = conBrecha.length - dimensionadas.length;
  const aulasTotales = dimensionadas.reduce((n, f) => n + (f.aulasAPedir ?? 0), 0);
  const paradas = conBrecha.filter((f) => f.urgencia === "sin agenda").length;
  const sinReservaAdicional = conBrecha.filter((f) => f.reservaAlcanza === false).length;
  // Si NINGUNA fila sabe cuánta reserva adicional le queda, la columna sería
  // «S/D» veinte veces. Se omite entera: una columna que no distingue nada
  // sólo estrecha las que sí lo hacen.
  const hayReservaAdicional = conBrecha.some((f) => f.reservaDisponible != null);
  // **El supuesto que hay detrás de cada número de esta lista.**
  //
  // «Pedir 14» sale de multiplicar lo que falta por la tasa de caída de 2025.
  // Esa constante no se toca —cambiarla cada día haría la alerta inservible—
  // pero si este estudio se estuviera cayendo al 35 % la lista estaría pidiendo
  // un cuarto menos de lo necesario y nada lo diría.
  const caida = useMemo(() => caidaObservada(agenda), [agenda]);
  // Cuando todas las facultades dicen lo mismo en «Cuándo», la columna es la
  // misma palabra veinte veces: ruido que empuja al resto. Se dice una vez en la
  // lectura y la columna desaparece. Se compara el TEXTO y no la urgencia,
  // porque dos facultades con margen distinto llevan fechas distintas.
  const cuandos = new Set(conBrecha.map(cuando));

  if (!filas.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        Sin cuotas por facultad no se puede decir cuántas aulas faltan por agendar.
      </p>
    );
  }

  if (!conBrecha.length) {
    return (
      <p className="aulas-anticipacion-ok">
        Ninguna facultad necesita aulas nuevas: con lo agendado todas llegan a su cuota.
      </p>
    );
  }

  return (
    <div className="aulas-anticipacion">
      <p className="aulas-cadenas-lectura">
        <strong>{fmt(conBrecha.length)}</strong>{" "}
        {conBrecha.length === 1 ? "facultad necesita" : "facultades necesitan"} cursos-horario nuevos
        {dimensionadas.length
          ? <> · hay que pedir <strong>{fmt(aulasTotales)}</strong> en total</>
          : null}
        {sinDimensionar
          ? <> · <strong>{fmt(sinDimensionar)}</strong> sin dimensionar todavía: hace falta
              el primer curso-horario aplicado para saber cuánto rinde uno</>
          : null}
        {/* Las paradas van en la lectura y no sólo en la tabla: son las que
            tienen días de campo perdiéndose ahora mismo. */}
        {paradas > 0
          ? <> · <strong>{fmt(paradas)}</strong> ya {paradas === 1 ? "está" : "están"} sin agenda</>
          : null}
        {cuandos.size === 1 ? ` · todas: ${[...cuandos][0]}` : ""}
      </p>

      {/* El supuesto, comparado con lo que va pasando. Va ARRIBA de la lista
          porque califica todos sus números, no debajo como una nota. */}
      {caida.tasa != null ? (
        <p className={`aulas-anticipacion-caida${caida.direccion ? " es-distinta" : ""}`}>
          <span>
            Se cae <strong>{pctCorto(caida.tasa)}</strong> de los titulares
            {" "}({fmt(caida.caidas)} de {fmt(caida.decididos)} ya resueltos)
            {" · "}en 2025 fue <strong>{pctCorto(TASA_DE_CAIDA)}</strong>
          </span>
          {caida.direccion ? (
            <em>
              {caida.direccion === "se caen más"
                ? "se están cayendo más que entonces: la lista está pidiendo de menos"
                : "se están cayendo menos que entonces: la lista está pidiendo de más"}
            </em>
          ) : (
            // Dentro del margen no se dice «va igual»: se dice que todavía no se
            // puede distinguir, que es lo que la evidencia permite afirmar.
            <em>
              {caida.margen == null
                ? "todavía son pocos desenlaces para compararlo"
                : "la diferencia cabe dentro del margen de este tamaño"}
            </em>
          )}
        </p>
      ) : null}

      {/* Va fuera de la lectura y antes de la tabla porque cambia QUÉ hacer, no
          cuánto: con la reserva adicional corta no hay llamada que lo arregle. */}
      {sinReservaAdicional > 0 ? (
        <p className="aulas-anticipacion-sinbanco">
          En <strong>{fmt(sinReservaAdicional)}</strong> {sinReservaAdicional === 1 ? "facultad" : "facultades"}{" "}
          la reserva adicional no tiene los cursos-horario que se piden: eso no se resuelve
          llamando, se resuelve ampliando la muestra en Cálculo de muestra.
        </p>
      ) : null}

      <ul
        role="table"
        aria-label="Cursos-horario por pedir, por facultad"
        className={`aulas-anticipacion-lista${hayReservaAdicional ? " con-banco" : ""}`}
        data-qa-geometry-capacity="owned"
        data-qa-geometry-member
      >
        {/* «Pedir» va primera entre las cifras porque es por lo que está
            ordenada la lista, y porque es la que se ejecuta. Con «Faltan»
            delante, la primera columna numérica que lee el ojo salta —232, 196,
            191, 186, 169, 163, 153, 168…— y la tabla parece desordenada cuando
            está ordenada por otra cosa. */}
        {/* Roles de tabla sobre la rejilla, no `<table>`: la cabecera estaba
            oculta y un lector de pantalla recibía las cifras sin nombre. **Las
            columnas condicionales llevan el rol DENTRO de su condicional**, o la
            fila declararía más celdas de las que pinta. */}
        <li className="aulas-anticipacion-cabecera" role="row">
          <span role="columnheader">Facultad</span>
          <span role="columnheader">Pedir</span>
          {hayReservaAdicional ? <span role="columnheader">Reserva adicional</span> : null}
          {/* **«Cubren» se leía como una afirmación sobre la reserva
              adicional.** Va pegada a la columna «Reserva adicional», que casi
              siempre dice «S/D», y la fila quedaba «Pedir 33 · Reserva
              adicional S/D · Cubren 25»: con la reserva adicional sin dato,
              ¿con qué cubren 25? No habla de la reserva adicional — son las
              aulas que BASTARÍAN para cerrar la brecha, y se piden más porque
              una parte se cae, como explica el pie. El rótulo nombra ahora lo
              que cuenta. */}
          <span role="columnheader">Bastarían</span>
          <span role="columnheader">Faltan</span>
          {cuandos.size > 1 ? <span role="columnheader">Cuándo</span> : null}
        </li>
        {conBrecha.map((f) => (
          <li key={f.facultad} role="row" className={`${f.urgencia === "hay margen" ? "" : "es-urgente"}${f.facultad === facultadEnFoco ? " es-en-foco" : ""}`}>
            <NombreDeFacultad facultad={f.facultad} className="aulas-anticipacion-nombre"
              rol="rowheader"
              enFoco={f.facultad === facultadEnFoco} />
            <span role="cell" className="aulas-anticipacion-pedir">
              {f.aulasAPedir ? <strong>{fmt(f.aulasAPedir)}</strong> : <em>S/D</em>}
            </span>
            {/* Extras de ESA facultad sin usar. `null` es «no se sabe», que no es
                cero: pintarlo como cero acusaría de una escasez no medida. */}
            {hayReservaAdicional ? (
              <span role="cell" className={f.reservaAlcanza === false ? "aulas-anticipacion-ya" : ""}>
                {f.reservaDisponible == null ? <em>S/D</em> : fmt(f.reservaDisponible)}
              </span>
            ) : null}
            {/* Las que cubrirían la brecha si TODAS se aplicaran. Se enseña al
                lado de las que hay que pedir para que el margen se vea, en vez de
                aparecer como un número inflado sin explicación. */}
            <span role="cell">{f.aulasNecesarias ? fmt(f.aulasNecesarias) : "S/D"}</span>
            {/* Lo que falta Y DE QUÉ. Sumar los dos sexos escondía la mitad de
                la instrucción: «pide 12 en Gestión» con 52 mujeres y 24 hombres
                de brecha. La reserva adicional se elige por composición, así
                que el pedido también. */}
            <span role="cell" className="aulas-anticipacion-faltan" title={
              f.faltanPorSexo.length
                ? f.faltanPorSexo.map((x) => `${fmt(x.faltan)} ${etiquetaDeSexo(x.sexo)}`).join(" · ")
                : undefined
            }>
              {fmt(f.faltan)}
              {f.faltanPorSexo.length > 1 && f.faltanPorSexo[0].faltan >= f.faltan * CARGA_QUE_MANDA ? (
                <em> · {fmt(f.faltanPorSexo[0].faltan)} {etiquetaDeSexo(f.faltanPorSexo[0].sexo)}</em>
              ) : null}
            </span>
            {cuandos.size > 1 ? (
              <span role="cell" className={f.urgencia === "hay margen" ? "" : "aulas-anticipacion-ya"}>
                {cuando(f)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="mon-profile-muted aulas-anticipacion-pie">
        {/* «21 de cada 170» y no «12 de cada 100»: redondear la tasa deja en la
            misma frase dos cifras del mismo hecho a cinco palabras de
            distancia. La fracción real no necesita redondeo — y es la fracción
            de CAÍDAS (titular sin aplicar cubierto por reemplazo), no la de
            «usó algún reemplazo», que en 2025 también contaba 25 refuerzos
            (checklist-tres-fuentes §A7). */}
        Se piden más aulas de las que cubren la brecha porque una parte no llega a
        aplicarse: en el operativo de 2025, <strong>21 de cada 170</strong>{" "}
        titulares cayeron y un reemplazo ocupó su lugar. La fecha es el último día para
        llamar sin que la facultad se quede parada: se cuenta desde el día en que
        se le acaba la agenda, restando los <strong>{DIAS_DE_ANTICIPACION} días</strong>{" "}
        que pasaron de mediana entre llamar a un curso-horario y aplicarlo, también en 2025.
        {hayReservaAdicional ? " «Reserva adicional» son los cursos-horario extra de esa facultad que siguen sin usarse." : ""}
      </p>
    </div>
  );
}
