// Identidad › Colores de las respuestas (P1–P7). Una tarjeta por grupo de respuestas iguales: sus opciones con su color
// y las preguntas que las usan. Al abrirla se elige una combinación de la marca con un clic o se ajusta opción por
// opción con las muestras de la marca; el código de color queda como «Otro color» para quien lo necesite. Lo que se
// elige aquí es lo que pintan el PPT y el Word.

import { useEffect, useId, useMemo, useState } from "react";
import { apiGraficosPaletasSugeridas, type PaletaSugeridaEntry } from "../../../api/client";
import { PulsoButton } from "../../../components/PulsoButton";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../../components/States";
import { Check, ChevronDown, Palette, Search } from "../../../vendor/lucide-react";
import { usePlanStore } from "../store";
import { useVariables } from "../useVariables";
import {
  combinacionesPara,
  conColoresDelGrupo,
  estadoGrupo,
  grupoCoincide,
  gruposDeRespuestas,
  MUESTRAS_MARCA,
  type GrupoRespuestas,
  type ListaRespuestas,
} from "./modeloColoresRespuestas";
import "./coloresRespuestas.css";

type Filtro = "todos" | "faltan" | "listos";

function normalizarListas(raw: PaletaSugeridaEntry[]): ListaRespuestas[] {
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? [v] : []);
  return raw.map((l) => ({ list_name: l.list_name, choices: Array.isArray(l.choices) ? l.choices : [], fuentes: arr(l.fuentes), variables: arr(l.variables) }));
}

function TiraColores({ grupo, colores }: { grupo: GrupoRespuestas; colores: Record<string, string> }) {
  return (
    <div className="pulso-cr-tira" aria-hidden="true">
      {grupo.opciones.map((o) => (
        <span key={o} className={colores[o] ? "pulso-cr-tira-tramo" : "pulso-cr-tira-tramo is-vacio"} style={colores[o] ? { background: colores[o] } : undefined} />
      ))}
    </div>
  );
}

function EstadoChip({ grupo }: { grupo: GrupoRespuestas }) {
  const estado = estadoGrupo(grupo);
  if (estado === "completo") return <span className="pulso-cr-estado is-completo"><Check size={12} aria-hidden="true" />Listo</span>;
  if (estado === "incompleto") return <span className="pulso-cr-estado is-faltan">Faltan {grupo.faltan} {grupo.faltan === 1 ? "color" : "colores"}</span>;
  return <span className="pulso-cr-estado is-vacio">Sin colores</span>;
}

