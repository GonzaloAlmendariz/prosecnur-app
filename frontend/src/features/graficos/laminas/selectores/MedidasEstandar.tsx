// Plegable «Medidas del estándar» de la ficha de «¿Qué lámina?»: el único lugar donde se ven los números del motor
// —tipografía de la familia en puntos, grosor de barra y ranuras en pulgadas—. Cerrado por defecto: el analista elige
// por la composición; quien arma plantillas abre esto.

import type { RanuraComposicion } from "../../iconos/composicion";
import type { LaminaEstandar } from "../../iconos/estandarLaminas.generated";

const num = (n: number): string => n.toLocaleString("es", { maximumFractionDigits: 3 });

type Props = {
  estandar: LaminaEstandar | undefined;
  ranuras: readonly RanuraComposicion[];
  slots: readonly string[];
  nombreSlot: (slot: string) => string;
};

export function MedidasEstandar({ estandar, ranuras, slots, nombreSlot }: Props) {
  const familia = estandar?.familia ?? null;
  const cifra = estandar?.cifra_valor_pt ?? null;
  if (!familia && !cifra && ranuras.length === 0) return null;
  return (
    <details className="pulso-f6-medidas">
      <summary>Medidas del estándar</summary>
      {(familia || cifra) && (
        <dl className="pulso-f6-ficha pulso-f6-medidas-familia">
          {familia && (
            <>
              <dt>Escala de la familia</dt>
              <dd>{num(familia.escala)}</dd>
              <dt>Cifra y rótulo</dt>
              <dd>{num(familia.cifra_pt)} pt, {num(familia.rotulo_pt)} pt</dd>
              <dt>Grosor de barra</dt>
              <dd>{num(familia.barra_in)} in</dd>
            </>
          )}
          {cifra && (
            <>
              <dt>Cifra destacada</dt>
              <dd>{num(cifra)} pt</dd>
            </>
          )}
        </dl>
      )}
      {ranuras.length > 0 && (
        <table>
          <caption>Ranuras en pulgadas de la lámina de 13,333 × 7,5</caption>
          <thead>
            <tr><th scope="col">Ranura</th><th scope="col">x</th><th scope="col">y</th><th scope="col">Ancho</th><th scope="col">Alto</th></tr>
          </thead>
          <tbody>
            {ranuras.map((r, i) => {
              const k = r.slot ? slots.indexOf(r.slot) + 1 : 0;
              const rotulo = r.tipo === "texto" ? "Texto" : `${r.tipo === "cifras" ? "Cifra" : "Gráfico"} ${k || ""}${r.slot ? `, ${nombreSlot(r.slot)}` : ""}`.trim();
              return (
                <tr key={`${r.tipo}-${i}`}>
                  <th scope="row">{rotulo}</th>
                  <td>{num(r.x)}</td><td>{num(r.y)}</td><td>{num(r.w)}</td><td>{num(r.h)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </details>
  );
}
