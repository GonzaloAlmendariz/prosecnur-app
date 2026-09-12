import type { MonitoreoAulasReservaDirigida } from "../../../../api/monitoreo";
import { fmtCuenta } from "./kpisDeAulas";
import { etiquetaDeSexo } from "./etiquetaDeSexo";

/**
 * A qué aula del banco ir por cada celda de cuota que no va a llegar.
 *
 * El motor lo calculaba desde hace tiempo —`monitoreo_aulas_reserva_dirigida.R`,
 * con su propio test— y **ningún archivo del frontend leía
 * `reserva_dirigida`**: comprobado por grep sobre `frontend/src/` entero. Lo que
 * la pantalla enseñaba era el agregado por facultad (`reservas_alcanzan`,
 * `reservas_libres`), que va un nivel más arriba y puede decir que las reservas
 * alcanzan mientras la celda de mujeres de esa misma facultad no tiene ni un
 * aula de banco que ayude.
 *
 * Se pinta sólo donde hay decisión que tomar. Sin celdas en déficit no hay
 * superficie: un panel vacío diciendo «todo bien» compite por la atención con
 * las que sí piden acción.
 */
/**
 * El `motivo` del motor sin la cola que el encabezado de la tarjeta ya dice.
 *
 * El motor lo redacta para ir SOLO —«Aporta 16 de 29 a la cuota de hombres de
 * Ricardo Y Ricardo Ricardo»— y aquí va bajo un encabezado que ya nombra la
 * facultad y el sexo. Medido en pantalla: cinco candidatos repetían la misma
 * cola cinco veces y lo único que los distinguía —16 de 29, 15.4 de 28— quedaba
 * al principio de una frase larga.
 *
 * Sólo se recorta cuando la cola CASA con esta celda; si el motor cambia la
 * frase, no casa y se muestra entera. La completa viaja en el `title`, así que
 * no se pierde nada.
 */
function motivoSinLaCola(motivo: string, sexo: string, facultad: string): string {
  // Concatenado y no interpolado a proposito: `cifrasConFormato` vigila las
  // plantillas porque ahi es donde una cifra llega a la pantalla sin formatear,
  // y esta cadena no se pinta —es la cola con la que se compara—.
  const cola = " a la cuota de " + sexo + " de " + facultad;
  return motivo.endsWith(cola) ? motivo.slice(0, -cola.length) : motivo;
}

