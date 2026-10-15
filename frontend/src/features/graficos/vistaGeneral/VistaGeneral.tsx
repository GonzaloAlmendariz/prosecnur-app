// Pestaña Informe (antes «Vista general») de Procesamiento › Gráficos (F6.3; dirección F6 §4.2): el informe como clasificador por
// capítulos. Cada capítulo es una fila con su separador y sus láminas como tarjetas 16:9 pares; se reordena arrastrando
// láminas y capítulos (o con Alt+flechas), se eligen varias (clic, Mayús+clic, Ctrl/⌘+clic) para moverlas, duplicarlas
// o eliminarlas, y con doble clic o Enter se abre la lámina en Láminas.
// Dirección: `/graficos?pestana=informe&foco=<id de lámina>` (`vista-general` se lee como alias). El `foco` es el id (no la posición): reordenar no
// lo cambia de lámina. Cada cambio del plan es UN paso deshacible (`loadPlan`), así que Ctrl/⌘+Z lo revierte entero.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Slide } from "../../../api/graficos";
import { toast } from "../../../components/toasterStore";
import { conNivel } from "../../../lib/navegacion/direccion";
import { searchConNivel, useSeccion } from "../../../lib/navegacion/useDireccion";
import { graficadorDisplayName } from "../graficadorDisplay";
import { nuevoIdLamina, usePlanStore } from "../store";
import { focoDeId, resolverFocoLamina } from "../focoLamina";
import { useGraficosRegistry } from "../useGraficosRegistry";
import { enfocarSinDesplazar } from "../laminas/enfocarSinDesplazar";
import { construirEstructura } from "../laminas/modeloEstructura";
import { BotonArmarDesdeVacio } from "../armarDesde/BotonArmarDesdeVacio";
import { AvisosVistaGeneral } from "./AvisosVistaGeneral";
import { BarraVistaGeneral } from "./BarraVistaGeneral";
import { ConfirmarEliminar } from "./ConfirmarEliminar";
import { FilaCapitulo } from "./FilaCapitulo";
import { TarjetaLamina, type ManejadoresTarjeta } from "./TarjetaLamina";
import {
  coberturaInforme,
  construirFilas,
  desplazarCapitulo,
  desplazarIds,
  duplicarSlides,
  eliminarSlides,
  filaDeLamina,
  ladoDeSoltar,
  marcaCapituloEnHueco,
  mismoOrden,
  moverAlCapitulo,
  destinosParaMover,
  ordenTrasSoltar,
  reordenarSlides,
  type FilaVistaGeneral,
} from "./modeloVistaGeneral";
import { objetivoDeAccion, reconciliarSeleccionVG, seleccionar, seleccionarTodo, SELECCION_VACIA } from "./seleccionVistaGeneral";
import { destinoDeFoco, intencionDeTecla, objetivoDeReenfoque } from "./tecladoVistaGeneral";
import { useEstadosInforme } from "./useEstadosInforme";
import { pasaFiltro } from "./estadoTarjetas";
import { useFlipTarjetas } from "./useFlipTarjetas";
import { useVistaGeneralUi } from "./vistaGeneralStore";
import "../laminas/movimiento.css";
import "../laminas/laminasWorkbench.css";
import "../laminas/estructuraInforme.css";
import "../laminas/tiraMiniaturas.css";
import "./vistaGeneral.css";

const SIN_NOMBRES: string[] = [];
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const sinMovimiento = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function filasDe(slides: readonly Slide[]): FilaVistaGeneral[] {
  return construirFilas(construirEstructura(slides), slides);
}

