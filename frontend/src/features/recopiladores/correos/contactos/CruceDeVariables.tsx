// El cruce de dos variables de control: tabla de contingencia de los efectivos
// del corte, con totales por fila, por columna y general. Se lee en casos o en
// porcentaje por fila (cada fila suma 100%), siempre con la base a la vista.

import type { CSSProperties } from "react";

import type { CruceDelPerfil } from "../../../../api/mailContactos";
import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { Grid3x3 } from "../../../../vendor/lucide-react";
import { TableScroll } from "../../TableScroll";
import { formatoPorcentaje, intensidad, proporcion, totalesDelCruce } from "./modeloContactos";
import { useContactosStore, type VistaDelCruce } from "./store";

type Props = {
  control: readonly string[];
  etiquetas: Readonly<Record<string, string>>;
  par: [string, string] | null;
  cruce: CruceDelPerfil | null;
  cargando: boolean;
  onElegirVariables: () => void;
};

const VISTAS: { id: VistaDelCruce; label: string }[] = [
  { id: "casos", label: "Casos" },
  { id: "fila", label: "% por fila" },
];

export function CruceDeVariables({ control, etiquetas, par, cruce, cargando, onElegirVariables }: Props) {
  const vista = useContactosStore((s) => s.vistaDelCruce);
  const setVista = useContactosStore((s) => s.setVistaDelCruce);
  const setCruce = useContactosStore((s) => s.setCruce);
  const nombre = (key: string) => etiquetas[key] ?? key;
  const vigente = cruce && par && cruce.a === par[0] && cruce.b === par[1] ? cruce : null;

  const cambiar = (posicion: 0 | 1, valor: string) => {
    if (!par) return;
    const otro = par[posicion === 0 ? 1 : 0];
    // Elegir en un lado la variable del otro las intercambia: nunca se cruza consigo misma.
    const siguiente: [string, string] = posicion === 0
      ? [valor, valor === otro ? par[0] : otro]
      : [valor === otro ? par[1] : otro, valor];
    setCruce(siguiente);
  };

  return (
    <section className="rec-contactos-seccion" aria-labelledby="rec-contactos-cruce-titulo" data-testid="contactos-cruce">
      <header className="rec-contactos-seccion-cabecera">
        <h2 id="rec-contactos-cruce-titulo" className="rec-contactos-titulo">
          <Grid3x3 size={16} aria-hidden />
          Cruce
        </h2>
        {par ? (
          <div className="rec-contactos-herramientas">
            <label className="rec-contactos-control">
              <span>Filas</span>
              <select value={par[0]} onChange={(e) => cambiar(0, e.target.value)}>
                {control.map((key) => <option key={key} value={key}>{nombre(key)}</option>)}
              </select>
            </label>
            <label className="rec-contactos-control">
              <span>Columnas</span>
              <select value={par[1]} onChange={(e) => cambiar(1, e.target.value)}>
                {control.map((key) => <option key={key} value={key}>{nombre(key)}</option>)}
              </select>
            </label>
            <div className="rec-contactos-segmentos" role="radiogroup" aria-label="Cómo se leen las celdas">
              {VISTAS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={vista === v.id}
                  className={`rec-contactos-segmento${vista === v.id ? " is-on" : ""}`}
                  onClick={() => setVista(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      {!par ? (
        <div className="rec-contactos-vacio-caja" data-qa-geometry-capacity="owned">
          <p>{control.length === 1 ? "Con una segunda variable de control se cruza una con otra." : "Elige dos variables de control para cruzarlas."}</p>
          <PulsoButton variant="secondary" size="sm" onClick={onElegirVariables}>Elegir variables</PulsoButton>
        </div>
      ) : !vigente ? (
        <div className="rec-contactos-vacio-caja" data-qa-geometry-capacity="owned">
          <p>{cargando ? "Leyendo el cruce…" : "El cruce no llegó con el perfil. Pulsa «Actualizar»."}</p>
        </div>
      ) : (
        <TablaDelCruce cruce={vigente} vista={vista} nombreA={nombre(vigente.a)} nombreB={nombre(vigente.b)} />
      )}
    </section>
  );
}

function TablaDelCruce({ cruce, vista, nombreA, nombreB }: {
  cruce: CruceDelPerfil;
  vista: VistaDelCruce;
  nombreA: string;
  nombreB: string;
}) {
  const totales = totalesDelCruce(cruce);
  const celda = (n: number, totalDeFila: number) => (
    vista === "fila" ? formatoPorcentaje(proporcion(n, totalDeFila)) : formatoConteo(n)
  );
  if (cruce.filas.length === 0 || cruce.columnas.length === 0) {
    return (
      <div className="rec-contactos-vacio-caja" data-qa-geometry-capacity="owned">
        <p>Ningún efectivo del corte tiene dato en las dos variables.</p>
      </div>
    );
  }
  return (
    <TableScroll className="rec-contactos-tabla-scroll">
      <table className="rec-contactos-tabla rec-contactos-cruce">
        <caption className="pulso-sr-only">
          {nombreA} por {nombreB}, {vista === "fila" ? "porcentaje por fila" : "casos"}; base {formatoConteo(totales.total)}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="rec-contactos-cruce-esquina">
              {nombreA} <span aria-hidden>×</span> {nombreB}
            </th>
            {cruce.columnas.map((col) => <th key={col} scope="col" className="is-num">{col}</th>)}
            <th scope="col" className="is-num rec-contactos-cruce-total">Total</th>
          </tr>
        </thead>
        <tbody>
          {cruce.filas.map((fila, i) => (
            <tr key={fila}>
              <th scope="row">{fila}</th>
              {cruce.columnas.map((col, j) => {
                const n = cruce.celdas[i]?.[j] ?? 0;
                return (
                  <td
                    key={col}
                    className="is-num"
                    style={{ "--rec-intensidad": intensidad(n, cruce).toFixed(3) } as CSSProperties}
                  >
                    {celda(n, totales.porFila[i])}
                  </td>
                );
              })}
              <td className="is-num rec-contactos-cruce-total">
                {vista === "fila" ? formatoPorcentaje(totales.porFila[i] ? 1 : null) : formatoConteo(totales.porFila[i])}
                {vista === "fila" ? <span className="rec-contactos-cruce-base"> · {formatoConteo(totales.porFila[i])}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            {totales.porColumna.map((n, j) => (
              <td key={cruce.columnas[j]} className="is-num">{celda(n, totales.total)}</td>
            ))}
            <td className="is-num rec-contactos-cruce-total">
              {vista === "fila" ? `${formatoPorcentaje(totales.total ? 1 : null)} · ${formatoConteo(totales.total)}` : formatoConteo(totales.total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </TableScroll>
  );
}
