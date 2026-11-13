import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Search } from "../../../../vendor/lucide-react";
import { PulsoInput } from "../../../../components/PulsoInput";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { ExploradorSeccion, ExploradorVariable } from "../../types";
import { ID_BUSCADOR_DE_PREGUNTAS, ID_LUPA_DE_PREGUNTAS } from "./AccionesDeLaLista";
import ChipsTipo from "./ChipsTipo";
import { conteoDeLasCoincidencias, rotuloDeSeccion, seccionDe, seccionesVisibles } from "./listaDePreguntasModelo";
import { useEstadoDeLaLista, useListaDePreguntasStore } from "./listaDePreguntasStore";
import {
  TIPO_ETIQUETA,
  TIPO_TONO,
  UMBRAL_COMPLETITUD,
  completitud,
  type FamiliaTipo,
} from "./tiposVariable";

/**
 * La lista de preguntas de Explorar (prototipo `validacion-explorar`, panel
 * "Preguntas"): el buscador que abre la lupa de la cabecera, chips de tipo con
 * su conteo y, por sección, un contenedor plegable con cada pregunta: su texto
 * arriba, el código debajo con el punto de su tipo y la completitud en una
 * barra a todo el ancho.
 *
 * Las secciones se pliegan a pedido de Gonzalo (ítem 38, 12 nov 2026); el
 * porqué está en `sinAcordeones.contract.test.ts`. Al buscar se abren las que
 * tienen coincidencias y la de la pregunta elegida se abre al elegirla.
 */
export default function ListaDePreguntas({
  base,
  secciones,
  elegida,
  onElegir,
  repeatCode = null,
  repeatLabel = null,
}: {
  /** Clave del estado de la lista (la base explorada). */
  base: string;
  secciones: ExploradorSeccion[];
  elegida: string | null;
  onElegir: (v: ExploradorVariable) => void;
  repeatCode?: string | null;
  repeatLabel?: string | null;
}) {
  const { buscando, consulta, plegadas } = useEstadoDeLaLista(base);
  const buscar = useListaDePreguntasStore((s) => s.buscar);
  const cerrarBuscador = useListaDePreguntasStore((s) => s.cerrarBuscador);
  const alternar = useListaDePreguntasStore((s) => s.alternar);
  const abrir = useListaDePreguntasStore((s) => s.abrir);
  const [familia, setFamilia] = useState<FamiliaTipo>("todas");
  const listaId = useId();
  const listaRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);

  const consultaActiva = buscando ? consulta : "";
  // Con la búsqueda escrita, cada chip cuenta las coincidencias de su tipo, no las de toda la base.
  const conteo = useMemo(() => conteoDeLasCoincidencias(secciones, consultaActiva), [secciones, consultaActiva]);
  const visibles = useMemo(() => seccionesVisibles(secciones, consultaActiva, familia), [secciones, consultaActiva, familia]);
  const nVisibles = visibles.reduce((t, s) => t + s.variables.length, 0);
  const cerradas = useMemo(() => new Set(plegadas), [plegadas]);

  // La sección de la pregunta elegida se abre al elegirla (también al llegar con `foco` en la dirección).
  const seccionElegida = useMemo(() => seccionDe(secciones, elegida), [secciones, elegida]);
  useEffect(() => {
    if (seccionElegida) abrir(base, [seccionElegida]);
  }, [abrir, base, seccionElegida]);

  // La pregunta elegida se trae a la vista dentro de la lista, sin mover lo que ya se ve.
  useEffect(() => {
    if (!elegida) return;
    const filas = listaRef.current?.querySelectorAll<HTMLElement>("[data-pregunta]") ?? [];
    const fila = Array.from(filas).find((f) => f.dataset.pregunta === elegida);
    if (fila && typeof fila.scrollIntoView === "function") fila.scrollIntoView({ block: "nearest" });
  }, [elegida, seccionElegida]);

  useEffect(() => {
    if (buscando) campoRef.current?.focus();
  }, [buscando]);

  const cerrar = () => {
    cerrarBuscador(base);
    document.getElementById(ID_LUPA_DE_PREGUNTAS)?.focus();
  };

  const alEscribir = (texto: string) => {
    buscar(base, texto, seccionesVisibles(secciones, texto, familia).map((s) => s.nombre));
    // Las coincidencias se leen desde la primera: el cuerpo vuelve arriba.
    listaRef.current?.closest(".pulso-panel-de-mesa-cuerpo")?.scrollTo?.({ top: 0 });
  };

  const textoBuscado = consultaActiva.trim();

  return (
    <div className="vx-preguntas">
      {buscando && (
        <div className="vx-busca">
          <span className="vx-busca-campo">
            <Search size={14} aria-hidden />
            <PulsoInput
              ref={campoRef}
              id={ID_BUSCADOR_DE_PREGUNTAS}
              size="sm"
              type="search"
              aria-label="Buscar preguntas"
              aria-controls={listaId}
              placeholder="Código o texto de la pregunta"
              value={consulta}
              onChange={(e) => alEscribir(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  cerrar();
                }
              }}
            />
          </span>
          {textoBuscado && (
            <span className="vx-busca-conteo" role="status">
              {nVisibles === 1 ? "1 coincidencia" : `${formatoConteo(nVisibles)} coincidencias`}
            </span>
          )}
        </div>
      )}
      <ChipsTipo valor={familia} conteo={conteo} onCambio={setFamilia} etiqueta="Filtrar la lista por tipo" />
      <div
        className="vx-preguntas-lista"
        id={listaId}
        ref={listaRef}
        data-qa-geometry-group="validacion/explorar-secciones"
        data-qa-geometry-contract="intrinsic"
      >
        {visibles.length === 0 && (
          <p role="status" className="vx-barra-nota">
            {!secciones.length
              ? "Sin preguntas en esta base."
              : textoBuscado
                ? `Ninguna pregunta coincide con "${textoBuscado}".`
                : "Ninguna pregunta de este tipo."}
          </p>
        )}
        {visibles.map((sec, i) => (
          <SeccionDePreguntas
            key={sec.nombre}
            id={`${listaId}-seccion-${i}`}
            seccion={sec}
            abierta={!cerradas.has(sec.nombre)}
            onAlternar={() => alternar(base, sec.nombre)}
          >
            {sec.variables.map((v) => (
              <li key={v.name}>
                <FilaPregunta
                  v={v}
                  elegida={v.name === elegida}
                  onClick={() => onElegir(v)}
                  especifica={v.repeat_scope === "conditional" ? (repeatCode && repeatLabel ? `Variable específica de ${repeatLabel}` : "Variable condicional según el servicio") : null}
                />
              </li>
            ))}
          </SeccionDePreguntas>
        ))}
      </div>
    </div>
  );
}

