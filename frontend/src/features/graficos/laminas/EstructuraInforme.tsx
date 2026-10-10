// Columna izquierda de la pestaña Láminas: el informe como documento (F6.1; dirección F6 §4.1 «Estructura»).
// Sólo lectura en esta parte: seleccionar escribe `foco=l-NN`. Insertar, reordenar y arrastrar llegan en la parte 2;
// mientras tanto siguen en el Editor anterior.

import { useEffect, useMemo, useRef } from "react";
import { ChevronRight, PanelLeftClose, Search } from "../../../vendor/lucide-react";
import { IconoTipo } from "../iconos/IconoTipo";
import {
  contarLaminas,
  filtrarEstructura,
  type EstructuraInforme as Estructura,
  type LaminaEnEstructura,
  type NodoEstructura,
} from "./modeloEstructura";
import { ETIQUETA_ESTADO } from "./estadoLamina";
import { useLaminasUi, type ResumenLamina } from "./laminasStore";
import "./estructuraInforme.css";

export type MarcaValidacion = "error" | "warning";

type Props = {
  estructura: Estructura;
  posicionActiva: number | null;
  onSeleccionar: (posicion: number) => void;
  /** Incidencias del validador del plan por id de lámina (las mismas reglas que bloquean exportar). */
  validacion: Record<string, MarcaValidacion>;
};

