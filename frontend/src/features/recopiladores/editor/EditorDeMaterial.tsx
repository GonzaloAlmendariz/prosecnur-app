import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { CollectionBlockType, CollectionMaterialBlock, CollectionStatePayload } from "../../../api/recopiladores";
import type { MaterialPreviewProblem } from "../../../api/materialPreview";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoButton } from "../../../components/PulsoButton";
import { conNivel } from "../../../lib/navegacion/direccion";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { useDireccion } from "../../../lib/navegacion/useDireccion";
import { AlertTriangle, RefreshCw } from "../../../vendor/lucide-react";
import { rotuloDeBloque } from "../bloquesDeMaterial";
import { fichasHechasDelEstado } from "../fichasDelEstado";
import { BarraDelEditor } from "./BarraDelEditor";
import { InspectorDeBloque } from "./InspectorDeBloque";
import {
  actualizarBloque,
  avisoAntesDeGuardar,
  bloqueElegido,
  conCara,
  huellaDeReceta,
  ladoDeCara,
  moverBloque,
  nombreDeReceta,
  notasDe,
  notasDeLaCara,
  type NotasDeBloque,
  parseFoco,
  procedencia,
  puedeMover,
  quitarBloque,
  rotuloDeCara,
  semillaDeBloque,
  serializarFoco,
  tiposQueSePuedenAgregar,
  zonasPorBloque,
} from "./modeloEditor";
import { OutlineDeCara } from "./OutlineDeCara";
import { PANEL_EDITOR_BLOQUE } from "./panelesEditor";
import { PliegoReal, type ZonaDelPliego } from "./PliegoReal";
import { SelectorDeUnidad } from "./SelectorDeUnidad";
import { useRecetaDelEditor } from "./useRecetaDelEditor";
import { useVistaDelPliego } from "./useVistaDelPliego";
import "./editor.css";

export const DIRECCION_DE_TIPOS = "/material-campo?seccion=catalogo&pestana=tipos";
export const DIRECCION_DE_UNIDADES = "/material-campo?seccion=unidades&pestana=lista";

type Props = {
  payload: CollectionStatePayload | null;
  onStateRefresh: () => Promise<void>;
  /** Avisa al shell mientras la receta o su primera página no han llegado. */
  onCargando?: (cargando: boolean) => void;
  onIr?: (to: string) => void;
};

const SIN_NOTAS = { noDibujado: null, avisos: [], problemas: [] };
const SIN_PROBLEMAS: MaterialPreviewProblem[] = [];

/**
 * Catálogo › Editor (E1b): la receta sobre su página real. A la izquierda los
 * bloques de la cara, al centro la página que dibuja el mismo motor del PDF con
 * una zona por bloque, a la derecha el bloque elegido.
 *
 * Qué cara y qué bloque se miran lo dice la dirección (`?foco=ficha~qr`); la
 * unidad de prueba no: es dato del plan y se queda en el editor.
 */
