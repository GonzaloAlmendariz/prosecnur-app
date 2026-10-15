// «Actores consultados» de la lámina de objetivo (G6, Gonzalo 2026-10-13: «había uno que te permitía poder poner
// perfiles o actores… la UI no refleja esas posibilidades»). El motor los dibuja con su ícono (`.lam_laminas_objetivo`,
// api/R/lamina_identidad.R) desde `meta.actores` y `meta.actores_iconos`.
// Gonzalo (2026-10-13): «¿por qué no me deja escoger el ícono para cada uno y por qué para agregar uno tiene que ser con
// Enter? ¿No debería tener un contenedor y un botón de más para agregar o quitar?» — una fila por actor con su ícono,
// su nombre y quitar; «Añadir actor» hasta seis. Las dimensiones de la composición 28, igual pero sin ícono.
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useId, useRef, useState } from "react";
import { create } from "zustand";
import { Plus, Sparkles, Trash2 } from "../../../../vendor/lucide-react";
import type { Slide } from "../../../../api/graficos";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { ContenidoBiblioteca, rotuloIcono } from "../../indice/BibliotecaIconos";
import { ICONO_AUTOMATICO, iconoEnBiblioteca } from "../../indice/modeloIndice";
import { useIconosRecetario } from "../../indice/useIconosRecetario";
import { PANEL_ICONO_ACTOR } from "../../panelesGraficos";
import { usePlanStore } from "../../store";
import { conSlideMeta, leerSlideMeta } from "../../slideMeta";
import {
  actoresDeMeta, dimensionesDeMeta, MAX_ACTORES, MAX_DIMENSIONES, metaDeActores, type Actor,
} from "./modeloActoresObjetivo";
import "../../indice/editorIndice.css";
import "./contenidoEspecial.css";

/** Qué actor eligió ícono (la biblioteca es `panel=icono-actor`; el actor no es una dimensión de la dirección). */
const useActorIcono = create<{ actor: number | null; elegir: (i: number | null) => void }>((set) => ({
  actor: null,
  elegir: (actor) => set({ actor }),
}));

/**
 * Enfoca el último campo cuando la lista crece por «Añadir». Con la lista vacía el `<ol>` todavía no existe al pulsar, y
 * un `requestAnimationFrame` llegaba antes que el render: el primer actor quedaba sin foco y lo escrito se perdía.
 */
function useEnfocarAlAnadir(n: number) {
  const lista = useRef<HTMLOListElement>(null);
  const pendiente = useRef(false);
  useEffect(() => {
    if (!pendiente.current) return;
    pendiente.current = false;
    const inputs = lista.current?.querySelectorAll<HTMLInputElement>("input");
    inputs?.[inputs.length - 1]?.focus();
  }, [n]);
  return { lista, marcar: () => { pendiente.current = true; } };
}

/**
 * Antes de quitar la fila `i` de `n`: el foco va al campo que queda en su lugar o, si la lista se vacía, a «Añadir». Las
 * filas usan la posición como clave, así que React desmonta siempre la ÚLTIMA y reutiliza las demás: el campo en
 * `min(i, n - 2)` sobrevive. Enfocar después (en un frame) caía en el que se estaba desmontando y el foco se perdía.
 */
function enfocarTrasQuitar(lista: HTMLOListElement | null, anadir: HTMLButtonElement | null, i: number, n: number) {
  if (n <= 1) { anadir?.focus(); return; }
  lista?.querySelectorAll<HTMLInputElement>("input")[Math.min(i, n - 2)]?.focus();
}

export function ActoresObjetivo({ slide }: { slide: Slide }) {
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const meta = leerSlideMeta(slide);
  const guardar = (cambios: Parameters<typeof conSlideMeta>[1]) => updatePayload(slide.id, { meta: conSlideMeta(slide, cambios).payload.meta });
  return (
    <>
      {meta.variante === "dimensiones" && (
        <ListaDimensiones dimensiones={dimensionesDeMeta(meta)} onCambio={(dimensiones) => guardar({ dimensiones })} />
      )}
      <ListaActores actores={actoresDeMeta(meta)} onCambio={(actores) => guardar(metaDeActores(actores))} />
    </>
  );
}

