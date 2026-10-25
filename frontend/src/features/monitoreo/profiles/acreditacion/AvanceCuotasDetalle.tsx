import { useId, useMemo, useState } from "react";

import type { MonitoreoCuota } from "../../../../api/monitoreoCuotas";
import { PulsoButton } from "../../../../components/PulsoButton";
import { Pencil, Search } from "../../../../vendor/lucide-react";
import {
  barraDeCategoria,
  categoriasVisibles,
  cifra,
  conBase,
  ESTADO_CATEGORIA,
  ORDENES_CATEGORIAS,
  type OrdenCategorias,
  porcentaje,
  restoDeCategoria,
  resumenCuota,
} from "./avanceCuotasModelo";
import { clasePublico, type PaletaDePublicos } from "./paletaPublicos";

// Detalle de una cuota: una barra tipo bullet por categoría (efectivas, marca
// de la meta), su cifra «efectivas / meta», lo que falta y la tasa sobre el
// universo de la categoría. El color dice el estado. La lista va completa —una
// variable puede traer ~150 categorías—, con filtro por texto y orden por
// brecha, universo o nombre; el panel es el único dueño del scroll y la barra
// de herramientas queda fija arriba mientras se recorre.

const UMBRAL_FILTRO = 8;

export function AvanceCuotasDetalle({
  cuota,
  paleta,
  onEditar,
}: {
  cuota: MonitoreoCuota;
  paleta: PaletaDePublicos;
  /** Sin él no hay botón: en Avance › Por cuota la franja ya lleva «Editar en Modelo». */
  onEditar?: (id: string) => void;
}) {
  const ids = useId();
  const [orden, setOrden] = useState<OrdenCategorias>("brecha");
  const [filtro, setFiltro] = useState("");
  const filas = useMemo(() => categoriasVisibles(cuota.categorias, orden, filtro), [cuota.categorias, orden, filtro]);
  const r = resumenCuota(cuota);
  const conMeta = cuota.categorias.filter((c) => (c.meta ?? 0) > 0).length;

  return (
    <section className={`mon-cuotas-detalle ${clasePublico(paleta, cuota.actor)}`} aria-labelledby={`${ids}-t`}>
      <header className="mon-cuotas-detalle-cabeza">
        <div className="mon-cuotas-detalle-titulo">
          <span className="mon-cuotas-versalita"><i className="mon-publico-punto" aria-hidden /> {cuota.actor}</span>
          <h3 id={`${ids}-t`}>{cuota.variable}</h3>
          {/* Una cifra por pieza; cobertura y personas sin dato, en el tooltip. */}
          <p title={[r.cobertura, cuota.sin_dato ? `${cifra(cuota.sin_dato)} personas sin dato en la base` : ""].filter(Boolean).join(". ")}>
            <span className={`mon-cuotas-chip es-${r.tono}`}>{r.meta > 0 ? porcentaje(r.avance) : "Sin metas"}</span>
            {r.meta > 0 ? <span>{`${cifra(r.efectivas)} de ${cifra(r.meta)}`}</span> : null}
            <span className="mon-cuotas-chip">{r.cumplidas}</span>
          </p>
        </div>
        {onEditar ? (
          <PulsoButton variant="secondary" size="sm" onClick={() => onEditar(cuota.id)}>
            <Pencil size={14} aria-hidden /> Editar metas
          </PulsoButton>
        ) : null}
      </header>

      <div className="mon-cuotas-herramientas" role="toolbar" aria-label={`Categorías de ${cuota.variable}`}>
        {cuota.categorias.length > UMBRAL_FILTRO ? (
          <label className="mon-cuotas-buscar">
            <Search size={14} aria-hidden />
            <span className="pulso-sr-only">Filtrar categorías</span>
            <input
              type="search"
              value={filtro}
              placeholder={`Filtrar ${cifra(cuota.categorias.length)} categorías`}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </label>
        ) : null}
        <div className="mon-cuotas-orden" role="group" aria-label="Ordenar categorías">
          <span className="mon-cuotas-orden-rotulo" aria-hidden>Ordenar</span>
          {ORDENES_CATEGORIAS.map((o) => (
            <button key={o.valor} type="button" aria-pressed={orden === o.valor} onClick={() => setOrden(o.valor)}>
              {o.etiqueta}
            </button>
          ))}
        </div>
        <span className="mon-cuotas-cuenta" aria-live="polite" title={`${cifra(conMeta)} con meta`}>
          {filtro ? `${cifra(filas.length)} de ${cifra(cuota.categorias.length)}` : `${cifra(cuota.categorias.length)} ${cuota.categorias.length === 1 ? "categoría" : "categorías"}`}
        </span>
      </div>

      {filas.length ? (
        <ol className="mon-cuotas-categorias" data-qa-geometry-group="monitoreo/acreditacion/avance/cuotas/categorias" data-qa-geometry-contract="equal">
          {filas.map((c) => {
            const b = barraDeCategoria(c);
            return (
              <li key={c.categoria} className={`mon-cuotas-categoria es-${c.estado}`}>
                <span className="mon-cuotas-categoria-nombre" title={c.categoria}>{c.categoria}</span>
                <span
                  className="mon-cuotas-bullet"
                  role="img"
                  aria-label={`${c.categoria}: ${cifra(c.efectivas)} de ${cifra(c.meta)} (${ESTADO_CATEGORIA[c.estado].etiqueta}); ${restoDeCategoria(c)}`}
                >
                  <i className={`mon-cuotas-bullet-relleno${b.pasada ? " es-pasada" : ""}`} style={{ inlineSize: `${b.relleno}%` }} />
                  {b.marca != null ? <i className="mon-cuotas-bullet-meta" style={{ insetInlineStart: `${b.marca}%` }} /> : null}
                </span>
                <span className="mon-cuotas-categoria-cifras">
                  <span className="mon-cuotas-categoria-fraccion">
                    <strong>{cifra(c.efectivas)}</strong>
                    <span> / {(c.meta ?? 0) > 0 ? cifra(c.meta) : "—"}</span>
                  </span>
                  <em className="mon-cuotas-resto">{restoDeCategoria(c)}</em>
                  <small title={`${conBase(c.efectivas, c.universo)} en la base`}>
                    {(c.meta ?? 0) > 0 ? `${porcentaje(c.avance)} de la meta` : `${porcentaje(c.universo ? (c.efectivas ?? 0) / c.universo : null)} de la base`}
                  </small>
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mon-cuotas-sin-coincidencias" role="status">Ninguna categoría contiene «{filtro}».</p>
      )}

      {/* Leyenda centrada, bajo lo que lee. */}
      <ul className="mon-cuotas-leyenda" aria-label="Estados">
        {(["cumplida", "en_curso", "sin_avance"] as const).map((e) => (
          <li key={e} className={`es-${e}`}><i aria-hidden />{ESTADO_CATEGORIA[e].etiqueta}</li>
        ))}
        <li className="es-meta"><i aria-hidden />Meta</li>
      </ul>
    </section>
  );
}
