// C50: cómo se redondean los porcentajes y con cuántos decimales se escriben, por familia de gráfico, más la nota del
// redondeo al pie. No son decisiones de lámina: valen para todo el informe. La clasificación (qué familia puede repartir
// a 100 % y cómo se llama su campo de decimales) la sirve el motor en `preset.calculos`; aquí no se repite.

import { useId } from "react";
import { PulsoButton } from "../../../components/PulsoButton";
import { RotateCcw } from "../../../vendor/lucide-react";
import { resolveGraphLucideIcon } from "../lucideRegistry";
import { SelloProcedencia } from "../estilo/SelloProcedencia";
import { CabeceraSeccion } from "./CabeceraSeccion";
import {
  DECIMALES_MAX,
  METODO_ESTANDAR,
  METODO_REPARTO,
  acotarDecimales,
  type FilaCalculo,
  type NotaRedondeo,
} from "./modeloEstiloInforme";

export type AccionesCalculos = {
  onMetodo: (fila: FilaCalculo, metodo: string) => void;
  onDecimales: (fila: FilaCalculo, decimales: number) => void;
  onVolverFila: (fila: FilaCalculo) => void;
  onMetodoEnTodas: (metodo: string) => void;
  onDecimalesEnTodas: (decimales: number) => void;
  onNota: (activa: boolean) => void;
  onVolverTodo: () => void;
};

