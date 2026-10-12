// Identidad › Colores de las respuestas (P1–P7). Una fila a todo el ancho por paleta: las preguntas que comparten
// respuestas se pintan juntas, la paleta puede llevar un nombre propio («Satisfacción») y juntar otros grupos con las
// mismas respuestas; ese nombre es el que se elige luego desde la tarjeta de un gráfico. Se pinta con combinaciones y
// muestras de la marca; el código de color queda como «Otro color». Lo que se elige aquí es lo que pintan PPT y Word.

import { useId, useMemo, useState } from "react";
import { PulsoButton } from "../../../components/PulsoButton";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../../components/States";
import { Check, ChevronDown, Palette, Search } from "../../../vendor/lucide-react";
import { usePlanStore } from "../store";
import { usePaletasRespuestas } from "./usePaletasRespuestas";
import { combinacionesPara, grupoCoincide, MUESTRAS_MARCA, textoSobre } from "./modeloColoresRespuestas";
import {
  conAgrupado,
  conColoresDeFila,
  conNombre,
  conSeparado,
  errorNombre,
  respuestasEnComun,
  type FilaPaleta,
} from "./modeloPaletasConNombre";
import "./coloresRespuestas.css";

type Filtro = "todos" | "faltan" | "listos";
type Mapas = { paletas: Record<string, Record<string, string>>; vinculos: Record<string, string> };

const lleno = (f: FilaPaleta) => f.faltan === 0;

function Punto({ color }: { color?: string }) {
  return <span className={color ? "pulso-cr-punto" : "pulso-cr-punto is-vacio"} style={color ? { background: color } : undefined} aria-hidden="true" />;
}

function Estado({ fila }: { fila: FilaPaleta }) {
  if (lleno(fila)) return <span className="pulso-cr-estado is-completo"><Check size={12} aria-hidden="true" />Lista</span>;
  if (fila.faltan < fila.opciones.length) return <span className="pulso-cr-estado is-faltan">Faltan {fila.faltan} {fila.faltan === 1 ? "color" : "colores"}</span>;
  return <span className="pulso-cr-estado is-vacio">Sin colores</span>;
}

