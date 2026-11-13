import type { ValorDeColumna } from "../../../../api/calcMuestraMarcoPublico";
import { PulsoInput } from "../../../../components/PulsoInput";
import { cifra } from "./piezas";

/**
 * Los valores de una columna con su peso, y el rótulo de cada uno escrito en línea: "M" pasa a "Hombres",
 * "EDUCACION" a "Educación". El valor original queda debajo cuando se corrigió. Se confirma al salir del campo o con
 * Enter; vacío vuelve al valor original.
 */
export function ValoresConRotulo({ columna, valores, rotulos, onRotulo, max = 12 }: {
  columna: string;
  valores: readonly ValorDeColumna[];
  rotulos: Readonly<Record<string, string>>;
  onRotulo: (valor: string, rotulo: string) => void;
  max?: number;
}) {
  const tope = Math.max(1, ...valores.map((v) => v.n));
  return (
    <ul className="cmmp-rotulos" aria-label={`Rótulos de ${columna}`}>
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
                onBlur={(e) => { if (e.currentTarget.value.trim() !== (rotulo ?? v.valor)) onRotulo(v.valor, e.currentTarget.value); }}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              />
              {rotulo ? <small>{v.valor}</small> : null}
            </span>
            <i><b style={{ width: `${(v.n / tope) * 100}%` }} /></i>
            <em>{cifra(v.n)}</em>
          </li>
        );
      })}
    </ul>
  );
}
