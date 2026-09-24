import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import type { CalcMuestraComponente, CalcMuestraEstrato } from "../../../api/calcMuestra";
import { fmtInt, type ComponentePatch } from "../sharedCore";
import { NumberCell } from "../universidad/aulas";
import {
  esProporcionValida,
  filasDeEstratos,
  leerProporcion,
  patchAgregar,
  patchProporcion,
  patchQuitar,
  patchRotulo,
  patchTamano,
  reglaEnPalabras,
  usaProporcionPorEstrato,
} from "./modeloEstratos";
import { useDesbordaHorizontal } from "./useDesbordaHorizontal";
import { useMuestraGeneral } from "./useMuestraGeneral";
import "./general.css";

/**
 * Método › Estratos del marco en Muestra general. No es la tabla de aulas:
 * lleva sólo lo que el motor general usa —rótulo, N_h y, en el estratificado,
 * la p esperada de cada estrato— y lo que devolvió por estrato.
 */
export function EstratosGeneral({
  comp,
  onComponente,
}: {
  comp: CalcMuestraComponente;
  onComponente: (id: string, patch: ComponentePatch) => void;
}) {
  const { marco } = useMuestraGeneral(comp.id);
  return <EstratosGeneralVista comp={comp} marcoDeclarado={Boolean(marco)} onComponente={onComponente} />;
}

/** La tabla con el marco ya resuelto (separada para probarla sin efectos). */
export function EstratosGeneralVista({
  comp,
  marcoDeclarado,
  onComponente,
}: {
  comp: CalcMuestraComponente;
  /** Con marco declarado los estratos y sus N_h salen del archivo. */
  marcoDeclarado: boolean;
  onComponente: (id: string, patch: ComponentePatch) => void;
}) {
  const { ref, desborda } = useDesbordaHorizontal<HTMLDivElement>();
  const conP = usaProporcionPorEstrato(comp.tecnica, comp.parametros?.tipo_indicador);
  const filas = filasDeEstratos(comp);
  const formulaN = comp.resultado?.formula_n;
  const pGlobal = comp.parametros.p;
  const editar = (patch: ComponentePatch | null) => {
    if (patch) onComponente(comp.id, patch);
  };

  return (
    <section className="cmv2-panel cmg-estratos-general" aria-labelledby="cmg-estratos-titulo">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">{marcoDeclarado ? "Del archivo del marco" : "Tabla editable"}</span>
        <strong id="cmg-estratos-titulo">Estratos del marco</strong>
      </div>
      {conP && (
        <p className="cmg-nota" id="cmg-estratos-ayuda">
          Con la proporción de cada estrato el n se calcula por estrato y Neyman puede repartir mejor.
        </p>
      )}
      <div
        ref={ref}
        className="cmv2-table-wrap cmg-tabla-desplazable"
        data-desborda={desborda ? "true" : "false"}
        tabIndex={desborda ? 0 : undefined}
        role={desborda ? "region" : undefined}
        aria-label={desborda ? "Tabla de estratos, desplazable" : undefined}
        data-qa-geometry-capacity="owned"
      >
        <table className="cmv2-table cmg-tabla-estratos" data-columnas={conP ? "con-p" : "sin-p"}>
          <thead>
            <tr>
              <th scope="col">Estrato</th>
              <th scope="col" className="cmg-num">N<sub>h</sub></th>
              {conP && <th scope="col">p esperada</th>}
              <th scope="col" className="cmg-num">n completas</th>
              <th scope="col" className="cmg-num">n a campo</th>
              <th scope="col">Reparto</th>
              {!marcoDeclarado && <th scope="col"><span className="cmg-sr-only">Quitar</span></th>}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td colSpan={5 + (conP ? 1 : 0) + (marcoDeclarado ? 0 : 1)} className="cmg-estratos-vacio">
                  {marcoDeclarado
                    ? "El marco se declaró sin columna de estrato. Elige una en Marco para repartir por estratos."
                    : "Sin estratos. Declara el marco con su columna de estrato o agrega uno aquí."}
                </td>
              </tr>
            )}
            {filas.map(({ estrato: e, reparto }, i) => (
              <tr key={e.id}>
                <td>
                  {marcoDeclarado ? (
                    <strong>{e.label}</strong>
                  ) : (
                    <input
                      className="cmv2-table-input"
                      aria-label={`Nombre del estrato ${i + 1}`}
                      value={e.label}
                      onChange={(ev) => editar(patchRotulo(comp, i, ev.currentTarget.value))}
                    />
                  )}
                </td>
                <td className="cmg-num">
                  {marcoDeclarado ? (
                    <span title="Sale del archivo del marco">{fmtInt(e.N)}</span>
                  ) : (
                    <NumberCell value={e.N} title={`N_h de ${e.label}`} onChange={(v) => editar(patchTamano(comp, i, v))} />
                  )}
                </td>
                {conP && (
                  <td>
                    <CeldaProporcion
                      estrato={e}
                      pGlobal={pGlobal}
                      onTexto={(texto) => editar(patchProporcion(comp, i, texto))}
                    />
                  </td>
                )}
                <td className="cmg-num">{reparto ? fmtInt(reparto.n) : "—"}</td>
                <td className="cmg-num">{reparto?.n_campo != null ? fmtInt(reparto.n_campo) : "—"}</td>
                <td>{reparto ? reglaEnPalabras(reparto.regla, formulaN) : "—"}</td>
                {!marcoDeclarado && (
                  <td>
                    <button
                      type="button"
                      className="cmv2-icon-button"
                      aria-label={`Quitar ${e.label}`}
                      onClick={() => editar(patchQuitar(comp, i))}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!marcoDeclarado && (
        <div className="cmv2-inline-actions">
          <button type="button" className="cmv2-ghost" onClick={() => editar(patchAgregar(comp))}>
            <Plus size={14} aria-hidden="true" /> Agregar estrato
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * La p de un estrato. Guarda el borrador mientras se teclea («0.» no es aún
 * una proporción) y sólo escribe lo que el motor puede usar; vacío vuelve a
 * la p global, que es la que se ve como placeholder.
 */
function CeldaProporcion({
  estrato,
  pGlobal,
  onTexto,
}: {
  estrato: CalcMuestraEstrato;
  pGlobal: number;
  onTexto: (texto: string) => void;
}) {
  const guardada = esProporcionValida(estrato.p_facultad) ? String(estrato.p_facultad) : "";
  const [borrador, setBorrador] = useState(guardada);
  // «0.» o «0» son pasos hacia «0.3»: el error se dice al salir del campo.
  const [editando, setEditando] = useState(false);
  useEffect(() => {
    setBorrador((actual) => (leerProporcion(actual).tipo === "invalida" ? actual : guardada));
  }, [guardada]);
  const invalida = !editando && leerProporcion(borrador).tipo === "invalida";
  const id = `cmg-p-${estrato.id}`;
  return (
    <div className="cmg-celda-p">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        className="cmv2-table-input"
        aria-label={`Proporción esperada de ${estrato.label}`}
        aria-describedby={invalida ? `${id}-error` : "cmg-estratos-ayuda"}
        aria-invalid={invalida ? true : undefined}
        placeholder={Number.isFinite(pGlobal) ? String(pGlobal) : undefined}
        value={borrador}
        onFocus={() => setEditando(true)}
        onBlur={() => setEditando(false)}
        onChange={(ev) => {
          const texto = ev.currentTarget.value;
          setBorrador(texto);
          onTexto(texto);
        }}
      />
      {invalida && <small id={`${id}-error`} className="cmg-error-p">Entre 0 y 1, sin incluirlos.</small>}
    </div>
  );
}
