// Índice de la Vista del cuestionario (E6, 2026-10-20): buscador de secciones y preguntas sobre la lista de secciones.
// Con búsqueda, la lista queda sólo con las secciones que casan y debajo van las preguntas encontradas.

import { useMemo, useState } from "react";
import { ListaPartes, type GrupoDePartes } from "../../../components/ListaPartes";
import { Search, X } from "../../../vendor/lucide-react";
import { stripMarkdown } from "../helpers/markdown";
import { duracion } from "../resumen/modeloResumen";
import { buscarEnCuestionario } from "./buscarEnCuestionario";
import { rotuloDeIndice, type SeccionDoc } from "./modeloCuestionario";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const MAX_PREGUNTAS = 40;

export function IndiceCuestionario({ secciones, actual, onSeccion, onPregunta }: {
  secciones: readonly SeccionDoc[];
  actual: string;
  onSeccion: (clave: string) => void;
  onPregunta: (name: string) => void;
}) {
  const [consulta, setConsulta] = useState("");
  const resultado = useMemo(() => buscarEnCuestionario(secciones, consulta), [secciones, consulta]);
  const visibles = resultado ? secciones.filter((s) => resultado.secciones.has(s.clave)) : secciones;

  const grupos: GrupoDePartes<string>[] = [{
    id: "secciones",
    titulo: "Secciones",
    partes: visibles.map((s) => ({
      clave: s.clave,
      rotulo: stripMarkdown(rotuloDeIndice(s)),
      detalle: `${plural(s.preguntas, "pregunta", "preguntas")}${s.preguntas ? ` · ${duracion(s.segundos)}` : ""}`,
      // Un glifo con su explicación al pasar el puntero: el texto «condicional» le quitaba la mitad del ancho al título.
      ...(s.conCondicion > 0
        ? { estado: { tono: "neutro" as const, texto: `${plural(s.conCondicion, "pregunta condicional", "preguntas condicionales")}` } }
        : {}),
    })),
  }];

  return (
    <nav className="pulso-xf-cue-indice" aria-label="Índice del cuestionario">
      <div className="pulso-xf-cue-buscador">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape" && consulta) { e.stopPropagation(); setConsulta(""); } }}
          placeholder="Buscar"
          aria-label="Buscar en el cuestionario"
        />
        {consulta && (
          <button type="button" className="pulso-xf-cue-buscador-limpiar" onClick={() => setConsulta("")} aria-label="Borrar la búsqueda">
            <X size={13} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="pulso-xf-cue-indice-cuerpo" data-qa-scroll-owner="cuestionario-indice">
      {resultado && (
        <p className="pulso-xf-cue-buscador-conteo" role="status">
          {resultado.secciones.size || resultado.preguntas.length
            ? `${plural(resultado.secciones.size, "sección", "secciones")} · ${plural(resultado.preguntas.length, "pregunta", "preguntas")}`
            : "Nada coincide"}
        </p>
      )}
      {visibles.length > 0 && (
        <ListaPartes etiqueta="Secciones del cuestionario" grupos={grupos} actual={actual} onElegir={onSeccion} prefijoId="xf-cue-indice" />
      )}
      {resultado && resultado.preguntas.length > 0 && (
        <ul className="pulso-xf-cue-hallazgos" aria-label="Preguntas encontradas">
          {resultado.preguntas.slice(0, MAX_PREGUNTAS).map((p) => (
            <li key={`${p.seccion}-${p.numero}-${p.name}`}>
              <button type="button" onClick={() => onPregunta(p.name)} title={p.texto}>
                <b>{p.numero}.</b>
                <span>{p.texto}</span>
                <code>{p.name}</code>
              </button>
            </li>
          ))}
          {resultado.preguntas.length > MAX_PREGUNTAS && (
            <li className="pulso-xf-cue-hallazgos-mas">y {resultado.preguntas.length - MAX_PREGUNTAS} más: afina la búsqueda</li>
          )}
        </ul>
      )}
      </div>
    </nav>
  );
}