export function AulasReservaDirigida(
  { celdas, porDebajoHoy }: {
    celdas: ReadonlyArray<MonitoreoAulasReservaDirigida>;
    /** Grupos de cuota con falta HOY (`missing > 0`), sin proyectar nada. */
    porDebajoHoy?: number;
  },
) {
  const conDecision = celdas.filter((c) => c && Number(c.brecha) > 0);
  if (!conDecision.length) return null;

  // Primero las que NO se cierran con el banco: son las que obligan a hacer algo
  // distinto —pedir aulas, mover cuota— y no sólo a activar una reserva.
  const orden = [...conDecision].sort((a, b) =>
    Number(a.alcanza) - Number(b.alcanza) || Number(b.brecha) - Number(a.brecha));

  return (
    <section
      className="aulas-reserva-dirigida"
      // **Es el cuerpo del panel que la monta, no un grupo aparte.** Declaraba
      // `data-qa-geometry-group` propio, y eso la SACABA de los miembros de su
      // panel: el runner los filtra por `closest("[data-qa-geometry-group]")
      // === group` (ui-quick-check.mjs:2083) y el `closest` de un grupo es él
      // mismo. Sin miembros declarados, el panel caía a sus hijos directos y
      // medía el ENCABEZADO —`mon-profile-panel-head`, 36 px— como contenedor
      // de datos: `capacity-drift` sobre sus 5 px de padding, un síntoma que no
      // se parece a su causa. Como miembro dueño de su capacidad el gate la
      // mira igual —sale en el audit del panel— y el encabezado deja de
      // medirse. Mismo patrón que «Metas por facultad y sexo» y «Respuestas».
      data-qa-geometry-capacity="owned"
      data-qa-geometry-member="true"
    >
      {/* **El título lo pone el panel que la monta, no ella.** Medido en
          pantalla el 2026-09-12: «A qué aula del banco ir» salía DOS VECES
          seguidas —el `h3` del panel y este `h4`, mismo texto, 36 px de
          distancia—. El único montaje de este componente es el panel de
          `AulasPestanaCuotas`, que ya declara qué es; lo que aquí sí informa es
          el conteo, y ése se queda. */}
      <header className="aulas-reserva-dirigida-head">
        {/* **«que hoy no llega» prometía otro número.** El motor filtra esta
            lista por `estado ∈ {deficit_proyectado, deficit_no_subsanable}`, o
            sea por el déficit PROYECTADO: una celda que hoy está 38 encuestas
            por debajo pero que se espera que cierre sola queda fuera. Medido
            sobre el estudio real: **1 grupo aquí y 9 por debajo de su cuota**,
            170 encuestas de falta.

            El filtro es deliberado —no se gasta reserva donde se espera cerrar
            solo— y esta reparación NO lo cambia: lo hace visible. Sin la
            segunda mitad de la frase, quien lee «1 grupo que hoy no llega» se
            queda con que sólo falta uno. */}
        <span>
          {orden.length === 1 ? "1 grupo" : `${fmtCuenta(orden.length)} grupos`} con déficit proyectado
          {porDebajoHoy && porDebajoHoy > orden.length
            ? ` · ${fmtCuenta(porDebajoHoy)} están hoy por debajo de su cuota`
            : ""}
        </span>
      </header>

      <ul className="aulas-reserva-dirigida-lista">
        {orden.map((celda) => {
          const clave = `${celda.faculty}‧${celda.sex}`;
          // La tercera copia de esta traducción en el perfil. De las tres, una
          // —la de `alertaDeAnticipacion`— no traducía y publicaba «faltan 48 ·
          // 38 m»; ésta sí, pero el mecanismo es el mismo. Una sola función.
          const enPalabras = etiquetaDeSexo(celda.sex);
          // Cuando NINGUNO trae padrón, la marca por línea deja de distinguir y
          // sólo repite: se dice una vez en la celda. Si unos sí y otros no, la
          // marca por línea es la que informa y se queda donde está.
          const ningunoMedible = celda.candidatos.length > 0
            && celda.candidatos.every((c) => !c.solape_medible);
          return (
            <li
              key={clave}
              className="aulas-reserva-dirigida-celda"
              data-alcanza={celda.alcanza ? "si" : "no"}
            >
              <div className="aulas-reserva-dirigida-celda-head">
                <strong>{celda.faculty || "Sin facultad"}</strong>
                <span className="aulas-reserva-dirigida-sexo">{enPalabras}</span>
                <span className="aulas-reserva-dirigida-brecha">faltan {fmtCuenta(celda.brecha)}</span>
              </div>

              {/* La frase la redacta el motor con las dos cifras que deciden
                  —cuánto aportan y cuánto falta—; reescribirla aquí sería una
                  segunda lectura del mismo dato. */}
              <p className="aulas-reserva-dirigida-etiqueta">
                {celda.etiqueta}
                {ningunoMedible ? (
                  <em className="aulas-reserva-dirigida-estimado"> · solape estimado en todas</em>
                ) : null}
              </p>

              {celda.candidatos.length ? (
                <ul className="aulas-reserva-dirigida-candidatos">
                  {celda.candidatos.map((cand) => (
                    <li key={`${clave}‧${cand.classroom_id}`}>
                      <code>{cand.classroom_id}</code>
                      <span title={cand.motivo}>
                        {motivoSinLaCola(cand.motivo, enPalabras, celda.faculty)}
                      </span>
                      {/* Sin padrón el solape es estimado, y decirlo es la
                          diferencia entre un número y un supuesto. Si NINGUNO lo
                          tiene, la celda ya lo dijo arriba una sola vez. */}
                      {cand.solape_medible || ningunoMedible ? null : (
                        <em className="aulas-reserva-dirigida-estimado">solape estimado</em>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
