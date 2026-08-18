import { useMemo, useState } from "react";

/**
 * El banco de reservas extra, por facultad.
 *
 * El diseño da dos niveles de respaldo y hasta ahora sólo se veía uno. Primero
 * la cadena propia del curso-horario —`CH 6` → `R 6.1` → `R 6.2`—, que vive en
 * Reemplazos. Y después el banco: reservas que **no cuelgan de ningún titular**,
 * repartidas por estrato. En el estudio de 2026 son 639 contra 202 titulares.
 *
 * La pregunta que esta vista contesta, dicha por quien la pidió: «necesitamos
 * bastantes mujeres en determinada facultad, esta cadena no funcionó, ¿qué
 * extra me garantiza tantos hombres y tantas mujeres?». Por eso abre por
 * facultad y no por código, y por eso el desglose por sexo va en la misma fila
 * que el aula: es el dato con el que se elige.
 */

export type ExtraDeBanco = {
  operational_code: string;
  course_name: string;
  faculty: string;
  stratum: string;
  level: string;
  teacher: string;
  eligible_n: number | null;
  mujeres: number | null;
  hombres: number | null;
};

export type FacultadDelBanco = {
  faculty: string;
  extras: number;
  elegibles: number;
  mujeres: number;
  hombres: number;
};

export type BancoDeExtras = {
  total: number;
  elegibles: number;
  mujeres: number;
  hombres: number;
  por_facultad: FacultadDelBanco[];
  extras: ExtraDeBanco[];
};

const fmt = (n: number) => n.toLocaleString("es-PE");
/** «—» y no «0»: no declarar el sexo no es lo mismo que no tener a nadie. */
const cifra = (n: number | null | undefined) => (n == null ? "—" : fmt(n));

export function AulasBancoExtras({ banco }: { banco: BancoDeExtras | null }) {
  const [facultad, setFacultad] = useState<string>("");

  const visibles = useMemo(() => {
    const todos = banco?.extras ?? [];
    const propios = facultad ? todos.filter((e) => e.faculty === facultad) : todos;
    // Por mujeres desc: el caso que motiva la vista es «me faltan mujeres en
    // esta facultad». Quien busque hombres ordena por su columna al mirarla;
    // abrir por código no contesta ninguna de las dos preguntas.
    return [...propios].sort((a, b) => (b.mujeres ?? -1) - (a.mujeres ?? -1));
  }, [banco, facultad]);

  if (!banco || !banco.total) {
    return (
      // Vacío legítimo: hay estudios cuyo diseño no dotó banco, y eso es una
      // decisión de la muestra, no un fallo de la vista.
      <p className="mon-profile-muted">
        El plan de este estudio no declara reservas extra: cada curso-horario
        cuenta sólo con su propia cadena de reemplazos.
      </p>
    );
  }

  return (
    <div className="aulas-banco">
      <p className="aulas-cadenas-lectura">
        <strong>{fmt(banco.total)}</strong> reservas sueltas en{" "}
        <strong>{fmt(banco.por_facultad.length)}</strong>{" "}
        {banco.por_facultad.length === 1 ? "facultad" : "facultades"} ·{" "}
        <strong>{fmt(banco.elegibles)}</strong> alumnos ·{" "}
        <strong>{fmt(banco.mujeres)}</strong> mujeres y{" "}
        <strong>{fmt(banco.hombres)}</strong> hombres
      </p>

      {/* Las facultades como filtro Y como resumen a la vez: la misma fila dice
          cuánto queda ahí y sirve para entrar. Dos superficies —una tabla de
          resumen y un selector aparte— repetirían el mismo cruce. */}
      <ul className="aulas-banco-facultades">
        <li>
          <button
            type="button"
            className={facultad ? "" : "es-activa"}
            onClick={() => setFacultad("")}
          >
            <span className="aulas-banco-nombre">Todas</span>
            <span className="aulas-banco-cuenta">{fmt(banco.total)}</span>
            <span className="aulas-banco-sexos">
              {fmt(banco.mujeres)} M · {fmt(banco.hombres)} H
            </span>
          </button>
        </li>
        {banco.por_facultad.map((f) => (
          <li key={f.faculty}>
            <button
              type="button"
              className={facultad === f.faculty ? "es-activa" : ""}
              onClick={() => setFacultad(facultad === f.faculty ? "" : f.faculty)}
            >
              <span className="aulas-banco-nombre">{f.faculty || "Sin facultad"}</span>
              <span className="aulas-banco-cuenta">{fmt(f.extras)}</span>
              <span className="aulas-banco-sexos">
                {fmt(f.mujeres)} M · {fmt(f.hombres)} H
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <table className="mon-profile-table">
          <thead>
            <tr>
              <th>Curso-horario</th>
              <th>Curso</th>
              <th>Facultad</th>
              <th className="es-cifra">Alumnos</th>
              <th className="es-cifra">Mujeres</th>
              <th className="es-cifra">Hombres</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((e) => (
              <tr key={e.operational_code}>
                <td><strong>{e.operational_code}</strong></td>
                <td>{e.course_name}</td>
                <td>{e.faculty}</td>
                <td className="es-cifra">{cifra(e.eligible_n)}</td>
                <td className="es-cifra">{cifra(e.mujeres)}</td>
                <td className="es-cifra">{cifra(e.hombres)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
