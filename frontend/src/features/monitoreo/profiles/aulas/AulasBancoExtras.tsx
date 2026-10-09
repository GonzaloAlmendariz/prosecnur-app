import { useMemo, useState } from "react";
import { fmt } from "./kpisDeAulas";
import {
  etiquetaDelEje, etiquetaPluralDelEje, etiquetaSinValorDelEje,
  type EjeDeclarado,
} from "./etiquetaDelEje";
import "./aulasBancoExtras.css";

/**
 * Las aulas extra, agrupadas por el eje de cuotas del estudio.
 *
 * NO son reemplazos y conviene decirlo, porque yo lo entendí al revés: un
 * curso-horario que se cae lo cubre su propia cadena —`CH 6` → `R 6.1` →
 * `R 6.2`—, y ahí se acaba el reemplazo. Los extras son **aulas adicionales**
 * que existen para cerrar la cuota del estudio —en HSVG, hombres y mujeres por
 * facultad; en un estudio cuya cuota es por nivel, ese nivel—. Por eso
 * no cuelgan de ningún titular: no vienen a sustituir a nadie, vienen a aportar
 * gente del perfil que falta.
 *
 * De ahí la forma de la vista. La pregunta que contesta es «me falta gente de
 * esta celda, ¿qué aula extra me la aporta?», así que abre por la columna del
 * eje y el desglose por sexo va en la misma fila que el aula: es el dato con el
 * que se elige. En el estudio de 2026 son 639 extras contra 202 titulares.
 *
 * **El agrupamiento se rehace aquí, no en el motor.** `banco_extras.por_facultad`
 * lo consumen además la ficha del aula (`dondeSeSaca`) y la alerta de
 * anticipación, y las dos lo CRUZAN contra la facultad de un aula: reagrupar en
 * el motor les cambiaría una clave de la junta y no la otra —el defecto que ya
 * costó cuatro hallazgos esta semana—. Las filas de `banco.extras` traen
 * `faculty` y `level`, así que este panel reagrupa lo suyo y deja el bloque del
 * motor intacto. Mismo camino que `kpisDeAulas` en `fd148816`.
 */

export type ExtraDeBanco = {
  operational_code: string;
  course_name: string;
  faculty: string;
  stratum: string;
  level: string;
  teacher: string;
  /** Todavía no entró al operativo. La cuenta de «quedan» se rehace con esto. */
  disponible?: boolean;
  eligible_n: number | null;
  mujeres: number | null;
  hombres: number | null;
};

export type FacultadDelBanco = {
  faculty: string;
  extras: number;
  /**
   * Las que todavía no entraron al operativo. `extras` es cuántas EXISTEN y
   * ésta cuántas QUEDAN: una reserva adicional de 207 de la que ya se
   * gastaron 190 se leía como 207, que es el número con el que alguien decide
   * salir a llamar.
   */
  disponibles?: number;
  elegibles: number;
  mujeres: number;
  hombres: number;
};

export type BancoDeExtras = {
  total: number;
  disponibles?: number;
  elegibles: number;
  mujeres: number;
  hombres: number;
  por_facultad: FacultadDelBanco[];
  extras: ExtraDeBanco[];
};