function TablaCalculos({ filas, acciones, titulo }: { filas: readonly FilaCalculo[]; acciones: AccionesCalculos; titulo: string }) {
  return (
    <div className="pulso-f6-informe-tabla-marco">
      <table className="pulso-f6-informe-tabla">
        <caption className="pulso-sr-only">{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">Gráfico</th>
            <th scope="col">Método de redondeo</th>
            <th scope="col">Decimales</th>
            <th scope="col">Procedencia</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => {
            const Icono = resolveGraphLucideIcon(fila.icono);
            const idMet = `f6-informe-met-${fila.preset}`;
            const idDec = `f6-informe-dec-${fila.preset}`;
            return (
              <tr key={fila.preset} data-preset={fila.preset}>
                <th scope="row">
                  <span className="pulso-f6-informe-familia">
                    <Icono size={15} aria-hidden="true" />
                    {fila.titulo}
                  </span>
                </th>
                <td>
                  {fila.admiteMetodo ? (
                    <>
                      <label className="pulso-sr-only" htmlFor={idMet}>Método de redondeo de {fila.titulo}</label>
                      <select id={idMet} value={fila.metodo} onChange={(e) => acciones.onMetodo(fila, e.target.value)}>
                        {fila.choicesMetodo.length > 0
                          ? fila.choicesMetodo.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)
                          : (
                            <>
                              <option value={METODO_ESTANDAR}>Redondeo estándar</option>
                              <option value={METODO_REPARTO}>Reparto a 100 %</option>
                            </>
                          )}
                      </select>
                    </>
                  ) : (
                    <span className="pulso-f6-informe-fijo" title="Sus categorías no suman 100 %: no hay resto que repartir.">
                      Redondeo estándar
                    </span>
                  )}
                </td>
                <td>
                  {fila.campoDecimales ? (
                    <>
                      <label className="pulso-sr-only" htmlFor={idDec}>Decimales de {fila.titulo}</label>
                      <input
                        id={idDec}
                        className="pulso-f6-informe-numero"
                        type="number"
                        min={0}
                        max={DECIMALES_MAX}
                        step={1}
                        value={fila.decimales}
                        onChange={(e) => acciones.onDecimales(fila, acotarDecimales(e.target.value))}
                      />
                    </>
                  ) : (
                    <span className="pulso-f6-informe-fijo">—</span>
                  )}
                </td>
                <td>
                  <span className="pulso-f6-informe-procedencia">
                    <SelloProcedencia procedencia={fila.procedencia} />
                    {fila.procedencia === "propio" ? (
                      <PulsoButton
                        variant="icon"
                        size="sm"
                        onClick={() => acciones.onVolverFila(fila)}
                        aria-label={`Volver al valor por defecto en ${fila.titulo}`}
                        title="Volver al valor por defecto"
                      >
                        <RotateCcw size={14} aria-hidden="true" />
                      </PulsoButton>
                    ) : null}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SeccionCalculos({
  filas,
  nota,
  acciones,
  estado,
}: {
  filas: readonly FilaCalculo[];
  nota: NotaRedondeo;
  acciones: AccionesCalculos;
  /** Texto de carga, error o catálogo vacío: ocupa el lugar de la tabla dentro de la sección (C3). */
  estado?: string;
}) {
  const tituloId = useId();
  const notaId = useId();
  const cierran = filas.filter((f) => f.admiteMetodo);
  const independientes = filas.filter((f) => !f.admiteMetodo);
  const modificado = nota.procedencia === "propio" || filas.some((f) => f.procedencia === "propio");
  return (
    <section className="pulso-f6-informe-seccion" aria-labelledby={tituloId} data-qa-geometry-member>
      <CabeceraSeccion
        id={tituloId}
        titulo="Cálculos"
        modificado={modificado}
        etiquetaVolver="Volver a los cálculos por defecto"
        onVolver={acciones.onVolverTodo}
      />
      <p className="pulso-f6-informe-ayuda">
        Lo único de esta pestaña que no es estético: decide las cifras de todo el mazo. El redondeo estándar redondea cada
        cifra sola, como SPSS y Excel, y puede sumar 99 % o 101 %; el reparto a 100 % cierra la suma a costa de alejar
        alguna cifra de su valor.
      </p>

      <div className="pulso-f6-informe-nota">
        <input
          id={notaId}
          type="checkbox"
          checked={nota.activa}
          onChange={(e) => acciones.onNota(e.target.checked)}
        />
        <label htmlFor={notaId}>
          <strong>Declarar el redondeo al pie de las láminas.</strong> Explica por qué una barra suma 99 % o 101 %. Si la
          lámina ya trae una nota, se anexa.
        </label>
        <SelloProcedencia procedencia={nota.procedencia} />
      </div>

      {estado ? (
        <p className="pulso-f6-informe-estado" role="status">{estado}</p>
      ) : (
        <>
          <div className="pulso-f6-informe-aplicar" role="group" aria-label="Aplicar a todos los gráficos">
            <span>Aplicar a todos:</span>
            <PulsoButton variant="secondary" size="sm" onClick={() => acciones.onMetodoEnTodas(METODO_ESTANDAR)}>Redondeo estándar</PulsoButton>
            <PulsoButton variant="secondary" size="sm" onClick={() => acciones.onMetodoEnTodas(METODO_REPARTO)}>Reparto a 100 %</PulsoButton>
            <PulsoButton variant="secondary" size="sm" onClick={() => acciones.onDecimalesEnTodas(0)}>Sin decimales</PulsoButton>
            <PulsoButton variant="secondary" size="sm" onClick={() => acciones.onDecimalesEnTodas(1)}>Un decimal</PulsoButton>
          </div>
          {cierran.length > 0 ? (
            <>
              <h4 className="pulso-f6-informe-subtitulo">Sus categorías suman 100 %</h4>
              <TablaCalculos filas={cierran} acciones={acciones} titulo="Gráficos cuyas categorías suman 100 %" />
            </>
          ) : null}
          {independientes.length > 0 ? (
            <>
              <h4 className="pulso-f6-informe-subtitulo">Cifras independientes</h4>
              <p className="pulso-f6-informe-ayuda">
                Respuesta múltiple, brechas y series no tienen un total que cerrar: siempre usan redondeo estándar.
              </p>
              <TablaCalculos filas={independientes} acciones={acciones} titulo="Gráficos de cifras independientes" />
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
