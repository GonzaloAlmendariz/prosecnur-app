// «Agrupar categorías» (ítem 1f): junta los códigos de una select_one en una
// variable nueva sin tocar la original. El borrador vive en el reducer puro de
// `agruparCategoriasModel.ts`; aquí sólo se pinta y se habla con el backend.

import { useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import {
  AlertTriangle, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Combine, Inbox, ListChecks, Plus, Save, Trash2,
} from "lucide-react";
import {
  AgrupacionTargetOcupadoError,
  apiCodifAgrupacionGet,
  apiCodifAgrupacionSet,
  type AgrupacionResponse,
  type AgrupacionSpec,
  type AgrupacionVistaPrevia,
} from "../../api/codificacion";
import { GlidingTabList } from "../../components/GlidingTabList";
import { PulsoButton } from "../../components/PulsoButton";
import { SaveStatusIndicator, type SaveState } from "../../components/SaveStatusIndicator";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../components/States";
import {
  borradorDesdeRespuesta,
  categoriaDeCodigo,
  categoriaDeTexto,
  construirSpec,
  destinoDeCodigo,
  destinoDeTexto,
  reducirBorrador,
  validarBorrador,
  type BorradorAgrupacion,
  type CategoriaBorrador,
} from "./agruparCategoriasModel";
import "./AgruparCategoriasCodificador.css";

// ---------- Pestañas del detalle de una select_one ----------

type ModoSelectOne = "respuestas" | "agrupar";

const MODOS: { id: ModoSelectOne; label: string }[] = [
  { id: "respuestas", label: "Codificar respuestas" },
  { id: "agrupar", label: "Agrupar categorías" },
];

/** Pestañas reales (tab/tabpanel) entre codificar el «Otro» y agrupar categorías. */
export function ModoSelectOneTabs({ parent, codificarRespuestas }: { parent: string; codificarRespuestas: ReactNode }) {
  const [modo, setModo] = useState<ModoSelectOne>("respuestas");
  const idBase = `codif-modo-${parent.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  return (
    <div className="pulso-agrupar-modos">
      <GlidingTabList
        as="div"
        role="tablist"
        aria-label="Cómo codificar esta pregunta"
        className="pulso-agrupar-modos-tabs"
        activeKey={modo}
        onRovingKeyChange={(k) => setModo(k === "agrupar" ? "agrupar" : "respuestas")}
      >
        {MODOS.map((m) => (
          <button
            key={m.id}
            id={`${idBase}-tab-${m.id}`}
            type="button"
            role="tab"
            aria-selected={modo === m.id}
            aria-controls={`${idBase}-panel`}
            tabIndex={modo === m.id ? 0 : -1}
            data-gliding-key={m.id}
            className={modo === m.id ? "is-active" : ""}
            onClick={() => setModo(m.id)}
          >
            {m.label}
          </button>
        ))}
      </GlidingTabList>
      <div id={`${idBase}-panel`} role="tabpanel" aria-labelledby={`${idBase}-tab-${modo}`}>
        {modo === "agrupar" ? <AgruparCategoriasCodificador key={parent} parent={parent} /> : codificarRespuestas}
      </div>
    </div>
  );
}

// ---------- Codificador ----------

type ErrorGuardar = { mensaje: string; sugerido: string | null };

type Remoto = {
  datos: AgrupacionResponse | null;
  errorCarga: string;
  guardado: AgrupacionSpec | null;
  guardando: boolean;
  errorGuardar: ErrorGuardar | null;
  vistaPrevia: AgrupacionVistaPrevia | null;
};

const REMOTO_INICIAL: Remoto = {
  datos: null, errorCarga: "", guardado: null, guardando: false, errorGuardar: null, vistaPrevia: null,
};

const BORRADOR_VACIO: BorradorAgrupacion = { target: "", textCol: null, codigoOtro: null, categorias: [], siguienteId: 1 };

function n(x: number): string {
  return x.toLocaleString("es-PE");
}

function nombreCategoria(c: CategoriaBorrador): string {
  const et = c.etiqueta.trim();
  return et ? `${c.codigo} ${et}` : c.codigo || "Sin código";
}

export function AgruparCategoriasCodificador({ parent, base }: { parent: string; base?: string }) {
  const [remoto, setRemoto] = useState<Remoto>(REMOTO_INICIAL);
  const [borrador, dispatch] = useReducer(reducirBorrador, BORRADOR_VACIO);
  const [abiertas, setAbiertas] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let vivo = true;
    apiCodifAgrupacionGet(parent, base)
      .then((r) => {
        if (!vivo) return;
        dispatch({ tipo: "reemplazar", borrador: borradorDesdeRespuesta(r) });
        setRemoto({ ...REMOTO_INICIAL, datos: r, guardado: r.spec });
      })
      .catch((e: unknown) => {
        if (vivo) setRemoto({ ...REMOTO_INICIAL, errorCarga: e instanceof Error ? e.message : String(e) });
      });
    return () => { vivo = false; };
  }, [parent, base]);

  const datos = remoto.datos;
  const errores = useMemo(
    () => (datos ? validarBorrador(borrador, parent, datos.nombres_ocupados) : []),
    [borrador, datos, parent],
  );
  const specActual = useMemo(() => construirSpec(borrador, parent), [borrador, parent]);
  // Sin agrupación guardada, el borrador sólo cuenta como cambio cuando ya tiene categorías.
  const sucio = remoto.guardado
    ? JSON.stringify(specActual) !== JSON.stringify(remoto.guardado)
    : borrador.categorias.length > 0;

  if (remoto.errorCarga) return <ErrorBlock label="No se pudo cargar la agrupación" detail={remoto.errorCarga} />;
  if (!datos) return <LoadingBlock variant="inline" label="Cargando categorías…" />;

  const saveState: SaveState = remoto.guardando ? "saving"
    : remoto.errorGuardar ? "error"
    : sucio ? "dirty"
    : remoto.guardado ? "saved" : "idle";

  async function guardar(spec: AgrupacionSpec | null) {
    setRemoto((r) => ({ ...r, guardando: true, errorGuardar: null }));
    try {
      const res = await apiCodifAgrupacionSet(parent, spec, base);
      if (spec === null) {
        if (datos) dispatch({ tipo: "reemplazar", borrador: borradorDesdeRespuesta({ ...datos, spec: null }) });
        setRemoto((r) => ({ ...r, guardando: false, guardado: null, vistaPrevia: null }));
      } else {
        setRemoto((r) => ({ ...r, guardando: false, guardado: res.spec ?? spec, vistaPrevia: res.vista_previa }));
      }
    } catch (e: unknown) {
      const errorGuardar: ErrorGuardar = e instanceof AgrupacionTargetOcupadoError
        ? { mensaje: e.message, sugerido: e.sugerido || null }
        : { mensaje: e instanceof Error ? e.message : String(e), sugerido: null };
      setRemoto((r) => ({ ...r, guardando: false, errorGuardar }));
    }
  }

  function alternarAvanzadas(id: string) {
    setAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const target = borrador.target.trim();
  const ocupado = datos.nombres_ocupados.some((o) => o.toLowerCase() === target.toLowerCase());
  const hayTexto = Boolean(borrador.textCol);
  const etiquetaDe = (id: string | null) => {
    const c = borrador.categorias.find((x) => x.id === id);
    return c ? nombreCategoria(c) : "";
  };

  return (
    <div className="pulso-agrupar" data-audit-ready="codificacion-codificar">
      <div className="pulso-agrupar-toolbar">
        <SaveStatusIndicator state={saveState} variant="badge" />
        <span className="pulso-agrupar-toolbar-spacer" />
        {remoto.guardado && (
          <PulsoButton
            variant="ghost"
            size="sm"
            onClick={() => void guardar(null)}
            disabled={remoto.guardando}
          >
            <Trash2 size={13} aria-hidden="true" /> Quitar agrupación
          </PulsoButton>
        )}
        <PulsoButton
          variant="primary"
          size="sm"
          onClick={() => void guardar(specActual)}
          disabled={remoto.guardando || errores.length > 0}
        >
          <Save size={13} aria-hidden="true" /> Guardar agrupación
        </PulsoButton>
      </div>

      {remoto.errorGuardar && (
        <div className="pulso-agrupar-aviso is-error" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{remoto.errorGuardar.mensaje}</span>
          {remoto.errorGuardar.sugerido && (
            <PulsoButton
              variant="secondary"
              size="sm"
              onClick={() => {
                dispatch({ tipo: "target", valor: remoto.errorGuardar?.sugerido ?? "" });
                setRemoto((r) => ({ ...r, errorGuardar: null }));
              }}
            >
              Usar «{remoto.errorGuardar.sugerido}»
            </PulsoButton>
          )}
        </div>
      )}

      <div
        className="pulso-agrupar-secciones"
        data-qa-geometry-group="codificacion/agrupar/secciones"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="pulso-agrupar-col" data-qa-geometry-group="codificacion/agrupar/definir" data-qa-geometry-contract="intrinsic">
        {/* Variable nueva */}
        <section className="pulso-agrupar-seccion" aria-labelledby={`agrupar-${parent}-target`}>
          <h3 id={`agrupar-${parent}-target`} className="pulso-agrupar-titulo">Variable nueva</h3>
          <label className="pulso-agrupar-campo">
            <span>Nombre</span>
            <input
              type="text"
              value={borrador.target}
              spellCheck={false}
              aria-invalid={ocupado || undefined}
              onChange={(e) => dispatch({ tipo: "target", valor: e.target.value })}
            />
          </label>
          <p className="pulso-agrupar-nota">
            Se crea al aplicar la codificación. La variable {parent} no cambia.
          </p>
          {ocupado && (
            <p className="pulso-agrupar-nota is-warn">
              Otra codificación ya usa «{target}». Prueba con «{datos.target_sugerido}».
            </p>
          )}
        </section>

        {/* Categorías nuevas */}
        <section className="pulso-agrupar-seccion" aria-labelledby={`agrupar-${parent}-cats`}>
          <div className="pulso-agrupar-seccion-head">
            <h3 id={`agrupar-${parent}-cats`} className="pulso-agrupar-titulo">Categorías nuevas</h3>
            <PulsoButton variant="secondary" size="sm" onClick={() => dispatch({ tipo: "agregar" })}>
              <Plus size={13} aria-hidden="true" /> Agregar categoría
            </PulsoButton>
          </div>
          <div className="pulso-agrupar-lista" data-qa-geometry-capacity="owned">
            {borrador.categorias.length === 0 ? (
              <EmptyState
                variant="inline"
                icon={<Combine size={18} />}
                title="Aún no hay categorías"
                hint="Agrega las categorías de la variable nueva y luego asigna a cada una sus códigos originales."
              />
            ) : (
              <ol
                className="pulso-agrupar-cats"
                data-qa-geometry-group="codificacion/agrupar/categorias"
                data-qa-geometry-contract="intrinsic"
              >
                {borrador.categorias.map((c, i) => (
                  <CategoriaFila
                    key={c.id}
                    c={c}
                    primera={i === 0}
                    ultima={i === borrador.categorias.length - 1}
                    abierta={abiertas.has(c.id)}
                    hayTexto={hayTexto}
                    onAlternar={() => alternarAvanzadas(c.id)}
                    dispatch={dispatch}
                  />
                ))}
              </ol>
            )}
          </div>
        </section>

        </div>

        <div className="pulso-agrupar-col" data-qa-geometry-group="codificacion/agrupar/asignar" data-qa-geometry-contract="intrinsic">
        {/* Códigos originales */}
        <section className="pulso-agrupar-seccion" aria-labelledby={`agrupar-${parent}-orig`}>
          <h3 id={`agrupar-${parent}-orig`} className="pulso-agrupar-titulo">Códigos originales</h3>
          <div className="pulso-agrupar-lista" data-qa-geometry-capacity="owned">
            {datos.codigos.length === 0 ? (
              <EmptyState
                variant="inline"
                icon={<Inbox size={18} />}
                title="Sin códigos en la base"
                hint={`La columna ${parent} no trae valores ni opciones en el formulario.`}
              />
            ) : (
              <table className="pulso-agrupar-tabla">
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Etiqueta</th>
                    <th scope="col" className="is-num">Casos</th>
                    <th scope="col">Categoría nueva</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.codigos.map((o) => {
                    const explicita = categoriaDeCodigo(borrador, o.codigo);
                    const destino = destinoDeCodigo(borrador, o.codigo);
                    const esOtro = hayTexto && o.codigo === borrador.codigoOtro;
                    return (
                      <tr key={o.codigo}>
                        <td><code>{o.codigo}</code></td>
                        <td>{o.etiqueta}</td>
                        <td className="is-num">{n(o.n)}</td>
                        <td>
                          <select
                            aria-label={`Categoría nueva para ${o.codigo} ${o.etiqueta}`}
                            value={explicita ?? ""}
                            disabled={borrador.categorias.length === 0}
                            onChange={(e) => dispatch({ tipo: "asignarCodigo", codigo: o.codigo, id: e.target.value || null })}
                          >
                            <option value="">Sin asignar</option>
                            {borrador.categorias.map((c) => (
                              <option key={c.id} value={c.id}>{nombreCategoria(c)}</option>
                            ))}
                          </select>
                          {!explicita && borrador.categorias.length > 0 && (
                            <span className={`pulso-agrupar-destino${destino || esOtro ? "" : " is-warn"}`}>
                              {esOtro
                                ? "Se clasifica por el texto escrito en «Otro»"
                                : destino
                                  ? `${destino.via === "rango" ? "Por rango" : "Por resto"} en ${etiquetaDe(destino.id)}`
                                  : "Sin categoría"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Textos de «Otro» */}
        {hayTexto && (
          <section className="pulso-agrupar-seccion" aria-labelledby={`agrupar-${parent}-otro`}>
            <h3 id={`agrupar-${parent}-otro`} className="pulso-agrupar-titulo">Textos escritos en «Otro»</h3>
            <label className="pulso-agrupar-campo">
              <span>Código de «Otro» en {parent}</span>
              <select
                value={borrador.codigoOtro ?? ""}
                onChange={(e) => dispatch({ tipo: "codigoOtro", valor: e.target.value || null })}
              >
                <option value="">Sin código de «Otro»</option>
                {datos.codigos.map((o) => (
                  <option key={o.codigo} value={o.codigo}>{o.codigo} {o.etiqueta}</option>
                ))}
              </select>
            </label>
            <p className="pulso-agrupar-nota">Los textos se leen de la columna {borrador.textCol}.</p>
            <div className="pulso-agrupar-lista" data-qa-geometry-capacity="owned">
              {datos.textos_otro.length === 0 ? (
                <EmptyState
                  variant="inline"
                  icon={<Inbox size={18} />}
                  title="Nadie escribió en «Otro»"
                  hint={`La columna ${borrador.textCol ?? ""} no trae textos en esta base.`}
                />
              ) : (
                <table className="pulso-agrupar-tabla">
                  <thead>
                    <tr>
                      <th scope="col">Texto</th>
                      <th scope="col" className="is-num">Casos</th>
                      <th scope="col">Categoría nueva</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.textos_otro.map((t) => {
                      const explicita = categoriaDeTexto(borrador, t.texto);
                      const destino = destinoDeTexto(borrador, t.texto);
                      return (
                        <tr key={t.texto}>
                          <td>{t.texto}</td>
                          <td className="is-num">{n(t.n)}</td>
                          <td>
                            <select
                              aria-label={`Categoría nueva para el texto ${t.texto}`}
                              value={explicita ?? ""}
                              disabled={borrador.categorias.length === 0}
                              onChange={(e) => dispatch({ tipo: "asignarTexto", texto: t.texto, id: e.target.value || null })}
                            >
                              <option value="">Sin asignar</option>
                              {borrador.categorias.map((c) => (
                                <option key={c.id} value={c.id}>{nombreCategoria(c)}</option>
                              ))}
                            </select>
                            {!explicita && borrador.categorias.length > 0 && (
                              <span className={`pulso-agrupar-destino${destino ? "" : " is-warn"}`}>
                                {destino
                                  ? `${destino.via === "rango" ? "Por año en rango" : "Por resto de textos"} en ${etiquetaDe(destino.id)}`
                                  : "Sin categoría"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {/* Validación y vista previa */}
        <section className="pulso-agrupar-seccion" aria-labelledby={`agrupar-${parent}-prev`}>
          <h3 id={`agrupar-${parent}-prev`} className="pulso-agrupar-titulo">Resultado</h3>
          <div className="pulso-agrupar-lista" data-qa-geometry-capacity="owned">
            {errores.length > 0 ? (
              <ul className="pulso-agrupar-errores" aria-label="Falta para guardar">
                {errores.map((e) => <li key={e}>{e}</li>)}
              </ul>
            ) : remoto.vistaPrevia && !sucio ? (
              <VistaPrevia vp={remoto.vistaPrevia} target={target} />
            ) : (
              <EmptyState
                variant="inline"
                icon={<ListChecks size={18} />}
                title={sucio ? "Guarda para ver cuántos casos caen en cada categoría" : "Agrupación guardada"}
                hint={sucio ? undefined : "Vuelve a guardar para recalcular los casos por categoría."}
              />
            )}
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}

function VistaPrevia({ vp, target }: { vp: AgrupacionVistaPrevia; target: string }) {
  return (
    <div className="pulso-agrupar-vista">
      <table className="pulso-agrupar-tabla">
        <caption>Casos por categoría en {target}</caption>
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Categoría</th>
            <th scope="col" className="is-num">Casos</th>
          </tr>
        </thead>
        <tbody>
          {vp.categorias.map((c) => (
            <tr key={c.codigo}>
              <td><code>{c.codigo}</code></td>
              <td>{c.etiqueta}</td>
              <td className="is-num">{n(c.n)}</td>
            </tr>
          ))}
          <tr className={vp.n_sin_categoria > 0 ? "is-warn" : undefined}>
            <td />
            <td>Sin categoría</td>
            <td className="is-num">{n(vp.n_sin_categoria)}</td>
          </tr>
        </tbody>
      </table>
      {vp.n_sin_categoria > 0 && (
        <p className="pulso-agrupar-nota is-warn">
          {n(vp.n_sin_categoria)} {vp.n_sin_categoria === 1 ? "caso con respuesta queda" : "casos con respuesta quedan"} vacíos en la variable nueva. Asigna sus códigos o marca una categoría que recoja el resto.
        </p>
      )}
    </div>
  );
}

function CategoriaFila({ c, primera, ultima, abierta, hayTexto, onAlternar, dispatch }: {
  c: CategoriaBorrador;
  primera: boolean;
  ultima: boolean;
  abierta: boolean;
  hayTexto: boolean;
  onAlternar: () => void;
  dispatch: (a: Parameters<typeof reducirBorrador>[1]) => void;
}) {
  const nombre = nombreCategoria(c);
  const panelId = `agrupar-avanzadas-${c.id}`;
  return (
    <li className="pulso-agrupar-cat">
      <div className="pulso-agrupar-cat-fila">
        <label className="pulso-agrupar-campo is-codigo">
          <span>Código</span>
          <input
            type="text"
            value={c.codigo}
            spellCheck={false}
            onChange={(e) => dispatch({ tipo: "editar", id: c.id, cambios: { codigo: e.target.value } })}
          />
        </label>
        <label className="pulso-agrupar-campo is-etiqueta">
          <span>Etiqueta</span>
          <input
            type="text"
            value={c.etiqueta}
            placeholder="Por ejemplo, Lima y Callao"
            onChange={(e) => dispatch({ tipo: "editar", id: c.id, cambios: { etiqueta: e.target.value } })}
          />
        </label>
        <div className="pulso-agrupar-cat-acciones">
          <PulsoButton variant="icon" size="sm" aria-label={`Subir ${nombre}`} disabled={primera}
            onClick={() => dispatch({ tipo: "mover", id: c.id, delta: -1 })}>
            <ArrowUp size={13} aria-hidden="true" />
          </PulsoButton>
          <PulsoButton variant="icon" size="sm" aria-label={`Bajar ${nombre}`} disabled={ultima}
            onClick={() => dispatch({ tipo: "mover", id: c.id, delta: 1 })}>
            <ArrowDown size={13} aria-hidden="true" />
          </PulsoButton>
          <PulsoButton variant="icon" size="sm" aria-label={`Quitar ${nombre}`}
            onClick={() => dispatch({ tipo: "quitar", id: c.id })}>
            <Trash2 size={13} aria-hidden="true" />
          </PulsoButton>
        </div>
      </div>
      <button
        type="button"
        className="pulso-agrupar-cat-toggle"
        aria-expanded={abierta}
        aria-controls={panelId}
        onClick={onAlternar}
      >
        {abierta ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
        Opciones avanzadas
        {(c.resto || c.otrosResto || c.rangoMin.trim() || c.rangoMax.trim()) && (
          <span className="pulso-agrupar-cat-marcas">
            {[c.rangoMin.trim() || c.rangoMax.trim() ? "rango" : "", c.resto ? "resto de códigos" : "", c.otrosResto ? "resto de textos" : ""]
              .filter(Boolean).join(", ")}
          </span>
        )}
      </button>
      {abierta && (
        <div id={panelId} className="pulso-agrupar-cat-avanzadas">
          <fieldset className="pulso-agrupar-rango">
            <legend>Rango de valores, por ejemplo años</legend>
            <label className="pulso-agrupar-campo">
              <span>Desde</span>
              <input type="number" inputMode="numeric" value={c.rangoMin}
                onChange={(e) => dispatch({ tipo: "editar", id: c.id, cambios: { rangoMin: e.target.value } })} />
            </label>
            <label className="pulso-agrupar-campo">
              <span>Hasta</span>
              <input type="number" inputMode="numeric" value={c.rangoMax}
                onChange={(e) => dispatch({ tipo: "editar", id: c.id, cambios: { rangoMax: e.target.value } })} />
            </label>
            <p className="pulso-agrupar-nota">
              Deja un extremo vacío para un rango abierto. Un rango abierto no recoge los códigos 80 a 99 ni el código de «Otro».
            </p>
          </fieldset>
          <label className="pulso-agrupar-check">
            <input type="checkbox" checked={c.resto}
              onChange={(e) => dispatch({ tipo: "resto", id: c.id, activo: e.target.checked })} />
            Recoge el resto de códigos sin asignar
          </label>
          {hayTexto && (
            <>
              <label className="pulso-agrupar-check">
                <input type="checkbox" checked={c.otrosNumerico}
                  onChange={(e) => dispatch({ tipo: "editar", id: c.id, cambios: { otrosNumerico: e.target.checked } })} />
                Recoge los años escritos en «Otro» que caen en su rango
              </label>
              <label className="pulso-agrupar-check">
                <input type="checkbox" checked={c.otrosResto}
                  onChange={(e) => dispatch({ tipo: "otrosResto", id: c.id, activo: e.target.checked })} />
                Recoge el resto de textos escritos en «Otro»
              </label>
            </>
          )}
        </div>
      )}
    </li>
  );
}