export function EditorDeMaterial({ payload, onStateRefresh, onCargando, onIr }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const direccion = useDireccion();
  const panel = usePanelDireccionable(PANEL_EDITOR_BLOQUE);
  const plan = payload?.state.plan ?? null;
  const fichasCreadas = fichasHechasDelEstado(payload?.state);
  const receta = useRecetaDelEditor({
    revision: payload?.state_revision ?? null,
    fichasCreadas,
    onStateRefresh,
  });
  const { estado, dispatch, borrador, conCambios } = receta;
  const pages = useMemo(() => borrador?.pages ?? [], [borrador]);
  const foco = useMemo(() => parseFoco(direccion?.foco, pages), [direccion?.foco, pages]);
  const cara = pages[foco.cara];
  const elegido = bloqueElegido(cara, foco.blockId);
  const huella = huellaDeReceta(borrador);

  const vista = useVistaDelPliego({
    borrador,
    conCambios,
    huella,
    page: foco.cara + 1,
    caras: pages.length,
    unidad: estado.unidad,
  });

  // El foco viejo (`?foco=qr`) o uno que ya no resuelve se reescribe en su
  // forma canónica, sin dejar una entrada en el historial.
  const escribirFoco = useCallback((valor: string | null, replace = true) => {
    navigate({ pathname: location.pathname, search: conNivel(location.search, "foco", valor) }, { replace });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!pages.length || !foco.reescribir) return;
    escribirFoco(foco.canonico);
  }, [escribirFoco, foco.canonico, foco.reescribir, pages.length]);

  const seleccionar = useCallback((blockId: string) => {
    if (!cara) return;
    escribirFoco(serializarFoco({ pageId: cara.page_id, blockId }));
  }, [cara, escribirFoco]);

  const cambiarCara = useCallback((pageId: string) => {
    escribirFoco(serializarFoco({ pageId, blockId: null }));
  }, [escribirFoco]);

  // Rechazos que se arreglan solos: la unidad que ya no está vuelve a la
  // primera titular; la cara que ya no existe, a la primera.
  const tipoDeFallo = vista.fallo?.tipo ?? null;
  useEffect(() => {
    if (tipoDeFallo === "unidad" && estado.unidad !== null) {
      dispatch({ type: "unidad", unidad: null });
      dispatch({ type: "aviso", aviso: { tono: "info", texto: "Esa unidad ya no está en el plan: se usa la primera titular." } });
    }
    if (tipoDeFallo === "pagina" && pages.length) cambiarCara(pages[0].page_id);
  }, [cambiarCara, dispatch, estado.unidad, pages, tipoDeFallo]);

  // La vista se declara lista con la receta y su primera página resueltas
  // (con imagen o con fallo): antes el QA mediría el esqueleto.
  const cargando = estado.carga.estado === "cargando"
    || (estado.carga.estado === "lista" && !vista.vista && !vista.fallo);
  useEffect(() => { onCargando?.(cargando); }, [cargando, onCargando]);
  useEffect(() => () => onCargando?.(false), [onCargando]);

  const zonas = useMemo(() => zonasPorBloque(vista.deEstaCara, cara?.page_id ?? ""), [cara?.page_id, vista.deEstaCara]);
  const problemas = useMemo(
    () => (vista.fallo?.tipo === "invalida" ? vista.fallo.problemas : SIN_PROBLEMAS),
    [vista.fallo],
  );
  const notas = useMemo(
    () => (cara ? notasDeLaCara({ cara, indice: foco.cara, vista: vista.deEstaCara, problemas }) : { porBloque: new Map<string, NotasDeBloque>(), generales: [] }),
    [cara, foco.cara, problemas, vista.deEstaCara],
  );
  const movibles = useMemo(() => new Set([...zonas.values()].filter((z) => z.reorderable).map((z) => z.block_id ?? "")), [zonas]);

  if (estado.carga.estado === "error") {
    return (
      <div className="rec-vacio-sin-plan" data-qa-geometry-capacity="owned">
        <EstadoVacio
          tamano="normal"
          icono={<AlertTriangle size={18} />}
          titulo="No se pudo abrir la receta"
          descripcion={estado.carga.mensaje}
          accion={(
            <PulsoButton variant="secondary" size="sm" onClick={() => { void receta.cargar(); }}>
              <RefreshCw size={14} aria-hidden /> Reintentar
            </PulsoButton>
          )}
        />
      </div>
    );
  }

  if (!borrador || !cara) {
    return <div className="rec-loading" data-qa-geometry-capacity="owned">Leyendo la receta…</div>;
  }

  const editarCara = (cambiar: (blocks: CollectionMaterialBlock[]) => CollectionMaterialBlock[]) => {
    receta.editar(conCara(borrador, foco.cara, cambiar));
  };
  const cambiarBloque = (patch: Partial<CollectionMaterialBlock>) => {
    if (elegido) receta.editar(actualizarBloque(borrador, foco.cara, elegido.block_id, patch));
  };
  const mover = (dir: -1 | 1) => {
    if (elegido) editarCara((blocks) => moverBloque(blocks, elegido.block_id, dir, movibles));
  };
  const quitar = () => {
    if (!elegido) return;
    const { blocks, siguiente } = quitarBloque(cara.blocks, elegido.block_id);
    receta.editar(conCara(borrador, foco.cara, () => blocks));
    escribirFoco(serializarFoco({ pageId: cara.page_id, blockId: siguiente }));
  };
  const agregar = (type: CollectionBlockType) => {
    const block = semillaDeBloque(type, cara.blocks);
    editarCara((blocks) => [...blocks, block]);
    escribirFoco(serializarFoco({ pageId: cara.page_id, blockId: block.block_id }));
  };

  const lado = ladoDeCara(foco.cara, pages.length);
  const nombreDeCara = rotuloDeCara(cara.layout_preset);
  const opcionesDeCara = pages.map((page, i) => ({
    value: page.page_id,
    label: ladoDeCara(i, pages.length) ?? rotuloDeCara(page.layout_preset),
  }));
  // En el orden de lectura que da la vista (arriba→abajo, izq→der): es el
  // orden de tabulación sobre la página, no el de la receta.
  const zonasDelPliego: ZonaDelPliego[] = [...zonas.values()].flatMap((zona) => {
    const block = cara.blocks.find((b) => b.block_id === zona.block_id);
    if (!block) return [];
    return [{
      zona,
      blockId: block.block_id,
      rotulo: rotuloDeBloque(block.type),
      deLaUnidad: procedencia(block, zona.fills_from).llenaLaUnidad,
      conProblema: notasDe(notas.porBloque, block.block_id).problemas.length > 0,
    }];
  });
  const deLaUnidad = new Set(cara.blocks
    .filter((block) => procedencia(block, zonas.get(block.block_id)?.fills_from).llenaLaUnidad)
    .map((block) => block.block_id));
  const zonaElegida = elegido ? zonas.get(elegido.block_id) ?? null : null;
  const falloVisible = vista.fallo && !vista.alDia
    ? { mensaje: vista.fallo.mensaje, reintentable: vista.fallo.tipo === "no-disponible" || vista.fallo.tipo === "error" }
    : null;
  const unidadUsada = vista.deEstaCara?.unit ?? null;
  const acceso = vista.deEstaCara?.access.source ?? null;
  const aviso = estado.aviso;
  const confirmacion = estado.confirmando ? avisoAntesDeGuardar(fichasCreadas) : null;

  return (
    <div className="rec-ed-contenedor">
      <div
        className="rec-ed"
        data-qa-geometry-group="material-campo/catalogo/editor"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="rec-ed-cabeza">
          <BarraDelEditor
            nombre={nombreDeReceta(borrador)}
            onIrAlCatalogo={onIr ? () => onIr(DIRECCION_DE_TIPOS) : undefined}
            caras={opcionesDeCara}
            caraActiva={cara.page_id}
            onCara={cambiarCara}
            unidad={(
              <SelectorDeUnidad
                units={plan?.units ?? null}
                valor={estado.unidad}
                usada={unidadUsada}
                onCambiar={(unidad) => dispatch({ type: "unidad", unidad })}
                onIrAUnidades={onIr ? () => onIr(DIRECCION_DE_UNIDADES) : undefined}
              />
            )}
            revision={borrador.revision}
            conCambios={conCambios}
            puedeDeshacer={Boolean(estado.historia?.past.length)}
            puedeRehacer={Boolean(estado.historia?.future.length)}
            onDeshacer={() => dispatch({ type: "deshacer" })}
            onRehacer={() => dispatch({ type: "rehacer" })}
            guardando={estado.guardando}
            puedeGuardar={payload !== null}
            onGuardar={receta.guardar}
            confirmacion={confirmacion}
            onConfirmar={() => { void receta.confirmarGuardado(); }}
            onCancelar={() => dispatch({ type: "cancelar-guardado" })}
          />
          {aviso || (vista.fallo && vista.deEstaCara) || notas.generales.length ? (
            <div className="rec-ed-avisos">
              {aviso ? (
                <p className={`rec-ed-aviso is-${aviso.tono}`} role={aviso.tono === "error" ? "alert" : "status"}>{aviso.texto}</p>
              ) : null}
              {vista.fallo && vista.deEstaCara ? (
                <p className={`rec-ed-aviso is-${vista.fallo.tipo === "invalida" ? "error" : "info"}`} role="status">
                  {vista.fallo.mensaje}
                  {vista.fallo.tipo === "no-disponible" || vista.fallo.tipo === "error" ? (
                    <button type="button" className="rec-ed-enlace" onClick={vista.reintentar}>Reintentar</button>
                  ) : null}
                </p>
              ) : null}
              {notas.generales.map((texto) => <p key={texto} className="rec-ed-aviso is-error" role="alert">{texto}</p>)}
            </div>
          ) : null}
        </div>
        <OutlineDeCara
          titulo={lado ? `${lado} · ${nombreDeCara}` : nombreDeCara}
          blocks={cara.blocks}
          seleccion={elegido?.block_id ?? null}
          onSeleccionar={seleccionar}
          deLaUnidad={deLaUnidad}
          notas={notas.porBloque}
          tiposAgregables={tiposQueSePuedenAgregar(cara.blocks)}
          onAgregar={agregar}
        />
        <section className="rec-ed-escenario" aria-label="Página real" data-qa-geometry-capacity="owned">
          <PliegoReal
            vista={vista.deEstaCara}
            papel={borrador.page.orientation === "landscape" ? { w: 297, h: 210 } : { w: 210, h: 297 }}
            zonas={zonasDelPliego}
            seleccion={elegido?.block_id ?? null}
            onSeleccionar={seleccionar}
            alt={`${nombreDeReceta(borrador)}, ${(lado ?? nombreDeCara).toLowerCase()}, con ${unidadUsada?.source === "plan" && unidadUsada.label ? unidadUsada.label : "la unidad de ejemplo"}`}
            cargando={vista.cargando}
            desactualizada={vista.desactualizada}
            fallo={falloVisible}
            onReintentar={vista.reintentar}
            acceso={acceso}
          />
        </section>
        <InspectorDeBloque
          block={elegido}
          zona={zonaElegida}
          notas={elegido ? notasDe(notas.porBloque, elegido.block_id) : SIN_NOTAS}
          puedeSubir={elegido ? puedeMover(cara.blocks, elegido.block_id, -1, movibles) : false}
          puedeBajar={elegido ? puedeMover(cara.blocks, elegido.block_id, 1, movibles) : false}
          onCambiar={cambiarBloque}
          onMover={mover}
          onQuitar={quitar}
          panelProps={panel.props}
        />
      </div>
    </div>
  );
}
