import { useMemo } from "react";
import { TerritorioGraficos } from "./TerritorioGraficos";
import { MapPinned, Minus, Plus, X } from "../../../../vendor/lucide-react";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { InspectorCabecera } from "../InspectorCabecera";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import type { HojasRutaTerritory, TerritorialFrameMeta } from "../../../../api/hojasRuta";
import { nombreDistrito } from "../nombres";
import { useLienzoHojasRuta } from "../store";
import { agregarVarios, alternar, cambios } from "./borrador";
import type { ZonaLima } from "./zonasLima";

const FILTRO = [["todos", "Todos"], ["elegidos", "Elegidos"]] as const;

/**
 * Territorio en la página del lienzo (ADR 0114 §2, U5). La estructura es el
 * catálogo de los 50 distritos del marco con interruptores y buscador (nunca
 * casillas); el inspector dice qué está elegido y qué cambia al confirmar.
 */

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(n);
const enMiles = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString("es-PE", { maximumFractionDigits: 2 })} M` : `${fmt(Math.round(n / 1000))} mil`);
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es-PE");

type EstructuraProps = {
  territorios: readonly HojasRutaTerritory[];
  confirmados: readonly string[];
  zonas: readonly ZonaLima[];
  bloqueado: boolean;
};

export function TerritorioEstructura({ territorios, confirmados, zonas, bloqueado }: EstructuraProps) {
  const { borrador: b, busquedaDistrito, soloElegidos, setBorrador, setBusquedaDistrito, setSoloElegidos, zonaFiltro, setZonaFiltro, distritoEnfocado, setDistritoEnfocado } = useLienzoHojasRuta();
  const borrador = b ?? [...confirmados];
  const q = normalizar(busquedaDistrito.trim());
  // Las zonas FILTRAN la lista; elegir es sólo con los interruptores (pedido de Gonzalo:
  // los atajos que seleccionaban en bloque eran «demasiado inclusivos o destructivos»).
  const zona = zonas.find((z) => z.id === zonaFiltro) ?? null;
  const visibles = useMemo(
    () => territorios.filter((t) => (!q || normalizar(t.distrito).includes(q) || t.ubigeo.includes(q)) && (!soloElegidos || borrador.includes(t.ubigeo)) && (!zona || zona.ubigeos.includes(t.ubigeo))),
    [territorios, q, soloElegidos, borrador, zona],
  );
  const filtrado = Boolean(q || zona || soloElegidos);
  const visiblesFuera = visibles.filter((t) => !borrador.includes(t.ubigeo)).length;
  const visiblesDentro = visibles.filter((t) => borrador.includes(t.ubigeo)).length;
  const grupos = [
    { id: "LIMA", etiqueta: "Lima Metropolitana" },
    { id: "CALLAO", etiqueta: "Callao" },
  ].map((g) => ({ ...g, filas: visibles.filter((t) => t.provincia === g.id).sort((x, y) => x.distrito.localeCompare(y.distrito, "es")) }));

  return (
    <>
      <div className="hr-mapa-cab hr-mapa-cab--pila">
        <div className="hr-mapa-cab-titulo">
          <h2>Distritos</h2>
          <small>
            {borrador.length} de {territorios.length}
          </small>
        </div>
        <input className="hr-mapa-buscar" type="search" aria-label="Buscar distrito" placeholder="Buscar distrito o ubigeo" value={busquedaDistrito} onChange={(e) => setBusquedaDistrito(e.target.value)} />
        <GlidingRadioGroup value={soloElegidos ? "elegidos" : "todos"} options={FILTRO} getOptionValue={(o) => o[0]} onValueChange={(v) => setSoloElegidos(v === "elegidos")} className="hr-muestra-opciones" aria-label="Qué distritos ver">
          {(o) => <span>{o[0] === "elegidos" ? `${o[1]} · ${borrador.length}` : `${o[1]} · ${territorios.length}`}</span>}
        </GlidingRadioGroup>
        <h3 className="hr-mapa-subtitulo">Zonas de Lima</h3>
        <div className="hr-mapa-zonas" role="group" aria-label="Zonas de Lima">
          {zonas.map((z) => {
            const n = z.ubigeos.filter((u) => borrador.includes(u)).length;
            return (
              <button
                key={z.id}
                type="button"
                className="hr-mapa-zona"
                data-estado={n === z.ubigeos.length ? "todo" : n ? "parte" : undefined}
                aria-pressed={zonaFiltro === z.id}
                title={`Ver los ${z.ubigeos.length} distritos de ${z.etiqueta} (no los elige)`}
                onClick={() => setZonaFiltro(zonaFiltro === z.id ? null : z.id)}
              >
                <span>{z.etiqueta}</span>
                <b>{n ? `${n}/${z.ubigeos.length}` : z.ubigeos.length}</b>
              </button>
            );
          })}
        </div>
        <div className="hr-mapa-acciones">
          {/* Sólo sobre lo que se ve, con su número: nada se elige ni se quita a ciegas. */}
          <PulsoButton variant="secondary" size="sm" disabled={bloqueado || !filtrado || !visiblesFuera} title={filtrado ? undefined : "Filtra por zona o busca para agregar varios a la vez"} onClick={() => setBorrador(agregarVarios(borrador, visibles.map((t) => t.ubigeo)))}>
            <Plus size={13} aria-hidden /> {filtrado && visiblesFuera ? `Agregar ${visiblesFuera} visible${visiblesFuera === 1 ? "" : "s"}` : "Agregar visibles"}
          </PulsoButton>
          <PulsoButton variant="secondary" size="sm" disabled={bloqueado || !visiblesDentro} onClick={() => setBorrador(borrador.filter((u) => !visibles.some((t) => t.ubigeo === u)))}>
            <Minus size={13} aria-hidden /> {visiblesDentro ? `Quitar ${visiblesDentro} visible${visiblesDentro === 1 ? "" : "s"}` : "Quitar visibles"}
          </PulsoButton>
        </div>
      </div>
      <div className="hr-mapa-catalogo">
        {grupos
          .filter((g) => g.filas.length)
          .map((g) => (
            <section key={g.id} aria-label={g.etiqueta}>
              <h3>
                {g.etiqueta}
                <span>
                  {g.filas.filter((t) => borrador.includes(t.ubigeo)).length}/{g.filas.length}
                </span>
              </h3>
              <ul>
                {g.filas.map((t) => {
                  const enBorrador = borrador.includes(t.ubigeo);
                  const cambio = enBorrador !== confirmados.includes(t.ubigeo) ? (enBorrador ? "se agrega" : "se quita") : null;
                  return (
                    <li key={t.ubigeo} data-elegido={enBorrador} data-enfocado={distritoEnfocado === t.ubigeo || undefined}>
                      <span className="hr-mapa-catalogo-copia" role="button" tabIndex={0} title="Ver su ficha" onClick={() => setDistritoEnfocado(distritoEnfocado === t.ubigeo ? null : t.ubigeo)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setDistritoEnfocado(distritoEnfocado === t.ubigeo ? null : t.ubigeo))}>
                        <strong>{nombreDistrito(t.distrito)}</strong>
                        <small>
                          {cambio ? <em>{cambio} · </em> : null}
                          {enMiles(t.poblacion)} hab. · {fmt(t.manzanas)} <span className="hr-largo">manzanas</span><span className="hr-corto" aria-hidden="true">mz</span>
                        </small>
                      </span>
                      <PulsoSwitch
                        size="sm"
                        ariaLabel={`${enBorrador ? "Quitar" : "Agregar"} ${nombreDistrito(t.distrito)}`}
                        checked={enBorrador}
                        disabled={bloqueado}
                        onCheckedChange={() => setBorrador(alternar(borrador, t.ubigeo))}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        {!visibles.length ? <p className="hr-mapa-vacio">Ningún distrito coincide con «{busquedaDistrito}».</p> : null}
      </div>
    </>
  );
}

type InspectorProps = {
  territorios: readonly HojasRutaTerritory[];
  confirmados: readonly string[];
  bloqueado: boolean;
  guardando: boolean;
  onConfirmar: (ubigeos: string[]) => void;
  /** Viviendas por nivel NSE de las manzanas cargadas de lo elegido (gráfica de perfil). */
  viviendasPorNse?: Record<number, number> | null;
  /** `frame_meta` del estado: de dónde salen marco y cartografía (B27). */
  marcoMeta?: TerritorialFrameMeta | null;
};

export function TerritorioInspector({ territorios, confirmados, bloqueado, guardando, onConfirmar, viviendasPorNse = null, marcoMeta = null }: InspectorProps) {
  const { borrador: b, distritoBajoCursor, setBorrador } = useLienzoHojasRuta();
  const borrador = b ?? [...confirmados];
  const { agrega, quita, pendiente } = cambios(confirmados, borrador);
  const porUbigeo = useMemo(() => new Map(territorios.map((t) => [t.ubigeo, t])), [territorios]);
  const elegidos = borrador.map((u) => porUbigeo.get(u)).filter((t): t is HojasRutaTerritory => Boolean(t));
  const suma = (k: "poblacion" | "viviendas" | "manzanas") => elegidos.reduce((a, t) => a + t[k], 0);
  const marco = territorios.reduce((a, t) => a + t.poblacion, 0);
  const { distritoEnfocado, setDistritoEnfocado } = useLienzoHojasRuta();
  const enfocado = distritoEnfocado ? porUbigeo.get(distritoEnfocado) : undefined;
  const bajo = distritoBajoCursor && distritoBajoCursor !== distritoEnfocado ? porUbigeo.get(distritoBajoCursor) : undefined;
  const nombre = (u: string) => nombreDistrito(porUbigeo.get(u)?.distrito ?? u);

  return (
    <>
      <InspectorCabecera icono={MapPinned} sobre="Territorio" titulo={elegidos.length ? `${elegidos.length} distrito${elegidos.length === 1 ? "" : "s"} elegido${elegidos.length === 1 ? "" : "s"}` : "Elige los distritos del estudio"} />
      <div className="hr-mapa-ins-cuerpo">
        {!elegidos.length ? (
          <ol className="hr-mapa-pasos">
            <li>Haz clic en los distritos del mapa o actívalos en la lista</li>
            <li>Confirma la selección</li>
            <li>Sigue con Población</li>
          </ol>
        ) : (
          <>
            <h3 className="hr-mapa-subtitulo">Lo elegido</h3>
            <div className="hr-mapa-cifras">
              <div><small>Población</small><strong>{enMiles(suma("poblacion"))}</strong></div>
              <div><small>Viviendas</small><strong>{enMiles(suma("viviendas"))}</strong></div>
              <div><small>Manzanas</small><strong>{fmt(suma("manzanas"))}</strong></div>
            </div>
            <dl className="hr-mapa-filas">
              <div><dt>Del marco de Lima y Callao</dt><dd>{marco ? `${((suma("poblacion") / marco) * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })} %` : "—"}</dd></div>
              <div><dt>Viviendas por manzana</dt><dd>{suma("manzanas") ? (suma("viviendas") / suma("manzanas")).toLocaleString("es-PE", { maximumFractionDigits: 1 }) : "—"}</dd></div>
            </dl>
          </>
        )}
        {enfocado ? (
          <section className="hr-ter-ficha" aria-label={`Ficha de ${nombreDistrito(enfocado.distrito)}`}>
            <header className="hr-ter-ficha-cab">
              <div>
                <strong>{nombreDistrito(enfocado.distrito)}</strong>
                <small>{enfocado.provincia === "CALLAO" ? "Callao" : "Lima"} · {enfocado.ubigeo} · {borrador.includes(enfocado.ubigeo) ? "en el estudio" : "fuera del estudio"}</small>
              </div>
              <button type="button" className="hr-ter-cerrar" aria-label="Cerrar la ficha" onClick={() => setDistritoEnfocado(null)}><X size={14} /></button>
            </header>
            <dl className="hr-ter-ficha-cifras">
              <div><dt>Población</dt><dd>{enMiles(enfocado.poblacion)}</dd></div>
              <div><dt>Viviendas</dt><dd>{enMiles(enfocado.viviendas)}</dd></div>
              <div><dt>Manzanas</dt><dd>{fmt(enfocado.manzanas)}</dd></div>
            </dl>
            <p className="hr-ter-ficha-nota">
              {marco ? `${((enfocado.poblacion / marco) * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })} % del marco de Lima y Callao` : null}
              {enfocado.manzanas ? ` · ${(enfocado.viviendas / enfocado.manzanas).toLocaleString("es-PE", { maximumFractionDigits: 1 })} viviendas por manzana` : null}
            </p>
            <PulsoButton variant="secondary" size="sm" disabled={bloqueado} onClick={() => setBorrador(alternar(borrador, enfocado.ubigeo))}>
              {borrador.includes(enfocado.ubigeo) ? "Quitar del estudio" : "Agregar al estudio"}
            </PulsoButton>
          </section>
        ) : null}
        {bajo ? (
          <dl className="hr-mapa-filas" aria-label="Distrito bajo el cursor">
            <div><dt>{nombreDistrito(bajo.distrito)}</dt><dd>{bajo.ubigeo}</dd></div>
            <div><dt>Población 2017</dt><dd>{fmt(bajo.poblacion)}</dd></div>
            <div><dt>Viviendas</dt><dd>{fmt(bajo.viviendas)}</dd></div>
            <div><dt>Manzanas censales</dt><dd>{fmt(bajo.manzanas)}</dd></div>
          </dl>
        ) : null}
        <MarcoTerritorial meta={marcoMeta} />
        {pendiente ? (
          <section className="hr-mapa-cambios" aria-label="Cambios sin confirmar">
            <h3>Cambios sin confirmar</h3>
            <div className="hr-mapa-chips">
              {agrega.map((u) => <span key={u} className="hr-mapa-chip" data-tipo="agrega">+ {nombre(u)}</span>)}
              {quita.map((u) => <span key={u} className="hr-mapa-chip" data-tipo="quita">− {nombre(u)}</span>)}
            </div>
            {confirmados.length ? <p className="hr-mapa-aviso">Al confirmar se recalculan la población, la muestra y las cuotas, y se descarta el sorteo actual.</p> : null}
          </section>
        ) : null}
        <TerritorioGraficos elegidos={elegidos} confirmados={confirmados} viviendasPorNse={viviendasPorNse} />
        <dl className="hr-mapa-filas" aria-label="Marco territorial">
          <div><dt>Cobertura</dt><dd>Lima y Callao · {territorios.length} distritos</dd></div>
          <div><dt>Manzanas</dt><dd>INEI 2017</dd></div>
        </dl>
        {bloqueado ? <p className="hr-mapa-aviso">El piloto es histórico: su territorio no se cambia.</p> : null}
      </div>
      <footer className="hr-mapa-pie">
        <PulsoButton variant="secondary" disabled={!pendiente || guardando} onClick={() => setBorrador(null)}>
          Deshacer
        </PulsoButton>
        <PulsoButton variant="primary" disabled={!pendiente || !borrador.length || bloqueado || guardando} onClick={() => onConfirmar(borrador)}>
          {guardando ? "Confirmando…" : "Confirmar selección"}
        </PulsoButton>
      </footer>
    </>
  );
}

/**
 * Marco territorial (brecha B27): cobertura, año del marco de manzanas y año de la
 * cartografía de cada provincia, tal como los declara el motor en `frame_meta`.
 */
function MarcoTerritorial({ meta }: { meta: TerritorialFrameMeta | null }) {
  if (!meta) return null;
  const fuentes = meta.block_cartography?.sources ?? {};
  const cartografia = (["lima", "callao"] as const)
    .map((k) => (fuentes[k]?.year ? `${k === "lima" ? "Lima" : "Callao"} ${fuentes[k].year}` : ""))
    .filter(Boolean)
    .join(" · ");
  return (
    <section className="hr-muestra-grupo" aria-label="Marco territorial">
      <h3>Marco territorial</h3>
      <dl className="hr-mapa-filas">
        <div><dt>Cobertura</dt><dd>{meta.coverage || "—"}{meta.n_distritos ? ` · ${meta.n_distritos} distritos` : ""}</dd></div>
        <div><dt>Manzanas</dt><dd>INEI {meta.year || "—"}</dd></div>
        <div><dt>Cartografía</dt><dd>{cartografia || "—"}</dd></div>
      </dl>
    </section>
  );
}
