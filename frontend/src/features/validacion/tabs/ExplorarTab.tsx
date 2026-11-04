import { useCallback, useEffect, useMemo, useState } from "react";
import { codigoDeError, esEstadoInicial, vacioSinDatos } from "../estadoEsperado";
import { AlertTriangle, Compass } from "../../../vendor/lucide-react";
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
import { PulsoButton } from "../../../components/PulsoButton";
import { RepeatGrainNote } from "../../../components/RepeatGrainNote";
import {
  buildExplorerGrain,
  scopeRepeatSections,
  withRepeatIdentityFilter,
  type ProcessingSheetRepeatContext,
} from "../../../lib/rosterExplorer";
import PlotlyView from "../components/PlotlyView";
import VariablePicker from "../components/VariablePicker";
import FiltroCascada from "../components/FiltroCascada";
import CrossBar from "../components/CrossBar";
import RepeatDimensionBar from "../components/RepeatDimensionBar";
import BarraLectura from "./explorar/BarraLectura";
import CabeceraVariable from "./explorar/CabeceraVariable";
import Cruce from "./explorar/Cruce";
import Distribucion from "./explorar/Distribucion";
import ExplorarLoadingPanel from "./explorar/ExplorarLoadingPanel";
import FuenteToggle from "./explorar/FuenteToggle";
import GraficoTarjeta from "./explorar/GraficoTarjeta";
import PanelApartaTotal from "./explorar/PanelApartaTotal";
import PanelDatos from "./explorar/PanelDatos";
import PanelFormulario from "./explorar/PanelFormulario";
import RielVariables from "./explorar/RielVariables";
import TextResponsesView from "./explorar/TextResponsesView";
import TiraCifras from "./explorar/TiraCifras";
import { enfrentados } from "./explorar/CruceEnfrentados";
import { recodificacion } from "./explorar/CruceRecodificacion";
import { cifrasClave, fraseBase, lecturaInicial, modeloCalor, resolverBase, type LecturaCalor } from "./explorar/explorarModelo";
import { graficoDelPar } from "./explorar/graficoDelPar";
import { findSeccionOf, pickInitialVariable } from "./explorar/seleccionInicial";
import "./explorar/explorar.css";
import { VacioListo } from "../components/VacioListo";

