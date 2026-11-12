import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { codigoDeError, esEstadoInicial, vacioSinDatos } from "../estadoEsperado";
import { AlertTriangle, Compass, List } from "../../../vendor/lucide-react";
import {
  apiV2ExplorarBivariado,
  apiV2ExplorarFicha,
  apiV2ExplorarUnivariado,
  apiV2ExplorarVariables,
  apiV2Limpieza,
  type ExplorarBivariadoResult,
  type ExplorarFiltros,
  type ExplorarFuente,
  type ExplorarUnivariadoResult,
} from "../../../api/validacion";
import type { ExploradorFicha } from "../../../api/validacionExplorar";
import type { ExploradorVariable, ExploradorVariablesList } from "../types";
import { useValidacionStore } from "../store";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../../components/States";
import { MesaDePestana, PilaDeMesa } from "../../../components/procesamiento/MesaDePestana";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { RepeatGrainNote } from "../../../components/RepeatGrainNote";
import {
  buildExplorerGrain,
  scopeRepeatSections,
  withRepeatIdentityFilter,
  type ProcessingSheetRepeatContext,
} from "../../../lib/rosterExplorer";
import PlotlyView from "../components/PlotlyView";
import FiltroCascada from "../components/FiltroCascada";
import CrossBar from "../components/CrossBar";
import RepeatDimensionBar from "../components/RepeatDimensionBar";
import BarraLectura from "./explorar/BarraLectura";
import ConmutadoresDeLectura from "./explorar/ConmutadoresDeLectura";
import ReglasDeLaPregunta from "./explorar/ReglasDeLaPregunta";
import { useCatalogoDeExplorar } from "./explorar/useCatalogoDeExplorar";
import { LECTURA_INICIAL, conmutadoresAplican, type LecturaDeDistribucion } from "./explorar/lecturaDeDistribucion";
import CabeceraDeTransicion from "../pestanas/CabeceraDeTransicion";
import { cabeceraDeExplorar } from "../pestanas/cabeceraDeValidacion";
import CabeceraPregunta from "./explorar/CabeceraPregunta";
import FlechasDePregunta from "./explorar/FlechasDePregunta";
import ListaDePreguntas from "./explorar/ListaDePreguntas";
import { fraseEnTexto, lecturaDelFormulario } from "./explorar/lecturaDelFormulario";
import { useSeleccionDeValidacion } from "../pestanaDireccionable";
import Cruce from "./explorar/Cruce";
import Distribucion from "./explorar/Distribucion";
import ExplorarLoadingPanel from "./explorar/ExplorarLoadingPanel";
import FuenteToggle from "./explorar/FuenteToggle";
import GraficoTarjeta from "./explorar/GraficoTarjeta";
import PanelApartaTotal from "./explorar/PanelApartaTotal";
import PanelFormulario from "./explorar/PanelFormulario";
import TextResponsesView from "./explorar/TextResponsesView";
import TiraCifras from "./explorar/TiraCifras";
import { enfrentados } from "./explorar/CruceEnfrentados";
import { recodificacion } from "./explorar/CruceRecodificacion";
import { cifrasClave, fraseBase, lecturaInicial, modeloCalor, resolverBase, type LecturaCalor } from "./explorar/explorarModelo";
import { findSeccionOf, pickInitialVariable } from "./explorar/seleccionInicial";
import "../../../app/tokens-datos.css";
import "./explorar/explorar.css";
import { VacioListo } from "../components/VacioListo";

// =============================================================================
// ExplorarTab — Sprint 3
// =============================================================================
// Revamp 2026-11-02 (docs/qa/checklist-explorador-variables-2026-11-02.md) y
// rebanada V5 del plan de fidelidad (cabecera y retoques del prototipo):
//   - Cabecera de la pestaña: preguntas, casos, cruce y filtros, y la versión
//     de la base (Cargada / Limpia) como acción (D-F9).
//   - La mesa de tres columnas del kit (MesaDePestana), como Reglas.
//   - Izquierda: "Preguntas" (E1), que no se pliega al cruzar.
//   - Centro: cabecera (E2), barra de lectura Cruzar por | Filtros con los
//     conmutadores Porcentaje / Casos y Gráfico / Tabla (E3), la base en una
//     frase (E4), la tira de cifras (E5) y el gráfico por tipo (E6) o el cruce
//     por par de tipos (E8/E9).
//   - Derecha: "En el formulario" (E10) o, con una tabla cruzada, "Lectura
//     del cruce"; y siempre "Reglas sobre esta pregunta".
// La pregunta explorada vive en la dirección (`foco=<código>`): se lee al
// abrir, se escribe al elegir otra y es la dirección de "Ver en Explorar".
// Si el motor aún no manda `dist`, `cruce` o la ficha, cada pieza cae a lo
// anterior (Plotly, las tarjetas KPI) o no se muestra.
//
// El enlace viejo por el store (prefill.explorar.var) se pasa al foco al montar.

