import { aulasFieldLabel, escalaDeProporciones, presentAulasRow } from "./aulasPresentation";

/**
 * «Base de control», la tercera hoja del operativo, leída en la app.
 *
 * Las otras dos hojas ya se veían: el agendamiento manda sus 20 campos a Agenda
 * y a las cadenas, y el parte de campo sus 10 a Consultas. Ésta se leía desde el
 * principio y sus 25 campos propios —validadores, cortas y largas, umbrales 70T
 * y 70P, cuota por sexo del aula, rango horario— no llegaban a ninguna
 * pantalla: el lector dejaba las filas en la sesión y no las consumía nadie.
 *
 * Vive en Validación porque es control de calidad, que es lo que esa sección
 * contiene. Los otros controles los deriva el motor; éstos los calcula el equipo
 * con sus fórmulas en el Excel, así que aquí se LEEN y no se recalculan: tener
 * dos cuentas del mismo número es peor que no tenerlo.
 *
 * Lo primero que se dice es cuánto del control viene lleno. Un aula sin
 * controles y un aula con el control en cero se ven igual en una tabla, y son
 * cosas distintas: la primera no se ha revisado.
 */

export type GrupoDeControl = {
  clave: string;
  etiqueta: string;
  campos: number;
  aulas_con_dato: number;
};

export type VeredictoDeControl = {
  efectivas: number;
  cumple_una: number;
  /** De `cumple_una`: llegó al 70 % de los asistentes y no al de los matriculados. */
  solo_asistentes?: number;
  /** De `cumple_una`: llegó al de los matriculados y no al de los asistentes. */
  solo_poblacion?: number;
  no_efectivas: number;
  indeterminadas: number;
};

export type ResumenDeControl = {
  aulas: number;
  grupos: GrupoDeControl[];
  veredicto?: VeredictoDeControl;
};

/**
 * Lo que esta hoja contesta, en una línea.
 *
 * Gonzalo lo dijo así: un aula es efectiva si llegó al 70 % de los asistentes
 * elegibles **y** al 70 % de los alumnos elegibles, hayan asistido o no. Los
 * dos umbrales, no uno. Esa es la pregunta que el equipo le hace al libro, y
 * hasta ahora había que leer veintisiete columnas para contestarla.
 *
 * «Cumple uno» va separado de «no cumple ninguno» porque es donde queda
 * decisión: al aula que falló los dos ya no hay nada que hacerle.
 * «Sin evaluar» no se suma a las que fallaron: nadie las miró todavía.
 */
