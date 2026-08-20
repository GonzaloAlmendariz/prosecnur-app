/**
 * El balance de hombres y mujeres de la selección, POR FACULTAD.
 *
 * El informe de representatividad publica el eje sexo en UNA fila: 53,8 % de
 * mujeres en el marco contra 52,1 % en lo seleccionado, dentro de tolerancia,
 * TRUE. Ese agregado cuadra y esconde lo que pasa por dentro — en la misma
 * corrida ARTE Y DISEÑO ofrece 62 % de mujeres donde su cuota pide 76 %—, y la
 * cuota de hombres y mujeres es **por facultad**.
 *
 * Se mide sobre las TITULARES, que son las que se visitan y las que entregan la
 * cuota: contar también las reservas daría una composición que nadie va a
 * encuestar.
 *
 * No emite veredicto por fila. Con dos aulas ninguna selección cae dentro de una
 * tolerancia pensada para el agregado, y marcarlas como incumplidas sería un
 * aviso falso; el umbral que calla los avisos es el que el propio estudio fijó.
 */
import type { CalcMuestraSexoPorFacultad } from "../../../../api/calcMuestra";
import { fmtInt } from "../../sharedCore";

const pct = (v: number | null): string => (v == null ? "—" : `${Math.round(v * 100)} %`);

export function SexoPorFacultadCard({
  balance,
}: {
  balance: CalcMuestraSexoPorFacultad | null;
}) {
  if (!balance || !balance.filas.length) return null;
  const conAviso = balance.filas.filter((f) => f.aviso);
  const base = balance.base === "titulares" ? "aulas titulares" : "aulas seleccionadas";

  return (
    <section className="cmv2-sexo-card" aria-label="Balance de sexo por facultad">
      <header>
        <strong>Qué composición por sexo ofrecen las aulas de cada facultad</strong>
        <span>
          Medido sobre las {base}.{" "}
          {conAviso.length > 0 ? (
            <>
              <strong>{fmtInt(conAviso.length)}</strong> de {fmtInt(balance.filas.length)} se
              apartan de su cuota más de lo que el estudio acepta en el agregado.
            </>
          ) : (
            <>Ninguna se aparta de su cuota más de lo que el estudio acepta.</>
          )}
        </span>
      </header>
      <div className="cmv2-sexo-wrap">
        <table className="cmv2-sexo-tabla">
          <thead>
            <tr>
              <th scope="col">Facultad</th>
              <th scope="col">Titulares</th>
              <th scope="col">Su cuota pide</th>
              <th scope="col">Sus aulas ofrecen</th>
              <th scope="col" className="cmv2-sexo-th-barras">
                % mujeres: <i data-serie="pide" /> pide · <i data-serie="ofrece" /> ofrece
              </th>
              <th scope="col">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {balance.filas.map((f) => (
              <tr key={f.faculty_key || f.facultad} data-estado={f.estado} data-aviso={f.aviso ? "true" : "false"}>
                <th scope="row">{f.facultad}</th>
                <td>{fmtInt(f.aulas_titulares)}</td>
                <td>{pct(f.marco_prop_mujeres)}</td>
                <td>{pct(f.titulares_prop_mujeres)}</td>
                <td className="cmv2-sexo-celda-barras">
                  {/* Las dos proporciones a escala comun 0-100: la brecha se VE
                      sin leer numeros (VARA 4: mas visual, mas intuitivo). */}
                  <span className="cmv2-sexo-track" data-serie="pide">
                    <span style={{ width: `${Math.min(100, Math.max(0, (f.marco_prop_mujeres ?? 0) * 100))}%` }} />
                  </span>
                  <span className="cmv2-sexo-track" data-serie="ofrece">
                    <span style={{ width: `${Math.min(100, Math.max(0, (f.titulares_prop_mujeres ?? 0) * 100))}%` }} />
                  </span>
                </td>
                <td>
                  {f.brecha_pp == null
                    ? "—"
                    : `${f.brecha_pp > 0 ? "+" : ""}${f.brecha_pp.toFixed(1)} pp`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {conAviso.slice(0, 3).map((f) => (
        <p key={f.faculty_key || f.facultad} className="cmv2-sexo-aviso" role="note">
          {f.aviso}
        </p>
      ))}
    </section>
  );
}
