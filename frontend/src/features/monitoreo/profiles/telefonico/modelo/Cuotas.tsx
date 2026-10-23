import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Plus, XCircle } from "../../../../../vendor/lucide-react";
import { pctConEspacio } from "../../../core/formatoComun";
import { MetaCuotaInput } from "../MetaCuotaInput";
import { NotaDelModo } from "../../../core/NotaDelModo";
import { metasConProporcion, validarMetas, type FilaDeMeta } from "./cuotasModel";
import "../control/controlTelefonico.css";
import "../insumos/insumosTelefonico.css";
import "./modeloTelefonico.css";

function n(valor: number) {
  return valor.toLocaleString("es-PE");
}

/** Proporción de 0 a 1 como «17.4 %». */
function pct(valor: number | null) {
  return pctConEspacio(valor == null ? null : valor * 100);
}

export type CandidataDeEje = { name: string; label: string; categories: number; universe: number; meta: number; enUso: boolean };

/**
 * Modelo › Cuotas y calendario: el eje de cuota y sus metas. Se edita lo
 * mismo que antes —la variable, las metas por categoría (con confirmación),
 * agregar o quitar categorías y el objetivo total—; lo nuevo es leer cada meta
 * frente al reparto proporcional al universo y la validación de lo declarado.
 * El calendario sigue en su sub-vista (`panel=calendario`).
 */
