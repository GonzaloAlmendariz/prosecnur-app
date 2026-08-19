import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import {
  DIAS_DE_ANTICIPACION,
  TASA_DE_CAIDA,
  alertaDeAnticipacion,
} from "./alertaDeAnticipacion";
import { proyeccionPorAgenda } from "./proyeccionPorAgenda";

/**
 * A quién hay que salir a agendar, cuántas aulas y hasta cuándo se puede esperar.
 *
 * El resto del perfil dice cómo va el campo; esto dice **qué hacer hoy con el
 * teléfono**. Por eso no es un gráfico: es una lista de facultades ordenada por
 * urgencia, con el número de aulas a pedir en cada una.
 *
 * Los dos umbrales van visibles en el pie **con su origen**. Una alerta que no
 * dice de dónde salen sus números no se puede discutir, y ésta pide trabajo a
 * gente: tiene que poder defenderse.
 */

const fmt = (n: number) => n.toLocaleString("es-PE");

export function AulasAlertaDeAnticipacion({ partes, agenda = [], cuotas = [], diasRestantes = null }: {
  partes: ReadonlyArray<MonitoreoRow>;
  agenda?: ReadonlyArray<MonitoreoRow>;
  cuotas?: ReadonlyArray<MonitoreoRow>;
  /** Días de campo que quedan. `null` si el estudio no declara fecha de cierre. */
  diasRestantes?: number | null;
}) {
  const filas = useMemo(
    () => alertaDeAnticipacion(proyeccionPorAgenda(agenda, partes, cuotas), diasRestantes),
    [agenda, partes, cuotas, diasRestantes],
  );

  const conBrecha = filas.filter((f) => f.urgencia !== "sin brecha");
  const aulasTotales = conBrecha.reduce((n, f) => n + f.aulasAPedir, 0);

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
    <div className="aulas-anticipacion" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-cadenas-lectura">
        <strong>{fmt(conBrecha.length)}</strong>{" "}
        {conBrecha.length === 1 ? "facultad necesita" : "facultades necesitan"} aulas nuevas ·
        hay que pedir <strong>{fmt(aulasTotales)}</strong> en total
        {diasRestantes == null ? " · el estudio no declara fecha de cierre" : ""}
      </p>

      <ul className="aulas-anticipacion-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <li className="aulas-anticipacion-cabecera" aria-hidden="true">
          <span>Facultad</span>
          <span>Faltan</span>
          <span>Cubren</span>
          <span>Pedir</span>
          <span>Cuándo</span>
        </li>
        {conBrecha.map((f) => (
          <li key={f.facultad} className={f.urgencia === "pedir ahora" ? "es-urgente" : ""}>
            <span className="aulas-anticipacion-nombre" title={f.facultad}>{f.facultad}</span>
            <span>{fmt(f.faltan)}</span>
            {/* Las que cubrirían la brecha si TODAS se aplicaran. Se enseña al
                lado de las que hay que pedir para que el margen se vea, en vez de
                aparecer como un número inflado sin explicación. */}
            <span>{f.aulasNecesarias ? fmt(f.aulasNecesarias) : "S/D"}</span>
            <span className="aulas-anticipacion-pedir">
              {f.aulasAPedir ? <strong>{fmt(f.aulasAPedir)}</strong> : <em>S/D</em>}
            </span>
            <span className={f.urgencia === "pedir ahora" ? "aulas-anticipacion-ya" : ""}>
              {f.urgencia === "pedir ahora" ? "ahora" : "hay margen"}
            </span>
          </li>
        ))}
      </ul>

      <p className="mon-profile-muted aulas-anticipacion-pie">
        Se piden más aulas de las que cubren la brecha porque una parte no llega a
        aplicarse: en el operativo de 2025, <strong>{Math.round(TASA_DE_CAIDA * 100)} de cada 100</strong>{" "}
        titulares acabaron necesitando reemplazo (40 de 170). Y «ahora» significa
        que queda menos margen que los <strong>{DIAS_DE_ANTICIPACION} días</strong> que
        pasaron de mediana entre llamar a un aula y aplicarla, también en 2025.
        {diasRestantes == null
          ? " Sin fecha de cierre declarada no se puede calcular margen, así que toda brecha se trata como urgente."
          : ""}
      </p>
    </div>
  );
}