function ListaActores({ actores, onCambio }: { actores: Actor[]; onCambio: (actores: Actor[]) => void }) {
  const idTitulo = useId();
  const idAyuda = useId();
  const { lista, marcar } = useEnfocarAlAnadir(actores.length);
  const botonAnadir = useRef<HTMLButtonElement>(null);
  const [anuncio, setAnuncio] = useState("");
  const panel = usePanelDireccionable(PANEL_ICONO_ACTOR);
  const actorIcono = useActorIcono((s) => s.actor);
  const elegirActor = useActorIcono((s) => s.elegir);
  const iconos = useIconosRecetario({ nombres: actores.map((a) => iconoEnBiblioteca(a.icono)) });
  const lleno = actores.length >= MAX_ACTORES;

  const cambiar = (i: number, cambio: Partial<Actor>) => onCambio(actores.map((a, k) => (k === i ? { ...a, ...cambio } : a)));
  const quitar = (i: number) => {
    const nombre = actores[i].nombre.trim() || `el actor ${i + 1}`;
    enfocarTrasQuitar(lista.current, botonAnadir.current, i, actores.length);
    onCambio(actores.filter((_, k) => k !== i));
    setAnuncio(`Se quitó ${nombre}. Ctrl+Z lo devuelve.`);
  };
  const anadir = () => {
    marcar();
    onCambio([...actores, { nombre: "", icono: ICONO_AUTOMATICO }]);
  };
  const k = actorIcono !== null && actorIcono < actores.length ? actorIcono : 0;
  const elegido = actores[k] ?? null;

  return (
    <section className="pulso-f6-especial" aria-labelledby={idTitulo} aria-describedby={idAyuda}
      data-qa-geometry-group="graficos/f6-actores" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-especial-cabeza">
        <h3 id={idTitulo} className="pulso-f6-subtitulo">Actores consultados</h3>
        <span className="pulso-f6-ayuda">{actores.length === 0 ? "Ninguno" : `${actores.length} de ${MAX_ACTORES}`}</span>
      </div>
      <span id={idAyuda} className="pulso-f6-ayuda">Cada uno sale con su ícono bajo el objetivo; sin actores, la lámina va sin esa fila.</span>
      {actores.length > 0 && (
        <ol ref={lista} className="pulso-f6-filas" data-qa-geometry-group="graficos/f6-actores-filas" data-qa-geometry-contract="intrinsic">
          {actores.map((a, i) => {
            const img = a.icono ? iconos.imagenes.get(iconoEnBiblioteca(a.icono)) : undefined;
            const nombre = a.nombre.trim() || `Actor ${i + 1}`;
            return (
              <li key={i} className="pulso-f6-fila-actor" data-qa-geometry-member>
                <button
                  type="button"
                  className="pulso-f6-indice-icono"
                  aria-label={`Ícono de ${nombre}: ${rotuloIcono(a.icono)}. Cambiar`}
                  title={rotuloIcono(a.icono)}
                  onClick={() => { elegirActor(i); panel.abrir(); }}
                >
                  {img ? <img src={img} alt="" /> : a.icono === ICONO_AUTOMATICO ? <Sparkles size={16} aria-hidden="true" /> : <span aria-hidden="true">?</span>}
                </button>
                <input
                  className="pulso-f6-input"
                  aria-label={`Nombre del actor ${i + 1}`}
                  placeholder="Ej. Estudiantes"
                  value={a.nombre}
                  onChange={(e) => cambiar(i, { nombre: e.target.value })}
                />
                <button type="button" className="pulso-f6-icono-boton" aria-label={`Quitar ${nombre}`} onClick={() => quitar(i)}>
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <button ref={botonAnadir} type="button" className="pulso-f6-boton pulso-f6-especial-anadir" onClick={anadir} disabled={lleno}>
        <Plus size={15} aria-hidden="true" />
        Añadir actor
      </button>
      {lleno && <span className="pulso-f6-ayuda">La lámina admite hasta {MAX_ACTORES} actores.</span>}
      <span className="pulso-sr-only" aria-live="polite">{anuncio}</span>

      <Dialog.Root modal open={panel.abierto} onOpenChange={(siguiente) => { if (!siguiente && panel.abierto) panel.cerrar(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="pulso-f6-selector-velo" />
          {panel.abierto && elegido && (
            <ContenidoBiblioteca
              key={`${k}-${elegido.icono}`}
              panelProps={panel.props}
              numero={k + 1}
              titulo={elegido.nombre.trim()}
              actual={elegido.icono}
              contexto="actor"
              textos={{
                antetitulo: "Objetivo",
                tituloDialogo: `Ícono del actor ${k + 1}`,
                sinTitulo: "Actor sin nombre",
                autoGeneral: "El motor lo elige por el nombre del actor.",
              }}
              onCerrar={panel.cerrar}
              onUsar={(icono) => { cambiar(k, { icono }); panel.cerrar(); }}
            />
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

function ListaDimensiones({ dimensiones, onCambio }: { dimensiones: string[]; onCambio: (d: string[]) => void }) {
  const idTitulo = useId();
  const { lista, marcar } = useEnfocarAlAnadir(dimensiones.length);
  const botonAnadir = useRef<HTMLButtonElement>(null);
  const lleno = dimensiones.length >= MAX_DIMENSIONES;
  const anadir = () => {
    marcar();
    onCambio([...dimensiones, ""]);
  };
  const quitar = (i: number) => {
    enfocarTrasQuitar(lista.current, botonAnadir.current, i, dimensiones.length);
    onCambio(dimensiones.filter((_, k) => k !== i));
  };
  return (
    <section className="pulso-f6-especial" aria-labelledby={idTitulo}
      data-qa-geometry-group="graficos/f6-dimensiones" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-especial-cabeza">
        <h3 id={idTitulo} className="pulso-f6-subtitulo">Dimensiones</h3>
        <span className="pulso-f6-ayuda">{dimensiones.length === 0 ? "Ninguna" : `${dimensiones.length} de ${MAX_DIMENSIONES}`}</span>
      </div>
      <span className="pulso-f6-ayuda">Van en tarjetas bajo Conocer la percepción sobre.</span>
      {dimensiones.length > 0 && (
        <ol ref={lista} className="pulso-f6-filas" data-qa-geometry-group="graficos/f6-dimensiones-filas" data-qa-geometry-contract="intrinsic">
          {dimensiones.map((d, i) => (
            <li key={i} className="pulso-f6-fila-dimension" data-qa-geometry-member>
              <input
                className="pulso-f6-input"
                aria-label={`Dimensión ${i + 1}`}
                placeholder="Ej. Los propósitos de la carrera"
                value={d}
                onChange={(e) => onCambio(dimensiones.map((x, k) => (k === i ? e.target.value : x)))}
              />
              <button type="button" className="pulso-f6-icono-boton" aria-label={`Quitar la dimensión ${i + 1}`} onClick={() => quitar(i)}>
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <button ref={botonAnadir} type="button" className="pulso-f6-boton pulso-f6-especial-anadir" onClick={anadir} disabled={lleno}>
        <Plus size={15} aria-hidden="true" />
        Añadir dimensión
      </button>
      {lleno && <span className="pulso-f6-ayuda">La lámina admite hasta {MAX_DIMENSIONES} dimensiones.</span>}
    </section>
  );
}
