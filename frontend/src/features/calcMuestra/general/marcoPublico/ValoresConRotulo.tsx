import type { ValorDeColumna } from "../../../../api/calcMuestraMarcoPublico";
import { PulsoInput } from "../../../../components/PulsoInput";
import { cifra } from "./piezas";

/**
 * Los valores de una columna con su peso, y el rótulo de cada uno escrito en línea: "M" pasa a "Hombres",
 * "EDUCACION" a "Educación". El valor original queda debajo cuando se corrigió. Se confirma al salir del campo o con
 * Enter; vacío vuelve al valor original.
 */
export function ValoresConRotulo({ columna, valores, rotulos, onRotulo, max = Number.POSITIVE_INFINITY, barra = true }: {
  columna: string;
  valores: readonly ValorDeColumna[];
  rotulos: Readonly<Record<string, string>>;
  onRotulo: (valor: string, rotulo: string) => void;
  max?: number;
  /** Sin barra cuando la tabla de al lado ya muestra los conteos. */
  barra?: boolean;
}) {
  const tope = Math.max(1, ...valores.map((v) => v.n));
  return (
    <ul className="cmmp-rotulos" data-barra={barra ? undefined : "no"} aria-label={`Rótulos de ${columna}`}>
      {valores.slice(0, max).map((v) => {
        const rotulo = rotulos[v.valor];
        return (
          <li key={v.valor}>
            <span className="cmmp-rotulo-campo">
              <PulsoInput
                key={`${v.valor}|${rotulo ?? ""}`}
                size="sm"
                defaultValue={rotulo ?? v.valor}
                aria-label={`Rótulo de ${v.valor}`}
                onBlur={(e) => {
                  const escrito = e.currentTarget.value.trim();
                  // Vacío vuelve al rótulo vigente (o al valor original) también en pantalla.
                  if (!escrito) e.currentTarget.value = rotulo ?? v.valor;
                  if (escrito !== (rotulo ?? v.valor)) onRotulo(v.valor, escrito);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              />
              {rotulo ? <small>{v.valor}</small> : null}
            </span>
            {barra ? <i><b style={{ width: `${(v.n / tope) * 100}%` }} /></i> : null}
            <em>{cifra(v.n)}</em>
          </li>
        );
      })}
    </ul>
  );
}
