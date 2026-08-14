import { useMemo } from "react";
import { ArgMetadata, PresetMetadata } from "../../api/client";
import { usePlanStore } from "./store";
import { usePresetsMetadata } from "./usePresetsMetadata";
import { resolveGraphLucideIcon } from "./lucideRegistry";
import "./calculosEditor.css";

// Pestaña «Cálculos» de la Configuración global.
//
// Cómo se redondea un porcentaje y con cuántos decimales se escribe NO son
// decisiones de lámina: en un mazo de sesenta no tiene sentido que la 12
// redondee distinto que la 13. Por eso viven aquí, en una matriz que se lee de
// un vistazo, y no repartidas dentro del preset de cada tipo —donde ya estaban,
// pero a seis clics de distancia y sin forma de compararlas entre sí—.
//
// La clasificación (qué familia rotula porcentajes, cuál puede elegir método y
// cómo se llama su campo de decimales) la sirve el motor en `preset.calculos`.
// Aquí no se repite: ver `api/R/graficos_calculos_gobernados.R`.

const METODO_ESTANDAR = "estandar";
const METODO_REPARTO = "reparto";
const ARG_METODO = "metodo_redondeo";

type FilaCalculos = {
  preset: PresetMetadata;
  admiteMetodo: boolean;
  campoDecimales: string;
  argMetodo?: ArgMetadata;
  argDecimales?: ArgMetadata;
};

function argDe(preset: PresetMetadata, nombre: string): ArgMetadata | undefined {
  return preset.args.find((a) => a.name === nombre);
}

