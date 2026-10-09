import { useMemo, useState } from "react";
import { CalendarRange, Check, Plus, Trash2 } from "../../../../vendor/lucide-react";
import type { MonitoreoAulasTramo } from "../../../../api/monitoreo";
import { estadoDelTramo, sinCambios, tramosGuardables, type TramoEditable } from "./tramosDelOperativo";
import "./aulasTramos.css";

/**
 * Los TRAMOS del operativo: rangos de fecha con nombre propio.
 *
 * Dictado de Gonzalo (2026-09-15): «debería tener un mecanismo para poder ir
 * recordando la aplicación de semana a semana y actualizándolas a lo que el
 * excel diga también, y cuando se cree una nueva semana de aplicación la app ya
 * las sabe». Y la corrección que fija el modelo: «más que semana en el estricto
 * senso, con rango a los que llamamos de forma personalizada; en este caso
 * seleccioné dos rangos semanales y les puse Semana 1 y Semana 2, pero puede
 * ser otro rango con otros nombres».
 *
 * **Qué se teclea y qué no.** Aquí sólo se decide el rango y su nombre. Las
 * citas, las aplicadas y las que faltan las cuenta el backend sobre el plan en
 * cada corrida y esta pantalla las ENSEÑA; no hay ningún número editable,
 * porque un conteo tecleado envejece y el derivado no puede.
 *
 * **Su vacío está contenido (C3).** Sin tramos declarados el backend devuelve
 * las semanas de calendario del plan y esta tabla las pinta igual, en gris,
 * diciendo que son derivadas: el operativo se ve desde el primer día y
 * declarar tramos es un añadido, no un requisito.
 */

export type AulasTramosProps = {
  /** Los tramos con su estado ya derivado por el backend. */
  tramos: MonitoreoAulasTramo[];
  /** Persiste la lista entera; `[]` vuelve al respaldo por semanas. */
  onGuardar: (tramos: { nombre: string; desde: string; hasta: string }[]) => void | Promise<void>;
  ocupado?: boolean;
};