export default function ExplorarTab({
  repeat = null,
}: {
  /** Contexto relacional cuando la base explorada es una hija repeat (Fase 5). */
  repeat?: ProcessingSheetRepeatContext | null;
}) {
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);
  const prefill = useValidacionStore((s) => s.prefill.explorar);
  const clearPrefill = useValidacionStore((s) => s.clearPrefill);
  // Una base de grupo repetido no tiene plan propio: sus reglas están en el catálogo de la madre.
  const catalogo = useCatalogoDeExplorar(repeat?.parentBase ?? baseNombre, version);

  const [inv, setInv] = useState<ExploradorVariablesList | null>(null);
  const { foco, elegir } = useSeleccionDeValidacion();
  const [uni, setUni] = useState<ExplorarUnivariadoResult | null>(null);
  const [cruzar, setCruzar] = useState<string | null>(null);
  const [biv, setBiv] = useState<ExplorarBivariadoResult | null>(null);
  const [filtros, setFiltros] = useState<ExplorarFiltros>({});
  // Corte estructural del repeat. Vive sólo en Explorar y no se mezcla con
  // los chips de filtros manuales.
  const [repeatCode, setRepeatCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [errorCode, setErrorCode] = useState<string>("");
  // Fuente de los datos que se exploran: "raw" = data cargada original;
  // "final" = data ya procesada por Limpieza (decisiones aplicadas).
  const [fuente, setFuente] = useState<ExplorarFuente>("raw");
  // Cuándo se cerró la base; sin cierre, "Limpia" queda deshabilitada.
  const [finalizedAt, setFinalizedAt] = useState<string | null>(null);
  // Ficha de la pregunta, con la variable y la fuente para las que se pidió:
  // así la readiness sabe si la que está en pantalla es la de la selección.
  const [fichaEstado, setFichaEstado] = useState<{ var: string; fuente: ExplorarFuente; ficha: ExploradorFicha | null } | null>(null);
  // La lectura que eligió la persona, para el par en que la eligió; otro par abre en la suya (`lecturaInicial`).
  const [lecturaElegida, setLecturaElegida] = useState<{ par: string; lectura: LecturaCalor } | null>(null);
  // Porcentaje / Casos y Gráfico / Tabla de una pregunta de opciones.
  const [lecturaDist, setLecturaDist] = useState<LecturaDeDistribucion>(LECTURA_INICIAL);

  const repeatContext = inv?.repeat_context ?? null;
  const selectedRepeatOption = repeatCode
    ? repeatContext?.options.find((option) => option.code === repeatCode) ?? null
    : null;
  const selectedRepeatIsEmpty = !!selectedRepeatOption && selectedRepeatOption.n_instancias === 0;

  const scopedSections = useMemo(
    () => scopeRepeatSections(inv?.secciones ?? [], repeatCode),
    [inv, repeatCode],
  );
  const scopedInv = useMemo<ExploradorVariablesList | null>(() => {
    if (!inv) return null;
    return {
      ...inv,
      secciones: scopedSections,
      n_variables: scopedSections.reduce((total, section) => total + section.variables.length, 0),
    };
  }, [inv, scopedSections]);

  const effectiveFiltros = useMemo<ExplorarFiltros>(
    () => withRepeatIdentityFilter(filtros, repeatContext, repeatCode),
    [filtros, repeatContext, repeatCode],
  );

  // Lista plana del contexto activo — gobierna sidebar, navegación y cruces.
  const flatVars = useMemo<ExploradorVariable[]>(() => {
    return scopedSections.flatMap((s) => s.variables);
  }, [scopedSections]);

  // La pregunta que se explora es la del foco de la dirección, si está en la
  // lista; sin foco (o con uno que esta lista no tiene), la primera útil, sin
  // escribirla: la dirección cambia solo cuando la persona elige otra.
  const selected = useMemo(() => {
    if (prefill?.var) return null;
    const pedida = foco ? flatVars.find((v) => v.name === foco) ?? null : null;
    return pedida ?? (scopedInv ? pickInitialVariable(scopedInv) : null);
  }, [flatVars, foco, scopedInv, prefill?.var]);
  const selectedName = selected?.name ?? null;
  const setSelected = useCallback((v: ExploradorVariable | null) => elegir({ foco: v?.name ?? null }), [elegir]);

  const currentIdx = useMemo(() => {
    if (!selected) return -1;
    return flatVars.findIndex((v) => v.name === selected.name);
  }, [flatVars, selected]);

  const prevVar = currentIdx > 0 ? flatVars[currentIdx - 1] : null;
  const nextVar = currentIdx >= 0 && currentIdx < flatVars.length - 1 ? flatVars[currentIdx + 1] : null;

  // Al cambiar de base (no al conocerla: de null a su nombre es la misma),
  // la fuente vuelve a "raw" y se sueltan el cruce y los filtros. La pregunta
  // no se suelta: si no existe en la otra base, la de abajo elige otra.
  const baseAnterior = useRef<string | null>(baseNombre);
  useEffect(() => {
    const anterior = baseAnterior.current;
    baseAnterior.current = baseNombre;
    if (anterior === null) return;
    setFuente("raw");
    setUni(null);
    setCruzar(null);
    setBiv(null);
    setFiltros({});
    setRepeatCode(null);
  }, [baseNombre, version]);

  // Si cambia el inventario (p.ej. raw → final) y el código ya no existe,
  // volvemos a Todos en vez de sostener un filtro invisible.
  useEffect(() => {
    if (!repeatCode || !repeatContext) return;
    if (!repeatContext.options.some((option) => option.code === repeatCode)) {
      setRepeatCode(null);
    }
  }, [repeatCode, repeatContext]);

  // Chequear si hay base final (Limpieza finalizada) para habilitar el
  // toggle "Data final".
  useEffect(() => {
    let cancel = false;
    apiV2Limpieza(baseNombre)
      .then((l) => {
        if (!cancel) setFinalizedAt(l.artifacts?.finalized_at ?? null);
      })
      .catch(() => {
        if (!cancel) setFinalizedAt(null);
      });
    return () => { cancel = true; };
  }, [baseNombre, version]);

  // Inventario al montar / cambiar base o fuente.
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError("");
    apiV2ExplorarVariables(baseNombre, fuente)
      .then((i) => {
        if (!cancel) setInv(i);
      })
      .catch((e) => {
        if (cancel) return;
        setError((e as Error).message);
        // El CODIGO, no solo el mensaje: hay estados esperados que llegan como
        // error HTTP —«todavia no hay data»— y merecen otra pantalla que una
        // averia. Sin esto, el unico dato disponible era el texto, que ademas
        // arrastra el codigo pegado («… · E_NO_DATA_INST»).
        setErrorCode(codigoDeError(e));
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [baseNombre, version, fuente]);

  // El enlace viejo por el store (prefill) pasa a la dirección en cuanto
  // llega, sin esperar la lista: así no lo pierde el paso de la base de null
  // a su nombre, que vuelve a pedir la lista.
  useEffect(() => {
    if (!prefill?.var) return;
    elegir({ foco: prefill.var });
    if (prefill.cruzar_con) setCruzar(prefill.cruzar_con);
    clearPrefill("explorar");
  }, [prefill, clearPrefill, elegir]);

  // Al cambiar de servicio, el cruce y los filtros que ya no aplican se sueltan.
  useEffect(() => {
    if (!scopedInv) return;
    if (cruzar && !flatVars.some((variable) => variable.name === cruzar)) {
      setCruzar(null);
    }
    const applicableNames = new Set(flatVars.map((variable) => variable.name));
    const nextFiltros = Object.fromEntries(
      Object.entries(filtros).filter(([name]) => applicableNames.has(name)),
    );
    if (Object.keys(nextFiltros).length !== Object.keys(filtros).length) {
      setFiltros(nextFiltros);
    }
  }, [scopedInv, flatVars, cruzar, filtros]);

  // Cargar univariado al seleccionar variable o cambiar filtros.
  useEffect(() => {
    if (!selected || selectedRepeatIsEmpty) {
      setUni(null);
      setBusy("");
      return;
    }
    let cancel = false;
    setBusy(`Cargando ${selected.name}…`);
    setError("");
    setUni(null);
    apiV2ExplorarUnivariado(selected.name, baseNombre, effectiveFiltros, fuente)
      .then((u) => {
        if (!cancel) setUni(u);
      })
      .catch((e) => {
        if (cancel) return;
        // Aqui NO se toca `errorCode`: este error es de una variable concreta
        // que el usuario acaba de pedir, no del estado del proyecto, y marcarlo
        // cambiaria la pantalla entera por un fallo de una sola consulta.
        setError((e as Error).message);
      })
      .finally(() => {
        if (!cancel) setBusy("");
      });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedName, baseNombre, fuente, selectedRepeatIsEmpty, JSON.stringify(effectiveFiltros)]);

  // Cargar bivariado cuando el usuario elige "cruzar con" (o cambian filtros).
  useEffect(() => {
    if (!selected || !cruzar || selectedRepeatIsEmpty) {
      setBiv(null);
      if (selectedRepeatIsEmpty) setBusy("");
      return;
    }
    let cancel = false;
    // Retira el cruce anterior antes de pedir el nuevo corte; evita mostrar
    // una matriz de otro servicio mientras llega la respuesta actual.
    setBiv(null);
    setBusy(`Cruzando ${selected.name} × ${cruzar}…`);
    apiV2ExplorarBivariado(selected.name, cruzar, baseNombre, effectiveFiltros, fuente)
      .then((b) => {
        if (!cancel) setBiv(b);
      })
      .catch((e) => {
        if (cancel) return;
        setError((e as Error).message);
        // El CODIGO, no solo el mensaje: hay estados esperados que llegan como
        // error HTTP —«todavia no hay data»— y merecen otra pantalla que una
        // averia. Sin esto, el unico dato disponible era el texto, que ademas
        // arrastra el codigo pegado («… · E_NO_DATA_INST»).
        setErrorCode(codigoDeError(e));
      })
      .finally(() => {
        if (!cancel) setBusy("");
      });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedName, cruzar, baseNombre, fuente, selectedRepeatIsEmpty, JSON.stringify(effectiveFiltros)]);

  // Ficha de la pregunta (E10/E11). Un motor sin el endpoint devuelve null y
  // los paneles no se muestran; un error tampoco tumba la vista.
  useEffect(() => {
    if (!selectedName || selectedRepeatIsEmpty) return;
    let cancel = false;
    const pedida = { var: selectedName, fuente };
    apiV2ExplorarFicha(selectedName, baseNombre, fuente)
      .then((ficha) => {
        if (!cancel) setFichaEstado({ ...pedida, ficha });
      })
      .catch(() => {
        if (!cancel) setFichaEstado({ ...pedida, ficha: null });
      });
    return () => {
      cancel = true;
    };
  }, [selectedName, baseNombre, fuente, selectedRepeatIsEmpty]);

  const onPickVariable = useCallback((v: ExploradorVariable) => {
    setSelected(v);
    setCruzar(null);
  }, [setSelected]);

  const fichaVigente =
    selected && fichaEstado && fichaEstado.var === selected.name && fichaEstado.fuente === fuente ? fichaEstado : null;
  const ficha = fichaVigente?.ficha ?? null;
  const uniVigente = selected && uni && uni.var === selected.name ? uni : null;
  const dist = uniVigente?.dist ?? null;
  const base = useMemo(() => (uniVigente ? resolverBase(uniVigente, dist, ficha) : null), [uniVigente, dist, ficha]);
  const cifras = useMemo(
    () => (uniVigente && base ? cifrasClave(uniVigente, dist, ficha, base) : []),
    [uniVigente, dist, ficha, base],
  );
  const declarados = useMemo(
    () => (ficha && ficha.opciones.length ? new Set(ficha.opciones.map((o) => o.codigo)) : null),
    [ficha],
  );
  const cruce = cruzar && biv ? biv.cruce ?? null : null;
  const parCruce = selected && cruzar ? `${selected.name}×${cruzar}` : "";
  const lecturaCalor =
    lecturaElegida && lecturaElegida.par === parCruce
      ? lecturaElegida.lectura
      : lecturaInicial(cruce?.tipo_x ?? "so", cruce?.tipo_y ?? "so");
  const setLecturaCalor = useCallback((lectura: LecturaCalor) => setLecturaElegida({ par: parCruce, lectura }), [parCruce]);
  const modelo = useMemo(
    () =>
      // Con puntos enfrentados (única × múltiple, 2 o 3 grupos) no hay tabla, ni panel de lo que se aparta del total.
      cruce?.forma === "tabla" && cruce.tabla && !enfrentados(cruce.tabla, cruce.tipo_x, cruce.tipo_y, cruce.base_n)
        ? modeloCalor(cruce.tabla, lecturaCalor, cruce.base_n, cruce.tipo_x, cruce.tipo_y)
        : null,
    [cruce, lecturaCalor],
  );

  // Keyboard shortcuts: ← / → iteran variables mientras no haya foco en
  // un input/textarea (para no pisar la edición de filtros).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (target.isContentEditable) return;
      }
      if (event.key === "ArrowLeft" && prevVar) {
        event.preventDefault();
        setSelected(prevVar);
      } else if (event.key === "ArrowRight" && nextVar) {
        event.preventDefault();
        setSelected(nextVar);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevVar, nextVar, setSelected]);

  // Banner de grano cuando la base explorada es una hija repeat: recuerda que
  // los denominadores de las distribuciones son instancias del roster, no
  // personas (varias filas pueden ser de una misma persona).
  const rosterGrain = repeat
    ? buildExplorerGrain({
        grain: repeat.grain,
        nInstancias: repeat.nInstancias,
        nPersonas: repeat.grain?.n_personas ?? null,
        repeatGroup: repeat.repeatGroup,
        parentBase: repeat.parentBase,
      })
    : null;

  const cabecera = (
    <CabeceraDeTransicion
      pestana="explorar"
      {...cabeceraDeExplorar(
        inv
          ? {
              preguntas: scopedInv?.n_variables ?? inv.n_variables,
              casos: uniVigente?.n_total ?? null,
              casosTrasFiltro: uniVigente?.n_tras_filtro ?? null,
              filtros: uniVigente?.filtros_aplicados ?? 0,
              cruce: !!cruzar,
            }
          : null,
      )}
      acciones={<FuenteToggle fuente={fuente} onChange={setFuente} finalizedAt={finalizedAt} />}
    />
  );
  const conCabecera = (cuerpo: ReactNode) => (
    <>
      {cabecera}
      {cuerpo}
    </>
  );

  if (loading) return conCabecera(<ExplorarLoadingPanel />);
  // **«Todavia no hay data» no es «no se pudo cargar».**
  //
  // El backend responde 409 `E_NO_DATA_INST` cuando el proyecto aun no tiene
  // base ni instrumento para esta pestaña, que es el estado NORMAL de un
  // estudio recien abierto. Caia en la rama de averia: visto en pantalla el
  // 2026-08-23 sobre un proyecto sin cargar, «No se pudo cargar el explorador ·
  // No hay data o instrumento cargado para esta base. · E_NO_DATA_INST».
  //
  // Tres cosas mal a la vez: el titulo dice que algo fallo, el texto ensena un
  // codigo tecnico, y ninguno dice donde se resuelve. Un vacio esperado que
  // parece una averia hace que la gente busque el problema donde no esta.
  if (esEstadoInicial(errorCode) && !inv) {
    return conCabecera(<VacioListo marca="validacion-explorar"><EmptyState icon={<Compass size={20} />} {...vacioSinDatos("que explorar")} /></VacioListo>);
  }
  if (error && !inv) {
    return conCabecera(
      <VacioListo marca="validacion-explorar">
      <EmptyState
        icon={<AlertTriangle size={20} />}
        title="No se pudo cargar el explorador"
        hint={error}
      />
      </VacioListo>
    );
  }
  if (!inv) {
    return conCabecera(
      <VacioListo marca="validacion-explorar">
      <EmptyState
        icon={<Compass size={20} />}
        title="Sin preguntas o campos para explorar"
        hint="La base no tiene columnas reconocibles. Revisa la carga en la Fase 1."
      />
      </VacioListo>
    );
  }
  if (inv.n_variables === 0) {
    return conCabecera(
      <div data-audit-ready="validacion-explorar" style={{ display: "contents" }}>
        <EmptyState
          icon={<Compass size={20} />}
          title="Sin preguntas o campos para explorar"
          hint="La base no tiene columnas reconocibles. Revisa la carga en la Fase 1."
        />
      </div>
    );
  }

  const crossVar = cruzar ? flatVars.find((v) => v.name === cruzar) ?? null : null;
  const sufijoRepeat = selectedRepeatOption ? ` (${selectedRepeatOption.label})` : "";
  const frase = base ? fraseBase(base) : null;
  const lecturaForm = selected
    ? lecturaDelFormulario(catalogo.estado === "listo" ? catalogo.catalogo : null, selected.name, ficha?.relevant ?? null)
    : null;
  const condicion = lecturaForm?.aparece.tipo === "frase" ? fraseEnTexto(lecturaForm.aparece.piezas) : null;

  // Con una recodificación (E8d), lo que «se aparta del total» es la diagonal: el panel no aporta.
  const esRecodificacion = !!(cruce?.tabla && cruce.tipo_x === "sm" && cruce.tipo_y === "sm" && recodificacion(cruce.tabla));
  const conLecturaDelCruce = !!crossVar && !!modelo && !esRecodificacion;

  const grafico = !uniVigente || !selected ? null : crossVar && biv ? (
    cruce ? (
      <Cruce
        cruce={cruce}
        modelo={modelo}
        lectura={lecturaCalor}
        onLectura={setLecturaCalor}
        x={selected}
        y={crossVar}
      />
    ) : (
      <GraficoTarjeta titulo={`${selected.name} × ${crossVar.name}${sufijoRepeat}`}>
        <PlotlyView view={biv.view} />
      </GraficoTarjeta>
    )
  ) : crossVar ? null : dist ? (
    <Distribucion dist={dist} sinRespuesta={base?.sinRespuesta ?? null} declarados={declarados} lectura={lecturaDist} />
  ) : (
    <GraficoTarjeta titulo={`Distribución${sufijoRepeat}`} tipo={uniVigente.tipo}>
      {uniVigente.chart.kind === "table" && uniVigente.chart.text_rows ? (
        <TextResponsesView view={uniVigente.chart} rows={uniVigente.chart.text_rows} />
      ) : (
        <PlotlyView view={uniVigente.chart} />
      )}
    </GraficoTarjeta>
  );

  const lista = (
    <PanelDeMesa
      zona="preguntas"
      titulo={selectedRepeatOption ? `Preguntas para ${selectedRepeatOption.label}` : "Preguntas"}
      icono={<List size={16} aria-hidden />}
      conteo={flatVars.length}
    >
      <ListaDePreguntas
        secciones={scopedSections}
        elegida={selected?.name ?? null}
        onElegir={onPickVariable}
        repeatCode={repeatCode}
        repeatLabel={selectedRepeatOption?.label ?? null}
      />
    </PanelDeMesa>
  );

  const centro = (
    <PanelDeMesa
      zona="pregunta"
      etiquetaCuerpo="Pregunta que se explora"
      titulo={selected ? (
        <CabeceraPregunta
          variable={selected}
          titulo={ficha?.label || uniVigente?.label || selected.label || selected.name}
          nOpciones={ficha?.opciones.length || (dist?.filas ? dist.filas.length : null)}
          condicion={condicion}
          cruce={crossVar}
          repeatLabel={selectedRepeatOption?.label ?? null}
          repeatInstances={selectedRepeatOption?.n_instancias ?? null}
        />
      ) : "Pregunta"}
      acciones={selected ? (
        <FlechasDePregunta
          posicion={currentIdx + 1}
          total={flatVars.length}
          anterior={prevVar?.name ?? null}
          siguiente={nextVar?.name ?? null}
          onAnterior={prevVar ? () => setSelected(prevVar) : undefined}
          onSiguiente={nextVar ? () => setSelected(nextVar) : undefined}
        />
      ) : undefined}
    >
      <div className="vx-centro">
        {rosterGrain && <RepeatGrainNote grain={rosterGrain} className="pulso-validacion-explorar-repeat" />}
        {repeatContext && repeatContext.options.length > 0 && (
          <RepeatDimensionBar context={repeatContext} selectedCode={repeatCode} onChange={setRepeatCode} />
        )}
        <BarraLectura
          conmutadores={
            conmutadoresAplican(dist, !!crossVar) ? (
              <ConmutadoresDeLectura lectura={lecturaDist} onCambio={setLecturaDist} />
            ) : null
          }
          filtro={
            <FiltroCascada secciones={scopedSections} filtros={filtros} onChange={setFiltros} baseNombre={baseNombre} incrustado />
          }
          cruce={
            selected ? (
              <CrossBar
                secciones={scopedSections}
                selfVar={selected.name}
                selfSeccion={scopedInv ? findSeccionOf(selected.name, scopedInv) : null}
                cruzar={cruzar}
                onChange={setCruzar}
              />
            ) : (
              <span className="vx-barra-nota">Elige una pregunta primero</span>
            )
          }
        />
        {selectedRepeatIsEmpty ? (
          <EmptyState
            icon={<Compass size={20} />}
            title={`Sin respuestas para ${selectedRepeatOption?.label ?? "este servicio"}`}
            hint="El servicio está declarado en el formulario, pero esta base no contiene instancias para analizar."
          />
        ) : !selected && (
          <EmptyState
            icon={<Compass size={20} />}
            title="Elige una pregunta o campo"
            hint="Selecciona un elemento de la lista para ver su distribución, resumen y cruces."
          />
        )}
        {!crossVar && <TiraCifras cifras={cifras} />}
        {grafico}
        {!crossVar && frase && (
          <p className="vx-nota">
            Sin ponderar. Base: <strong>{frase.destacado}</strong>
            {frase.resto}
          </p>
        )}
        {busy && <LoadingBlock variant="inline" label={busy} />}
        {error && <ErrorBlock label="Error" detail={error} />}
      </div>
    </PanelDeMesa>
  );

  const derecha = selected ? (
    <PilaDeMesa grupo="validacion/explorar">
      {conLecturaDelCruce && modelo ? (
        <PanelDeMesa zona="lectura-cruce" titulo="Lectura del cruce">
          <PanelApartaTotal modelo={modelo} />
        </PanelDeMesa>
      ) : !crossVar && (ficha || !fichaVigente) ? (
        <PanelDeMesa zona="formulario" titulo="En el formulario" ocupado={!fichaVigente}>
          {ficha && lecturaForm ? (
            <PanelFormulario ficha={ficha} lectura={lecturaForm} />
          ) : (
            <LoadingBlock variant="inline" minHeight={40} label="Leyendo el formulario" />
          )}
        </PanelDeMesa>
      ) : null}
      <ReglasDeLaPregunta variable={selected.name} lectura={catalogo} />
    </PilaDeMesa>
  ) : (
    <PilaDeMesa grupo="validacion/explorar">
      <PanelDeMesa zona="formulario" titulo="En el formulario">
        <p className="vx-barra-nota">Elige una pregunta de la lista.</p>
      </PanelDeMesa>
    </PilaDeMesa>
  );

  const mesa = (
    <MesaDePestana grupo="validacion/explorar" columnas={3} cabecera={cabecera}>
      {lista}
      {centro}
      {derecha}
    </MesaDePestana>
  );

  const scopedInventoryEmpty = (scopedInv?.n_variables ?? inv.n_variables) === 0;
  const primaryResultPending =
    !scopedInventoryEmpty &&
    (
      !selected ||
      (!selectedRepeatIsEmpty && (!uni || uni.var !== selected.name)) ||
      (!selectedRepeatIsEmpty && !fichaVigente) ||
      (!!cruzar && !biv)
    );

  if (busy || error || primaryResultPending) {
    return <div className="pulso-validacion-pestana-explorar">{mesa}</div>;
  }

  return (
    <div className="pulso-validacion-pestana-explorar" data-audit-ready="validacion-explorar">
      {mesa}
    </div>
  );
}
