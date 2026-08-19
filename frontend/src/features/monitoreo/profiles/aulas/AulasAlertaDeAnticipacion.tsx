import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import {
  DIAS_DE_ANTICIPACION,
  type AlertaDeFacultad,
  alertaDeAnticipacion,
} from "./alertaDeAnticipacion";
import { proyeccionPorAgenda } from "./proyeccionPorAgenda";

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

export function AulasAlertaDeAnticipacion({ partes, agenda = [], cuotas = [] }: {
  partes: ReadonlyArray<MonitoreoRow>;
  agenda?: ReadonlyArray<MonitoreoRow>;
  cuotas?: ReadonlyArray<MonitoreoRow>;
}) {
  const filas = useMemo(
    () => alertaDeAnticipacion(proyeccionPorAgenda(agenda, partes, cuotas)),
    [agenda, partes, cuotas],
  );

  const conBrecha = filas.filter((f) => f.urgencia !== "sin brecha");
  const aulasTotales = conBrecha.reduce((n, f) => n + f.aulasAPedir, 0);
  const paradas = conBrecha.filter((f) => f.urgencia === "sin agenda").length;
  // Cuando todas las facultades dicen lo mismo en «Cuándo», la columna es la
  // misma palabra veinte veces: ruido que empuja al resto. Se dice una vez en la
  // lectura y la columna desaparece. Se compara el TEXTO y no la urgencia,
  // porque dos facultades con margen distinto llevan fechas distintas.
  const cuandos = new Set(conBrecha.map(cuando));

  if (!filas.length) {
    return (
      <p className="mon-profile-muted">
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

      <ul className="aulas-anticipacion-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        {/* «Pedir» va primera entre las cifras porque es por lo que está
            ordenada la lista, y porque es la que se ejecuta. Con «Faltan»
            delante, la primera columna numérica que lee el ojo salta —232, 196,
            191, 186, 169, 163, 153, 168…— y la tabla parece desordenada cuando
            está ordenada por otra cosa. */}
        <li className="aulas-anticipacion-cabecera" aria-hidden="true">
          <span>Facultad</span>
          <span>Pedir</span>
          <span>Cubren</span>
          <span>Faltan</span>
          {cuandos.size > 1 ? <span>Cuándo</span> : null}
        </li>
        {conBrecha.map((f) => (
          <li key={f.facultad} className={f.urgencia === "hay margen" ? "" : "es-urgente"}>
            <span className="aulas-anticipacion-nombre" title={f.facultad}>{f.facultad}</span>
            <span className="aulas-anticipacion-pedir">
              {f.aulasAPedir ? <strong>{fmt(f.aulasAPedir)}</strong> : <em>S/D</em>}
            </span>
            {/* Las que cubrirían la brecha si TODAS se aplicaran. Se enseña al
                lado de las que hay que pedir para que el margen se vea, en vez de
                aparecer como un número inflado sin explicación. */}
            <span>{f.aulasNecesarias ? fmt(f.aulasNecesarias) : "S/D"}</span>
            <span>{fmt(f.faltan)}</span>
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
      </p>
    </div>
  );
}
