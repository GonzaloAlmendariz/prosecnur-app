import type { ReactNode } from "react";

import { fmt, pctPerfil } from "./kpisDeAulas";
import { efectividadPorDia, tendenciaDeEfectividad } from "./efectividadPorDia";
import type { MonitoreoRow } from "../../../../api/monitoreo";
import "./aulasEfectividadPorDia.css";

/** «2026-09-07» → «Lun 07/09», sin locale: el mismo patrón que el resto del perfil. */
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
function etiquetaDeDia(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return iso;
  const fecha = new Date(Date.UTC(a, m - 1, d));
  return `${DIAS[fecha.getUTCDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/**
 * Hacia dónde va la efectividad del campo, jornada a jornada.
 *
 * Contesta la pregunta que Gonzalo echó en falta en esta pestaña: «si la
 * efectividad era baja al principio pero ahora se está recuperando, patrones,
 * tendencias». Lo que había era la lista de cada curso-horario contra su
 * margen, y de decenas de filas sueltas no sale una tendencia.
 *
 * **Cada día lleva su número de aulas al lado, no en un `title`.** La última
 * jornada del operativo tenía siete visitas y un 88,9 %: sin ese conteo a la
 * vista, la barra más alta se lee como un salto del campo y puede ser la
 * composición de las aulas que tocaron ese día.
 */
export function AulasEfectividadPorDia({ partes, plan }: {
  partes: ReadonlyArray<MonitoreoRow>;
  plan: ReadonlyArray<MonitoreoRow>;
}): ReactNode {
  const dias = efectividadPorDia(partes, plan);
  if (!dias.length) {
    return (
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="mon-profile-muted">
          Todavía no hay partes de campo con fecha: la efectividad por jornada aparece
          con el primero.
        </p>
      </div>
    );
  }
  const t = tendenciaDeEfectividad(dias);
  const FRASE = { sube: "va subiendo", baja: "va bajando", estable: "se mantiene" } as const;

  return (
    // **La rama CON datos declaraba menos que su propio vacío.** El `return` de
    // arriba —el de «todavía no hay partes»— ya marcaba la capacidad, y éste
    // no: sin ella el runner cae a los hijos del `section` del panel y mide el
    // ENCABEZADO —`mon-profile-panel-head`, 36 px— como si fuera el contenedor
    // de datos, y canta `capacity-drift` sobre sus 5 px de padding. Es el
    // patrón que ya arreglaron «Metas por facultad y sexo», «Respuestas» y «A
    // qué aula del banco ir»; los otros cuatro paneles de esta misma pestaña
    // —`aulas-cvf`, `aulas-mapa`, `aulas-tau`, `aulas-dt`— lo declaran y salen
    // limpios. Arreglar el vacío y dejar el lleno sin declarar deja el gate en
    // rojo justo cuando hay datos, que es siempre.
    <div className="aulas-efdia" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      {t ? (
        <p className="aulas-efdia-lectura">
          La efectividad <strong>{FRASE[t.sentido]}</strong>: del{" "}
          <strong>{pctPerfil(t.desde.tau ?? 0)}</strong> de {etiquetaDeDia(t.desde.fecha)} al{" "}
          <strong>{pctPerfil(t.hasta.tau ?? 0)}</strong> de {etiquetaDeDia(t.hasta.fecha)}
          {t.hasta.aulas < 10 ? (
            <em>
              {" "}· la última jornada son {fmt(t.hasta.aulas)}{" "}
              {t.hasta.aulas === 1 ? "curso-horario" : "cursos-horario"}, así que es
              una señal, no todavía un hecho
            </em>
          ) : null}
        </p>
      ) : null}
      <ul className="aulas-efdia-serie" role="table"
        aria-label="Efectividad de cada jornada sobre los alumnos elegibles">
        <li role="row" className="aulas-efdia-cab">
          <span role="columnheader">Jornada</span>
          <span role="columnheader">Cursos-horario</span>
          <span role="columnheader" title="Efectivas del parte de campo sobre los alumnos elegibles de esos cursos-horario. Es la tasa que decide si el estudio cierra.">
            De los elegibles
          </span>
          <span role="columnheader">Efectivas</span>
          <span role="columnheader" title="Efectivas conseguidas contra las que el diseño esperaba de esos mismos cursos-horario. Por encima de 100 % el campo rinde más de lo supuesto.">
            De lo esperado
          </span>
        </li>
        {dias.map((d) => (
          <li key={d.fecha} role="row">
            <span role="cell" className="aulas-efdia-dia">{etiquetaDeDia(d.fecha)}</span>
            <span role="cell" className="aulas-efdia-num">{fmt(d.aulas)}</span>
            <span role="cell" className="aulas-efdia-barra"
              aria-label={`Recogido de los elegibles: ${pctPerfil(d.tau ?? 0)}`}>
              {/* Escala 0–100 y no contra el máximo de la tanda: la tasa ya es
                  una fracción de sí misma, y estirarla al mayor del operativo
                  haría que el mejor día pareciera lleno recogiendo el 40 %. */}
              <i style={{ width: `${Math.max(2, Math.min(100, d.tau ?? 0))}%` }}>
                {d.tau === null ? "—" : pctPerfil(d.tau)}
              </i>
            </span>
            <span role="cell" className="aulas-efdia-num">{fmt(d.efectivas)}</span>
            <span role="cell" className="aulas-efdia-num">
              {d.delEsperado === null ? "—" : pctPerfil(d.delEsperado)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mon-profile-muted aulas-efdia-pie">
        La tasa es sobre los alumnos ELEGIBLES de cada curso-horario visitado, que es la
        que decide si el estudio cierra; la de «sobre asistentes» —el trabajo dentro del
        curso-horario— vive en Rendimiento. Un parte sin efectivas ni asistentes no
        cuenta como jornada de cero: es un parte vacío.
      </p>
    </div>
  );
}