function CampoNombre({ fila, error, onGuardar }: { fila: FilaPaleta; error: (n: string) => string | null; onGuardar: (n: string) => void }) {
  const id = useId();
  const [borrador, setBorrador] = useState(fila.clave ?? "");
  const problema = borrador.trim() && borrador.trim() !== fila.clave ? error(borrador) : null;
  const guardar = () => {
    if (!borrador.trim() || borrador.trim() === fila.clave || problema) return;
    onGuardar(borrador.trim());
  };
  return (
    <div className="pulso-cr-nombre">
      <label htmlFor={id} className="pulso-cr-editor-rotulo">Nombre de la paleta</label>
      <div className="pulso-cr-nombre-fila">
        <input
          id={id}
          className="pulso-cr-input"
          value={borrador}
          placeholder={fila.nombre}
          aria-invalid={problema ? true : undefined}
          onChange={(e) => setBorrador(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") guardar(); if (e.key === "Escape") setBorrador(fila.clave ?? ""); }}
        />
        <PulsoButton variant="secondary" size="sm" onClick={guardar} disabled={!borrador.trim() || borrador.trim() === fila.clave || Boolean(problema)}>
          {fila.clave ? "Renombrar" : "Guardar nombre"}
        </PulsoButton>
      </div>
      <p className={problema ? "pulso-cr-ayuda is-error" : "pulso-cr-ayuda"} role={problema ? "alert" : undefined}>
        {problema ?? "Con nombre, la paleta se puede elegir desde cualquier gráfico."}
      </p>
    </div>
  );
}

function Pintor({ fila, onPintar }: { fila: FilaPaleta; onPintar: (c: Record<string, string | null>) => void }) {
  const [activa, setActiva] = useState<string | null>(fila.opciones.find((o) => !fila.colores[o]) ?? fila.opciones[0] ?? null);
  const combinaciones = useMemo(() => combinacionesPara(fila.opciones), [fila.opciones]);
  const otroId = useId();
  const color = activa ? fila.colores[activa] : undefined;
  return (
    <>
      <div className="pulso-cr-editor-bloque">
        <p className="pulso-cr-editor-rotulo">Combinaciones de la marca</p>
        <div className="pulso-cr-combos">
          {combinaciones.map((c) => {
            const aplicada = fila.opciones.every((o) => fila.colores[o]?.toLowerCase() === c.colores[o]?.toLowerCase());
            return (
              <button key={c.nombre} type="button" className={aplicada ? "pulso-cr-combo is-aplicada" : "pulso-cr-combo"} aria-pressed={aplicada} onClick={() => onPintar(c.colores)}>
                <span className="pulso-cr-combo-tira" aria-hidden="true">{fila.opciones.map((o) => <span key={o} style={{ background: c.colores[o] }} />)}</span>
                <span className="pulso-cr-combo-nombre">{c.nombre}</span>
                {aplicada ? <Check size={14} aria-hidden="true" className="pulso-cr-combo-check" /> : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="pulso-cr-editor-bloque">
        <p className="pulso-cr-editor-rotulo">Cada respuesta</p>
        <ul className="pulso-cr-opciones">
          {fila.opciones.map((o) => (
            <li key={o}>
              <button type="button" className={o === activa ? "pulso-cr-opcion is-activa" : "pulso-cr-opcion"} aria-pressed={o === activa} onClick={() => setActiva(o)}>
                <Punto color={fila.colores[o]} />
                <span>{o}</span>
                {fila.colores[o] ? null : <span className="pulso-cr-opcion-falta">sin color</span>}
              </button>
            </li>
          ))}
        </ul>
        {activa ? (
          <div className="pulso-cr-muestras" role="group" aria-label={`Color para «${activa}»`}>
            {MUESTRAS_MARCA.map((m) => {
              const elegida = color?.toLowerCase() === m.hex.toLowerCase();
              return (
                <button key={m.hex} type="button" className={elegida ? "pulso-cr-muestra is-elegida" : "pulso-cr-muestra"} style={{ background: m.hex }} title={m.nombre} aria-label={m.nombre} aria-pressed={elegida} onClick={() => onPintar({ [activa]: m.hex })}>
                  {elegida ? <Check size={14} aria-hidden="true" /> : null}
                </button>
              );
            })}
            <label className="pulso-cr-otro" htmlFor={otroId}>
              <input id={otroId} type="color" value={color ?? "#bfbfbf"} onChange={(e) => onPintar({ [activa]: e.target.value.toUpperCase() })} />
              Otro color
            </label>
          </div>
        ) : null}
      </div>
    </>
  );
}

function Agrupar({ fila, filas, onAgrupar }: { fila: FilaPaleta; filas: readonly FilaPaleta[]; onAgrupar: (destino: FilaPaleta) => void }) {
  const candidatas = filas
    .filter((f) => f !== fila)
    .map((f) => ({ f, comun: respuestasEnComun(fila, f) }))
    .filter((x) => x.comun > 0)
    .sort((a, b) => Number(Boolean(b.f.clave)) - Number(Boolean(a.f.clave)) || b.comun - a.comun)
    .slice(0, 6);
  if (!candidatas.length) return null;
  return (
    <div className="pulso-cr-editor-bloque">
      <p className="pulso-cr-editor-rotulo">Agrupar con</p>
      <ul className="pulso-cr-agrupar">
        {candidatas.map(({ f, comun }) => (
          <li key={f.id} className="pulso-cr-agrupar-fila">
            <span className="pulso-cr-mini-tira" aria-hidden="true">{f.opciones.map((o) => <span key={o} style={f.colores[o] ? { background: f.colores[o] } : undefined} />)}</span>
            <span className="pulso-cr-agrupar-texto">
              <strong>{f.nombre}</strong>
              <span>Comparten {comun} de {fila.opciones.length} respuestas</span>
            </span>
            <PulsoButton variant="ghost" size="sm" onClick={() => onAgrupar(f)}>Agrupar</PulsoButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilaColores(props: {
  fila: FilaPaleta;
  filas: readonly FilaPaleta[];
  abierta: boolean;
  onAbrir: () => void;
  onPintar: (c: Record<string, string | null>) => void;
  errorNombre: (n: string) => string | null;
  onNombrar: (n: string) => void;
  onAgrupar: (destino: FilaPaleta) => void;
  onSeparar: (grupoId: string) => void;
}) {
  const { fila, abierta } = props;
  const cuerpoId = useId();
  return (
    <article className={abierta ? "pulso-cr-fila is-abierta" : "pulso-cr-fila"} data-qa-geometry-member>
      <button type="button" className="pulso-cr-fila-cabecera" aria-expanded={abierta} aria-controls={cuerpoId} onClick={props.onAbrir}>
        <span className="pulso-cr-identidad">
          <span className="pulso-cr-fila-nombre">
            {fila.nombre}
            {fila.clave ? <span className="pulso-cr-sello">Paleta con nombre</span> : null}
          </span>
          <span className="pulso-cr-fila-resumen">
            {fila.preguntas.length === 1 ? "1 pregunta" : `${fila.preguntas.length} preguntas`}
            {fila.bases.length > 1 ? ` en ${fila.bases.length} bases` : fila.bases.length === 1 ? ` de ${fila.bases[0]}` : ""}
          </span>
          {fila.grupos.length > 1 ? <span className="pulso-cr-fila-resumen">Reúne {fila.grupos.length} grupos de respuestas</span> : null}
        </span>
        <span className="pulso-cr-vista">
          <span className="pulso-cr-barra" aria-label={`Respuestas: ${fila.opciones.join(", ")}`}>
            {fila.opciones.map((o) => (
              <span
                key={o}
                className={`pulso-cr-segmento is-${fila.colores[o] ? textoSobre(fila.colores[o]) : "vacio"}`}
                style={fila.colores[o] ? { background: fila.colores[o] } : undefined}
                title={fila.colores[o] ? o : `${o}: sin color`}
              >
                <span className="pulso-cr-segmento-texto">{o}</span>
              </span>
            ))}
          </span>
          {fila.preguntas[0] ? <span className="pulso-cr-ejemplo">{fila.preguntas[0].texto}</span> : null}
        </span>
        <span className="pulso-cr-lado">
          <Estado fila={fila} />
          <ChevronDown size={18} aria-hidden="true" className="pulso-cr-chevron" />
        </span>
      </button>
      {abierta ? (
        <div id={cuerpoId} className="pulso-cr-editor">
          <div className="pulso-cr-editor-col">
            <CampoNombre key={fila.clave ?? fila.id} fila={fila} error={props.errorNombre} onGuardar={props.onNombrar} />
            <Agrupar fila={fila} filas={props.filas} onAgrupar={props.onAgrupar} />
            {fila.clave && fila.grupos.length > 1 ? (
              <div className="pulso-cr-editor-bloque">
                <p className="pulso-cr-editor-rotulo">Grupos en esta paleta</p>
                <ul className="pulso-cr-agrupar">
                  {fila.grupos.map((g) => (
                    <li key={g.id} className="pulso-cr-agrupar-fila">
                      <span className="pulso-cr-agrupar-texto">
                        <strong>{g.opciones.join(" / ")}</strong>
                        <span>{g.preguntas.length === 1 ? "1 pregunta" : `${g.preguntas.length} preguntas`}</span>
                      </span>
                      <PulsoButton variant="ghost" size="sm" onClick={() => props.onSeparar(g.id)}>Separar</PulsoButton>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="pulso-cr-editor-col is-ancha">
            <Pintor fila={fila} onPintar={props.onPintar} />
            <details className="pulso-cr-preguntas">
              <summary>Ver las preguntas que la usan ({fila.preguntas.length})</summary>
              <ul>{fila.preguntas.map((p) => <li key={p.ref}>{p.texto}{p.base ? <span className="pulso-cr-base-tag">{p.base}</span> : null}</li>)}</ul>
            </details>
            <div className="pulso-cr-editor-pie">
              <PulsoButton variant="ghost" size="sm" onClick={() => props.onPintar(Object.fromEntries(fila.opciones.map((o) => [o, null])))} disabled={fila.faltan === fila.opciones.length}>
                Quitar colores
              </PulsoButton>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function ColoresRespuestas() {
  const paletas = usePlanStore((s) => s.paletas);
  const vinculos = usePlanStore((s) => s.paletasVinculos);
  const setPaletas = usePlanStore((s) => s.setPaletas);
  const setPaletasYVinculos = usePlanStore((s) => s.setPaletasYVinculos);
  const { listas, filas, error } = usePaletasRespuestas();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const tituloId = useId();

  const faltan = filas.filter((f) => !lleno(f)).length;
  const coincide = (f: FilaPaleta) => !consulta.trim() || f.nombre.toLowerCase().includes(consulta.trim().toLowerCase()) || f.grupos.some((g) => grupoCoincide(g, consulta));
  const visibles = filas.filter((f) => coincide(f) && (filtro === "todos" || (filtro === "faltan" ? !lleno(f) : lleno(f))));
  const mapas: Mapas = { paletas, vinculos };
  const aplicar = (m: Mapas, abrir?: string) => { setPaletasYVinculos(m.paletas, m.vinculos); if (abrir) setAbierto(abrir); };

  const FILTROS: { id: Filtro; rotulo: string; n: number }[] = [
    { id: "todos", rotulo: "Todas", n: filas.length },
    { id: "faltan", rotulo: "Faltan colores", n: faltan },
    { id: "listos", rotulo: "Listas", n: filas.length - faltan },
  ];

  return (
    <section className="pulso-cr" aria-labelledby={tituloId} data-seccion="colores-respuestas">
      <header className="pulso-cr-cabecera">
        <h3 id={tituloId} className="pulso-cr-titulo">Colores de las respuestas</h3>
        <p className="pulso-cr-bajada">
          Las preguntas que comparten respuestas se pintan juntas. Ponle nombre a una paleta para reunir otros grupos y elegirla desde cualquier gráfico.
        </p>
      </header>

      {error ? <ErrorBlock label="No se pudieron leer las respuestas" detail={error} /> : null}
      {!error && !listas ? <LoadingBlock label="Leyendo las respuestas del formulario…" /> : null}
      {listas && !filas.length ? (
        <EmptyState icon={<Palette size={20} aria-hidden="true" />} title="Este formulario no tiene listas de respuestas" hint="Cuando tenga preguntas de opción, aparecerán aquí." />
      ) : null}

      {filas.length ? (
        <>
          <div className="pulso-cr-herramientas">
            <div className="pulso-cr-filtros" role="tablist" aria-label="Mostrar" data-gliding-opt-out="Es un filtro de la lista de paletas (todas, faltan colores, listas), no el recorrido del módulo: un control segmentado con su conteo en cada opción, que marca la activa con su propio fondo.">
              {FILTROS.map((f) => (
                <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} className={filtro === f.id ? "pulso-cr-filtro is-activo" : "pulso-cr-filtro"} onClick={() => setFiltro(f.id)}>
                  {f.rotulo}<span className="pulso-cr-filtro-n">{f.n}</span>
                </button>
              ))}
            </div>
            <label className="pulso-cr-buscar">
              <Search size={14} aria-hidden="true" />
              <input type="search" value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="Buscar paleta, respuesta o pregunta" aria-label="Buscar paleta, respuesta o pregunta" />
            </label>
          </div>
          {visibles.length ? (
            <div className="pulso-cr-lista" data-qa-geometry-group="graficos/identidad-colores-respuestas" data-qa-geometry-contract="intrinsic">
              {visibles.map((f) => (
                <FilaColores
                  key={f.id}
                  fila={f}
                  filas={filas}
                  abierta={abierto === f.id}
                  onAbrir={() => setAbierto((a) => (a === f.id ? null : f.id))}
                  onPintar={(c) => listas && setPaletas(conColoresDeFila(f, c, listas, paletas))}
                  errorNombre={(n) => (listas ? errorNombre(n, filas, listas, f) : null)}
                  onNombrar={(n) => listas && aplicar(conNombre(f, n, listas, mapas), `paleta:${n}`)}
                  onAgrupar={(d) => listas && aplicar(conAgrupado(f, d, listas, mapas))}
                  onSeparar={(gid) => {
                    const g = f.grupos.find((x) => x.id === gid);
                    if (listas && g) aplicar(conSeparado(f, g, listas, mapas));
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="pulso-cr-nada">{filtro === "faltan" && !consulta ? "Todas las paletas tienen sus colores." : "Nada coincide con la búsqueda."}</p>
          )}
        </>
      ) : null}
    </section>
  );
}
