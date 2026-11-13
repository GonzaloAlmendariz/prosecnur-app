// Codificar, la mesa de una pregunta (etapa P3c del rediseño de Procesamiento).
//
// Este archivo compone: una cabecera de una fila (cifras y herramientas) y dos paneles que llegan al pie,
// las respuestas a la izquierda (en tarjetas o en tabla) y los códigos a la derecha. Las piezas, los
// modelos y la hoja viven en `codificar/`; la tabla, en `tabla/`. Aquí se decide qué le pasa a los
// códigos con cada gesto y todo cambio pasa por `mesa.cambiar`, que lo guarda y lo deja deshacer.

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import type { Grupo } from "../../api/client";
import type { ModuloSugerible, PropuestaModulo } from "../../api/codificacion";
import { Alert } from "../../components/Alert";
import { toast } from "../../components/toasterStore";
import { Panel } from "../../components/Panel";
import { PulsoButton } from "../../components/PulsoButton";
import { ErrorBlock } from "../../components/States";
import { BarraDeAvance } from "../../components/BarraDeAvance";
import { SaveStatusIndicator } from "../../components/SaveStatusIndicator";
import { PanelDeMesa } from "../../components/procesamiento/PanelDeMesa";
import type { CifraDePestana } from "../../components/procesamiento/CifrasDePestana";
import { MessageSquare, Undo2 } from "../../vendor/lucide-react";
import { formatoConteo } from "../../lib/formatoNumero";
import { conModificador, rotuloDeAtajo } from "../../lib/teclado";
import { avanceDeRespuestas } from "./avanceRespuestas";
import { avanceDeCodificacion, cifrasDelAvance } from "./avanceDeCodificacion";
import { useAvances } from "./avanceStore";
import { ESTILO_DE_LA_CAPA_DEL_FANTASMA, anunciosDeRespuestas, fantasmaDentroDeLaVentana } from "./codificar/arrastreDeRespuestas";
import { asignarVarias, crearCodigoCon, destinoDeSuelta, quitarUltimoCodigo, siguienteCodigo } from "./codificar/asignacionEnLote";
import { CifrasDeCodificar } from "./codificar/CifrasDeCodificar";
import type { MarcoDeCodificar } from "./codificar/marcoDeCodificar";
import { respuestasConVariosCodigos } from "./codificar/tipoResultante";
import { ConmutadorVista } from "./tabla/ConmutadorVista";
import { CargaDeCodificar } from "./codificar/CargaDeCodificar";
import { FantasmaRespuestas } from "./codificar/FantasmaRespuestas";
import { claveDeArrastre } from "./codificar/FilaRespuesta";
import { FiltroDeRespuestas } from "./codificar/FiltroDeRespuestas";
import { useFiltroRespuestas } from "./codificar/filtroRespuestasStore";
import { ListaRespuestas } from "./codificar/ListaRespuestas";
import { BarraDeSeleccion } from "./codificar/BarraDeSeleccion";
import { PulsoSelect } from "../../components/PulsoSelect";
import { Switch } from "../../components/Switch";
import { avisosDelLote, marcasDelLote, buscarRespuestas, type CifraDeCasos, filasDeRespuestas, filtrarPorCodigo, sumarCasosConTexto, tarjetasDeCodigos } from "./codificar/modeloDeCodificar";
import { BotonModuloSugerido, propuestasPorConfirmar } from "./codificar/ModuloSugerido";
import { PanelCodigos } from "./codificar/PanelCodigos";
import {
  SELECCION_VACIA,
  alternarVarias,
  reconciliarSeleccion,
  respuestasLevantadas,
  seleccionar,
  seleccionarTodo,
  seleccionTrasAsignar,
  soltarSeleccion,
} from "./codificar/seleccionRespuestas";
import { SinRespuestas, type MotivoSinRespuestas } from "./codificar/SinRespuestas";
import { useGruposDeCodificacion } from "./codificar/useGruposDeCodificacion";
import "./codificar/codificar.css";
import "./codificar/lista.css";
import "./codificar/codigos.css";
import "./codificar/ventanas.css";
import { clavesNoRespuesta, separarNoRespuestas } from "./noRespuestas";
import "./noRespuestas.css";
import { PalabrasBoton, PalabrasPanel } from "./PalabrasPanel";
import { colisionDePreguntas } from "./preguntas/arrastre";
import { SugerenciaModuloFila } from "./SugerenciaModuloFila";
import { SugerenciasModuloBanda, type UltimaConfirmacion } from "./SugerenciasModuloBanda";
import {
  confirmarSugerencias,
  deshacerConfirmacion,
  quitarSugerencia,
  rotuloDePropuesta,
  aceptarSugeridas,
  sugeridasPorAceptar,
  sinMarcadoresDelFormulario,
  conEvidenciaSuficiente,
  sugerenciasPorRespuesta,
  type EntradaSugerida,
  type RegistroConfirmacion,
} from "./sugerenciasModulo";
import { quitarCodigo } from "./tabla/asignacionCodigos";
import { BuscadorRespuestas } from "./tabla/BuscadorRespuestas";
import { TablaCodificar } from "./tabla/TablaCodificar";
import { LibroDeCodigos } from "./tabla/LibroDeCodigos";
import { codigosDeTabla } from "./tabla/tablaCodificarModelo";
import { useVistaCodificar } from "./tabla/vistaCodificarStore";
import { useSugerenciasModulo, type EstadoSugerencias } from "./useSugerenciasModulo";

