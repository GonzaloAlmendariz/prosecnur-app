// Diálogo de líneas visuales propias (ID3c del rediseño, 2026-10-15; decisión D7): guardar lo actual como línea nueva,
// editar una propia (nombre, descripción, qué incluye), duplicar una (del recetario o propia) y eliminar una propia.
// Diálogo modal (Radix) y no panel direccionable, como ConfirmarEliminar: es una acción sobre una línea que un enlace no
// reproduce. Guardar una nueva la aplica al plan; eliminar la que está aplicada no le quita nada al estudio (el plan ya
// tiene copiados sus valores).

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState, type FormEvent } from "react";
import { idLineaNueva, type LineaVisualNueva } from "../../../api/graficosLineasVisuales";
import { usePlanStore } from "../store";
import { useLineasPropias } from "./lineasPropiasStore";
import { lineaDesdePerfil, lineaDesdePlan } from "./modeloLineaPropia";
import { PulsoButton } from "../../../components/PulsoButton";

const mensaje = (e: unknown) => (e instanceof Error && e.message ? e.message : "No se pudo guardar la línea visual.");

export function DialogoLinea() {
  const edicion = useLineasPropias((s) => s.edicion);
  const setEdicion = useLineasPropias((s) => s.setEdicion);
  const guardar = useLineasPropias((s) => s.guardar);
  const eliminar = useLineasPropias((s) => s.eliminar);
  const aplicar = usePlanStore((s) => s.applyPptStyleProfile);
  // Estado del formulario: vive sólo mientras el diálogo está abierto y se reinicia al abrirlo.
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [colores, setColores] = useState(true);
  const [graficos, setGraficos] = useState(true);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!edicion || edicion.modo === "eliminar") return;
    const base = edicion.modo === "editar" ? edicion.linea : edicion.modo === "duplicar" ? edicion.base : null;
    setTitulo(edicion.modo === "nueva" ? "" : edicion.modo === "duplicar" ? `${base?.titulo_humano ?? "Línea"} (copia)` : base?.titulo_humano ?? "");
    setDescripcion(base?.descripcion ?? "");
    setColores(edicion.modo === "editar" ? edicion.linea.incluye.colores : true);
    setGraficos(edicion.modo === "editar" ? edicion.linea.incluye.portada : true);
    setError("");
  }, [edicion]);

  const cerrar = () => { if (!ocupado) setEdicion(null); };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!edicion || edicion.modo === "eliminar") return;
    if (!titulo.trim()) { setError("Ponle un nombre a la línea."); return; }
    setOcupado(true);
    try {
      let linea: LineaVisualNueva;
      let id: string;
      if (edicion.modo === "editar") {
        // Editar cambia nombre, descripción y qué incluye sobre los valores que la línea ya tenía.
        const l = edicion.linea;
        const base = lineaDesdePerfil(l, titulo);
        linea = { ...base, descripcion: descripcion.trim(), paletas: colores ? l.paletas : {}, preview_colors: colores ? l.preview_colors : [],
          incluye: { ...base.incluye, colores, portada: graficos },
          ...(graficos ? {} : { presets: {}, overrides_reusables: [], scope_rules: {} }) };
        id = l.id;
      } else if (edicion.modo === "duplicar") {
        linea = { ...lineaDesdePerfil(edicion.base, titulo), descripcion: descripcion.trim() };
        id = idLineaNueva(titulo);
      } else {
        const p = usePlanStore.getState();
        linea = lineaDesdePlan({ presets: p.presets, paletas: p.paletas, overridesReusables: p.overridesReusables, scopeRules: p.scopeRules },
          { titulo, descripcion, colores, graficos });
        id = idLineaNueva(titulo);
      }
      const guardada = await guardar(id, linea);
      if (edicion.modo === "nueva") aplicar(guardada);   // lo actual pasa a ser esta línea
      setEdicion(null);
    } catch (err) {
      setError(mensaje(err));
    } finally {
      setOcupado(false);
    }
  };

  const confirmarEliminar = async () => {
    if (edicion?.modo !== "eliminar") return;
    setOcupado(true);
    try {
      await eliminar(edicion.linea.id);
      setEdicion(null);
    } catch (err) {
      setError(mensaje(err));
    } finally {
      setOcupado(false);
    }
  };

  const titulos = { nueva: "Guardar como línea nueva", editar: "Editar la línea", duplicar: "Duplicar como línea propia", eliminar: "¿Eliminar la línea?" };
  return (
    <Dialog.Root open={!!edicion} onOpenChange={(abierto) => { if (!abierto) cerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-f6-lv-velo" />
        <Dialog.Content className="pulso-f6-lv-dialogo" role={edicion?.modo === "eliminar" ? "alertdialog" : "dialog"} data-qa-surface="graficos/f6-lv-dialogo"
          aria-describedby={undefined}>
          <Dialog.Title className="pulso-f6-lv-dialogo-titulo">{edicion ? titulos[edicion.modo] : ""}</Dialog.Title>
          {edicion?.modo === "eliminar" ? (
            <>
              <p className="pulso-f6-lv-dialogo-texto">
                «{edicion.linea.titulo_humano}» se borra de la app y deja de estar en la biblioteca de todos los estudios. Los
                estudios que ya la aplicaron conservan sus colores y estilos.
              </p>
              {error ? <p className="pulso-f6-lv-dialogo-error" role="alert">{error}</p> : null}
              <div className="pulso-f6-lv-dialogo-acciones">
                <Dialog.Close asChild><PulsoButton variant="ghost" size="sm" disabled={ocupado}>Cancelar</PulsoButton></Dialog.Close>
                <PulsoButton variant="danger" size="sm" onClick={() => void confirmarEliminar()} disabled={ocupado}>Eliminar</PulsoButton>
              </div>
            </>
          ) : (
            <form className="pulso-f6-lv-form" onSubmit={(e) => void enviar(e)}>
              {edicion?.modo === "nueva" && <p className="pulso-f6-lv-dialogo-texto">Parte de lo que tiene el informe ahora. Se guarda en la app y sirve para todos tus estudios.</p>}
              <label className="pulso-f6-lv-campo">
                <span>Nombre</span>
                <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} autoFocus required />
              </label>
              <label className="pulso-f6-lv-campo">
                <span>Descripción <small>opcional</small></span>
                <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={300} rows={2} />
              </label>
              {edicion?.modo !== "duplicar" && (
                <fieldset className="pulso-f6-lv-incluye">
                  <legend>Qué incluye</legend>
                  <label><input type="checkbox" checked={colores} onChange={(e) => setColores(e.target.checked)} /> Colores <small>las paletas de las respuestas</small></label>
                  <label><input type="checkbox" checked={graficos} onChange={(e) => setGraficos(e.target.checked)} /> Gráficos y portada <small>estilo de los gráficos, estilos guardados y plantilla</small></label>
                  <label className="is-deshabilitado"><input type="checkbox" checked={false} disabled /> Logos y letra <small>llegarán a la línea cuando lleguen al PowerPoint</small></label>
                </fieldset>
              )}
              {error ? <p className="pulso-f6-lv-dialogo-error" role="alert">{error}</p> : null}
              <div className="pulso-f6-lv-dialogo-acciones">
                <Dialog.Close asChild><PulsoButton type="button" variant="ghost" size="sm" disabled={ocupado}>Cancelar</PulsoButton></Dialog.Close>
                <PulsoButton type="submit" variant="primary" size="sm" disabled={ocupado || (!colores && !graficos && edicion?.modo !== "duplicar")}>
                  {ocupado ? "Guardando…" : "Guardar"}
                </PulsoButton>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