export function EstructuraInforme({ estructura, posicionActiva, onSeleccionar, validacion }: Props) {
  const consulta = useLaminasUi((s) => s.consulta);
  const setConsulta = useLaminasUi((s) => s.setConsulta);
  const cerrados = useLaminasUi((s) => s.cerrados);
  const alternarNodo = useLaminasUi((s) => s.alternarNodo);
  const fijarCerrados = useLaminasUi((s) => s.fijarCerrados);
  const resumenes = useLaminasUi((s) => s.resumenes);
  const alternarEstructura = useLaminasUi((s) => s.alternarEstructura);
  const busquedaRef = useRef<HTMLInputElement>(null);
  const cuerpoRef = useRef<HTMLElement>(null);

  // La lámina activa siempre a la vista en el árbol (al abrir por enlace o al avanzar con las flechas del visor).
  useEffect(() => {
    if (!posicionActiva) return;
    const fila = cuerpoRef.current?.querySelector<HTMLElement>(`[data-foco-lamina="${posicionActiva}"]`);
    fila?.scrollIntoView({ block: "nearest" });
  }, [posicionActiva]);

  const nodos = useMemo(() => filtrarEstructura(estructura, consulta), [estructura, consulta]);
  const plegables = useMemo(() => estructura.nodos.map((n) => n.id), [estructura]);
  const todoCerrado = plegables.length > 0 && plegables.every((id) => cerrados[id]);
  const buscando = consulta.trim() !== "";

  const fila = (l: LaminaEnEstructura, sangria: 0 | 1 | 2) => (
    <FilaLamina
      key={l.id}
      lamina={l}
      activa={l.posicion === posicionActiva}
      sangria={sangria}
      resumen={resumenes[l.id]}
      validacion={validacion[l.id]}
      onSeleccionar={onSeleccionar}
    />
  );

  return (
    <aside className="pulso-f6-estructura" aria-label="Estructura del informe">
      <header className="pulso-f6-col-head">
        <h2>Estructura</h2>
        <span className="pulso-f6-col-meta">{estructura.laminas.length} láminas</span>
        <span className="pulso-f6-col-sp" />
        <button
          type="button"
          className="pulso-f6-texto-boton"
          onClick={() => fijarCerrados(todoCerrado ? [] : plegables)}
          disabled={!plegables.length}
        >
          {todoCerrado ? "Abrir todo" : "Cerrar todo"}
        </button>
        <button
          type="button"
          className="pulso-f6-icono-boton pulso-f6-solo-ancho"
          aria-label="Ocultar la estructura"
          title="Ocultar la estructura: la lámina gana su ancho"
          onClick={alternarEstructura}
        >
          <PanelLeftClose size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="pulso-f6-estructura-busca">
        <label className="pulso-f6-busca">
          <Search size={14} aria-hidden="true" />
          <span className="pulso-sr-only">Buscar lámina</span>
          <input
            ref={busquedaRef}
            type="search"
            value={consulta}
            placeholder="Buscar lámina…"
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setConsulta(""); }}
          />
        </label>
      </div>
      <nav ref={cuerpoRef} className="pulso-f6-estructura-cuerpo" aria-label="Láminas del informe" data-qa-scroll-owner="estructura">
        {estructura.laminas.length === 0 ? (
          <p className="pulso-f6-vacio-col">El informe todavía no tiene láminas. Agrégalas desde el Editor anterior.</p>
        ) : nodos.length === 0 ? (
          <p className="pulso-f6-vacio-col">Ninguna lámina coincide con «{consulta.trim()}».</p>
        ) : (
          <ul className="pulso-f6-arbol" data-qa-geometry-group="graficos/f6-estructura-nodos" data-qa-geometry-contract="intrinsic">
            {nodos.map((nodo) => (
              <NodoArbol
                key={nodo.id}
                nodo={nodo}
                abierto={buscando || !cerrados[nodo.id]}
                onAlternar={() => alternarNodo(nodo.id)}
                fila={fila}
              />
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}

function NodoArbol({ nodo, abierto, onAlternar, fila }: {
  nodo: NodoEstructura;
  abierto: boolean;
  onAlternar: () => void;
  fila: (l: LaminaEnEstructura, sangria: 0 | 1 | 2) => JSX.Element;
}) {
  const idHijos = `pulso-f6-nodo-${nodo.id}`;
  return (
    <li className={`pulso-f6-nodo is-${nodo.clase}${abierto ? " is-abierto" : ""}`}>
      <button
        type="button"
        className="pulso-f6-nodo-cabeza"
        aria-expanded={abierto}
        aria-controls={idHijos}
        onClick={onAlternar}
      >
        <ChevronRight size={14} aria-hidden="true" className="pulso-f6-nodo-chevron" />
        {nodo.clase === "capitulo" && <span className="pulso-f6-num">{nodo.numero}</span>}
        <span className="pulso-f6-nodo-titulo">{nodo.titulo}</span>
        <span className="pulso-f6-nodo-cuenta" aria-label={`${contarLaminas(nodo)} láminas`}>{contarLaminas(nodo)}</span>
      </button>
      {abierto && (
        <div id={idHijos} className="pulso-f6-nodo-hijos">
          {/* Filas de lámina: marco fijo de 44 px (C2), sea cual sea el título. */}
          <ul className="pulso-f6-filas" data-qa-geometry-group="graficos/f6-estructura-filas" data-qa-geometry-contract="equal">
            {nodo.clase === "bloque"
              ? nodo.laminas.map((l) => fila(l, 0))
              : [fila(nodo.separador, 1), ...nodo.laminas.map((l) => fila(l, 1))]}
          </ul>
          {nodo.clase === "capitulo" && nodo.subcapitulos.length > 0 && (
            <ul className="pulso-f6-filas" data-qa-geometry-group="graficos/f6-estructura-subcapitulos" data-qa-geometry-contract="intrinsic">
              {nodo.subcapitulos.map((s) => (
                <li key={s.id} className="pulso-f6-sub">
                  <div className="pulso-f6-sub-cabeza">
                    <span className="pulso-f6-num">{s.numero}</span>
                    <span className="pulso-f6-nodo-titulo">{s.titulo}</span>
                    <span className="pulso-f6-nodo-cuenta">{1 + s.laminas.length}</span>
                  </div>
                  <ul className="pulso-f6-filas pulso-f6-sub-filas" data-qa-geometry-group="graficos/f6-estructura-filas-sub" data-qa-geometry-contract="equal">
                    {fila(s.separador, 2)}
                    {s.laminas.map((l) => fila(l, 2))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function FilaLamina({ lamina, activa, sangria, resumen, validacion, onSeleccionar }: {
  lamina: LaminaEnEstructura;
  activa: boolean;
  sangria: 0 | 1 | 2;
  resumen: ResumenLamina | undefined;
  validacion: MarcaValidacion | undefined;
  onSeleccionar: (posicion: number) => void;
}) {
  const punto = puntoDeEstado(resumen, validacion);
  // El conteo de gráficos sólo aparece cuando dice algo: ranuras vacías.
  const detalle = lamina.ranuras > 0 && lamina.ranurasLlenas < lamina.ranuras
    ? `${lamina.tipoLabel} · ${lamina.ranurasLlenas} de ${lamina.ranuras} con gráfico`
    : lamina.tipoLabel;
  return (
    <li>
      <button
        type="button"
        className={`pulso-f6-lamina is-sangria-${sangria}${activa ? " is-activa" : ""}`}
        aria-current={activa ? "true" : undefined}
        aria-label={`Lámina ${lamina.posicion}: ${lamina.titulo}. ${detalle}. ${punto.texto}`}
        data-foco-lamina={lamina.posicion}
        onClick={() => onSeleccionar(lamina.posicion)}
      >
        <span className="pulso-f6-lamina-pos" aria-hidden="true">{lamina.posicion}</span>
        <span className="pulso-f6-lamina-tipo">
          <IconoTipo clase="lamina" tipo={lamina.tipo} size={20} />
        </span>
        <span className="pulso-f6-lamina-texto">
          <span className="pulso-f6-lamina-titulo">{lamina.titulo}</span>
          <span className="pulso-f6-lamina-detalle">{detalle}</span>
        </span>
        {resumen && resumen.partes > 1 && (
          <span className="pulso-f6-lamina-partes" aria-hidden="true">×{resumen.partes}</span>
        )}
        <span className={`pulso-f6-punto is-${punto.clase}`} title={punto.texto} aria-hidden="true" />
      </button>
    </li>
  );
}

function puntoDeEstado(resumen: ResumenLamina | undefined, validacion: MarcaValidacion | undefined): { clase: string; texto: string } {
  if (validacion === "error") return { clase: "error", texto: "Tiene un problema que bloquea exportar" };
  if (resumen?.estado === "ruta_anterior") return { clase: "ruta-anterior", texto: "Sale por la ruta anterior" };
  if (validacion === "warning" || (resumen && resumen.avisos > 0)) return { clase: "aviso", texto: "Tiene avisos" };
  if (resumen?.estado) return { clase: resumen.estado === "sin_grafico" ? "sin-grafico" : "nativa", texto: ETIQUETA_ESTADO[resumen.estado] };
  return { clase: "sin-ver", texto: "Estado por conocer: se sabe al generar su vista" };
}