export function Cuotas({
  variable,
  etiquetaDeVariable,
  candidatas,
  onElegir,
  onUsar,
  variableGuardada,
  filas,
  pendientes,
  onMeta,
  cambiadas,
  etiquetaConfirmar,
  onConfirmar,
  onDescartar,
  onQuitar,
  onAgregar,
  objetivoTotal,
  onObjetivoTotal,
  filtro,
  calendario,
  estado,
}: {
  variable: string;
  etiquetaDeVariable: string;
  candidatas: readonly CandidataDeEje[];
  onElegir: (variable: string) => void;
  onUsar: () => void;
  variableGuardada: boolean;
  filas: readonly FilaDeMeta[];
  pendientes: Record<string, number>;
  onMeta: (categoria: string, meta: number) => void;
  cambiadas: number;
  etiquetaConfirmar: string;
  onConfirmar: () => void;
  onDescartar: () => void;
  onQuitar: (categoria: string) => void;
  onAgregar: (categoria: string) => void;
  objetivoTotal: number | null;
  onObjetivoTotal: (valor: number | null) => void;
  /** «Intro/Consent: Yes», o vacío si no hay filtro de efectiva. */
  filtro: string;
  calendario: { ventana: string; reporte: string; fases: number; dias: ReadonlyArray<{ fecha: string; casos: number }>; nota: string };
  estado: { tono: string; texto: string } | null;
}) {
  const [nueva, setNueva] = useState("");
  const [, setParams] = useSearchParams();
  const conPendientes = useMemo(
    () => filas.map((fila) => ({ ...fila, meta: pendientes[fila.value] ?? fila.meta })),
    [filas, pendientes],
  );
  const proporcion = useMemo(() => metasConProporcion(conPendientes), [conPendientes]);
  const validaciones = validarMetas({ filas: proporcion, variable: etiquetaDeVariable, objetivoTotal });
  const totalUniverso = filas.reduce((suma, fila) => suma + fila.universe, 0);
  const totalMeta = conPendientes.reduce((suma, fila) => suma + (fila.meta ?? 0), 0);
  const maximoSobre = Math.max(0.01, ...proporcion.map((fila) => Math.max(fila.sobreUniverso ?? 0, fila.proporcional != null && fila.universe ? fila.proporcional / fila.universe : 0)));
  const nombreDeCategoria = etiquetaDeVariable.toLocaleLowerCase("es");
  const maximoDia = Math.max(1, ...calendario.dias.map((dia) => dia.casos));
  const topeDeAvance = Math.max(1, ...conPendientes.map((fila) => Math.max(fila.meta ?? 0, fila.effective)));

  return (
    <div className="mon-metas-modelo" data-qa-geometry-group="telefonico-modelo-cuotas" data-qa-geometry-contract="intrinsic">
      <div className="mon-metas-modelo-columna">
        <section className="mon-ctl-panel mon-metas-eje" aria-label="Eje de cuota">
          <header>
            <strong>Eje de cuota</strong>
            <span>{candidatas.length > 1 ? "Una variable, como máximo dos" : ""}</span>
            {variable && !variableGuardada ? (
              <button type="button" className="mon-insumos-boton" onClick={onUsar}>
                <CheckCircle2 size={13} /> Usar {etiquetaDeVariable} para cuotas
              </button>
            ) : null}
          </header>
          <div className="mon-metas-candidatas" role="radiogroup" aria-label="Variable de cuota">
            {candidatas.map((candidata) => (
              <button
                key={candidata.name}
                type="button"
                role="radio"
                aria-checked={candidata.name === variable}
                className={candidata.name === variable ? "is-activa" : undefined}
                onClick={() => onElegir(candidata.name)}
              >
                <strong>{candidata.label}</strong>
                <em>
                  {n(candidata.categories)} {candidata.categories === 1 ? "valor" : "valores"}
                  {candidata.enUso ? ", en uso" : ""}
                </em>
              </button>
            ))}
          </div>
        </section>

        <section className="mon-ctl-panel mon-metas-metas" aria-label={`Metas por ${nombreDeCategoria}`} data-qa-geometry-capacity="owned">
          <header className="mon-insumos-cabecera">
            <strong>Metas por {nombreDeCategoria}</strong>
            <span>Meta frente al reparto proporcional al universo</span>
            <label className="mon-metas-objetivo">
              <span>Objetivo total</span>
              <input
                type="number"
                min={0}
                value={objetivoTotal ?? ""}
                onChange={(event) => {
                  const valor = event.currentTarget.value;
                  onObjetivoTotal(valor ? Number(valor) : null);
                }}
                aria-label="Objetivo total"
              />
            </label>
          </header>
          {cambiadas ? (
            <div className="mon-metas-confirmar" role="status">
              <span>{cambiadas === 1 ? "1 meta ajustada sin confirmar" : `${n(cambiadas)} metas ajustadas sin confirmar`}</span>
              <button type="button" className="mon-insumos-boton" onClick={onDescartar}>Descartar</button>
              <button type="button" className="mon-insumos-boton is-primario" onClick={onConfirmar}>{etiquetaConfirmar}</button>
            </div>
          ) : null}
          {proporcion.length ? (
          <div className="mon-metas-marco">
            <table className="mon-ctl-tabla mon-metas-tabla">
              <thead>
                <tr>
                  <th scope="col">{etiquetaDeVariable}</th>
                  <th scope="col" className="is-num">Universo</th>
                  <th scope="col" className="is-num">Meta</th>
                  <th scope="col" className="is-num">Sobre el universo</th>
                  <th scope="col">Meta frente al reparto proporcional</th>
                  <th scope="col" className="is-num">Desvío</th>
                  <th scope="col"><span className="pulso-sr-only">Quitar</span></th>
                </tr>
              </thead>
              <tbody>
                {proporcion.map((fila) => {
                  const ancho = fila.sobreUniverso != null ? (fila.sobreUniverso / maximoSobre) * 100 : 0;
                  const marca = fila.proporcional != null && fila.universe ? ((fila.proporcional / fila.universe) / maximoSobre) * 100 : null;
                  return (
                    <tr key={fila.value}>
                      <th scope="row">{fila.value}{fila.universe <= 0 ? <em className="mon-ctl-sin-regla">sin base</em> : null}</th>
                      <td className="is-num">{n(fila.universe)}</td>
                      <td className="is-num mon-metas-meta">
                        <MetaCuotaInput value={fila.meta} ariaLabel={`Meta de ${fila.value}`} onCommit={(meta) => onMeta(fila.value, meta)} />
                      </td>
                      <td className="is-num">{pct(fila.sobreUniverso)}</td>
                      <td>
                        <i className="mon-metas-barra" aria-hidden="true">
                          <i style={{ width: `${Math.min(100, ancho)}%` }} />
                          {marca != null ? <b style={{ left: `${Math.min(100, marca)}%` }} /> : null}
                        </i>
                      </td>
                      <td className={`is-num mon-metas-desvio${fila.desvio != null && Math.abs(fila.desvio) >= 5 ? " is-aviso" : ""}`}>
                        {fila.desvio == null ? "—" : fila.desvio > 0 ? `+${n(fila.desvio)}` : n(fila.desvio)}
                      </td>
                      <td>
                        <button type="button" className="mon-metas-quitar" aria-label={`Quitar ${fila.value}`} onClick={() => onQuitar(fila.value)}>
                          <XCircle size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          ) : (
            <NotaDelModo tono="neutro" className="mon-metas-sin-categorias">
              {variable
                ? `${etiquetaDeVariable} no tiene categorías en la base. Agrega una abajo o elige otro eje de cuota.`
                : "Elige un eje de cuota para repartir la meta."}
            </NotaDelModo>
          )}
          {/* Debajo de la tabla, el avance de cada meta: con pocas categorías usa
            * el alto que la tabla no pide; con muchas baja y la tabla desplaza. */}
          <section className="mon-metas-avance" aria-label="Avance de cada meta" data-qa-geometry-capacity="owned">
            <span className="mon-ctl-antetitulo">Avance de cada meta</span>
            {conPendientes.length ? (
            <div className="mon-metas-avance-lienzo" style={{ gridTemplateColumns: `repeat(${Math.max(1, conPendientes.length)}, minmax(0, 1fr))` }}>
              {conPendientes.map((fila) => {
                const meta = fila.meta ?? 0;
                const faltan = meta > 0 ? Math.max(0, meta - fila.effective) : null;
                return (
                  <div key={fila.value} className={`mon-metas-avance-columna${faltan === 0 ? " is-cumple" : ""}`} title={`${fila.value}: ${n(fila.effective)} de ${meta > 0 ? n(meta) : "sin meta"}`}>
                    <span className="is-num mon-metas-avance-cifra">{n(fila.effective)} de {meta > 0 ? n(meta) : "—"}</span>
                    <div className="mon-metas-avance-area">
                      <i style={{ height: `${(fila.effective / topeDeAvance) * 100}%` }} />
                      {meta > 0 ? <b style={{ bottom: `${(meta / topeDeAvance) * 100}%` }} /> : null}
                    </div>
                    <span className="mon-metas-avance-nombre">{fila.value}</span>
                    <span className="is-num mon-metas-avance-faltan">
                      {faltan == null ? "Sin meta" : faltan === 0 ? "Cumplida" : `Faltan ${n(faltan)}`}
                    </span>
                  </div>
                );
              })}
            </div>
            ) : (
              <p className="mon-metas-avance-vacio">Sin categorías, no hay metas que seguir.</p>
            )}
          </section>
          <footer className="mon-metas-pie">
            <dl className="mon-metas-total">
              <div><dt>Universo</dt><dd className="is-num">{n(totalUniverso)}</dd></div>
              <div><dt>Metas</dt><dd className="is-num">{n(totalMeta)}</dd></div>
              <div><dt>Sobre el universo</dt><dd className="is-num">{pct(totalUniverso ? totalMeta / totalUniverso : null)}</dd></div>
            </dl>
            <form
              className="mon-metas-agregar"
              onSubmit={(event) => {
                event.preventDefault();
                if (!nueva.trim()) return;
                onAgregar(nueva.trim());
                setNueva("");
              }}
            >
              <input value={nueva} onChange={(event) => setNueva(event.currentTarget.value)} placeholder={`Otra categoría de ${nombreDeCategoria}`} aria-label={`Agregar categoría de ${nombreDeCategoria}`} />
              <button type="submit" className="mon-insumos-boton" disabled={!nueva.trim()}><Plus size={13} /> Agregar</button>
            </form>
          </footer>
          {estado ? (
            <NotaDelModo className="mon-metas-estado" estado tono={estado.tono === "error" ? "error" : estado.tono === "success" ? "exito" : "info"}>
              {estado.texto}
            </NotaDelModo>
          ) : null}
        </section>
      </div>

      <div className="mon-metas-modelo-lateral">
        <section className="mon-ctl-panel mon-insumos-tarjeta" aria-label="Validación">
          <span className="mon-ctl-antetitulo">Validación</span>
          <ul className="mon-metas-validacion">
            {validaciones.map((item) => (
              <li key={item.texto} className={`is-${item.tono}`}>
                {item.tono === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                <span>{item.texto}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mon-ctl-panel mon-insumos-tarjeta" aria-label="Qué cuenta para la meta">
          <span className="mon-ctl-antetitulo">Qué cuenta para la meta</span>
          <p>{filtro ? `Efectivas de Kobo que pasan el filtro ${filtro}, una por CodPulso.` : "Efectivas de Kobo, una por CodPulso. El filtro de efectiva no está declarado."}</p>
          <p>Las metas son por {nombreDeCategoria}; no hay metas por enumerador.</p>
        </section>

        <section className="mon-ctl-panel mon-insumos-tarjeta mon-metas-calendario" aria-label="Calendario">
          <span className="mon-ctl-antetitulo">Calendario</span>
          <dl>
            <div><dt>Ventana de campo</dt><dd>{calendario.ventana}</dd></div>
            <div><dt>Reporte de avance</dt><dd>{calendario.reporte}</dd></div>
            <div><dt>Fases del campo</dt><dd>{calendario.fases ? `${n(calendario.fases)} declaradas` : "Sin fases declaradas"}</dd></div>
          </dl>
          {calendario.dias.length ? (
            <>
              <span className="mon-ctl-antetitulo">Días de campo con efectivas</span>
              <ul className="mon-metas-dias">
                {calendario.dias.map((dia) => (
                  <li key={dia.fecha}>
                    <span>{`${dia.fecha.slice(8, 10)}/${dia.fecha.slice(5, 7)}`}</span>
                    <i aria-hidden="true"><i style={{ width: `${(dia.casos / maximoDia) * 100}%` }} /></i>
                    <strong className="is-num">{n(dia.casos)}</strong>
                  </li>
                ))}
              </ul>
              {calendario.nota ? <NotaDelModo tono="aviso">{calendario.nota}.</NotaDelModo> : null}
            </>
          ) : (
            <p className="mon-metas-dias-vacio">Ningún día con efectivas de Kobo todavía.</p>
          )}
          <button
            type="button"
            className="mon-insumos-boton"
            onClick={() => setParams((actual) => {
              const siguiente = new URLSearchParams(actual);
              siguiente.set("panel", "calendario");
              return siguiente;
            })}
          >
            Ver y editar el calendario
          </button>
        </section>
      </div>
    </div>
  );
}
