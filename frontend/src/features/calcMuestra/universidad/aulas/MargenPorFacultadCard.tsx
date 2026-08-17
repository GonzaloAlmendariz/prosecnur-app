/**
 * Cuántas aulas HAY frente a las que cada facultad necesita.
 *
 * El motor calculaba cuántas pedía cada facultad —`aulas_base`— y no decía
 * cuántas existen. Medido en HSVG2026: LETRAS Y CIENCIAS HUMANAS requiere 16 y
 * tiene exactamente 16, así que sus dieciséis son titulares y **no queda ninguna
 * para reemplazar a la que se caiga en campo**; ARQUITECTURA usa 36 de 56 y las
 * 20 que sobran no llegan a una reserva por titular; CIENCIAS E INGENIERIA usa
 * 49 de 592 y sostiene las 11 que pide el diseño. **Sólo una de quince las
 * sostiene.**
 *
 * Es la causa de lo que se veía al sortear: aulas que recibían menos reservas de
 * las pedidas, alguna una sola. Una facultad no puede dar reservas que no tiene,
 * y eso se sabe ANTES de sortear.
 */
import type { CalcMuestraAulasEstrato } from "../../../../api/calcMuestra";
import { fmtInt } from "../../sharedCore";

const ORDEN: Record<string, number> = {
  insuficiente: 0, sin_reservas: 1, reservas_cortas: 2, holgado: 3, desconocido: 4,
};

const ETIQUETA: Record<string, string> = {
  insuficiente: "no alcanza ni para los titulares",
  sin_reservas: "todas son titulares",
  reservas_cortas: "reservas por debajo de lo pedido",
  holgado: "sostiene lo pedido",
  desconocido: "sin medir",
};

export function MargenPorFacultadCard({
  filas,
}: {
  filas: CalcMuestraAulasEstrato[] | null | undefined;
}) {
  const conMargen = (filas ?? []).filter((f) => f.margen != null);
  if (!conMargen.length) return null;
  const ordenadas = [...conMargen].sort(
    (a, b) => (ORDEN[a.margen!.estado] ?? 9) - (ORDEN[b.margen!.estado] ?? 9),
  );
  const apretadas = ordenadas.filter((f) =>
    f.margen!.estado === "insuficiente" || f.margen!.estado === "sin_reservas",
  );
  const pedidas = ordenadas[0]?.margen?.reservas_pedidas ?? null;

  return (
    <section className="cmv2-margen-card" aria-label="Margen de aulas por facultad">
      <header>
        <strong>Cuántas aulas tiene cada facultad frente a las que necesita</strong>
        <span>
          {apretadas.length > 0 ? (
            <>
              <strong>{fmtInt(apretadas.length)}</strong> de {fmtInt(ordenadas.length)} no
              dejan ninguna aula libre para reemplazar.
            </>
          ) : (
            <>Todas dejan aulas libres para reemplazar.</>
          )}
          {pedidas != null ? <> El diseño pide {fmtInt(pedidas)} reservas por titular.</> : null}
        </span>
      </header>
      <div className="cmv2-margen-wrap">
        <table className="cmv2-margen-tabla">
          <thead>
            <tr>
              <th scope="col">Facultad</th>
              <th scope="col">Necesita</th>
              <th scope="col">Tiene</th>
              <th scope="col">Sobran</th>
              <th scope="col">Reservas que sostiene</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((f) => {
              const m = f.margen!;
              return (
                <tr key={f.estrato} data-estado={m.estado}>
                  <th scope="row">{f.estrato}</th>
                  <td>{m.aulas_requeridas != null ? fmtInt(m.aulas_requeridas) : "—"}</td>
                  <td>{m.aulas_disponibles != null ? fmtInt(m.aulas_disponibles) : "—"}</td>
                  <td>{m.aulas_sobrantes != null ? fmtInt(m.aulas_sobrantes) : "—"}</td>
                  <td>
                    {m.reservas_sostenibles != null ? fmtInt(m.reservas_sostenibles) : "—"}
                    {pedidas != null ? <span className="cmv2-margen-de"> de {fmtInt(pedidas)}</span> : null}
                  </td>
                  <td>{ETIQUETA[m.estado] ?? m.estado}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {ordenadas
        .filter((f) => f.margen!.aviso)
        .slice(0, 3)
        .map((f) => (
          <p key={f.estrato} className="cmv2-margen-aviso" role="note">
            {f.margen!.aviso}
          </p>
        ))}
    </section>
  );
}
