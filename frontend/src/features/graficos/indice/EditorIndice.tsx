// Editor del índice en Inspector › Contenido de `p_slide_indice` (A5 rebanada 2b, W2; decisiones 22 y 23 de Gonzalo).
// El analista edita los capítulos (título, subcapítulos, ícono, orden, quitar y añadir) y, con un botón explícito,
// puede tomar los capítulos del informe; si el índice deja de reflejarlos, se avisa y nunca se sobrescribe solo. Cada
// edición es un `updateSlidePayload` (un paso de deshacer). La lógica vive en `modeloIndice.ts`.

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Ban, Info, ListOrdered, Plus, Sparkles, Trash2 } from "../../../vendor/lucide-react";
import type { Slide } from "../../../api/graficos";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { construirEstructura, type EstructuraInforme } from "../laminas/modeloEstructura";
import { ATRIBUTO_ACCION_ORDEN, enfocarTrasMover } from "../laminas/ordenCategorias";
import { PANEL_ICONOS } from "../panelesGraficos";
import { usePlanStore } from "../store";
import { BibliotecaIconos, rotuloIcono } from "./BibliotecaIconos";
import { borradorVigente, useIndiceUi } from "./indiceUiStore";
import {
  avisosIndice,
  conCapitulo,
  conCapituloNuevo,
  firmaIndice,
  ICONO_AUTOMATICO,
  iconoEnBiblioteca,
  indiceDesdeEstructura,
  indiceDesfasado,
  leerIndice,
  moverCapitulo,
  serializarIndice,
  SIN_ICONO,
  sinCapitulo,
  type IndiceEditable,
} from "./modeloIndice";
import { useIconosRecetario } from "./useIconosRecetario";
import "./editorIndice.css";

export function EditorIndice({ slide }: { slide: Slide }) {
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const slides = usePlanStore((s) => s.plan.slides);
  const borrador = useIndiceUi((s) => s.borrador);
  const setBorrador = useIndiceUi((s) => s.setBorrador);
  const setCapituloIcono = useIndiceUi((s) => s.setCapituloIcono);
  const biblioteca = usePanelDireccionable(PANEL_ICONOS);
  const payload = slide.payload as Record<string, unknown>;
  const firma = firmaIndice(payload);
  const guardado = useMemo(() => leerIndice(payload), [payload]);
  const indice = borradorVigente(borrador, slide.id, firma) ?? guardado;
  const estructura = useMemo(() => construirEstructura(slides), [slides]);

  /** Guarda el índice si se puede; el borrador conserva lo que el payload no representa (o lo que está bloqueado). */
  const aplicar = (siguiente: IndiceEditable) => {
    const r = serializarIndice(slide, siguiente);
    if (r.ok) {
      const firmaNueva = firmaIndice({ ...payload, ...r.patch });
      // Lo que el payload no representa (un capítulo aún sin título) no es un cambio: no ensucia ni suma un deshacer.
      if (firmaNueva !== firma) updatePayload(slide.id, r.patch);
      setBorrador({ slideId: slide.id, firma: firmaNueva, indice: siguiente });
    } else {
      setBorrador({ slideId: slide.id, firma, indice: siguiente });
    }
  };

  return (
    <>
      <EditorIndiceVista
        indice={indice}
        estructura={estructura}
        onAplicar={aplicar}
        onAbrirIcono={(i) => { setCapituloIcono(i); biblioteca.abrir(); }}
      />
      <BibliotecaIconos indice={indice} onElegir={(i, icono) => aplicar(conCapitulo(indice, i, { icono }))} />
    </>
  );
}

type PropsVista = {
  indice: IndiceEditable;
  estructura: EstructuraInforme;
  onAplicar: (siguiente: IndiceEditable) => void;
  onAbrirIcono: (capitulo: number) => void;
};