export default function AulasTramosDelOperativo({
  tramos, onGuardar, ocupado = false,
}: AulasTramosProps) {
  const declarados = useMemo(
    () => tramos.filter((t) => t.declarado === true),
    [tramos],
  );
  const derivados = declarados.length === 0 && tramos.length > 0;

  // **Lo editado, o lo que llega.** Mientras nadie toca nada la tabla ES las
  // props: sin estado que sincronizar no hay forma de que se separen, y la
  // pantalla se puede pintar sin ejecutar un efecto —que es como se prueba en
  // esta casa y como se sirve el primer render—. En cuanto alguien escribe,
  // manda lo suyo: un Recargar de fondo no le puede borrar lo que iba a
  // guardar.
  //
  // Arranca de lo derivado cuando no hay nada declarado, que es lo que alguien
  // querría nombrar: adoptar lo que el plan ya dice cuesta un clic y teclear
  // cuatro rangos a mano cuesta la tarde.
  const [editado, setEditado] = useState<TramoEditable[] | null>(null);
  const borrador = useMemo(() => editado ?? tramos.map((t) => ({
    nombre: t.nombre ?? "", desde: t.desde ?? "", hasta: t.hasta ?? "",
  })), [editado, tramos]);
  const setBorrador = (fn: (prev: TramoEditable[]) => TramoEditable[]) => {
    setEditado(fn(borrador));
  };

  const completos = tramosGuardables(borrador);
  const hayIncompleto = borrador.length > completos.length;
  const sinCambio = useMemo(() => sinCambios(borrador, declarados), [borrador, declarados]);

  const editar = (i: number, campo: "nombre" | "desde" | "hasta", valor: string) => {
    setBorrador((prev) => prev.map((t, k) => (k === i ? { ...t, [campo]: valor } : t)));
  };

  return (
    <section className="aulas-tramos" aria-label="Tramos del operativo">
      <header className="aulas-tramos-cabecera">
        <CalendarRange size={15} aria-hidden="true" />
        <h4>Tramos del operativo</h4>
        <p>
          {derivados
            ? "Todavía no has nombrado ninguno, así que la app usa las semanas del plan. Ponles nombre o cambia las fechas y guárdalos."
            : "El rango y su nombre los decides tú; lo que cada tramo lleva aplicado sale del plan en cada actualización."}
        </p>
      </header>

      <table className="aulas-tramos-tabla">
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">Desde</th>
            <th scope="col">Hasta</th>
            <th scope="col" className="aulas-tramos-num">Citas</th>
            <th scope="col" className="aulas-tramos-num">Aplicadas</th>
            <th scope="col" className="aulas-tramos-num">Por aplicar</th>
            <th scope="col"><span className="aulas-tramos-sr">Quitar</span></th>
          </tr>
        </thead>
        <tbody>
          {borrador.map((t, i) => {
            // El estado derivado se empareja por RANGO, no por posición: si
            // alguien inserta un tramo en medio, las cifras seguirían pegadas a
            // la fila de al lado sin que nada fallara.
            const estado = estadoDelTramo(tramos, t);
            return (
              <tr key={`${i}-${t.desde}-${t.hasta}`} className={estado?.vigente ? "es-vigente" : undefined}>
                <td>
                  <input
                    type="text"
                    value={t.nombre}
                    placeholder={`Tramo ${i + 1}`}
                    aria-label={`Nombre del tramo ${i + 1}`}
                    onChange={(e) => editar(i, "nombre", e.target.value)}
                  />
                  {estado?.vigente ? <span className="aulas-tramos-marca">en curso</span> : null}
                </td>
                <td>
                  <input
                    type="date" value={t.desde}
                    aria-label={`Primer día del tramo ${i + 1}`}
                    onChange={(e) => editar(i, "desde", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="date" value={t.hasta}
                    aria-label={`Último día del tramo ${i + 1}`}
                    onChange={(e) => editar(i, "hasta", e.target.value)}
                  />
                </td>
                {/* Un guion cuando el rango que se está tecleando todavía no
                    existe en el backend: un cero ahí se leería como «este tramo
                    no tiene citas», que es otra cosa. */}
                <td className="aulas-tramos-num">{estado ? estado.citas ?? 0 : "—"}</td>
                <td className="aulas-tramos-num">{estado ? estado.aplicadas ?? 0 : "—"}</td>
                <td className="aulas-tramos-num">{estado ? estado.por_aplicar ?? 0 : "—"}</td>
                <td>
                  <button
                    type="button"
                    className="aulas-tramos-quitar"
                    aria-label={`Quitar el tramo ${t.nombre || i + 1}`}
                    onClick={() => setBorrador((prev) => prev.filter((_, k) => k !== i))}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            );
          })}
          {borrador.length === 0 ? (
            <tr>
              <td colSpan={7} className="aulas-tramos-vacio">
                Sin tramos. Añade uno para decirle a la app qué rango es el que está en curso.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="aulas-tramos-acciones">
        <button
          type="button"
          onClick={() => setBorrador((prev) => [...prev, { nombre: "", desde: "", hasta: "" }])}
        >
          <Plus size={14} aria-hidden="true" /> Añadir tramo
        </button>
        <button
          type="button"
          className="aulas-tramos-guardar"
          disabled={ocupado || sinCambio}
          title={hayIncompleto
            ? "Los tramos sin las dos fechas no se guardan: un rango a medias no puede contener a nadie"
            : undefined}
          onClick={() => {
            // Soltar lo editado deja que la tabla vuelva a ser lo que el
            // backend devuelva: si normalizó algo —enderezar un rango, ordenar
            // por fecha— se ve, en vez de quedarse enseñando lo que se tecleó.
            void Promise.resolve(onGuardar(completos)).then(() => setEditado(null));
          }}
        >
          {ocupado ? "Guardando…" : sinCambio ? <><Check size={14} aria-hidden="true" /> Guardado</> : "Guardar tramos"}
        </button>
        {hayIncompleto ? (
          <span className="aulas-tramos-nota">
            {borrador.length - completos.length} sin las dos fechas: no se guardan.
          </span>
        ) : null}
      </div>
    </section>
  );
}