export default function VistaGeneral() {
  const location = useLocation();
  const navigate = useNavigate();
  const direccion = useSeccion("procesamiento");
  const slides = usePlanStore((s) => s.plan.slides);
  const loadPlan = usePlanStore((s) => s.loadPlan);
  const select = usePlanStore((s) => s.select);
  const undo = usePlanStore((s) => s.undo);
  const { graficadoresById } = useGraficosRegistry();
  const seleccion = useVistaGeneralUi((s) => s.seleccion);
  const arrastre = useVistaGeneralUi((s) => s.arrastre);
  const marca = useVistaGeneralUi((s) => s.marca);
  const confirmarEliminar = useVistaGeneralUi((s) => s.confirmarEliminar);
  const anuncio = useVistaGeneralUi((s) => s.anuncio);
  const filtro = useVistaGeneralUi((s) => s.filtro);

  const estructura = useMemo(() => construirEstructura(slides), [slides]);
  const filas = useMemo(() => construirFilas(estructura, slides), [estructura, slides]);
  const cobertura = useMemo(() => coberturaInforme(filas), [filas]);
  const { estados, conteos } = useEstadosInforme(estructura);
  const ids = useMemo(() => slides.map((s) => s.id), [slides]);
  const porId = useMemo(() => new Map(slides.map((s) => [s.id, s])), [slides]);
  const firma = ids.join("|");
  const capitulos = useMemo(() => filas.filter((f) => f.clase === "capitulo"), [filas]);

  // La misma resolución que Láminas (`../focoLamina.ts`): id, `id:gK` o el heredado `l-NN`.
  const focoId = resolverFocoLamina(direccion.foco, slides)?.id ?? null;
  const itinerante = focoId ?? ids[0] ?? null;

  const cuerpoRef = useRef<HTMLDivElement>(null);
  useFlipTarjetas(cuerpoRef, firma);

  // Lo último de cada valor para los manejadores estables (las tarjetas son `memo`: no se re-crean por render).
  const vivo = useRef({ ids, filas, slides, seleccion, location, itinerante });
  vivo.current = { ids, filas, slides, seleccion, location, itinerante };

  // La selección sigue al plan: se olvidan las láminas que ya no están (eliminar, deshacer).
  useEffect(() => {
    const s = useVistaGeneralUi.getState();
    s.setSeleccion(reconciliarSeleccionVG(s.seleccion, ids));
  }, [ids]);

  // Salir de la pestaña no deja arrastres ni confirmaciones a medias.
  useEffect(() => () => {
    const s = useVistaGeneralUi.getState();
    s.setArrastre(null);
    s.setConfirmarEliminar(null);
  }, []);

  const tarjetaEl = useCallback((id: string | null) => (
    id ? cuerpoRef.current?.querySelector<HTMLElement>(`[data-vg-tarjeta="${CSS.escape(id)}"]`) ?? null : null
  ), []);

  const escribirFoco = useCallback((id: string | null) => {
    const { location: loc } = vivo.current;
    navigate({ pathname: loc.pathname, search: conNivel(loc.search, "foco", id) }, { replace: true });
  }, [navigate]);

  // Tras reordenar, el foco vuelve a quien lo tenía (React mueve el nodo y el navegador lo suelta) y se ve.
  const reenfocar = useRef<HTMLElement | string | null>(null);
  useLayoutEffect(() => {
    const pendiente = reenfocar.current;
    if (!pendiente) return;
    reenfocar.current = null;
    let el = typeof pendiente === "string" ? tarjetaEl(pendiente) : pendiente.isConnected ? pendiente : null;
    // «Subir el capítulo» queda deshabilitado al llegar arriba: el foco pasa al asa del mismo capítulo.
    if (el instanceof HTMLButtonElement && el.disabled) el = el.closest("[data-vg-fila]")?.querySelector<HTMLElement>(".pulso-f6-vg-asa") ?? null;
    if (!el) return;
    if (document.activeElement !== el) enfocarSinDesplazar(el);
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: sinMovimiento() ? "auto" : "smooth" });
  });

  // `foco=l-NN` (venir de Láminas por el rail, o un enlace suyo) se reescribe como el id: es la forma de esta pestaña.
  useEffect(() => {
    if (focoId && direccion.foco !== focoId) escribirFoco(focoId);
  }, [focoId, direccion.foco, escribirFoco]);

  // Un enlace con `foco` lleva a esa tarjeta una vez (sin robar el foco).
  const focoInicial = useRef(focoId);
  useEffect(() => {
    tarjetaEl(focoInicial.current)?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [tarjetaEl]);

  /** Aplica un plan nuevo en un paso deshacible y conserva la lámina seleccionada del editor si sigue viva. */
  const aplicar = useCallback((nuevos: Slide[], seleccionPlan?: string | null) => {
    const previa = usePlanStore.getState().selectedSlideId;
    // El id de la tarjeta y no su nodo: cruzar de capítulo desmonta el `<li>` (ver `objetivoDeReenfoque`).
    const activo = document.activeElement;
    reenfocar.current = activo instanceof HTMLElement ? objetivoDeReenfoque(activo) : null;
    loadPlan({ slides: nuevos });
    const vigente = seleccionPlan ?? (previa && nuevos.some((s) => s.id === previa) ? previa : nuevos[0]?.id ?? null);
    select(vigente);
  }, [loadPlan, select]);

  const anunciarMovidas = useCallback((movidas: string[], nuevos: Slide[]) => {
    const fila = filaDeLamina(filasDe(nuevos), movidas[0] ?? "");
    const pos = nuevos.findIndex((s) => s.id === movidas[0]) + 1;
    const quien = movidas.length === 1 ? "Lámina movida" : `${plural(movidas.length, "lámina movida", "láminas movidas")}`;
    useVistaGeneralUi.getState().anunciar(`${quien} a la posición ${pos}${fila ? `, en ${fila.rotulo}` : ""}.`);
  }, []);

  const reordenar = useCallback((orden: string[], movidas: string[]) => {
    const { slides: actuales } = vivo.current;
    const nuevos = reordenarSlides(actuales, orden);
    aplicar(nuevos);
    anunciarMovidas(movidas, nuevos);
  }, [aplicar, anunciarMovidas]);

  const abrir = useCallback((id: string) => {
    const { slides: actuales, location: loc } = vivo.current;
    if (!actuales.some((s) => s.id === id)) return;
    select(id);
    navigate({ pathname: loc.pathname, search: conNivel(searchConNivel(loc.search, "pestana", "laminas"), "foco", focoDeId(id)) });
  }, [navigate, select]);

  const duplicar = useCallback((objetivo: string[]) => {
    if (!objetivo.length) return;
    const { slides: actuales } = vivo.current;
    const { slides: nuevos, copias } = duplicarSlides(actuales, new Set(objetivo), nuevoIdLamina);
    aplicar(nuevos, copias[0] ?? null);
    const ui = useVistaGeneralUi.getState();
    ui.setSeleccion({ ids: copias, ancla: copias[0] ?? null });
    if (copias[0]) { reenfocar.current = copias[0]; escribirFoco(copias[0]); }
    ui.anunciar(copias.length === 1 ? "Lámina duplicada; la copia quedó elegida." : `${plural(copias.length, "lámina duplicada", "láminas duplicadas")}; las copias quedaron elegidas.`);
  }, [aplicar, escribirFoco]);

  const pedirEliminar = useCallback((objetivo: string[]) => {
    if (objetivo.length) useVistaGeneralUi.getState().setConfirmarEliminar(objetivo);
  }, []);

  const retornoTrasConfirmar = useRef<string | null>(null);
  const confirmarEliminacion = useCallback(() => {
    const ui = useVistaGeneralUi.getState();
    const objetivo = ui.confirmarEliminar ?? [];
    ui.setConfirmarEliminar(null);
    if (!objetivo.length) return;
    const { slides: actuales } = vivo.current;
    const { slides: nuevos, vecina } = eliminarSlides(actuales, new Set(objetivo));
    aplicar(nuevos, vecina);
    reenfocar.current = vecina;
    ui.setSeleccion(SELECCION_VACIA);
    retornoTrasConfirmar.current = vecina;
    escribirFoco(vecina);
    const texto = objetivo.length === 1 ? "Lámina eliminada" : `${plural(objetivo.length, "lámina eliminada", "láminas eliminadas")}`;
    ui.anunciar(`${texto}. Se puede deshacer.`);
    toast.aviso(texto, {
      ...(objetivo.length === 1 ? { detalle: construirEstructura(actuales).laminas.find((l) => l.id === objetivo[0])?.titulo } : {}),
      accion: { label: "Deshacer", onSelect: () => { undo(); useVistaGeneralUi.getState().anunciar("Eliminación deshecha."); } },
    });
  }, [aplicar, escribirFoco, undo]);

  const moverCapitulo = useCallback((filaId: string, dir: -1 | 1) => {
    const { ids: orden, filas: actuales } = vivo.current;
    const siguiente = desplazarCapitulo(orden, actuales, filaId, dir);
    const fila = actuales.find((f) => f.id === filaId);
    if (!siguiente || !fila) {
      useVistaGeneralUi.getState().anunciar(dir === -1 ? "El capítulo ya es el primero." : "El capítulo ya es el último.");
      return;
    }
    const nuevos = reordenarSlides(vivo.current.slides, siguiente);
    aplicar(nuevos);
    const numero = filasDe(nuevos).find((f) => f.ids[0] === fila.ids[0])?.numero;
    useVistaGeneralUi.getState().anunciar(`Capítulo «${fila.titulo}» movido${numero ? `: ahora es el ${numero}` : ""}.`);
  }, [aplicar]);

  // Un separador elegido mueve su capítulo entero, como el asa (ver `moverAlCapitulo`); el anuncio nombra el destino.
  const moverA = useCallback((filaId: string) => {
    const { ids: orden, filas: actuales, seleccion: sel, slides: actualesSlides } = vivo.current;
    const r = moverAlCapitulo(orden, actuales, sel.ids, filaId);
    if (r.ok) aplicar(reordenarSlides(actualesSlides, r.orden));
    useVistaGeneralUi.getState().anunciar(r.anuncio);
  }, [aplicar]);
  const destinosMover = useMemo(() => destinosParaMover(filas, seleccion.ids), [filas, seleccion.ids]);

  const manejadores = useMemo<ManejadoresTarjeta>(() => ({
    onClic: (id: string, e: MouseEvent<HTMLElement>) => {
      const { ids: orden, seleccion: sel } = vivo.current;
      const modo = e.shiftKey ? "rango" : e.metaKey || e.ctrlKey ? "alternar" : "unica";
      useVistaGeneralUi.getState().setSeleccion(seleccionar(sel, id, modo, orden));
      select(id);
      escribirFoco(id);
    },
    onAbrir: abrir,
    onFoco: (id: string) => { if (vivo.current.itinerante !== id) escribirFoco(id); },
    onTecla: (id: string, e: KeyboardEvent<HTMLElement>) => {
      const intencion = intencionDeTecla(e);
      if (!intencion) return;
      const { ids: orden, filas: actuales, seleccion: sel } = vivo.current;
      const ui = useVistaGeneralUi.getState();
      if (intencion.tipo === "vaciar" && !sel.ids.length) return;
      e.preventDefault();
      e.stopPropagation();
      switch (intencion.tipo) {
        case "ir": {
          const destino = destinoDeFoco(actuales.map((f) => f.ids), id, intencion.destino);
          if (!destino) return;
          if (intencion.extender) ui.setSeleccion(seleccionar(sel.ancla ? sel : { ids: [id], ancla: id }, destino, "rango", orden));
          reenfocar.current = destino;
          escribirFoco(destino);
          return;
        }
        case "mover": {
          const objetivo = objetivoDeAccion(sel, id);
          const siguiente = desplazarIds(orden, new Set(objetivo), intencion.dir);
          if (mismoOrden(orden, siguiente)) { ui.anunciar(intencion.dir === -1 ? "Ya está al principio del informe." : "Ya está al final del informe."); return; }
          reordenar(siguiente, objetivo);
          return;
        }
        case "alternar": ui.setSeleccion(seleccionar(sel, id, "alternar", orden)); return;
        case "todo": ui.setSeleccion(seleccionarTodo(orden)); ui.anunciar(`${plural(orden.length, "lámina elegida", "láminas elegidas")}.`); return;
        case "vaciar": ui.setSeleccion(SELECCION_VACIA); ui.anunciar("Selección vacía."); return;
        case "abrir": abrir(id); return;
        case "duplicar": duplicar(objetivoDeAccion(sel, id)); return;
        case "eliminar": retornoTrasConfirmar.current = id; pedirEliminar(objetivoDeAccion(sel, id)); return;
      }
    },
    onArrastrar: (id: string, e: DragEvent<HTMLElement>) => {
      const { ids: orden, seleccion: sel } = vivo.current;
      const objetivo = objetivoDeAccion(sel, id);
      const ui = useVistaGeneralUi.getState();
      if (!sel.ids.includes(id)) ui.setSeleccion(seleccionar(sel, id, "unica", orden));
      ui.setArrastre({ clase: "laminas", ids: objetivo });
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", objetivo.join(","));
    },
    onSobre: (id: string, e: DragEvent<HTMLElement>) => {
      const ui = useVistaGeneralUi.getState();
      if (ui.arrastre?.clase !== "laminas") return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      const r = e.currentTarget.getBoundingClientRect();
      ui.setMarca({ clase: "tarjeta", id, lado: ladoDeSoltar(e.clientX, r.left, r.width) });
    },
    onSoltar: (e: DragEvent<HTMLElement>) => {
      const ui = useVistaGeneralUi.getState();
      const { arrastre: a, marca: m } = ui;
      if (!a) return;
      e.preventDefault();
      e.stopPropagation();
      ui.setArrastre(null);
      if (!m) return;
      const { ids: orden, filas: actuales } = vivo.current;
      const siguiente = ordenTrasSoltar(orden, actuales, a, m);
      if (!siguiente) return;
      if (a.clase === "laminas") { reordenar(siguiente, a.ids); return; }
      const fila = actuales.find((f) => f.id === a.filaId);
      const nuevos = reordenarSlides(vivo.current.slides, siguiente);
      aplicar(nuevos);
      const numero = fila ? filasDe(nuevos).find((f) => f.ids[0] === fila.ids[0])?.numero : null;
      ui.anunciar(`Capítulo${fila ? ` «${fila.titulo}»` : ""} movido${numero ? `: ahora es el ${numero}` : ""}.`);
    },
    onFinArrastre: () => useVistaGeneralUi.getState().setArrastre(null),
  }), [abrir, aplicar, duplicar, escribirFoco, pedirEliminar, reordenar, select]);

  const onArrastrarCapitulo = useCallback((filaId: string, e: DragEvent<HTMLElement>) => {
    useVistaGeneralUi.getState().setArrastre({ clase: "capitulo", filaId });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", filaId);
  }, []);

  const onSobreFila = useCallback((filaId: string, e: DragEvent<HTMLElement>) => {
    const ui = useVistaGeneralUi.getState();
    if (!ui.arrastre) return;
    const fila = vivo.current.filas.find((f) => f.id === filaId);
    if (!fila) return;
    if (ui.arrastre.clase === "capitulo") {
      if (fila.clase !== "capitulo") return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const r = e.currentTarget.getBoundingClientRect();
      ui.setMarca({ clase: "capitulo", filaId, lado: ladoDeSoltar(e.clientY, r.top, r.height) });
      return;
    }
    // Láminas sobre la cabecera o el margen de la fila: caen al final de esa fila.
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    ui.setMarca({ clase: "fin-fila", filaId });
  }, []);

  // El hueco entre filas (gap del contenedor) también recibe un capítulo arrastrado: ver `marcaCapituloEnHueco`.
  const onSobreHueco = useCallback((e: DragEvent<HTMLElement>) => {
    const ui = useVistaGeneralUi.getState();
    if (ui.arrastre?.clase !== "capitulo" || e.target !== e.currentTarget) return;
    const rects = [...e.currentTarget.querySelectorAll<HTMLElement>(":scope > [data-vg-fila]")].map((el) => {
      const r = el.getBoundingClientRect();
      const id = el.dataset.vgFila ?? "";
      return { id, clase: vivo.current.filas.find((f) => f.id === id)?.clase ?? "bloque", top: r.top, bottom: r.bottom };
    });
    const marca = marcaCapituloEnHueco(rects, e.clientY);
    if (!marca || marca.filaId === ui.arrastre.filaId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    ui.setMarca(marca);
  }, []);

  const onSobreFinFila = useCallback((filaId: string, e: DragEvent<HTMLElement>) => {
    const ui = useVistaGeneralUi.getState();
    if (ui.arrastre?.clase !== "laminas") return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    ui.setMarca({ clase: "fin-fila", filaId });
  }, []);

  // Por lámina, estable entre renders mientras no cambien el plan ni el registro (las tarjetas son `memo`).
  const nombresGraficos = useMemo(() => new Map(filas.flatMap((f) => f.tarjetas).map((t) => [
    t.lamina.id, t.graficos.map((g) => graficadorDisplayName(g, graficadoresById[g])),
  ])), [filas, graficadoresById]);

  const elegidas = useMemo(() => new Set(seleccion.ids), [seleccion.ids]);
  const arrastradas = useMemo(() => new Set(arrastre?.clase === "laminas" ? arrastre.ids : []), [arrastre]);
  const titulosAEliminar = useMemo(
    () => confirmarEliminar?.map((id) => porId.get(id)).filter((s): s is Slide => !!s).map((s) => {
      const lam = estructura.laminas.find((l) => l.id === s.id);
      return lam ? `${lam.posicion}. ${lam.titulo}` : s.id;
    }) ?? null,
    [confirmarEliminar, porId, estructura],
  );

  if (!slides.length) {
    return (
      <div className="pulso-f6-vg" data-audit-ready="graficos-vista-general" data-qa-surface="graficos/f6-vista-general">
        <div className="pulso-f6-vg-cuerpo is-vacio" data-qa-scroll-owner="vista-general">
          <div className="pulso-f6-vacio-informe pulso-f6-vg-vacio" role="status">
            <strong>El informe todavía no tiene láminas</strong>
            <p>Aquí verás el informe por capítulos, con cada lámina como tarjeta, para ordenarlo de un vistazo. Empieza por insertar la primera lámina en Láminas o arma el informe desde un plan sugerido.</p>
            <div className="pulso-f6-vacio-acciones">
              <button type="button" className="pulso-f6-boton" onClick={() => direccion.irA("pestana", "laminas")}>Ir a Láminas</button>
              <BotonArmarDesdeVacio />
            </div>
          </div>
        </div>
      </div>
    );
  }

  let indiceCapitulo = -1;
  return (
    <div className="pulso-f6-vg" data-audit-ready="graficos-vista-general" data-qa-surface="graficos/f6-vista-general">
      <BarraVistaGeneral
        cobertura={cobertura}
        conteos={conteos}
        filtro={filtro}
        onFiltro={useVistaGeneralUi.getState().setFiltro}
        filas={filas}
        seleccionadas={seleccion.ids.length}
        destinosHabilitados={destinosMover}
        onMoverA={moverA}
        onDuplicar={() => duplicar(seleccion.ids)}
        onEliminar={() => { retornoTrasConfirmar.current = itinerante; pedirEliminar(seleccion.ids); }}
        onVaciar={() => useVistaGeneralUi.getState().setSeleccion(SELECCION_VACIA)}
      />
      <span className="pulso-sr-only" role="status" aria-live="polite">{anuncio}</span>
      <div
        ref={cuerpoRef}
        className={`pulso-f6-vg-cuerpo${arrastre ? " is-arrastrando" : ""}`}
        data-qa-scroll-owner="vista-general"
        aria-label="Láminas del informe por capítulo"
        role="region"
      >
        <div className="pulso-f6-vg-filas" data-qa-geometry-group="graficos/f6-vg-filas" data-qa-geometry-contract="intrinsic"
          onDragOver={onSobreHueco} onDrop={manejadores.onSoltar}>
          {filas.map((fila) => {
            if (fila.clase === "capitulo") indiceCapitulo += 1;
            const soltarCapitulo = marca?.clase === "capitulo" && marca.filaId === fila.id ? marca.lado : null;
            return (
              <FilaCapitulo
                key={fila.id}
                fila={fila}
                indiceCapitulo={fila.clase === "capitulo" ? indiceCapitulo : null}
                totalCapitulos={capitulos.length}
                arrastrada={arrastre?.clase === "capitulo" && arrastre.filaId === fila.id}
                soltarCapitulo={soltarCapitulo}
                soltarAlFinal={marca?.clase === "fin-fila" && marca.filaId === fila.id}
                onMoverCapitulo={moverCapitulo}
                onArrastrarCapitulo={onArrastrarCapitulo}
                onSobreFila={onSobreFila}
                onSobreFinFila={onSobreFinFila}
                onSoltar={manejadores.onSoltar}
                onFinArrastre={manejadores.onFinArrastre}
              >
                {fila.tarjetas.map((t) => (
                  <TarjetaLamina
                    key={t.lamina.id}
                    tarjeta={t}
                    estado={estados.get(t.lamina.id)}
                    fuera={!pasaFiltro(filtro, estados.get(t.lamina.id))}
                    slide={porId.get(t.lamina.id)}
                    nombresGraficos={nombresGraficos.get(t.lamina.id) ?? SIN_NOMBRES}
                    seleccionada={elegidas.has(t.lamina.id)}
                    itinerante={t.lamina.id === itinerante}
                    arrastrada={arrastradas.has(t.lamina.id)}
                    soltar={marca?.clase === "tarjeta" && marca.id === t.lamina.id ? marca.lado : null}
                    manejadores={manejadores}
                  />
                ))}
              </FilaCapitulo>
            );
          })}
        </div>
      </div>
      <AvisosVistaGeneral estructura={estructura} onIr={abrir} />
      <ConfirmarEliminar
        titulos={titulosAEliminar}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => useVistaGeneralUi.getState().setConfirmarEliminar(null)}
        retorno={() => tarjetaEl(retornoTrasConfirmar.current) ?? tarjetaEl(vivo.current.itinerante)}
      />
    </div>
  );
}
