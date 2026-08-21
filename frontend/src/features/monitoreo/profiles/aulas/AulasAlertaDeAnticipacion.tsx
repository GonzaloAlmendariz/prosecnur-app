import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import type { FacultadDelBanco } from "./AulasBancoExtras";
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
 * Y «Banco» va pegada a «Pedir» porque la comparación es exactamente entre esas
 * dos. Cuando el banco de la facultad no llega, la lista deja de pedir llamadas:
 * no hay de dónde sacar esas aulas y el problema vuelve a Cálculo de muestra.
 * Decir «pide 14» sin mirar si existen es mandar a llamar al vacío.
 */

const fmt = (n: number) => n.toLocaleString("es-PE");

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
  const aulasTotales = conBrecha.reduce((n, f) => n + f.aulasAPedir, 0);
  const paradas = conBrecha.filter((f) => f.urgencia === "sin agenda").length;
  const sinBanco = conBrecha.filter((f) => f.bancoAlcanza === false).length;
  // Si NINGUNA fila sabe cuánto banco le queda, la columna sería «S/D» veinte
  // veces. Se omite entera: una columna que no distingue nada sólo estrecha las
  // que sí lo hacen.
  const hayBanco = conBrecha.some((f) => f.bancoDisponible != null);
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
        {conBrecha.length === 1 ? "facultad necesita" : "facultades necesitan"} aulas nuevas ·
        hay que pedir <strong>{fmt(aulasTotales)}</strong> en total
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
          cuánto: con el banco corto no hay llamada que lo arregle. */}
      {sinBanco > 0 ? (
        <p className="aulas-anticipacion-sinbanco">
          En <strong>{fmt(sinBanco)}</strong> {sinBanco === 1 ? "facultad" : "facultades"}{" "}
          el banco de extras no tiene las aulas que se piden: eso no se resuelve
          llamando, se resuelve ampliando la muestra en Cálculo de muestra.
        </p>
      ) : null}

      <ul
        className={`aulas-anticipacion-lista${hayBanco ? " con-banco" : ""}`}
        data-qa-geometry-capacity="owned"
        data-qa-geometry-member
      >
        {/* «Pedir» va primera entre las cifras porque es por lo que está
            ordenada la lista, y porque es la que se ejecuta. Con «Faltan»
            delante, la primera columna numérica que lee el ojo salta —232, 196,
            191, 186, 169, 163, 153, 168…— y la tabla parece desordenada cuando
            está ordenada por otra cosa. */}
        <li className="aulas-anticipacion-cabecera" aria-hidden="true">
          <span>Facultad</span>
          <span>Pedir</span>
          {hayBanco ? <span>Banco</span> : null}
          <span>Cubren</span>
          <span>Faltan</span>
          {cuandos.size > 1 ? <span>Cuándo</span> : null}
        </li>
        {conBrecha.map((f) => (
          <li key={f.facultad} className={`${f.urgencia === "hay margen" ? "" : "es-urgente"}${f.facultad === facultadEnFoco ? " es-en-foco" : ""}`}>
            <NombreDeFacultad facultad={f.facultad} className="aulas-anticipacion-nombre"
              enFoco={f.facultad === facultadEnFoco} onFoco={onFoco} />
            <span className="aulas-anticipacion-pedir">
              {f.aulasAPedir ? <strong>{fmt(f.aulasAPedir)}</strong> : <em>S/D</em>}
            </span>
            {/* Extras de ESA facultad sin usar. `null` es «no se sabe», que no es
                cero: pintarlo como cero acusaría de una escasez no medida. */}
            {hayBanco ? (
              <span className={f.bancoAlcanza === false ? "aulas-anticipacion-ya" : ""}>
                {f.bancoDisponible == null ? <em>S/D</em> : fmt(f.bancoDisponible)}
              </span>
            ) : null}
            {/* Las que cubrirían la brecha si TODAS se aplicaran. Se enseña al
                lado de las que hay que pedir para que el margen se vea, en vez de
                aparecer como un número inflado sin explicación. */}
            <span>{f.aulasNecesarias ? fmt(f.aulasNecesarias) : "S/D"}</span>
            {/* Lo que falta Y DE QUÉ. Sumar los dos sexos escondía la mitad de
                la instrucción: «pide 12 en Gestión» con 52 mujeres y 24 hombres
                de brecha. El banco se elige por composición, así que el pedido
                también. */}
            <span className="aulas-anticipacion-faltan" title={
              f.faltanPorSexo.length
                ? f.faltanPorSexo.map((x) => `${fmt(x.faltan)} ${x.sexo}`).join(" · ")
                : undefined
            }>
              {fmt(f.faltan)}
              {f.faltanPorSexo.length > 1 && f.faltanPorSexo[0].faltan >= f.faltan * CARGA_QUE_MANDA ? (
                <em> · {fmt(f.faltanPorSexo[0].faltan)} {f.faltanPorSexo[0].sexo.toLowerCase()}</em>
              ) : null}
            </span>
            {cuandos.size > 1 ? (
              <span className={f.urgencia === "hay margen" ? "" : "aulas-anticipacion-ya"}>
                {cuando(f)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="mon-profile-muted aulas-anticipacion-pie">
        {/* «40 de cada 170» y no «24 de cada 100»: redondear la tasa dejaba en la
            misma frase un 24 % y un «(40 de 170)» que da 23,5 —dos cifras del
            mismo hecho a cinco palabras de distancia—. La fracción real no
            necesita redondeo. */}
        Se piden más aulas de las que cubren la brecha porque una parte no llega a
        aplicarse: en el operativo de 2025, <strong>40 de cada 170</strong>{" "}
        titulares acabaron necesitando reemplazo. La fecha es el último día para
        llamar sin que la facultad se quede parada: se cuenta desde el día en que
        se le acaba la agenda, restando los <strong>{DIAS_DE_ANTICIPACION} días</strong>{" "}
        que pasaron de mediana entre llamar a un aula y aplicarla, también en 2025.
        {hayBanco ? " «Banco» son las aulas extra de esa facultad que siguen sin usarse." : ""}
      </p>
    </div>
  );
}
