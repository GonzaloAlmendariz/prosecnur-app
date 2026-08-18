import { useMemo, useState } from "react";

/**
 * Las aulas extra, por facultad.
 *
 * NO son reemplazos y conviene decirlo, porque yo lo entendí al revés: un
 * curso-horario que se cae lo cubre su propia cadena —`CH 6` → `R 6.1` →
 * `R 6.2`—, y ahí se acaba el reemplazo. Los extras son **aulas adicionales**
 * que existen para cerrar la cuota de hombres y mujeres por facultad. Por eso
 * no cuelgan de ningún titular: no vienen a sustituir a nadie, vienen a aportar
 * gente del perfil que falta.
 *
 * De ahí la forma de la vista. La pregunta que contesta es «me faltan mujeres
 * en esta facultad, ¿qué aula extra me las aporta?», así que abre por facultad
 * y el desglose por sexo va en la misma fila que el aula: es el dato con el que
 * se elige. En el estudio de 2026 son 639 extras contra 202 titulares.
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
        El plan de este estudio no declara aulas extra: la cuota por facultad
        se cubre sólo con los cursos-horario de la muestra y sus cadenas.
      </p>
    );
  }

  // Los elegibles que ninguna de las dos categorías de sexo cubre. Nunca
  // negativo: si un dato viniera inconsistente, la línea calla en vez de
  // enseñar un «-12 sin sexo declarado» que no significa nada.
  const resto = Math.max(0, banco.elegibles - banco.mujeres - banco.hombres);

  return (
    <div className="aulas-banco">
      <p className="aulas-cadenas-lectura">
        <strong>{fmt(banco.total)}</strong> aulas extra en{" "}
        <strong>{fmt(banco.por_facultad.length)}</strong>{" "}
        {banco.por_facultad.length === 1 ? "facultad" : "facultades"} ·{" "}
        <strong>{fmt(banco.elegibles)}</strong> alumnos ·{" "}
        <strong>{fmt(banco.mujeres)}</strong> mujeres y{" "}
        <strong>{fmt(banco.hombres)}</strong> hombres
        {/* El resto, DICHO. La línea enseñaba «1 345 alumnos · 580 mujeres y
            460 hombres» y quien resta encuentra 305 que no están en ninguno de
            los dos, sin nada que los explique. No es un error de cuenta: los
            alumnos son TODOS los elegibles del aula y mujeres/hombres salen de
            las dos categorías de sexo más frecuentes de esa aula, así que lo
            que caiga fuera de esas dos no aparece.
            Y aquí importa especialmente: el banco existe para cerrar la cuota
            de hombres y mujeres, o sea que los alumnos sin sexo declarado son
            justo los que limitan cuánto puede ayudar. Enseñar los dos primeros
            números y callar el tercero deja creer que el banco cubre más de lo
            que puede. */}
        {resto > 0 ? (
          <> · <strong>{fmt(resto)}</strong> sin sexo declarado</>
        ) : null}
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