// =============================================================================
// ExplorarTab — Sprint 3
// =============================================================================
// Revamp 2026-11-02 (docs/qa/checklist-explorador-variables-2026-11-02.md):
//   - Izquierda: la lista de variables (E1); al cruzar se pliega en un riel (E12).
//   - Centro: cabecera (E2), barra de lectura Momento | Filtro | Cruzar por
//     (E3), la base en una frase (E4), la tira de cifras (E5) y el gráfico por
//     tipo (E6) o el cruce por par de tipos (E8/E9).
//   - Derecha: «En el formulario» y «Lo que se ve en los datos» (E10/E11) o,
//     con una tabla cruzada, «Lo que se aparta del total».
// Si el motor aún no manda `dist`, `cruce` o la ficha, cada pieza cae a lo
// anterior (Plotly, las tarjetas KPI) o no se muestra.
//
// El deep-link desde Limpieza (prefill.explorar.var) se consume al montar.

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

  const [inv, setInv] = useState<ExploradorVariablesList | null>(null);
  const [selected, setSelected] = useState<ExploradorVariable | null>(null);
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
  // Si la base tiene Limpieza cerrada, habilitamos el modo "final".
  const [hasFinalizedBase, setHasFinalizedBase] = useState<boolean>(false);
  const [finalizedAt, setFinalizedAt] = useState<string | null>(null);
  // Ficha de la pregunta, con la variable y la fuente para las que se pidió:
  // así la readiness sabe si la que está en pantalla es la de la selección.
  const [fichaEstado, setFichaEstado] = useState<{ var: string; fuente: ExplorarFuente; ficha: ExploradorFicha | null } | null>(null);
  // La lectura que eligió la persona, para el par en que la eligió; otro par abre en la suya (`lecturaInicial`).
  const [lecturaElegida, setLecturaElegida] = useState<{ par: string; lectura: LecturaCalor } | null>(null);
  // Con cruce la lista va plegada; «lista» o «buscar» la despliegan a pedido.
  const [listaAbierta, setListaAbierta] = useState<null | "lista" | "buscar">(null);

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

  const currentIdx = useMemo(() => {
    if (!selected) return -1;
    return flatVars.findIndex((v) => v.name === selected.name);
  }, [flatVars, selected]);

  const prevVar = currentIdx > 0 ? flatVars[currentIdx - 1] : null;
  const nextVar = currentIdx >= 0 && currentIdx < flatVars.length - 1 ? flatVars[currentIdx + 1] : null;

  // Al cambiar de base, reseteamos el modo fuente a "raw".
  useEffect(() => {
    setFuente("raw");
    setSelected(null);
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
        if (cancel) return;
        const at = l.artifacts?.finalized_at ?? null;
        setFinalizedAt(at);
        setHasFinalizedBase(!!at);
      })
      .catch(() => {
        if (!cancel) {
          setHasFinalizedBase(false);
          setFinalizedAt(null);
        }
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

  // Consumir prefill deep-link: abre la variable indicada al cargar.
  useEffect(() => {
    if (!inv || !prefill?.var) return;
    const found = inv.secciones
      .flatMap((s) => s.variables)
      .find((v) => v.name === prefill.var);
    if (found) {
      setSelected(found);
      if (prefill.cruzar_con) setCruzar(prefill.cruzar_con);
    }
    clearPrefill("explorar");
  }, [inv, prefill, clearPrefill]);

  // Si el explorador ya tiene inventario y no viene un deep-link, abrir la
  // primera variable evita que la mesa arranque vacía pese a tener datos.
  useEffect(() => {
    if (!scopedInv || selected || prefill?.var) return;
    const first = pickInitialVariable(scopedInv);
    if (first) setSelected(first);
  }, [scopedInv, selected, prefill?.var]);

  // Al cambiar de servicio, conserva la variable si sigue siendo aplicable y
  // adopta sus conteos segmentados; si no, elige la primera variable útil.
  useEffect(() => {
    if (!scopedInv) return;
    const nextSelected = selected
      ? flatVars.find((variable) => variable.name === selected.name) ?? null
      : null;
    if (selected && !nextSelected) {
      setSelected(pickInitialVariable(scopedInv));
    } else if (selected && nextSelected && nextSelected !== selected) {
      setSelected(nextSelected);
    }
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
  }, [scopedInv, flatVars, selected, cruzar, filtros]);

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
  }, [selected, baseNombre, fuente, selectedRepeatIsEmpty, JSON.stringify(effectiveFiltros)]);

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
  }, [selected, cruzar, baseNombre, fuente, selectedRepeatIsEmpty, JSON.stringify(effectiveFiltros)]);

  // Ficha de la pregunta (E10/E11). Un motor sin el endpoint devuelve null y
  // los paneles no se muestran; un error tampoco tumba la vista.
  useEffect(() => {
    if (!selected || selectedRepeatIsEmpty) return;
    let cancel = false;
    const pedida = { var: selected.name, fuente };
    apiV2ExplorarFicha(selected.name, baseNombre, fuente)
      .then((ficha) => {
        if (!cancel) setFichaEstado({ ...pedida, ficha });
      })
      .catch(() => {
        if (!cancel) setFichaEstado({ ...pedida, ficha: null });
      });
    return () => {
      cancel = true;
    };
  }, [selected, baseNombre, fuente, selectedRepeatIsEmpty]);

  const cambiarCruce = useCallback((v: string | null) => {
    setCruzar(v);
    setListaAbierta(null);
  }, []);

  const onPickVariable = useCallback((v: ExploradorVariable) => {
    setSelected(v);
    setCruzar(null);
    setListaAbierta(null);
  }, []);

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
  }, [prevVar, nextVar]);

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

  if (loading) return <ExplorarLoadingPanel />;
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
    return <VacioListo marca="validacion-explorar"><EmptyState icon={<Compass size={20} />} {...vacioSinDatos("que explorar")} /></VacioListo>;
  }
  if (error && !inv) {
    return (
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
    return (
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
    return (
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
  const plegada = !!crossVar && listaAbierta === null;
  const titulo = selectedRepeatOption ? `Preguntas para ${selectedRepeatOption.label}` : "Variables";
  const sufijoRepeat = selectedRepeatOption ? ` (${selectedRepeatOption.label})` : "";
  const frase = base ? fraseBase(base) : null;

  // Con una recodificación (E8d), lo que «se aparta del total» es la diagonal: el panel no aporta.
  const esRecodificacion = !!(cruce?.tabla && cruce.tipo_x === "sm" && cruce.tipo_y === "sm" && recodificacion(cruce.tabla));
  const lateral =
    crossVar && modelo && !esRecodificacion ? (
      <aside className="vx-lateral" aria-label="Lectura del cruce">
        <PanelApartaTotal modelo={modelo} />
      </aside>
    ) : !crossVar && uniVigente && (ficha || !fichaVigente) ? (
      // La columna se reserva mientras llega la ficha: el gráfico no ocupa el
      // ancho entero para encogerse un instante después (C2). Si la ficha
      // falló, no hay columna.
      <aside className="vx-lateral" aria-label="Ficha de la pregunta" aria-busy={!ficha}>
        <div className="vx-tarjeta vx-ficha">
          {ficha ? (
            <>
              <PanelFormulario ficha={ficha} />
              <PanelDatos ficha={ficha} filtrado={uniVigente.filtros_aplicados > 0} />
            </>
          ) : (
            <LoadingBlock variant="inline" minHeight={40} label="Leyendo el formulario…" />
          )}
        </div>
      </aside>
    ) : null;

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
    <Distribucion dist={dist} titulo={selected.label || selected.name} sinRespuesta={base?.sinRespuesta ?? null} declarados={declarados} />
  ) : (
    <GraficoTarjeta titulo={`Distribución${sufijoRepeat}`} tipo={uniVigente.tipo}>
      {uniVigente.chart.kind === "table" && uniVigente.chart.text_rows ? (
        <TextResponsesView view={uniVigente.chart} rows={uniVigente.chart.text_rows} />
      ) : (
        <PlotlyView view={uniVigente.chart} />
      )}
    </GraficoTarjeta>
  );

  const panelContent = (
    <>
      {plegada ? (
        <RielVariables
          posicion={currentIdx + 1}
          total={flatVars.length}
          onDesplegar={() => setListaAbierta("lista")}
          onBuscar={() => setListaAbierta("buscar")}
          onAnterior={prevVar ? () => setSelected(prevVar) : undefined}
          onSiguiente={nextVar ? () => setSelected(nextVar) : undefined}
          nombreAnterior={prevVar?.name ?? null}
          nombreSiguiente={nextVar?.name ?? null}
        />
      ) : (
        <aside className="pulso-validacion-explorar-sidebar" aria-label="Variables del formulario">
          <VariablePicker
            secciones={scopedSections}
            selectedVar={selected?.name ?? null}
            onSelect={onPickVariable}
            repeatCode={repeatCode}
            repeatLabel={selectedRepeatOption?.label ?? null}
            titulo={titulo}
            autoFocusBusqueda={listaAbierta === "buscar"}
            accion={
              crossVar ? (
                <PulsoButton variant="link" size="sm" onClick={() => setListaAbierta(null)}>
                  Plegar
                </PulsoButton>
              ) : null
            }
          />
        </aside>
      )}

      <main className="pulso-validacion-explorar-main">
        {rosterGrain && (
          <RepeatGrainNote grain={rosterGrain} className="pulso-validacion-explorar-repeat" />
        )}

        {repeatContext && repeatContext.options.length > 0 && (
          <RepeatDimensionBar
            context={repeatContext}
            selectedCode={repeatCode}
            onChange={setRepeatCode}
          />
        )}

        <div className="vx-cuerpo">
          <div className="vx-centro">
            {selected && uniVigente && (
              <CabeceraVariable
                uni={uniVigente}
                ficha={ficha}
                seccion={scopedInv ? findSeccionOf(selected.name, scopedInv) : null}
                posicion={currentIdx + 1}
                total={flatVars.length}
                nOpciones={ficha?.opciones.length || (dist?.filas ? dist.filas.length : null)}
                cruce={crossVar ? { variable: crossVar, grafico: cruce?.grafico || graficoDelPar(selected.tipo, crossVar.tipo) } : null}
                onAnterior={prevVar ? () => setSelected(prevVar) : undefined}
                onSiguiente={nextVar ? () => setSelected(nextVar) : undefined}
                nombreAnterior={prevVar?.name ?? null}
                nombreSiguiente={nextVar?.name ?? null}
                repeatLabel={selectedRepeatOption?.label ?? null}
                repeatInstances={selectedRepeatOption?.n_instancias ?? null}
              />
            )}

            <BarraLectura
              momento={
                <FuenteToggle fuente={fuente} onChange={setFuente} hasFinal={hasFinalizedBase} finalizedAt={finalizedAt} />
              }
              filtro={
                <FiltroCascada
                  secciones={scopedSections}
                  filtros={filtros}
                  onChange={setFiltros}
                  baseNombre={baseNombre}
                  incrustado
                />
              }
              cruce={
                selected ? (
                  <CrossBar
                    secciones={scopedSections}
                    selfVar={selected.name}
                    selfSeccion={scopedInv ? findSeccionOf(selected.name, scopedInv) : null}
                    cruzar={cruzar}
                    onChange={cambiarCruce}
                  />
                ) : (
                  <span className="vx-barra-nota">Elige una variable primero</span>
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

            {frase && (
              <p className="vx-base">
                Base: <strong>{frase.destacado}</strong>
                {frase.resto}
              </p>
            )}
            {!crossVar && <TiraCifras cifras={cifras} />}
            {grafico}

            {busy && <LoadingBlock variant="inline" label={busy} />}
            {error && <ErrorBlock label="Error" detail={error} />}
          </div>
          {lateral}
        </div>
      </main>
    </>
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

  const layoutClass = `pulso-validacion-explorar-layout${plegada ? " vx-con-riel" : ""}`;
  if (busy || error || primaryResultPending) {
    return <div className={layoutClass}>{panelContent}</div>;
  }

  return (
    <div
      className={layoutClass}
      data-audit-ready="validacion-explorar"
    >
      {panelContent}
    </div>
  );
}