function textoDe(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numeroDe(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function CalculosEditor() {
  const { presets, loading, error } = usePresetsMetadata();
  const valores = usePlanStore((s) => s.presets);
  const setPresetArg = usePlanStore((s) => s.setPresetArg);

  const filas = useMemo<FilaCalculos[]>(
    () =>
      presets
        .filter((p) => p.calculos?.familia_porcentaje)
        .map((preset) => {
          const campoDecimales = preset.calculos?.campo_decimales ?? "";
          return {
            preset,
            admiteMetodo: preset.calculos?.admite_metodo === true,
            campoDecimales,
            argMetodo: argDe(preset, ARG_METODO),
            argDecimales: campoDecimales ? argDe(preset, campoDecimales) : undefined,
          };
        }),
    [presets],
  );

  const cierran = filas.filter((f) => f.admiteMetodo);
  const noCierran = filas.filter((f) => !f.admiteMetodo);

  const metodoDe = (fila: FilaCalculos): string =>
    textoDe(
      valores[fila.preset.name]?.[ARG_METODO] ?? fila.argMetodo?.default,
      METODO_ESTANDAR,
    );

  const decimalesDe = (fila: FilaCalculos): number =>
    numeroDe(
      valores[fila.preset.name]?.[fila.campoDecimales] ?? fila.argDecimales?.default,
      0,
    );

  const aplicarMetodoATodos = (metodo: string) => {
    for (const fila of cierran) setPresetArg(fila.preset.name, ARG_METODO, metodo);
  };

  const aplicarDecimalesATodos = (dec: number) => {
    for (const fila of filas) {
      if (!fila.campoDecimales) continue;
      setPresetArg(fila.preset.name, fila.campoDecimales, dec);
    }
  };

  if (loading) return <div className="pulso-calculos__estado">Cargando catálogo…</div>;
  if (error) return <div className="pulso-calculos__estado">No se pudo cargar el catálogo: {error}</div>;
  if (!filas.length) {
    return (
      <div className="pulso-calculos__estado">
        Ningún tipo de gráfico del catálogo rotula porcentajes.
      </div>
    );
  }

  const renderTabla = (grupo: FilaCalculos[]) => (
    <div className="pulso-calculos__tabla-wrap">
      <table className="pulso-calculos__tabla">
        <thead>
          <tr>
            <th scope="col">Gráfico</th>
            <th scope="col">Método de redondeo</th>
            <th scope="col">Decimales</th>
          </tr>
        </thead>
        <tbody>
          {grupo.map((fila) => {
            const Icono = resolveGraphLucideIcon(fila.preset.icono_ui);
            const idDec = `calculos-dec-${fila.preset.name}`;
            const idMet = `calculos-met-${fila.preset.name}`;
            return (
              <tr key={fila.preset.name}>
                <td>
                  <span className="pulso-calculos__familia">
                    <Icono size={15} aria-hidden />
                    {fila.preset.titulo_humano}
                  </span>
                </td>
                <td>
                  {fila.admiteMetodo ? (
                    <>
                      <label className="pulso-sr-only" htmlFor={idMet}>
                        Método de redondeo de {fila.preset.titulo_humano}
                      </label>
                      <select
                        id={idMet}
                        className="pulso-calculos__select"
                        value={metodoDe(fila)}
                        onChange={(e) =>
                          setPresetArg(fila.preset.name, ARG_METODO, e.target.value)
                        }
                      >
                        {(fila.argMetodo?.choices ?? []).map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <span
                      className="pulso-calculos__fijo"
                      title="Sus categorías no suman 100 %, así que no hay resto que repartir."
                    >
                      Redondeo estándar
                    </span>
                  )}
                </td>
                <td>
                  <label className="pulso-sr-only" htmlFor={idDec}>
                    Decimales de {fila.preset.titulo_humano}
                  </label>
                  <input
                    id={idDec}
                    type="number"
                    className="pulso-calculos__number"
                    min={0}
                    max={2}
                    step={1}
                    value={decimalesDe(fila)}
                    onChange={(e) => {
                      if (!fila.campoDecimales) return;
                      const n = Math.max(0, Math.min(2, Math.round(Number(e.target.value) || 0)));
                      setPresetArg(fila.preset.name, fila.campoDecimales, n);
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="pulso-calculos">
      <div className="pulso-calculos__intro">
        <div className="pulso-calculos__metodo-card">
          <h4>Redondeo estándar</h4>
          <p>
            Cada cifra se redondea sola y el 0,5 sube, igual que SPSS y Excel: cualquiera
            con la base llega al mismo número. A cambio, las cifras impresas pueden sumar
            99 % o 101 %.
          </p>
        </div>
        <div className="pulso-calculos__metodo-card">
          <h4>Reparto a 100 %</h4>
          <p>
            Las cifras impresas suman exactamente 100 %. A cambio, alguna puede alejarse de
            su valor real, y una categoría con muy pocos casos puede quedar rotulada 0 % —
            en barras apiladas, esa categoría no se dibuja.
          </p>
        </div>
      </div>

      <div className="pulso-calculos__aplicar">
        <span>Aplicar a todos:</span>
        <button
          type="button"
          className="pulso-calculos__boton"
          onClick={() => aplicarMetodoATodos(METODO_ESTANDAR)}
        >
          Redondeo estándar
        </button>
        <button
          type="button"
          className="pulso-calculos__boton"
          onClick={() => aplicarMetodoATodos(METODO_REPARTO)}
        >
          Reparto a 100 %
        </button>
        <button
          type="button"
          className="pulso-calculos__boton"
          onClick={() => aplicarDecimalesATodos(0)}
        >
          Sin decimales
        </button>
        <button
          type="button"
          className="pulso-calculos__boton"
          onClick={() => aplicarDecimalesATodos(1)}
        >
          Un decimal
        </button>
      </div>

      {cierran.length > 0 && (
        <>
          <p className="pulso-calculos__grupo-titulo">Sus categorías suman 100 %</p>
          {renderTabla(cierran)}
        </>
      )}

      {noCierran.length > 0 && (
        <>
          <p className="pulso-calculos__grupo-titulo">Cifras independientes</p>
          <p className="pulso-calculos__grupo-nota">
            Respuesta múltiple, brechas y series no tienen un total que cerrar, así que no
            hay resto que repartir: siempre usan redondeo estándar.
          </p>
          {renderTabla(noCierran)}
        </>
      )}

      <p className="pulso-calculos__estado">
        Esto vale para todo el mazo. Los ajustes de cada lámina ya no pueden cambiarlo.
      </p>
    </div>
  );
}