/** El criterio de comparación de nombres del perfil: sin tildes ni mayúsculas. */
const clave = (v: unknown) =>
  String(v ?? "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** «—» y no «0»: no declarar el sexo no es lo mismo que no tener a nadie. */
const cifra = (n: number | null | undefined) => (n == null ? "—" : fmt(n));

export function AulasBancoExtras({ banco, facultadEnFoco = "", eje }: {
  banco: BancoDeExtras | null;
  /** El eje de cuotas declarado. Sin él, facultad: HSVG no se mueve un byte. */
  eje?: EjeDeclarado;
  /**
   * **La facultad de la CABECERA manda sobre el mando local.**
   *
   * Este panel tenía su propio selector desde antes de que el de la cabecera
   * llegara a Consultas (2026-09-10). Con los dos a la vez, quien pone DERECHO
   * arriba y ve aquí las quince facultades no sabe cuál gana; y el contrato de
   * navegación v3 dice que una dimensión no se duplica en otra. Cuando la
   * cabecera trae facultad, ésta filtra y el mando local se retira.
   */
  facultadEnFoco?: string;
}) {
  const columna = eje?.columna || "faculty";
  const esFacultad = columna === "faculty";
  const valorDe = (e: ExtraDeBanco) =>
    String((e as unknown as Record<string, unknown>)[columna] ?? "");

  const [facultadLocal, setFacultadLocal] = useState<string>("");
  // El mando de la cabecera gobierna los grupos SÓLO cuando los grupos son
  // facultades. Con el eje en otra dimensión son dos cosas distintas y la
  // cabecera no puede elegir por una lista que no enumera.
  const mandoDeCabecera = esFacultad ? facultadEnFoco : "";
  const facultad = mandoDeCabecera || facultadLocal;
  const setFacultad = setFacultadLocal;

  // Los grupos. Con el eje en facultad, los que publica el motor, tal cual:
  // así HSVG sale byte a byte —incluido su orden y sus ceros declarados—.
  const grupos = useMemo<FacultadDelBanco[]>(() => {
    if (esFacultad) return banco?.por_facultad ?? [];
    const acc = new Map<string, FacultadDelBanco>();
    for (const e of banco?.extras ?? []) {
      const v = valorDe(e);
      const g = acc.get(v) ?? { faculty: v, extras: 0, disponibles: 0, elegibles: 0, mujeres: 0, hombres: 0 };
      g.extras += 1;
      g.disponibles = (g.disponibles ?? 0) + (e.disponible ? 1 : 0);
      g.elegibles += e.eligible_n ?? 0;
      g.mujeres += e.mujeres ?? 0;
      g.hombres += e.hombres ?? 0;
      acc.set(v, g);
    }
    return [...acc.values()].sort((a, b) => b.extras - a.extras || a.faculty.localeCompare(b.faculty, "es"));
  }, [banco, esFacultad, columna]);

  const visibles = useMemo(() => {
    const todos = banco?.extras ?? [];
    const buscada = clave(facultad);
    let propios = facultad ? todos.filter((e) => clave(valorDe(e)) === buscada) : todos;
    // Con el eje fuera de la facultad, el foco de la cabecera SIGUE queriendo
    // decir algo —«enséñame lo de esta facultad»—: acota las filas sin gobernar
    // los grupos, que son de otra dimensión.
    if (!esFacultad && facultadEnFoco) {
      const f = clave(facultadEnFoco);
      propios = propios.filter((e) => clave(e.faculty) === f);
    }
    // Por mujeres desc: el caso que motiva la vista es «me falta gente de este
    // perfil». Quien busque hombres ordena por su columna al mirarla; abrir por
    // código no contesta ninguna de las dos preguntas.
    return [...propios].sort((a, b) => (b.mujeres ?? -1) - (a.mujeres ?? -1));
  }, [banco, facultad, esFacultad, facultadEnFoco, columna]);

  if (!banco || !banco.total) {
    return (
      // Vacío legítimo: hay estudios cuyo diseño no dotó de reserva
      // adicional, y eso es una decisión de la muestra, no un fallo de la vista.
      <p className="mon-profile-muted">
        El plan de este estudio no declara aulas extra: la cuota por{" "}
        {etiquetaDelEje(eje).toLocaleLowerCase("es")} se cubre sólo con los
        cursos-horario de la muestra y sus cadenas.
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
        <strong>{fmt(banco.total)}</strong> cursos-horario extra en{" "}
        {/* Las facultades CON extras, no las listadas: «45 en 15 facultades»
            prometía un reparto que no existe cuando 42 son de Derecho y 3 de
            una segunda — el mismo defecto del «repartido en» que ya corrigió
            el chart de sexo (E23). Las agotadas siguen a la vista abajo, con
            su cero declarado. */}
        <strong>{fmt(grupos.filter((f) => f.extras > 0).length)}</strong>{" "}
        {grupos.filter((f) => f.extras > 0).length === 1
          ? etiquetaDelEje(eje).toLocaleLowerCase("es")
          : etiquetaPluralDelEje(eje).toLocaleLowerCase("es")} ·{" "}
        <strong>{fmt(banco.elegibles)}</strong> alumnos ·{" "}
        <strong>{fmt(banco.mujeres)}</strong> mujeres y{" "}
        <strong>{fmt(banco.hombres)}</strong> hombres
        {/* El resto, DICHO. La línea enseñaba «1 345 alumnos · 580 mujeres y
            460 hombres» y quien resta encuentra 305 que no están en ninguno de
            los dos, sin nada que los explique. No es un error de cuenta: los
            alumnos son TODOS los elegibles del aula y mujeres/hombres salen de
            las dos categorías de sexo más frecuentes de esa aula, así que lo
            que caiga fuera de esas dos no aparece.
            Y aquí importa especialmente: la reserva adicional existe para
            cerrar la cuota de hombres y mujeres, o sea que los alumnos sin
            sexo declarado son justo los que limitan cuánto puede ayudar.
            Enseñar los dos primeros números y callar el tercero deja creer
            que la reserva adicional cubre más de lo que puede. */}
        {resto > 0 ? (
          <> · <strong>{fmt(resto)}</strong> sin sexo declarado</>
        ) : null}
        {/* **El orden, dicho donde se ordena.**
            La lista va por mujeres descendente —el caso que motiva la vista es
            «me faltan mujeres en esta facultad»— y eso hace que con «Todas»
            activo se vean sólo aulas de una facultad: las de Estudios Generales
            Letras traen 27 mujeres de media y las de Ciencias e Ingeniería, 8.
            Sin decirlo, el filtro parece roto.
            Va en ESTE componente y no en el subtítulo del panel de fuera: aquí
            está el `sort` y no pueden separarse. */}
        <em>{" "}· los que más mujeres traen primero</em>
      </p>

      {/* Las facultades como filtro Y como resumen a la vez: la misma fila dice
          cuánto queda ahí y sirve para entrar. Dos superficies —una tabla de
          resumen y un selector aparte— repetirían el mismo cruce. */}
      {/* **Con la cabecera puesta, esto se queda como RESUMEN y deja de filtrar.**
          Retirarlo entero se llevaría por delante el reparto por facultad, que
          es la mitad de su función; dejarlo clickeable pondría dos mandos a
          pelearse por la misma dimensión. */}
      {mandoDeCabecera ? (
        <p className="mon-profile-muted">
          Filtrado por <strong>{mandoDeCabecera}</strong> desde el selector de la
          cabecera. Quita la facultad de arriba para volver a elegir aquí.
        </p>
      ) : null}
      <ul className="aulas-banco-facultades">
        <li>
          <button
            type="button"
            className={facultad ? "" : "es-activa"}
            disabled={Boolean(mandoDeCabecera)}
            onClick={() => setFacultad("")}
          >
            <span className="aulas-banco-nombre">Todas</span>
            <span className="aulas-banco-cuenta">{fmt(banco.total)}</span>
            <span className="aulas-banco-sexos">
              {fmt(banco.mujeres)} M · {fmt(banco.hombres)} H
            </span>
          </button>
        </li>
        {grupos.map((f) => (
          <li key={f.faculty}>
            {/* Loop mejora-ui E8: la facultad sin extras se DECLARA (doctrina
                de los ceros a la vista) pero susurra — doce «0 · 0 M · 0 H» al
                mismo volumen ahogaban a las tres tarjetas con contenido, que
                son la respuesta que se viene a buscar. Sigue clickeable: su
                vacío filtrado también se declara. */}
            <button
              type="button"
              className={[
                clave(facultad) === clave(f.faculty) && facultad ? "es-activa" : "",
                f.extras === 0 ? "es-agotada" : "",
              ].filter(Boolean).join(" ")}
              disabled={Boolean(mandoDeCabecera)}
              onClick={() => setFacultad(facultad === f.faculty ? "" : f.faculty)}
            >
              <span className="aulas-banco-nombre">{f.faculty || etiquetaSinValorDelEje(eje)}</span>
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
              <th>{etiquetaDelEje(eje)}</th>
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
                <td>{valorDe(e) || etiquetaSinValorDelEje(eje)}</td>
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