function EditorGrupo({ grupo, onPintar }: { grupo: GrupoRespuestas; onPintar: (colores: Record<string, string | null>) => void }) {
  const [activa, setActiva] = useState<string | null>(grupo.opciones.find((o) => !grupo.colores[o]) ?? grupo.opciones[0] ?? null);
  const combinaciones = useMemo(() => combinacionesPara(grupo.opciones), [grupo.opciones]);
  const otroId = useId();
  const color = activa ? grupo.colores[activa] : undefined;
  return (
    <div className="pulso-cr-editor">
      <div className="pulso-cr-editor-bloque">
        <p className="pulso-cr-editor-rotulo">Combinaciones de la marca</p>
        <div className="pulso-cr-combos">
          {combinaciones.map((c) => {
            const aplicada = grupo.opciones.every((o) => grupo.colores[o]?.toLowerCase() === c.colores[o]?.toLowerCase());
            return (
              <button key={c.nombre} type="button" className={aplicada ? "pulso-cr-combo is-aplicada" : "pulso-cr-combo"} aria-pressed={aplicada} onClick={() => onPintar(c.colores)}>
                <span className="pulso-cr-combo-tira" aria-hidden="true">
                  {grupo.opciones.map((o) => <span key={o} style={{ background: c.colores[o] }} />)}
                </span>
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
          {grupo.opciones.map((o) => (
            <li key={o}>
              <button type="button" className={o === activa ? "pulso-cr-opcion is-activa" : "pulso-cr-opcion"} aria-pressed={o === activa} onClick={() => setActiva(o)}>
                <span className={grupo.colores[o] ? "pulso-cr-punto" : "pulso-cr-punto is-vacio"} style={grupo.colores[o] ? { background: grupo.colores[o] } : undefined} aria-hidden="true" />
                <span className="pulso-cr-opcion-texto">{o}</span>
                {grupo.colores[o] ? null : <span className="pulso-cr-opcion-falta">sin color</span>}
              </button>
            </li>
          ))}
        </ul>
        {activa ? (
          <div className="pulso-cr-muestras" role="group" aria-label={`Color para «${activa}»`}>
            {MUESTRAS_MARCA.map((m) => {
              const elegida = color?.toLowerCase() === m.hex.toLowerCase();
              return (
                <button
                  key={m.hex}
                  type="button"
                  className={elegida ? "pulso-cr-muestra is-elegida" : "pulso-cr-muestra"}
                  style={{ background: m.hex }}
                  title={m.nombre}
                  aria-label={m.nombre}
                  aria-pressed={elegida}
                  onClick={() => onPintar({ [activa]: m.hex })}
                >
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

      <div className="pulso-cr-editor-pie">
        <PulsoButton variant="ghost" size="sm" onClick={() => onPintar(Object.fromEntries(grupo.opciones.map((o) => [o, null])))} disabled={grupo.faltan === grupo.opciones.length}>
          Quitar colores
        </PulsoButton>
      </div>
    </div>
  );
}

function TarjetaGrupo({ grupo, abierta, onAbrir, onPintar }: { grupo: GrupoRespuestas; abierta: boolean; onAbrir: () => void; onPintar: (c: Record<string, string | null>) => void }) {
  const cuerpoId = useId();
  const [primera, ...resto] = grupo.preguntas;
  return (
    <article className={abierta ? "pulso-cr-tarjeta is-abierta" : "pulso-cr-tarjeta"} data-qa-geometry-member>
      <TiraColores grupo={grupo} colores={grupo.colores} />
      <button type="button" className="pulso-cr-tarjeta-cabecera" aria-expanded={abierta} aria-controls={cuerpoId} onClick={onAbrir}>
        <span className="pulso-cr-tarjeta-titulo">
          <span className="pulso-cr-pregunta">{primera?.texto ?? grupo.opciones.join(" / ")}</span>
          <span className="pulso-cr-mas">
            {resto.length ? `y ${resto.length} ${resto.length === 1 ? "pregunta más" : "preguntas más"}` : grupo.preguntas.length ? "1 pregunta" : "Sin preguntas en el informe"}
          </span>
        </span>
        <EstadoChip grupo={grupo} />
        <ChevronDown size={16} aria-hidden="true" className="pulso-cr-chevron" />
      </button>
      <ul className="pulso-cr-chips" aria-label="Respuestas">
        {grupo.opciones.map((o) => (
          <li key={o} className="pulso-cr-chip">
            <span className={grupo.colores[o] ? "pulso-cr-punto" : "pulso-cr-punto is-vacio"} style={grupo.colores[o] ? { background: grupo.colores[o] } : undefined} aria-hidden="true" />
            {o}
          </li>
        ))}
      </ul>
      {grupo.bases.length > 1 || (grupo.bases.length === 1 && abierta) ? (
        <p className="pulso-cr-bases">{grupo.bases.length === 1 ? "Base" : "Bases"}: {grupo.bases.join(", ")}</p>
      ) : null}
      {abierta ? (
        <div id={cuerpoId}>
          {resto.length ? (
            <details className="pulso-cr-preguntas">
              <summary>Ver las {grupo.preguntas.length} preguntas</summary>
              <ul>{grupo.preguntas.map((p) => <li key={p.ref}>{p.texto}{p.base ? <span className="pulso-cr-base-tag">{p.base}</span> : null}</li>)}</ul>
            </details>
          ) : null}
          <EditorGrupo grupo={grupo} onPintar={onPintar} />
        </div>
      ) : null}
    </article>
  );
}

export function ColoresRespuestas() {
  const paletas = usePlanStore((s) => s.paletas);
  const vinculos = usePlanStore((s) => s.paletasVinculos);
  const setPaletas = usePlanStore((s) => s.setPaletas);
  const { variables } = useVariables();
  const [listas, setListas] = useState<ListaRespuestas[] | null>(null);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const tituloId = useId();

  useEffect(() => {
    let vivo = true;
    apiGraficosPaletasSugeridas()
      .then((r) => { if (vivo) setListas(normalizarListas(r.listas ?? [])); })
      .catch((e: unknown) => { if (vivo) setError(e instanceof Error ? e.message : "No se pudieron leer las respuestas del instrumento."); });
    return () => { vivo = false; };
  }, []);

  const etiquetas = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of variables) {
      if (!v.label) continue;
      m.set(`${v.source}$${v.name}`, v.label);
      if (!m.has(v.name)) m.set(v.name, v.label);
    }
    return m;
  }, [variables]);

  const grupos = useMemo(() => (listas ? gruposDeRespuestas(listas, paletas, vinculos, etiquetas) : []), [listas, paletas, vinculos, etiquetas]);
  const faltan = grupos.filter((g) => estadoGrupo(g) !== "completo").length;
  const visibles = grupos.filter((g) => grupoCoincide(g, consulta) && (filtro === "todos" || (filtro === "faltan" ? estadoGrupo(g) !== "completo" : estadoGrupo(g) === "completo")));

  const pintar = (g: GrupoRespuestas, colores: Record<string, string | null>) => {
    if (listas) setPaletas(conColoresDelGrupo(paletas, g, listas, colores));
  };

  const FILTROS: { id: Filtro; rotulo: string; n: number }[] = [
    { id: "todos", rotulo: "Todas", n: grupos.length },
    { id: "faltan", rotulo: "Faltan colores", n: faltan },
    { id: "listos", rotulo: "Listas", n: grupos.length - faltan },
  ];

  return (
    <section className="pulso-cr" aria-labelledby={tituloId} data-seccion="colores-respuestas">
      <header className="pulso-cr-cabecera">
        <div>
          <h3 id={tituloId} className="pulso-cr-titulo">Colores de las respuestas</h3>
          <p className="pulso-cr-bajada">Las preguntas que comparten respuestas se pintan juntas. Lo que elijas aquí es lo que sale en el PPT y el Word.</p>
        </div>
      </header>

      {error ? <ErrorBlock label="No se pudieron leer las respuestas" detail={error} /> : null}
      {!error && !listas ? <LoadingBlock label="Leyendo las respuestas del instrumento…" /> : null}
      {listas && !grupos.length ? (
        <EmptyState icon={<Palette size={20} aria-hidden="true" />} title="Este instrumento no tiene listas de respuestas" hint="Cuando el formulario tenga preguntas de opción, aparecerán aquí." />
      ) : null}

      {grupos.length ? (
        <>
          <div className="pulso-cr-herramientas">
            <div className="pulso-cr-filtros" role="tablist" aria-label="Mostrar">
              {FILTROS.map((f) => (
                <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} className={filtro === f.id ? "pulso-cr-filtro is-activo" : "pulso-cr-filtro"} onClick={() => setFiltro(f.id)}>
                  {f.rotulo}<span className="pulso-cr-filtro-n">{f.n}</span>
                </button>
              ))}
            </div>
            <label className="pulso-cr-buscar">
              <Search size={14} aria-hidden="true" />
              <input type="search" value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="Buscar respuesta o pregunta" aria-label="Buscar respuesta o pregunta" />
            </label>
          </div>
          {visibles.length ? (
            <div className="pulso-cr-grilla" data-qa-geometry-group="graficos/identidad-colores-respuestas" data-qa-geometry-contract="intrinsic">
              {visibles.map((g) => (
                <TarjetaGrupo key={g.id} grupo={g} abierta={abierto === g.id} onAbrir={() => setAbierto((a) => (a === g.id ? null : g.id))} onPintar={(c) => pintar(g, c)} />
              ))}
            </div>
          ) : (
            <p className="pulso-cr-nada">{filtro === "faltan" && !consulta ? "Todas las respuestas tienen sus colores." : "Nada coincide con la búsqueda."}</p>
          )}
        </>
      ) : null}
    </section>
  );
}