type Props = {
  parent: string;
  /** El marco de la pestaña: cabecera con cifras y mesa de tres columnas (`codificar/marcoDeCodificar.ts`). */
  marco: MarcoDeCodificar;
  /** La pregunta que se codifica, sobre la lista; el tipo que sale depende de los códigos. */
  cabeceraDePregunta: (grupos: readonly Grupo[]) => ReactNode;
};

const SIN_RESPUESTAS: never[] = [];

/** El orden de la tabla como menú (prototipo: "Más repetidas primero"). */
const ORDENES_DE_TABLA = [
  { value: "frecuencia", label: "Más repetidas primero" },
  { value: "alfabetico", label: "De la A a la Z" },
];

export function RespuestasCodificador({ parent, marco, cabeceraDePregunta }: Props) {
  const [liveMsg, setLiveMsg] = useState("");
  const anunciar = useCallback((mensaje: string) => {
    setLiveMsg(mensaje);
    window.setTimeout(() => setLiveMsg(""), 1200);
  }, []);
  const mesa = useGruposDeCodificacion(parent, anunciar);
  const { carga, grupos } = mesa;
  const respuestas = carga?.respuestas ?? null;
  const tipo = carga?.tipo ?? "";
  const colEfectiva = carga?.colEfectiva ?? "";
  // La única regla de cuándo una respuesta admite varios códigos: una múltiple con su opción "Otros".
  const esSM = tipo === "select_multiple" && !!carga?.smOtros;

  // Tarjetas o tabla, y todas o por codificar: se recuerdan entre preguntas (este componente se vuelve a montar con cada una).
  const vista = useVistaCodificar((s) => s.vista);
  const elegirVista = useVistaCodificar((s) => s.elegirVista);
  const ordenTabla = useVistaCodificar((s) => s.orden);
  const elegirOrdenTabla = useVistaCodificar((s) => s.elegirOrden);
  const agruparTabla = useVistaCodificar((s) => s.agrupar);
  const alternarAgrupar = useVistaCodificar((s) => s.alternarAgrupar);
  const filtro = useFiltroRespuestas((s) => s.filtro);
  const elegirFiltro = useFiltroRespuestas((s) => s.elegirFiltro);

  const [query, setQuery] = useState("");
  const [seleccionElegida, setSeleccion] = useState(SELECCION_VACIA);
  // Las respuestas que se arrastran, y las que esperan el nombre del código nuevo (`null` con el formulario cerrado).
  const [lote, setLote] = useState<{ levantadas: string[]; paraNuevo: string[] | null }>({ levantadas: [], paraNuevo: null });
  // TXT-3: la propuesta de módulo (solo texto abierto), su fila a pedido y la última confirmación por módulo.
  const [modulo, setModulo] = useState<{ abierto: boolean; version: number; ultima: { registro: RegistroConfirmacion; aviso: UltimaConfirmacion } | null }>({
    abierto: false,
    version: 0,
    ultima: null,
  });
  const idModulo = `${useId()}-modulo`;
  // TXT-6/7: guardar el diccionario de la pregunta (panel "Palabras") vuelve a pedir la propuesta.
  const alGuardarDiccionario = useCallback(() => setModulo((m) => ({ ...m, version: m.version + 1 })), []);
  const sugerenciasDelMotor = useSugerenciasModulo(colEfectiva, tipo === "text" && !!respuestas, modulo.version);
  // Los módulos con un marcador del formulario sin reemplazar (`${sede_ppl}`) no se ofrecen como código.
  const sugerencias = useMemo<EstadoSugerencias>(
    () => (sugerenciasDelMotor.fase === "lista" ? { fase: "lista", datos: conEvidenciaSuficiente(sinMarcadoresDelFormulario(sugerenciasDelMotor.datos)) } : sugerenciasDelMotor),
    [sugerenciasDelMotor],
  );
  const mapaSugerencias = useMemo(
    () => (sugerencias.fase === "lista" && respuestas ? sugerenciasPorRespuesta(sugerencias.datos, respuestas) : new Map<string, EntradaSugerida>()),
    [sugerencias, respuestas],
  );

  // Las respuestas a la vista: lo buscado, lo que falta si así se pidió, y las no respuestas al final (TXT-12).
  const tramos = useMemo(() => {
    const todas = respuestas ?? SIN_RESPUESTAS;
    const visibles = filtrarPorCodigo(buscarRespuestas(todas, query), grupos, filtro);
    const claves = sugerencias.fase === "lista" ? clavesNoRespuesta(sugerencias.datos, todas) : new Set<string>();
    return separarNoRespuestas(visibles, claves);
  }, [respuestas, query, grupos, filtro, sugerencias]);

  // Con código y pendientes salen de la misma lista (regla en avanceRespuestas.ts): un código guardado
  // para un texto que la base ya no trae no cuenta.
  const avance = useMemo(() => avanceDeRespuestas(respuestas, grupos), [respuestas, grupos]);
  // Una definición para toda la sección (avanceDeCodificacion.ts): "respuestas" son casos y "textos
  // distintos" las respuestas únicas. La cabecera dice respuestas; la barra, textos distintos.
  const avanceCod = useMemo(() => avanceDeCodificacion(respuestas ?? SIN_RESPUESTAS, grupos), [respuestas, grupos]);
  const ponerAvance = useAvances((s) => s.poner);
  useEffect(() => {
    if (respuestas) ponerAvance(parent, { avance: avanceCod, grupos });
  }, [parent, respuestas, avanceCod, grupos, ponerAvance]);
  const nOtros = esSM ? carga?.smOtros?.n_otros_marcados : null;
  const casos: CifraDeCasos[] = [
    ...cifrasDelAvance(avanceCod),
    ...(typeof nOtros === "number" ? [{ id: "otros", valor: nOtros, singular: 'marcó "Otro"', plural: 'marcaron "Otro"' }] : []),
  ];
  const codigos = useMemo(() => codigosDeTabla(grupos, respuestas ?? SIN_RESPUESTAS), [grupos, respuestas]);
  // La base de la barra de proporción de cada código: los casos que escribieron algo en la pregunta.
  const casosConTexto = useMemo(() => sumarCasosConTexto(respuestas ?? SIN_RESPUESTAS), [respuestas]);
  const filas = useMemo(() => filasDeRespuestas(tramos, grupos, codigos), [tramos, grupos, codigos]);
  const tarjetas = useMemo(() => tarjetasDeCodigos(grupos, respuestas ?? SIN_RESPUESTAS), [grupos, respuestas]);
  const orden = useMemo(() => filas.map((f) => f.clave), [filas]);
  const seleccion = useMemo(() => reconciliarSeleccion(seleccionElegida, orden), [seleccionElegida, orden]);
  const enJuego = lote.levantadas.length ? lote.levantadas : seleccion.claves;
  const avisos = useMemo(() => avisosDelLote(codigos, respuestas ?? SIN_RESPUESTAS, enJuego), [codigos, respuestas, enJuego]);

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const rotuloDeCodigo = (grupoId: string) => codigos.find((c) => c.id === grupoId)?.rotulo ?? "";
  const anuncios = anunciosDeRespuestas(
    (zona) => {
      const destino = destinoDeSuelta(zona);
      return destino?.tipo === "codigo" ? `el código ${rotuloDeCodigo(destino.grupoId)}` : "un código nuevo";
    },
    () => lote.levantadas.length,
  );

  // Cmd o Ctrl y Z deshace el último paso, esté donde esté el foco; un campo de texto o un diálogo abierto
  // deshacen lo suyo. (El selector busca diálogos, no dibuja uno: va sin comillas para no contarse como tal.)
  const deshacer = mesa.deshacer;
  useEffect(() => {
    function alTeclear(evento: KeyboardEvent) {
      if (!conModificador(evento) || evento.shiftKey || evento.altKey || evento.key.toLowerCase() !== "z") return;
      const origen = evento.target instanceof HTMLElement ? evento.target : null;
      if (origen && (origen.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(origen.tagName) || origen.closest("[role=dialog]"))) return;
      if (deshacer()) evento.preventDefault();
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [deshacer]);

  function textoDe(clave: string): string {
    return filas.find((f) => f.clave === clave)?.texto ?? tarjetas.flatMap((t) => t.respuestas).find((r) => r.clave === clave)?.texto ?? clave;
  }
  /** `"Iglesia"` para una respuesta, `3 respuestas` para varias. */
  function nombreDelLote(claves: readonly string[]): string {
    return claves.length === 1 ? `"${textoDe(claves[0])}"` : `${formatoConteo(claves.length)} respuestas`;
  }

  // Con `esSM` el código se suma; sin él, la respuesta sale de donde esté (regla en tabla/asignacionCodigos.ts).
  function asignar(claves: readonly string[], grupoId: string, despues: "siguiente" | "quedarse" | "soltar") {
    const rotulo = rotuloDeCodigo(grupoId);
    if (!rotulo || claves.length === 0) return;
    const paso = `${nombreDelLote(claves)} ${claves.length === 1 ? "asignada" : "asignadas"} al código ${rotulo}`;
    const resultado = mesa.cambiar((gs) => asignarVarias(gs, claves, grupoId, esSM), paso);
    anunciar(`${paso}.`);
    // El aviso del prototipo tras asignar en tarjetas, con "Deshacer" (Cmd o Ctrl y Z hace lo mismo). En la
    // tabla, donde se asigna fila tras fila con Enter, no se avisa cada vez.
    if (despues !== "quedarse") {
      const nombre = codigos.find((c) => c.id === grupoId)?.nombre ?? rotulo;
      toast.info(`${claves.length === 1 ? "1 respuesta" : `${formatoConteo(claves.length)} respuestas`} a "${nombre}"`, {
        accion: { label: "Deshacer", onSelect: () => void deshacer() },
      });
    }
    if (despues === "soltar") setSeleccion((s) => soltarSeleccion(s));
    else if (despues === "siguiente") {
      const asignadas = new Set(resultado.flatMap((g) => g.respuestas));
      setSeleccion(seleccionTrasAsignar(claves, orden, (clave) => asignadas.has(clave)));
    }
  }

  function quitarDeCodigo(clave: string, grupoId: string) {
    const paso = `"${textoDe(clave)}" sin el código ${rotuloDeCodigo(grupoId)}`;
    mesa.cambiar((gs) => quitarCodigo(gs, clave, grupoId), paso);
    anunciar(`${paso}.`);
  }

  // "Aceptar las N sugeridas" de la tabla: la misma confirmación que la fila de tarjetas, de una vez.
  const porAceptar = sugeridasPorAceptar(mapaSugerencias, grupos);
  function aceptarTodas() {
    if (!porAceptar.length) return;
    const n = porAceptar.length;
    const paso = n === 1 ? "1 sugerencia aceptada" : `${formatoConteo(n)} sugerencias aceptadas`;
    mesa.cambiar((gs) => aceptarSugeridas(gs, porAceptar), paso);
    anunciar(`${paso}.`);
  }

  /** Quita un código de varias respuestas en un solo paso (una fila de la tabla que junta parecidas). */
  function quitarDeVarias(claves: readonly string[], grupoId: string) {
    const paso = `${nombreDelLote(claves)} sin el código ${rotuloDeCodigo(grupoId)}`;
    mesa.cambiar((gs) => claves.reduce((acc, clave) => quitarCodigo(acc, clave, grupoId), gs), paso);
    anunciar(`${paso}.`);
  }

  function quitarUltimo(claves: readonly string[]) {
    const paso = `código quitado a ${nombreDelLote(claves)}`;
    mesa.cambiar((gs) => quitarUltimoCodigo(gs, claves), paso);
    anunciar(`Se quitó el código a ${nombreDelLote(claves)}.`);
  }

  function crearCon(claves: readonly string[], nombre: string, despues: "siguiente" | "quedarse" | "soltar") {
    const id = `g_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const numero = siguienteCodigo(grupos);
    const paso = claves.length ? `código ${numero}. ${nombre} creado con ${nombreDelLote(claves)}` : `código ${numero}. ${nombre} creado`;
    const resultado = mesa.cambiar((gs) => crearCodigoCon(gs, claves, nombre, esSM, id).grupos, paso);
    anunciar(`Se creó el código ${numero}. ${nombre}.`);
    setLote((l) => ({ ...l, paraNuevo: null }));
    if (despues === "soltar") setSeleccion((s) => soltarSeleccion(s));
    else if (despues === "siguiente" && claves.length) {
      const asignadas = new Set(resultado.flatMap((g) => g.respuestas));
      setSeleccion(seleccionTrasAsignar(claves, orden, (clave) => asignadas.has(clave)));
    }
  }

  function cambiarGrupo(id: string, cambio: Partial<Grupo>) {
    mesa.cambiar((gs) => gs.map((g) => (g.id === id ? { ...g, ...cambio } : g)), "código editado");
  }

  function eliminarGrupo(id: string) {
    const rotulo = rotuloDeCodigo(id);
    mesa.cambiar((gs) => gs.filter((g) => g.id !== id), `código ${rotulo} eliminado`);
    anunciar(`Se eliminó el código ${rotulo}.`);
  }

  // El orden se guarda y es el del archivo de salida.
  function moverGrupo(id: string, hacia: "arriba" | "abajo") {
    mesa.cambiar((gs) => {
      const i = gs.findIndex((g) => g.id === id);
      const j = hacia === "arriba" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= gs.length) return gs;
      const lista = [...gs];
      [lista[i], lista[j]] = [lista[j], lista[i]];
      return lista;
    }, "código movido");
  }

  function confirmarPropuesta(entrada: EntradaSugerida, p: PropuestaModulo) {
    const r = rotuloDePropuesta(p);
    const paso = `"${textoDe(entrada.clave)}" confirmada en ${r.corto}`;
    mesa.cambiar((gs) => confirmarSugerencias(gs, { codigo: p.codigo, etiqueta: r.grupo }, [entrada]).grupos, paso);
    anunciar(`${paso}.`);
  }

  function quitarPropuesta(entrada: EntradaSugerida, p: PropuestaModulo) {
    const r = rotuloDePropuesta(p);
    const paso = `"${textoDe(entrada.clave)}" quitada de ${r.corto}`;
    mesa.cambiar((gs) => quitarSugerencia(gs, p.codigo, entrada.clave), paso);
    anunciar(`${paso}.`);
  }

  function confirmarModulo(m: ModuloSugerible, entradas: EntradaSugerida[]) {
    if (!entradas.length) return;
    const r = rotuloDePropuesta(m);
    const cuantas = entradas.length === 1 ? "1 respuesta" : `${formatoConteo(entradas.length)} respuestas`;
    const salida = confirmarSugerencias(grupos, { codigo: m.codigo, etiqueta: r.grupo }, entradas);
    mesa.cambiar(() => salida.grupos, `${cuantas} confirmadas en ${r.corto}`);
    setModulo((actual) => ({ ...actual, ultima: { registro: salida.registro, aviso: { modulo: r.corto, n: entradas.length } } }));
    anunciar(`${entradas.length === 1 ? "Se confirmó 1 respuesta" : `Se confirmaron ${formatoConteo(entradas.length)} respuestas`} en ${r.corto}.`);
  }

  function deshacerMasiva() {
    const ultima = modulo.ultima;
    if (!ultima) return;
    mesa.cambiar((gs) => deshacerConfirmacion(gs, ultima.registro), `confirmación en ${ultima.aviso.modulo} retirada`);
    anunciar(`Se deshizo la confirmación en ${ultima.aviso.modulo}.`);
    setModulo((actual) => ({ ...actual, ultima: null }));
  }

  function alLevantar(evento: DragStartEvent) {
    const clave = claveDeArrastre(evento.active.id);
    const levantadas = respuestasLevantadas(seleccion, clave);
    if (!seleccion.claves.includes(clave)) setSeleccion(seleccionar(seleccion, clave, "unica", orden));
    setLote((l) => ({ ...l, levantadas }));
  }

  function alSoltar(evento: DragEndEvent) {
    const levantadas = respuestasLevantadas(seleccion, claveDeArrastre(evento.active.id));
    const destino = destinoDeSuelta(evento.over?.id);
    setLote((l) => ({ levantadas: [], paraNuevo: destino?.tipo === "nuevo" ? levantadas : l.paraNuevo }));
    if (destino?.tipo === "codigo") asignar(levantadas, destino.grupoId, "soltar");
  }

  if (mesa.errorDeCarga) {
    return marco({
      columnas: (
        <Panel noPadding className="pulso-cc-ancho">
          <ErrorBlock
            label="No se pudieron cargar las respuestas"
            detail={mesa.errorDeCarga}
            queda="Los códigos guardados siguen como estaban"
            acciones={<PulsoButton variant="secondary" size="sm" onClick={mesa.reintentarCarga}>Reintentar</PulsoButton>}
          />
        </Panel>
      ),
    });
  }
  // En texto abierto se espera también la propuesta de módulo (o su error): la mesa se monta una vez y con sus chips.
  if (!respuestas || (tipo === "text" && (sugerencias.fase === "cargando" || sugerencias.fase === "apagado"))) {
    return marco({
      columnas: <CargaDeCodificar rotulo={respuestas ? "Leyendo los módulos del formulario" : "Cargando respuestas"} />,
    });
  }

  const vacio: MotivoSinRespuestas | null =
    filas.length > 0 ? null : respuestas.length === 0 ? "sin-respuestas" : query.trim() ? "sin-coincidencias" : filtro === "sin-codigo" ? "todas-con-codigo" : "sin-respuestas";
  const verTodas = () => {
    elegirFiltro("todas");
    setQuery("");
  };
  const todasElegidas = orden.length > 0 && seleccion.claves.length === orden.length;
  // La tabla elige con su casilla; lo elegido se asigna con la misma barra que en tarjetas.
  const elegidasEnTabla = new Set(seleccion.claves);
  const filasElegidas = filas.filter((f) => elegidasEnTabla.has(f.clave));
  const comunesEnTabla = filasElegidas.length
    ? filasElegidas[0].codigos.filter((c) => filasElegidas.every((f) => f.codigos.some((x) => x.id === c.id)))
    : [];
  const loteEnTabla = marcasDelLote(respuestas, seleccion.claves);
  const primeraLevantada = lote.levantadas[0];
  const textoDeshacer = mesa.ultimoPaso ? `Deshacer: ${mesa.ultimoPaso}` : "Deshacer";
  const varios = respuestasConVariosCodigos(grupos);

  // Las cifras de la pregunta en la cabecera de la pestaña. "Respuestas con código" cuenta textos distintos
  // (la regla de avanceRespuestas.ts); "con más de un código" solo en una abierta, la única que hoy puede
  // salir múltiple por lo codificado (en una pareja el tipo lo fija su pregunta cerrada).
  const cifras: CifraDePestana[] = [
    {
      clave: "respuestas",
      valor: formatoConteo(avanceCod.casosConCodigo),
      base: formatoConteo(avanceCod.casos),
      rotulo: "respuestas con código",
      titulo: "Respuestas (personas que escribieron) con al menos un código, sobre las respuestas de la pregunta",
      rango: 1,
    },
    { clave: "codigos", valor: formatoConteo(tarjetas.length), rotulo: tarjetas.length === 1 ? "código" : "códigos" },
    ...(tipo === "text" ? [{ clave: "varios", valor: formatoConteo(varios), rotulo: "con más de un código", rango: 3 as const }] : []),
  ];

  // En la cabecera de la pestaña, como en el prototipo, solo la vista. El guardado y deshacer son de las
  // respuestas: van al final de la fila del buscador, junto a lo que cambian.
  const acciones = <ConmutadorVista vista={vista} onElegir={elegirVista} />;
  const guardadoYDeshacer = (
    <>
      <SaveStatusIndicator state={mesa.guardado} variant="badge" />
      <PulsoButton
        variant="icon"
        size="sm"
        disabled={!mesa.ultimoPaso}
        onClick={deshacer}
        aria-label={textoDeshacer}
        title={rotuloDeAtajo(textoDeshacer, "Z")}
      >
        <Undo2 aria-hidden="true" />
      </PulsoButton>
    </>
  );

  const herramientas = (
    <>
      {tipo === "text" && sugerencias.fase === "lista" ? (
        <BotonModuloSugerido
          abierto={modulo.abierto}
          controla={idModulo}
          porConfirmar={propuestasPorConfirmar(mapaSugerencias, grupos)}
          onAlternar={() => setModulo((m) => ({ ...m, abierto: !m.abierto }))}
        />
      ) : null}
      {tipo === "text" && colEfectiva ? (
        <>
          <PalabrasBoton />
          <PalabrasPanel variable={colEfectiva} onGuardado={alGuardarDiccionario} />
        </>
      ) : null}
    </>
  );

  return marco({
    cifras,
    acciones,
    pendientes:
      tipo === "text"
        ? undefined
        : "Con más de un código: una pareja de opción única no admite un segundo código hasta el cambio de motor D12 (plan 5.3, fase F4)",
    columnas: (
      <DndContext
        sensors={sensores}
        collisionDetection={colisionDePreguntas}
        accessibility={{ announcements: anuncios }}
        onDragStart={alLevantar}
        onDragEnd={alSoltar}
        onDragCancel={() => setLote((l) => ({ ...l, levantadas: [] }))}
      >
        <PanelDeMesa
          zona="respuestas"
          titulo="Respuestas"
          icono={<MessageSquare size={15} />}
          conteo={filas.length}
          acciones={<FiltroDeRespuestas filtro={filtro} onElegir={elegirFiltro} />}
        >
          <div className="pulso-codificacion-respuestas pulso-cc-mesa" data-audit-ready="codificacion-codificar" data-vista={vista}>
            {cabeceraDePregunta(grupos)}
            <div className="pulso-cc-avance">
              <BarraDeAvance valor={avanceCod.casosConCodigo} total={avanceCod.casos} etiqueta="Respuestas con código" />
              <CifrasDeCodificar casos={casos} />
            </div>
            <div className="pulso-sr-only" aria-live="polite" aria-atomic="true">
              {liveMsg}
            </div>
            {mesa.guardado === "error" ? (
              <Alert kind="error" acciones={<PulsoButton variant="secondary" size="sm" onClick={mesa.reintentarGuardado}>Reintentar</PulsoButton>}>
                No se pudo guardar la codificación: {mesa.errorDeGuardado}
              </Alert>
            ) : null}
            {tipo === "text" && sugerencias.fase === "lista" && modulo.abierto ? (
              <div id={idModulo} className="pulso-cc-modulo">
                <SugerenciasModuloBanda
                  datos={sugerencias.datos}
                  mapa={mapaSugerencias}
                  grupos={grupos}
                  ultima={modulo.ultima?.aviso ?? null}
                  onConfirmarModulo={confirmarModulo}
                  onDeshacer={deshacerMasiva}
                />
              </div>
            ) : null}
            {tipo === "text" && sugerencias.fase === "error" ? (
              <p className="pulso-cv2-modsug-banda-vacia pulso-cc-nota" role="note">No se pudo proponer un módulo para estos comentarios: {sugerencias.mensaje}</p>
            ) : null}
            <div className="pulso-cc-busca">
              {vista === "tarjetas" ? (
                <input
                  type="checkbox"
                  className="pulso-cc-todas"
                  checked={todasElegidas}
                  disabled={orden.length === 0}
                  ref={(casilla) => {
                    if (casilla) casilla.indeterminate = seleccion.claves.length > 0 && !todasElegidas;
                  }}
                  onChange={() => setSeleccion(todasElegidas ? soltarSeleccion(seleccion) : seleccionarTodo(orden, seleccion))}
                  aria-label="Seleccionar todas las respuestas a la vista"
                  title="Seleccionar todas"
                />
              ) : null}
              <BuscadorRespuestas valor={query} onCambiar={setQuery} etiqueta={`Buscar respuestas de ${parent}`} placeholder="Buscar en las respuestas" />
              {vista === "tabla" ? (
                // El orden y "Agrupar parecidas" de la tabla, junto al buscador (prototipo, vista de tabla).
                <>
                  <PulsoSelect
                    size="sm"
                    className="pulso-cc-orden"
                    value={ordenTabla}
                    onValueChange={(v) => elegirOrdenTabla(v === "alfabetico" ? "alfabetico" : "frecuencia")}
                    options={ORDENES_DE_TABLA}
                    ariaLabel="Orden de las respuestas"
                  />
                  <label className="pulso-cc-agrupar">
                    <Switch checked={agruparTabla} onToggle={alternarAgrupar} ariaLabel="Agrupar parecidas" />
                    <span aria-hidden="true">Agrupar parecidas</span>
                  </label>
                </>
              ) : null}
              {guardadoYDeshacer}
            </div>
            {vacio ? (
              <SinRespuestas motivo={vacio} onVerTodas={verTodas} />
            ) : vista === "tabla" ? (
              <div className="pulso-cc-lista" data-con-barra={seleccion.claves.length ? "" : undefined}>
              <TablaCodificar
                pregunta={parent}
                respuestas={respuestas}
                tramos={tramos}
                grupos={grupos}
                busqueda={query}
                onBuscar={setQuery}
                buscadorPropio={false}
                permiteVarios={esSM}
                onAsignar={(clave, grupoId) => asignar([clave], grupoId, "quedarse")}
                onQuitar={quitarDeCodigo}
                onCrear={(clave, nombre) => crearCon([clave], nombre, "quedarse")}
                elegidas={elegidasEnTabla}
                onAlternar={(claves) => setSeleccion((s) => alternarVarias(s, claves, orden))}
                onAsignarLote={(claves, grupoId) => asignar(claves, grupoId, "quedarse")}
                onCrearLote={(claves, nombre) => crearCon(claves, nombre, "quedarse")}
                onQuitarLote={(claves, grupoId) => quitarDeVarias(claves, grupoId)}
                sugerenciaDe={mapaSugerencias.size > 0 ? (clave) => {
                  const entrada = mapaSugerencias.get(clave);
                  if (!entrada?.propuestas.length) return null;
                  return (
                    <SugerenciaModuloFila
                      entrada={entrada}
                      grupos={grupos}
                      onConfirmar={(p) => confirmarPropuesta(entrada, p)}
                      onQuitar={(p) => quitarPropuesta(entrada, p)}
                    />
                  );
                } : undefined}
                pie={porAceptar.length > 0 ? (
                  <PulsoButton variant="secondary" size="sm" onClick={aceptarTodas}>
                    {porAceptar.length === 1 ? "Aceptar la sugerida" : `Aceptar las ${formatoConteo(porAceptar.length)} sugeridas`}
                  </PulsoButton>
                ) : undefined}
              />
              {seleccion.claves.length ? (
                <BarraDeSeleccion
                  seleccionadas={seleccion.claves.length}
                  conCodigo={filasElegidas.filter((f) => f.codigos.length > 0).length}
                  cifras=""
                  aviso=""
                  codigos={codigos}
                  comunes={comunesEnTabla}
                  marcas={loteEnTabla.marcas}
                  veces={loteEnTabla.veces}
                  onAsignar={(grupoId) => asignar(seleccion.claves, grupoId, "soltar")}
                  onCrear={(nombre) => crearCon(seleccion.claves, nombre, "soltar")}
                  onQuitar={() => quitarUltimo(seleccion.claves)}
                  onSoltar={() => setSeleccion((s) => soltarSeleccion(s))}
                  onSalir={() => undefined}
                />
              ) : null}
              </div>
            ) : (
              <ListaRespuestas
                pregunta={parent}
                respuestas={respuestas}
                filas={filas}
                codigos={codigos}
                permiteVarios={esSM}
                seleccion={seleccion}
                onSeleccion={setSeleccion}
                levantadas={lote.levantadas}
                extraDeFila={mapaSugerencias.size > 0 ? (clave) => {
                  const entrada = mapaSugerencias.get(clave);
                  // Sin propuesta no hay nada que decir: la ausencia no lleva rótulo ("Sin módulo claro" se retiró).
                  if (!entrada?.propuestas.length) return null;
                  return (
                    <SugerenciaModuloFila
                      entrada={entrada}
                      grupos={grupos}
                      onConfirmar={(p) => { if (entrada) confirmarPropuesta(entrada, p); }}
                      onQuitar={(p) => { if (entrada) quitarPropuesta(entrada, p); }}
                    />
                  );
                } : undefined}
                onAsignar={(claves, grupoId, quedarse) => asignar(claves, grupoId, quedarse ? "quedarse" : "siguiente")}
                onCrear={(claves, nombre) => crearCon(claves, nombre, "siguiente")}
                onQuitarCodigo={quitarDeCodigo}
                onQuitarUltimo={quitarUltimo}
              />
            )}
          </div>
        </PanelDeMesa>

        {vista === "tabla" ? (
          <LibroDeCodigos
            tarjetas={tarjetas}
            casosConTexto={casosConTexto}
            sinCodigo={avanceCod.casos - avanceCod.casosConCodigo}
            arrastrando={lote.levantadas.length > 0}
            siguiente={siguienteCodigo(grupos)}
            pendientesDeNuevo={lote.paraNuevo ? lote.paraNuevo.length : null}
            herramientas={herramientas}
            onAbrirNuevo={() => setLote((l) => ({ ...l, paraNuevo: l.paraNuevo ?? [] }))}
            onCrear={(nombre) => crearCon(lote.paraNuevo ?? [], nombre, "soltar")}
            onCancelarNuevo={() => setLote((l) => ({ ...l, paraNuevo: null }))}
          />
        ) : (
        <PanelCodigos
          tarjetas={tarjetas}
          grupos={grupos}
          respuestas={respuestas}
          casosConTexto={casosConTexto}
          permiteVarios={esSM}
          arrastrando={lote.levantadas.length > 0}
          avisos={avisos}
          siguiente={siguienteCodigo(grupos)}
          pendientesDeNuevo={lote.paraNuevo ? lote.paraNuevo.length : null}
          herramientas={herramientas}
          onAbrirNuevo={() => setLote((l) => ({ ...l, paraNuevo: l.paraNuevo ?? [] }))}
          onCrear={(nombre) => crearCon(lote.paraNuevo ?? [], nombre, "soltar")}
          onCancelarNuevo={() => setLote((l) => ({ ...l, paraNuevo: null }))}
          onCambiar={cambiarGrupo}
          onEliminar={eliminarGrupo}
          onMover={moverGrupo}
          onQuitarRespuesta={quitarDeCodigo}
          onAgregarRespuesta={(clave, grupoId) => asignar([clave], grupoId, "quedarse")}
        />
        )}

      {/* El fantasma se porta a document.body: un ancestro con transform haría de bloque contenedor de su
          position: fixed y lo separaría del cursor. El portal conserva el contexto del arrastre. */}
      {createPortal(
        <DragOverlay dropAnimation={null} modifiers={[fantasmaDentroDeLaVentana]} style={ESTILO_DE_LA_CAPA_DEL_FANTASMA}>
          {primeraLevantada ? <FantasmaRespuestas texto={textoDe(primeraLevantada)} cuantas={lote.levantadas.length} /> : null}
        </DragOverlay>,
        document.body,
      )}
      </DndContext>
    ),
  });
}