/** El editor pintado: lo que se ve y el teclado. Sin stores, para que se pueda pintar con el índice que se quiera. */
export function EditorIndiceVista({ indice, estructura, onAplicar: aplicar, onAbrirIcono: abrirIcono }: PropsVista) {
  const capitulosInforme = useMemo(() => estructura.nodos.filter((n) => n.clase === "capitulo").length, [estructura]);
  const desfasado = indiceDesfasado(indice, estructura);
  const avisos = avisosIndice(indice);
  const iconos = useIconosRecetario({ nombres: indice.capitulos.map((c) => iconoEnBiblioteca(c.icono)) });
  const filas = useRef(new Map<number, HTMLLIElement>());
  const [anuncio, setAnuncio] = useState("");
  const idTitulo = useId();
  const idMotivo = useId();
  const idAyuda = useId();

  const mover = (desde: number, hasta: number, enfocar: "fila" | "subir" | "bajar") => {
    if (hasta < 0 || hasta >= indice.capitulos.length || desde === hasta) return;
    const titulo = indice.capitulos[desde].titulo.trim() || "Capítulo sin título";
    aplicar(moverCapitulo(indice, desde, hasta));
    setAnuncio(`«${titulo}» en la posición ${hasta + 1} de ${indice.capitulos.length}.`);
    requestAnimationFrame(() => {
      const fila = filas.current.get(hasta);
      if (!fila) return;
      if (enfocar === "fila") fila.focus();
      else enfocarTrasMover(fila, enfocar, hasta, indice.capitulos.length);
    });
  };
  const onTecla = (i: number) => (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.target !== e.currentTarget || !e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    // Alt+↑/↓ también mueve la lámina en el editor: sobre un capítulo mueve el capítulo.
    e.preventDefault();
    e.stopPropagation();
    mover(i, e.key === "ArrowUp" ? i - 1 : i + 1, "fila");
  };
  const quitar = (i: number) => {
    const titulo = indice.capitulos[i].titulo.trim() || "Capítulo sin título";
    aplicar(sinCapitulo(indice, i));
    setAnuncio(`Se quitó «${titulo}». Ctrl+Z lo devuelve.`);
    requestAnimationFrame(() => filas.current.get(Math.min(i, indice.capitulos.length - 2))?.focus());
  };
  const tomar = () => {
    const nuevo = indiceDesdeEstructura(estructura, indice);
    aplicar(nuevo);
    setAnuncio(`El índice tomó los ${nuevo.capitulos.length} capítulos del informe. Ctrl+Z lo deshace.`);
  };
  const n = indice.capitulos.length;
  return (
    <section className="pulso-f6-indice" aria-labelledby={idTitulo} data-qa-geometry-group="graficos/f6-indice" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-indice-cabeza">
        <h3 id={idTitulo} className="pulso-f6-subtitulo">Capítulos del índice</h3>
        <span className="pulso-f6-ayuda">{n === 0 ? "Ninguno" : `${n} ${n === 1 ? "capítulo" : "capítulos"}`}</span>
      </div>

      {desfasado && (
        <p className="pulso-f6-indice-desfase" role="status">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>
            El índice no coincide con los {capitulosInforme} {capitulosInforme === 1 ? "capítulo" : "capítulos"} del informe. No se
            cambia solo: tómalos si quieres que lo refleje y edítalo después.
          </span>
        </p>
      )}
      <div className="pulso-f6-indice-tomar">
        <button
          type="button"
          className="pulso-f6-boton"
          aria-disabled={capitulosInforme === 0 || undefined}
          aria-describedby={capitulosInforme === 0 ? idMotivo : undefined}
          onClick={() => { if (capitulosInforme > 0) tomar(); }}
        >
          <ListOrdered size={15} aria-hidden="true" />
          Tomar los capítulos del informe
        </button>
        {capitulosInforme === 0 && (
          <span id={idMotivo} className="pulso-f6-ayuda">El informe todavía no tiene separadores de capítulo.</span>
        )}
      </div>

      {avisos.length > 0 && (
        <ul className="pulso-f6-indice-avisos" aria-label="Avisos del índice">
          {avisos.map((a) => (
            <li key={`${a.codigo}-${a.capitulo ?? 0}`} className={a.bloquea ? "is-bloquea" : undefined} data-aviso={a.codigo}>
              {a.bloquea ? <AlertTriangle size={13} aria-hidden="true" /> : <Info size={13} aria-hidden="true" />}
              <span>{a.texto}</span>
            </li>
          ))}
        </ul>
      )}

      {n === 0 ? (
        <p className="pulso-f6-indice-vacio">
          El índice no tiene capítulos: sin ellos sale el índice de la plantilla. Añade uno o tómalos del informe.
        </p>
      ) : (
        <>
          <span className="pulso-f6-ayuda" id={idAyuda}>Usa Alt + ↑/↓ sobre un capítulo para moverlo.</span>
          <ol className="pulso-f6-indice-lista" aria-describedby={idAyuda} data-qa-geometry-group="graficos/f6-indice-capitulos" data-qa-geometry-contract="intrinsic">
            {indice.capitulos.map((c, i) => {
              const nombre = c.titulo.trim() || "Capítulo sin título";
              const img = c.icono && c.icono !== SIN_ICONO ? iconos.imagenes.get(iconoEnBiblioteca(c.icono)) : undefined;
              return (
                <li
                  // La posición es la identidad: dos capítulos pueden llamarse igual y el título cambia al escribir.
                  key={i}
                  ref={(el) => { if (el) filas.current.set(i, el); else filas.current.delete(i); }}
                  className="pulso-f6-indice-capitulo"
                  tabIndex={0}
                  aria-label={`Capítulo ${i + 1} de ${n}: ${nombre}`}
                  onKeyDown={onTecla(i)}
                  data-qa-geometry-member
                >
                  <div className="pulso-f6-indice-fila">
                    <span className="pulso-f6-indice-numero" aria-hidden="true">{i + 1}</span>
                    <button
                      type="button"
                      className="pulso-f6-indice-icono"
                      aria-label={`Ícono del capítulo ${i + 1}: ${rotuloIcono(c.icono)}. Cambiar`}
                      title={rotuloIcono(c.icono)}
                      onClick={() => abrirIcono(i)}
                    >
                      {img ? <img src={img} alt="" /> : c.icono === SIN_ICONO ? <Ban size={16} aria-hidden="true" />
                        : c.icono === ICONO_AUTOMATICO ? <Sparkles size={16} aria-hidden="true" /> : <span aria-hidden="true">?</span>}
                    </button>
                    <input
                      className="pulso-f6-input"
                      aria-label={`Título del capítulo ${i + 1}`}
                      placeholder="Título del capítulo"
                      value={c.titulo}
                      onChange={(e) => aplicar(conCapitulo(indice, i, { titulo: e.target.value }))}
                    />
                    <button type="button" className="pulso-f6-icono-boton" {...{ [ATRIBUTO_ACCION_ORDEN]: "subir" }}
                      aria-label={`Subir «${nombre}»`} disabled={i === 0} onClick={() => mover(i, i - 1, "subir")}>
                      <ArrowUp size={14} aria-hidden="true" />
                    </button>
                    <button type="button" className="pulso-f6-icono-boton" {...{ [ATRIBUTO_ACCION_ORDEN]: "bajar" }}
                      aria-label={`Bajar «${nombre}»`} disabled={i === n - 1} onClick={() => mover(i, i + 1, "bajar")}>
                      <ArrowDown size={14} aria-hidden="true" />
                    </button>
                    <button type="button" className="pulso-f6-icono-boton" aria-label={`Quitar «${nombre}»`} onClick={() => quitar(i)}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <label className="pulso-f6-indice-subs">
                    <span>Subcapítulos, uno por línea</span>
                    <textarea
                      className="pulso-f6-input"
                      rows={Math.min(6, Math.max(2, c.subcapitulos.length + 1))}
                      aria-label={`Subcapítulos del capítulo ${i + 1}, uno por línea`}
                      value={c.subcapitulos.join("\n")}
                      onChange={(e) => aplicar(conCapitulo(indice, i, { subcapitulos: e.target.value.split("\n") }))}
                    />
                  </label>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <button
        type="button"
        className="pulso-f6-boton pulso-f6-indice-anadir"
        onClick={() => {
          aplicar(conCapituloNuevo(indice));
          requestAnimationFrame(() => filas.current.get(n)?.querySelector<HTMLInputElement>("input")?.focus());
        }}
      >
        <Plus size={15} aria-hidden="true" />
        Añadir capítulo
      </button>
      <span className="pulso-sr-only" aria-live="polite">{anuncio}</span>
    </section>
  );
}