function SeccionDePreguntas({
  id,
  seccion,
  abierta,
  onAlternar,
  children,
}: {
  id: string;
  seccion: ExploradorSeccion;
  abierta: boolean;
  onAlternar: () => void;
  children: ReactNode;
}) {
  const rotulo = rotuloDeSeccion(seccion);
  const n = seccion.variables.length;
  return (
    <section className="vx-preguntas-seccion" data-abierta={abierta ? "true" : "false"} aria-labelledby={`${id}-cab`}>
      <h5 className="vx-preguntas-grupo">
        <button type="button" id={`${id}-cab`} aria-expanded={abierta} aria-controls={`${id}-lista`} onClick={onAlternar} title={rotulo.texto}>
          <ChevronRight size={14} className="vx-preguntas-grupo-chevron" aria-hidden />
          {rotulo.esIdentificador ? (
            <code className="vx-preguntas-grupo-nombre is-id">{rotulo.texto}</code>
          ) : (
            <span className="vx-preguntas-grupo-nombre">{rotulo.texto}</span>
          )}
          <span className="vx-preguntas-grupo-conteo">
            {formatoConteo(n)}
            <span className="pulso-sr-only">{n === 1 ? " pregunta" : " preguntas"}</span>
          </span>
        </button>
      </h5>
      <ul id={`${id}-lista`} hidden={!abierta} aria-labelledby={`${id}-cab`} data-qa-geometry-group="validacion/explorar-preguntas" data-qa-geometry-contract="intrinsic">
        {children}
      </ul>
    </section>
  );
}

function FilaPregunta({
  v,
  elegida,
  onClick,
  especifica,
}: {
  v: ExploradorVariable;
  elegida: boolean;
  onClick: () => void;
  especifica: string | null;
}) {
  const frac = completitud(v);
  const pct = frac === null ? null : Math.round(frac * 100);
  const baja = frac !== null && frac < UMBRAL_COMPLETITUD;
  const texto = v.label || v.name;
  const tipo = TIPO_ETIQUETA[v.tipo] ?? TIPO_ETIQUETA.mixto;
  return (
    <button type="button" className="vx-pregunta-fila" data-pregunta={v.name} aria-current={elegida ? "true" : undefined} onClick={onClick} title={texto}>
      <b>{texto}</b>
      {pct !== null && <em>{pct} %</em>}
      <span className="vx-pregunta-codigo">
        <i className="vx-tp" data-tono={TIPO_TONO[v.tipo]} title={tipo.larga} aria-label={tipo.larga} role="img" />
        {texto !== v.name ? <code>{v.name}</code> : <span>{tipo.larga}</span>}
        {especifica && <span className="pulso-variable-repeat-scope" title={especifica}>Específica</span>}
      </span>
      {pct !== null && (
        <span className={`vx-pregunta-av${baja ? " is-baja" : ""}`} aria-label={`${pct} % de casos con dato`} role="img">
          <i style={{ width: `${pct}%` }} />
        </span>
      )}
    </button>
  );
}