function Veredicto({ v, aulas }: { v: VeredictoDeControl; aulas: number }) {
  const pct = aulas > 0 ? Math.round((v.efectivas / aulas) * 100) : 0;
  return (
    <div className="aulas-control-veredicto">
      <p className="aulas-control-titular">
        <strong>{v.efectivas}</strong> de {aulas} aulas efectivas
        <span> · {pct} %</span>
      </p>
      <p className="mon-profile-muted">
        Alcanzaron el 70 % contra los dos denominadores: asistentes elegibles y alumnos elegibles.
      </p>
      <ul className="aulas-control-desglose">
        {/* «Cumplen sólo uno» valía igual para dos diagnósticos opuestos, y la
            hoja ya sabía cuál era cada uno. Se desglosa porque de eso depende
            si volver al aula sirve de algo: si sobró aplicación y faltó gente
            en clase, no se arregla volviendo a la misma sesión. Los dos suman
            `cumple_una`; si el desglose no llega —motor viejo— se enseña el
            total, que es lo que había. */}
        {v.cumple_una > 0 && (v.solo_asistentes ?? 0) + (v.solo_poblacion ?? 0) === v.cumple_una ? (
          <>
            {v.solo_asistentes ? (
              <li>
                <strong>{v.solo_asistentes}</strong> llegaron al 70 % de los asistentes y no al de los matriculados
                <span className="mon-profile-muted"> · fue poca gente a clase; volver a esa sesión no la trae</span>
              </li>
            ) : null}
            {v.solo_poblacion ? (
              <li>
                <strong>{v.solo_poblacion}</strong> llegaron al 70 % de los matriculados y no al de los asistentes
                <span className="mon-profile-muted"> · había más presentes que elegibles y parte no respondió</span>
              </li>
            ) : null}
          </>
        ) : v.cumple_una > 0 ? (
          <li>
            <strong>{v.cumple_una}</strong> cumplen sólo uno de los dos
          </li>
        ) : null}
        {v.no_efectivas > 0 ? (
          <li>
            <strong>{v.no_efectivas}</strong> no alcanzan ninguno
          </li>
        ) : null}
        {v.indeterminadas > 0 ? (
          <li>
            {/* Distinto de «no llegó»: es que el libro no trae con qué decidirlo. */}
            <strong>{v.indeterminadas}</strong> sin evaluar en el libro
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/**
 * El nombre visible de cada grupo.
 *
 * NO se usa la `etiqueta` que manda el motor: el R del proyecto se escribe sin
 * tildes, así que llegaba «Control - duracion» y eso es lo que se leía en
 * pantalla. El nombre que ve el equipo es de la capa de presentación, igual que
 * el de cualquier otra columna. Son los rótulos de la fila 1 de la hoja.
 */
const NOMBRE_DE_GRUPO: Record<string, string> = {
  cuenta: "Cuenta",
  duracion: "Duración",
  cuotas: "Cuotas",
  horario: "Rango horario",
};

function nombreDeGrupo(grupo: GrupoDeControl) {
  return NOMBRE_DE_GRUPO[grupo.clave] ?? grupo.etiqueta.replace("Control - ", "");
}

/** Los campos de cada grupo, en el orden de la hoja. Espeja al motor. */
const CAMPOS_POR_GRUPO: Record<string, string[]> = {
  cuenta: [
    "sent_total", "sent_vs_total", "sent_vs_population",
    "validator_1", "validator_2", "validator_3",
    "short_total", "short_vs_total", "long_total", "long_vs_total",
    "threshold_total", "threshold_population", "valid_total", "valid_population",
  ],
  duracion: ["last_response_day"],
  cuotas: [
    "observed_students", "non_respondents", "attendance_pct",
    "quota_pct", "quota_missing", "women_n", "men_n", "women_pct", "men_pct",
  ],
  horario: ["schedule_norm", "schedule_range"],
};

function texto(valor: unknown) {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  return String(valor).trim();
}

export function AulasControlDelLibro({
  filas,
  resumen,
}: {
  filas: ReadonlyArray<Record<string, unknown>>;
  resumen: ResumenDeControl | null;
}) {
  const grupos = resumen?.grupos ?? [];
  const aulas = resumen?.aulas ?? filas.length;

  if (!aulas) {
    return (
      // El vacío vive dentro de la caja y dice de dónde saldría el dato (C3):
      // esta hoja no la produce la app, la llena el equipo.
      <p className="mon-profile-muted">
        El libro importado no trae la hoja «Base de control», o la trae sin filas.
        Es la hoja donde el equipo lleva el control de calidad por aula.
      </p>
    );
  }

  // Sólo los grupos que traen algo. Un grupo entero vacío se dice en una línea
  // al final, no ocupando una columna de ceros.
  const conDato = grupos.filter((g) => g.aulas_con_dato > 0);
  const vacios = grupos.filter((g) => g.aulas_con_dato === 0);
  // Las columnas que se muestran salen de los grupos que tienen dato: enseñar
  // catorce columnas vacías porque la hoja las declara no informa de nada.
  const columnas = ["operational_code", ...conDato.flatMap((g) => CAMPOS_POR_GRUPO[g.clave] ?? [])];
  // Esta tabla pinta sus celdas por su cuenta —no pasa por `DataTable`— y por
  // eso enseñaba «0.909» bajo un rótulo que dice «vs Total». La conversión es
  // de la capa de presentación, la misma que ya traduce estados y motivos, y la
  // escala se decide sobre la columna entera.
  const enProporcion = escalaDeProporciones(filas);
  const presentadas = filas.map((fila) => presentAulasRow(fila, enProporcion));

  return (
    <div className="aulas-control-libro">
      {/* Primero el veredicto, después de qué está hecho y sólo al final el
          detalle fila a fila. Es el orden del histórico del cálculo de muestra
          (ADR 0060): se narra en el orden en que se decide, y la tabla cruda
          queda de respaldo para quien vaya a por un aula concreta. */}
      {resumen?.veredicto ? <Veredicto v={resumen.veredicto} aulas={aulas} /> : null}
      <p className="aulas-cadenas-lectura">
        <strong>{aulas}</strong> {aulas === 1 ? "aula" : "aulas"} en la hoja
        {conDato.map((g) => (
          <span key={g.clave}>
            {" · "}
            {nombreDeGrupo(g)} <strong>{g.aulas_con_dato}</strong>
          </span>
        ))}
      </p>
      {vacios.length ? (
        <p className="mon-profile-muted">
          Sin llenar en el libro: {vacios.map(nombreDeGrupo).join(" · ")}.
        </p>
      ) : null}
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <table className="mon-profile-table">
          <thead>
            <tr>{columnas.map((c) => <th key={c}>{aulasFieldLabel(c)}</th>)}</tr>
          </thead>
          <tbody>
            {presentadas.map((fila, i) => (
              <tr key={texto(fila.operational_code) || i}>
                {columnas.map((c) => <td key={c}>{texto(fila[c])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
