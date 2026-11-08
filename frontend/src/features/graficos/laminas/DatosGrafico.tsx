// Datos de un gráfico en su tarjeta del inspector (F6.1, parte 2). Reemplaza al editor de ranura viejo incrustado:
// una sola superficie con filas planas (rótulo y control en una línea), sólo los datos que la salida nativa lee
// (lista blanca, argsDatosGrafico.ts), sin buscador de ajustes. Lo que no cabe en el inspector (bloques de
// multiapiladas, filtros) se edita en un panel ancho. ADR 0135 §8: tres secciones para todos los graficadores (Datos,
// Cálculo y Aspecto, gruposTarjeta.ts) y cada control con su rótulo y un «?» que guarda su descripción; ningún
// párrafo de ayuda debajo. Lo que sigue visible bajo un control es estado (avisos), no ayuda.

import { Fragment, useEffect, useId, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Filter, Rows3 } from "../../../vendor/lucide-react";
import { AyudaGlobo } from "./AyudaGlobo";
import type { GraficadorRef } from "../../../api/graficos";
import { Switch } from "../../../components/Switch";
import { usePlanStore } from "../store";
import { useGraficosRegistry } from "../useGraficosRegistry";
import VariablePicker from "../VariablePicker";
import {
  ayudaDeLaOpcion,
  camposDeDatos,
  textoAyuda,
  codigosATexto,
  codigosEmitidos,
  textoACodigos,
  CORTE_EN_CADENA,
  AYUDA_CODIGOS,
  interruptorEncendido,
  type CampoDato,
} from "./argsDatosGrafico";
import { useLaminasUi } from "./laminasStore";
import { publicosDistintos } from "./argsDatosGrafico";
import { useGraficosReportScope } from "../reportScope";
import { aplicaOrden, varCalificada } from "./ordenCategorias";
import { useSession } from "../../../lib/SessionContext";
import { OrdenCategoriasGrafico } from "./OrdenCategoriasGrafico";
import { TwoBoxGrafico } from "./tarjetaGrafico/TwoBoxGrafico";
import { CasosGrafico } from "./CasosGrafico";
import { ListaPreguntas } from "./ListaPreguntas";
import { PublicosGrafico } from "./publicosGrafico/PublicosGrafico";
import { usaPublicos } from "./publicosGrafico/modeloPublicos";
import { CriteriosGrafico } from "./CriteriosGrafico";
import { DestacarRespuestas } from "./DestacarRespuestas";
import { criteriosDelRadar, formaEfectivaRadar, rotuloTablaAuto } from "./formaRadar";
import { NotaFormaRadar } from "./NotaFormaRadar";
import { DonaCentro } from "./DonaCentro";
import { PublicoGrafico } from "./PublicoGrafico";
import { SignificanciaPublicos } from "./SignificanciaPublicos";
import { EtiquetaCortaPregunta, EtiquetasCortasPreguntas } from "./EtiquetasCortas";
import { PreguntaClave } from "./preguntasClave/PreguntaClave";
import { LetraYEjeAgrupadas } from "./tarjetaGrafico/LetraYEjeAgrupadas";
import { valorDeMando } from "./mandosPorOverrides";
import { EnElWord } from "./tarjetaGrafico/EnElWord";
import { ColoresGrafico } from "./colores/ColoresGrafico";
import { PaletaDelGrafico } from "./colores/PaletaDelGrafico";
import { AvisoColorPorOpcion } from "./colores/AvisoColorPorOpcion";
import { NombresPorBase } from "./datosBase/NombresPorBase";
import { RedondeoDelGrafico } from "./RedondeoDelGrafico";
import { grupoDeCampo, seccionAbierta, seccionDeClave, type SeccionTarjeta } from "./gruposTarjeta";
import { SeccionPlegable } from "./tarjetaGrafico/SeccionPlegable";
import { resumenPlegado } from "./tarjetaGrafico/resumenPlegado";
import { ARG_CALCULOS_PROPIOS } from "./modeloRedondeoGrafico";
import { IndiceSecciones } from "./tarjetaGrafico/IndiceSecciones";
import { irASeccion } from "./tarjetaGrafico/irASeccion";
import { esPropio, ranurasDelTipo, SIN_ALCANCE, valorDelTipo } from "./modeloAlcance";
import { SelloAlcance } from "./SelloAlcance";
import { SelectorCategorias } from "./SelectorCategorias";
import { GRUPO, NIVEL, type Sustantivo } from "./modeloSelectorCategorias";
import { CifraGrafico } from "./CifraGrafico";
import { CitasAprobadas } from "./citas/CitasAprobadas";
import { ObjetivoDimension } from "./ObjetivoDimension";
import { CortesNumericos } from "./CortesNumericos";
import { PartesLineas } from "./PartesLineas";
import { AgruparLista } from "./AgruparLista";
import { Segmentado } from "../subpestanas/Segmentado";
import { opcionesNumeroEnBotones } from "./numerosEnBotones";
import { opcionesEnSegmentado } from "./opcionesEnSegmentado";
import { campoDeslizable } from "./modeloNumeroDeslizable";
import { NumeroDeslizable } from "./NumeroDeslizable";
import { FilaSegmentada } from "./tarjetaGrafico/FilaSegmentada";
import { graficadorToPresetType } from "../graficadorPresetMap";
import { graficadorDisplayName } from "../graficadorDisplay";
import { toast } from "../../../components/toasterStore";
import { BrechaEntreGrupos } from "./brecha/BrechaEntreGrupos";
import { MatrizCuadrantes } from "./matriz/MatrizCuadrantes";
import { NotaBaseCompartido } from "./datosBase/NotaBaseCompartido";
import { faltaBaseEnCompartido } from "./datosBase/baseEnCompartido";
import { EditorTemasEquivalentes } from "../temasEquivalentes/EditorTemasEquivalentes";
import { argsATemas, codigosComunes, patchModoRadar } from "../temasEquivalentes/temasEquivalentesModel";
import { useVariables } from "../useVariables";
import { NumeroAcotado, tieneRango } from "./NumeroAcotado";
import { DiferenciasInspector } from "./diferencias/DiferenciasInspector";
import { TarjetasDiferencias } from "./diferencias/TarjetasDiferencias";
import { admiteTarjetas } from "./diferencias/modeloTarjetas";
import { argDeCruce, valorDeCruce } from "./diferencias/modeloDiferencias";
import { interruptorAplica, interruptorGuardado, parcheInterruptor } from "./diferencias/interruptorDelGrafico";
import { revelarYEnfocar } from "../revelarFila";
import { ReglaPreguntas } from "./reglaPreguntas/ReglaPreguntas";
import { PadronPublicos } from "./gruposPadron/PadronPublicos";
import { llevaPadronPublicos } from "./gruposPadron/modeloPadron";
import type { ReglaPreguntas as Regla } from "../../../api/graficosRegla";
import { ExcluirRespuestas } from "./excluirConCifra/ExcluirRespuestas";
import { LadosEscala } from "./divergentes/LadosEscala";
import { ARGS_LADOS, llevaLados } from "./divergentes/modeloLados";
import { conDetalle } from "./cifrasInspector/modeloCifras";
import "./datosGrafico.css";
import { formatoConteo } from "../../../lib/formatoNumero";

type Props = { slideId: string; slot: string; valor: GraficadorRef };

export function DatosGrafico({ slideId, slot, valor }: Props) {
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  const abrirEditorAmplio = useLaminasUi((s) => s.setEditorAmplio);
  const { graficadoresById } = useGraficosRegistry();
  const meta = graficadoresById[valor.graficador];
  const args = (valor.args ?? {}) as Record<string, unknown>;
  // Donde aplica el orden por gráfico (D8), su fila reemplaza al «Orden» anterior del registro.
  const conOrden = aplicaOrden(valor.graficador);
  // P21: el radar entre públicos y la serie temporal se arman con temas por público; su editor es dueño de las
  // preguntas, del orden de las mediciones y —cuando hay respuestas comunes que marcar— del indicador.
  const radarPublicos = valor.graficador === "p_radar" && args.modo === "publicos";
  const serie = valor.graficador === "p_serie_temporal";
  const { variables } = useVariables();
  const conCasillas = (radarPublicos || serie) && codigosComunes(argsATemas(args), variables).length > 0;
  // La cifra destacada tiene su propio editor (qué cifra, respuesta y texto); de la lista genérica sólo queda la pregunta.
  const cifra = valor.graficador === "p_cifra";
  // O3b-b: las citas aprobadas tienen su tarjeta de aprobación (candidatas, recorte, corrección y [sic]).
  const citas = valor.graficador === "p_citas";
  // ADR 0135 §6: el padrón de cada grupo o público (y en la cobertura, los públicos, la meta y las filas extra) se edita
  // en su control (GruposPadron, PadronPublicos), no como texto suelto.
  const padronPropio = (valor.graficador === "p_dumbbell" && args.estilo === "resumen") || llevaPadronPublicos(valor.graficador, args);
  const delEditor = (name: string) => (cifra && name !== "var") || (citas && name === "citas_aprobadas") ||
    (padronPropio && (name === "universos" || name === "bases" || name === "metas" || name === "extras")) ||
    (radarPublicos || serie) && (name === "vars" || name === "orden_periodos" || (name === "corte" && conCasillas));
  const formaRadar = radarPublicos ? formaEfectivaRadar({ forma: args.forma, fallback_pocos: args.fallback_pocos, tabla: args.tabla, nCriterios: criteriosDelRadar(args) }).forma : "radar";
  const campos = camposDeDatos(meta?.args ?? [], args, valor.graficador)
    // «Automática: junto al radar» miente cuando la forma efectiva es otra: sólo cambia el rótulo, no el valor.
    .map((c) => c.arg.name === "tabla" ? { ...c, opciones: c.opciones.map((o) => o.value === "auto" ? { ...o, label: rotuloTablaAuto(formaRadar, o.label) } : o) } : c)
    .filter((c) => !(conOrden && ORDEN_ANTERIOR.has(c.arg.name)) && !delEditor(c.arg.name));
  const scope = useGraficosReportScope(useLocation().search);
  const baseActiva = useSession().state?.active_base;
  const set = (patch: Record<string, unknown>) => updateSlotArgs(slideId, slot, patch);
  const presets = usePlanStore((s) => s.presets) as Record<string, Record<string, unknown>>;
  const slidesPlan = usePlanStore((s) => s.plan.slides);
  const aplicarAlTipo = usePlanStore((s) => s.aplicarAjusteAlTipo);
  const undo = usePlanStore((s) => s.undo);
  const variable = typeof args.var === "string" ? args.var : "";
  // En el informe compartido una pregunta sin base no se califica con la activa: se pide elegirla (H9).
  const sinBaseCompartido = faltaBaseEnCompartido(variable, scope);
  const esMulti = valor.graficador === "p_barras_multiapiladas";
  // Las láminas de equivalencias traen `vars` por tema ({ tema_1: [docentes$p1, estudiantes$p1], … }): se cuentan los temas.
  const varsPorTema = !Array.isArray(args.vars) && args.vars && typeof args.vars === "object" ? (args.vars as Record<string, unknown>) : null;
  const nVars = Array.isArray(args.vars) ? args.vars.length : varsPorTema ? Object.keys(varsPorTema).length : 0;
  // Los públicos distintos de la lámina, no el máximo por tema: en la lámina 10 de Arte cada tema tiene dos, pero entre
  // todos son tres (docentes, administrativos y estudiantes), como dice la base (loop UI).
  const nPublicos = varsPorTema ? publicosDistintos(varsPorTema) : 0;
  const filtros = Array.isArray(args.filtros) ? args.filtros.length : 0;
  const admiteFiltros = (meta?.args ?? []).some((a) => a.name === "filtros");

  // O7b: en Categorías y orden y en Cifras, cada ajuste sabe si es propio de este gráfico o viene de su tipo.
  const tipo = graficadorToPresetType(valor.graficador);
  const nTipo = tipo ? ranurasDelTipo(slidesPlan, tipo).length : 0;
  const nombreTipo = graficadorDisplayName(valor.graficador, meta).toLowerCase();
  const alcance = (c: CampoDato) => {
    const name = c.arg.name;
    // U6/U10: un mando que el motor lee de `overrides` muestra lo de `overrides` si está (lo que la lámina dibuja).
    const guardado = valorDeMando(args, name);
    if (!tipo || grupoDeCampo(name) === "datos" || SIN_ALCANCE.has(name)) return { valor: guardado, sello: undefined, propio: false };
    const delTipo = valorDelTipo(presets, tipo, name, c.arg.default);
    const enPreset = presets[tipo]?.[name];
    const sello = esPropio(args, name, delTipo) ? (
      <SelloAlcance nombreTipo={nombreTipo} nTipo={nTipo} ajuste={c.rotulo}
        onAplicarTipo={() => {
          aplicarAlTipo(tipo, { [name]: args[name] });
          toast.exito(`${c.rotulo}: aplicado a ${nTipo > 1 ? `los ${nTipo} gráficos` : "los gráficos"} de ${nombreTipo}`, {
            accion: { label: "Deshacer", onSelect: () => undo() },
          });
        }}
        onVolver={() => set({ [name]: enPreset === undefined || enPreset === null ? undefined : enPreset })} />
    ) : undefined;
    return { valor: guardado ?? (enPreset === null ? undefined : enPreset), sello, propio: !!sello };
  };
  // El pie de la tarjeta lleva todos los cambios propios de una vez (los mismos que muestran la marca).
  const propios = tipo ? campos.filter((c) => alcance(c).propio) : [];
  // Ítem 12: la cabecera plegada dice lo propio de adentro; el redondeo propio va por su marca en `overrides` (R4).
  const redondeoPropio = (args.overrides as Record<string, unknown> | undefined)?.[ARG_CALCULOS_PROPIOS] === true;
  const resumenDe = (g: SeccionTarjeta) => resumenPlegado([
    ...propios.filter((c) => grupoDeCampo(c.arg.name) === g).map((c) => c.rotulo), ...(g === "calculo" && redondeoPropio ? ["Redondeo"] : []),
  ]);
  const aplicarTodos = () => {
    if (!tipo || !propios.length) return;
    aplicarAlTipo(tipo, Object.fromEntries(propios.map((c) => [c.arg.name, args[c.arg.name]])));
    toast.exito(`${propios.length === 1 ? "Un cambio aplicado" : `${formatoConteo(propios.length)} cambios aplicados`} a los gráficos de ${nombreTipo}`, {
      accion: { label: "Deshacer", onSelect: () => undo() },
    });
  };
  // Excluir respuestas y Corte usan las categorías de la pregunta; Excluir grupos, las de la variable de grupo.
  const grupoVar = typeof args.grupo === "string" ? args.grupo : "";
  const categoriasDe = (name: string): CategoriasFila | undefined => {
    if (name === "excluir_opciones" || name === "corte" || name === "series" || name === "segmentos_total") {
      // Varias preguntas de la misma escala (radar, divergentes): las categorías de la primera, que todas comparten.
      // Con temas por público (objeto, no lista) o con `base$*` (panorama, ADR 0134) no hay una sola lista: queda el texto.
      const primera = !variable && Array.isArray(args.vars) && typeof args.vars[0] === "string" && !args.vars[0].endsWith("$*") ? args.vars[0] : "";
      if (!variable && !primera) return nVars > 0 ? undefined : { variable: "", scope, modo: name === "corte" ? "elegir" : "excluir" };
      return { variable: varCalificada(variable || primera, baseActiva, scope), scope, modo: name === "corte" ? "elegir" : "excluir" };
    }
    if (name === "excluir_grupos") return { variable: grupoVar ? varCalificada(grupoVar, baseActiva, scope) : "", scope, modo: "excluir", sustantivo: GRUPO };
    // Línea por nivel: los niveles del eje son las categorías de su `cruce` (U5).
    if (name === "grupos" && valor.graficador === "p_lineas_nivel") {
      const niveles = typeof args.cruce === "string" ? args.cruce : "";
      return {
        variable: niveles ? varCalificada(niveles, baseActiva, scope) : "", scope, modo: "elegir", vacioEsTodos: true, sustantivo: NIVEL,
        nota: "Quita un nivel para sacarlo del gráfico.",
      };
    }
    return undefined;
  };
  const filaDe = (c: CampoDato) => c.arg.name === "objetivo" && valor.graficador.startsWith("p_dim_") ? (
    <ObjetivoDimension key={c.arg.name} id={`${slideId}-${slot}-objetivo`} modo={args.modo} valor={args.objetivo}
      etiqueta={<label className="pulso-f6-dato-rotulo" htmlFor={`${slideId}-${slot}-objetivo`}>Índice</label>}
      onCambio={(v) => set({ objetivo: v })} />
  ) : (
    <Fragment key={`${slideId}:${slot}:${c.arg.name}`}>
      {/* H2: la ayuda de «Pista gris» describe la opción elegida, no siempre «Automática». */}
      <Fila campo={{ ...c, ayuda: ayudaDeLaOpcion(c, alcance(c).valor) }} graficador={valor.graficador} valor={alcance(c).valor} sello={alcance(c).sello} categorias={categoriasDe(c.arg.name)}
            args={args} scope={scope}
            onCambio={(v) => set(valor.graficador === "p_radar" && c.arg.name === "modo" && typeof v === "string" ? patchModoRadar(args.modo, v) : { [c.arg.name]: v })} />
      {/* H2: «Un color por opción» encendido sobre una lista sin colores dice por qué no se ve. */}
      {c.arg.name === "colorear_por_opcion" && interruptorEncendido(c.arg, alcance(c).valor) && <AvisoColorPorOpcion valor={valor} />}
      {radarPublicos && c.arg.name === "forma" && <NotaFormaRadar args={args} />}
      {radarPublicos && c.arg.name === "modo" && <EditorTemasEquivalentes tipo="radar" args={args} onCambio={set} />}
    </Fragment>
  );
  // Oleada I2, ítem 4: en la divergente, los tres args de los lados van en un solo control (LadosEscala).
  const deLados = (c: CampoDato) => llevaLados(valor.graficador) && ARGS_LADOS.has(c.arg.name);
  const delGrupo = (g: SeccionTarjeta) => campos.filter((c) => grupoDeCampo(c.arg.name) === g && !deLados(c)).map(filaDe);

  // ADR 0128: «Diferencias entre grupos» reemplaza al nivel de significancia de Cifras. El interruptor es el
  // `mostrar_significancia` del gráfico (guardado, del tipo o el default del registro); el nivel es de la regla del estudio.
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const argSig = (meta?.args ?? []).find((a) => a.name === "mostrar_significancia");
  const argCruce = argDeCruce((meta?.args ?? []).map((a) => a.name));
  const cruce = argCruce ? valorDeCruce(args[argCruce]) : "";
  const nombreCruce = cruce.includes("$") ? cruce.slice(cruce.lastIndexOf("$") + 1) : cruce;
  const etiquetaCruce = cruce ? variables.find((v) => v.name === nombreCruce || `${v.source}$${v.name}` === cruce)?.label ?? null : null;
  // U11: un `overrides.mostrar_significancia` viejo manda, como en el motor; en multiapiladas sólo el modo «cruce» marca.
  const sigGuardada = interruptorGuardado(args) ?? (tipo ? presets[tipo]?.mostrar_significancia : undefined);
  const sigAplica = !!argSig && interruptorAplica(argSig, meta?.args ?? [], args);
  // ADR 0129: una lámina de total (un gráfico, sin cruce) puede llevar tarjetas de diferencias en vez de marcas; en la
  // de dos gráficos, cada uno las suyas (U2 del checklist del mazo).
  const conTarjetas = admiteTarjetas(slidesPlan.find((x) => x.id === slideId)?.tipo ?? "", valor.graficador, cruce, slot);
  const abrirSeccion = useLaminasUi((s) => s.abrirSeccionTarjeta);
  const agregarCruce = () => {
    // H4: «Dividir por» vive en Datos, que puede estar plegada; se abre antes de llevar el foco.
    abrirSeccion("datos");
    requestAnimationFrame(() => {
      const campo = argCruce ? tarjetaRef.current?.querySelector<HTMLElement>(`[data-campo="${argCruce}"]`) : null;
      if (!campo?.querySelector("button, input, [tabindex]")) {
        toast.info("Elige la pregunta que divide en «Dividir por», en Datos.");
        return;
      }
      revelarYEnfocar(campo);
    });
  };
  // H4: al volver a la tarjeta (de Identidad › Colores, de otra lámina) se vuelve a la sección que se abrió por última vez.
  useEffect(() => {
    const { seccionReciente, seccionesTarjeta } = useLaminasUi.getState();
    const reciente = seccionDeClave(seccionReciente);
    if (reciente && reciente !== "datos" && seccionAbierta(seccionesTarjeta, reciente)) {
      irASeccion(tarjetaRef.current, reciente, { enfocar: false, instantaneo: true });
    }
  }, [slideId, slot]);

  // O7b: la tarjeta en grupos; cada uno se oculta si ese tipo no tiene nada en él (`.pulso-f6-grupo:not(:has(...))`).
  return (
    <div className="pulso-f6-datos" ref={tarjetaRef} data-qa-geometry-group="graficos/f6-datos" data-qa-geometry-contract="intrinsic">
      <IndiceSecciones tarjeta={tarjetaRef} />
      <SeccionPlegable seccion="datos">
        {esMulti && (
          <div className="pulso-f6-dato">
            <span className="pulso-f6-dato-rotulo">Bloques</span>
            <button type="button" className="pulso-f6-boton pulso-f6-dato-accion" onClick={() => abrirEditorAmplio({ tipo: "bloques", slideId, slot })}>
              <Rows3 size={14} aria-hidden="true" />
              {nVars
                ? varsPorTema
                  ? `${nVars} ${nVars === 1 ? "tema" : "temas"} en ${nPublicos} ${nPublicos === 1 ? "público" : "públicos"}, editar`
                  : `${nVars} ${nVars === 1 ? "pregunta" : "preguntas"}, editar`
                : "Elegir preguntas"}
            </button>
          </div>
        )}
        {valor.graficador === "p_dumbbell" && <BrechaEntreGrupos args={args} onCambio={set} />}
        {valor.graficador === "p_matriz_cuadrantes" && <MatrizCuadrantes args={args} onCambio={set} />}
        {valor.graficador === "p_significancia_publicos" && <SignificanciaPublicos args={args} onCambio={set} />}
        {valor.graficador === "p_dim_heatmap_criterios" && <CriteriosGrafico valor={args.config_criterios} onCambio={(c) => set({ config_criterios: c })} />}
        {serie && <EditorTemasEquivalentes tipo="serie" args={args} onCambio={set} />}
        {delGrupo("datos")}
        {valor.graficador !== "p_dumbbell" && llevaPadronPublicos(valor.graficador, args) && (
          <PadronPublicos graficador={valor.graficador} args={args} scope={scope} onCambio={set} />
        )}
        {cifra && <CifraGrafico args={args} variable={variable && !sinBaseCompartido ? varCalificada(variable, baseActiva, scope) : ""} scope={scope} onCambio={set} />}
        {citas && <CitasAprobadas args={args} variable={variable && !sinBaseCompartido ? varCalificada(variable, baseActiva, scope) : ""} onCambio={set} />}
        {sinBaseCompartido && <NotaBaseCompartido />}
        {variable && !cifra && <EtiquetaCortaPregunta args={args} variable={variable} onCambio={(ov) => set({ overrides: ov })} />}
        {/* U9: en la multiapilada de una barra por pregunta, una etiqueta corta por pregunta. */}
        {esMulti && !variable && <EtiquetasCortasPreguntas slideId={slideId} args={args} onCambio={(ov) => set({ overrides: ov })} />}
        {/* H14: marca la pregunta (o cada pregunta de la batería) como clave del estudio, de donde propone el resumen. */}
        <PreguntaClave slideId={slideId} graficador={valor.graficador} args={args} />
        {admiteFiltros && (
          <div className="pulso-f6-dato">
            <span className="pulso-f6-dato-rotulo">Filtrar respuestas</span>
            <button type="button" className="pulso-f6-boton pulso-f6-dato-accion" onClick={() => abrirEditorAmplio({ tipo: "filtros", slideId, slot })}>
              <Filter size={14} aria-hidden="true" />
              {filtros ? `${filtros} ${filtros === 1 ? "regla" : "reglas"}, editar` : "Sin filtro, agregar"}
            </button>
          </div>
        )}
        <PublicoGrafico slideId={slideId} slot={slot} valor={valor} />
      </SeccionPlegable>
      {/* Cálculo: qué se cuenta y cómo (indicador, Two Box, redondeo y diferencias entre grupos). */}
      <SeccionPlegable seccion="calculo" resumen={resumenDe("calculo")}>
        {delGrupo("calculo")}
        {campos.some(deLados) && <LadosEscala id={`${slideId}-${slot}-lados`} graficador={valor.graficador} scope={scope} args={args} onCambio={set} respaldo={campos.filter(deLados).map(filaDe)} />}
        <TwoBoxGrafico slideId={slideId} slot={slot} valor={valor} onAbrirBloques={() => abrirEditorAmplio({ tipo: "bloques", slideId, slot })} />
        {/* R4: método y decimales propios, como excepción a la regla del informe. */}
        <RedondeoDelGrafico graficador={valor.graficador} args={args} onCambio={(ov) => set({ overrides: ov })} />
        {conTarjetas && <TarjetasDiferencias slideId={slideId} slot={slot} />}
        {argSig && sigAplica && argCruce && !conTarjetas && (
          <DiferenciasInspector
            slideId={slideId}
            encendido={interruptorEncendido(argSig, sigGuardada)}
            cruce={cruce}
            etiquetaCruce={etiquetaCruce}
            onAlternar={(v) => set(parcheInterruptor(args, v))}
            onAgregarCruce={agregarCruce}
            onQuitarCruce={() => set({ [argCruce]: null })}
          />
        )}
      </SeccionPlegable>
      {/* Aspecto: orden, cifras, colores y el Word. */}
      <SeccionPlegable seccion="aspecto" resumen={resumenDe("aspecto")}>
        {conOrden && variable && !sinBaseCompartido && (
          <OrdenCategoriasGrafico variable={varCalificada(variable, baseActiva, scope)} graficador={valor.graficador} args={args} scope={scope} onCambio={(o) => set({ orden_categorias: o })} />
        )}
        {delGrupo("aspecto")}
        <DestacarRespuestas slideId={slideId} slot={slot} valor={valor} scope={scope} />
        {/* U12: letra de categorías y cifras y eje libre, que la lámina nativa lee de `overrides`. */}
        <LetraYEjeAgrupadas key={`${slideId}:${slot}`} graficador={valor.graficador} args={args} onCambio={(ov) => set({ overrides: ov })} />
        <CasosGrafico slideId={slideId} slot={slot} valor={valor} />
        <DonaCentro slideId={slideId} slot={slot} valor={valor} />
        <ColoresGrafico slideId={slideId} slot={slot} valor={valor} argsDelRegistro={meta?.args ?? []} />
        <PaletaDelGrafico valor={valor} />
        <EnElWord slideId={slideId} slot={slot} valor={valor} argsDelRegistro={meta?.args ?? []} />
      </SeccionPlegable>
      {propios.length > 0 && (
        <div className="pulso-f6-dato pulso-f6-alcance-pie" data-qa="ajustes-del-tipo">
          <span className="pulso-f6-dato-rotulo">
            {propios.length === 1 ? "Un ajuste es sólo de este gráfico" : `${formatoConteo(propios.length)} ajustes son sólo de este gráfico`}
          </span>
          <button type="button" className="pulso-f6-boton pulso-f6-dato-accion" onClick={aplicarTodos}>
            Aplicar a {nTipo > 1 ? `los ${nTipo} gráficos` : "todos los gráficos"} de {nombreTipo}
          </button>
        </div>
      )}
    </div>
  );
}

// H5 (checklist de usabilidad, 2026-11-05): donde rige el orden por gráfico, `invertir_barras` es un segundo «Invertir»
// que el motor no lee para el orden pedido: `.goc_traducir` escribe el orden ya invertido según
// `orden_categorias.invertir`, y con un orden pedido en horizontal la agrupada fuerza `invertir_barras` a TRUE
// (graficador_barras_agrupadas.R, F1). Queda un solo mando, el «Invertir» de «Orden»; el valor guardado no se toca.
const ORDEN_ANTERIOR = new Set(["orden_barras", "ordenar_categorias", "invertir_barras"]);

function Ayuda({ id, rotulo, detalle }: { id?: string; rotulo: string; detalle: string }) {
  return <AyudaGlobo id={id} rotulo={rotulo} detalle={detalle} />;
}

type CategoriasFila = {
  variable: string; scope: "active" | "consolidated"; modo: "excluir" | "elegir";
  /** Lo que dice la marca, si no es «se excluye» ni «forma el corte». */
  nota?: string;
  /** «elegir» donde nada guardado es todos (H9). */
  vacioEsTodos?: boolean;
  sustantivo?: Sustantivo;
};

function Fila({ campo, graficador, valor, onCambio, sello, categorias, args, scope }: {
  campo: CampoDato; graficador: string; valor: unknown; onCambio: (v: unknown) => void; sello?: ReactNode;
  /** El alcance del informe (activo o compartido): el conteo de la regla se pide sobre las mismas fuentes que la vista previa. */
  scope: "active" | "consolidated";
  /** Los args del gráfico, para los controles que leen otros args (las preguntas del mapa en «Agrupar en la lista»). */
  args: Readonly<Record<string, unknown>>;
  /** Para los campos de códigos que son categorías de una pregunta: cuál y cómo se marcan. */
  categorias?: CategoriasFila;
}) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const { arg, rotulo, ayuda, detalle, control, placeholder } = campo;
  // ADR 0135 §8: la guarda (C40) y la descripción del registro van en el «?» del rótulo, en todas las formas de fila.
  // Los campos de categorías suman lo que significa marcar una ficha.
  const marcas = control === "codigos" && categorias
    ? categorias.nota ?? (categorias.modo === "excluir" ? "Las marcadas no salen en el gráfico." : "Las marcadas forman el corte.")
    : null;
  const texto = textoAyuda(ayuda, marcas, detalle);
  const describe = texto ? idAyuda : undefined;
  const globo = <Ayuda id={idAyuda} rotulo={rotulo} detalle={texto} />;
  const segmentos = control === "opciones" ? opcionesEnSegmentado(campo.opciones, valor) : null;
  const deslizable = control === "numero" ? campoDeslizable(arg) : null;
  const etiqueta = (
    <label className="pulso-f6-dato-rotulo" htmlFor={id}>
      {rotulo}
      {globo}
      {sello}
    </label>
  );
  if (control === "variable" || control === "variable_opcional") {
    return (
      <div className="pulso-f6-dato is-apilado" data-campo={arg.name}>
        {etiqueta}
        <div id={id} className="pulso-f6-dato-control">
          <VariablePicker
            value={typeof valor === "string" ? valor : null}
            onChange={(v) => onCambio(v ?? (control === "variable_opcional" ? null : ""))}
            allowEmpty={control === "variable_opcional"}
            placeholder={control === "variable_opcional" ? "Sin dividir" : "Elige una pregunta…"}
          />
        </div>
      </div>
    );
  }
  // Q2-11: con `base$*` las preguntas se eligen por público (una ficha por base, ordenable); no un selector vacío por cada una.
  if (control === "variables" && usaPublicos(valor)) {
    return (
      <div className="pulso-f6-dato is-apilado" data-campo={arg.name}>
        <span className="pulso-f6-dato-rotulo" id={`${id}-publicos`}>
          Públicos
          <Ayuda rotulo="Públicos" detalle="Todas las preguntas de escala de cada público. El orden es el de las filas del gráfico." />
          {sello}
        </span>
        <PublicosGrafico id={id} graficador={graficador} valor={valor} describe={`${id}-publicos`} onCambio={onCambio} />
      </div>
    );
  }
  if (control === "variables") {
    return (
      <div className="pulso-f6-dato is-apilado">
        {etiqueta}
        <div id={id} className="pulso-f6-dato-control">
          <ListaPreguntas valor={valor} onCambio={onCambio} describe={describe} />
        </div>
      </div>
    );
  }
  if (control === "nombres_base") {
    return <NombresPorBase argName={arg.name} rotulo={rotulo} ayuda={ayuda} valor={valor} onCambio={(p) => onCambio(p[arg.name])} />;
  }
  if (control === "interruptor") {
    // Sin valor guardado manda el default del registro: un interruptor apagado sobre un dibujo encendido mentiría.
    const encendido = interruptorEncendido(arg, valor);
    return (
      <div className="pulso-f6-dato">
        <span className="pulso-f6-dato-rotulo" id={id}>{rotulo}{globo}{sello}</span>
        <Switch checked={encendido} ariaLabel={rotulo} onToggle={() => onCambio(!encendido)} />
      </div>
    );
  }
  // Ítem 9 (2026-11-08): hasta tres opciones cortas, a la vista en un segmentado (opcionesEnSegmentado.ts).
  if (control === "opciones" && segmentos) return <FilaSegmentada id={id} rotulo={rotulo} marcas={<>{globo}{sello}</>} segmentos={segmentos} valor={typeof valor === "string" ? valor : String(arg.default ?? "")} onCambio={onCambio} />;
  if (control === "opciones") {
    // Un valor guardado con una opción retirada (6a) se ve como actual y lleva su aviso; al cambiarlo ya no vuelve.
    const idAviso = `${id}-aviso`;
    const describeSelect = [describe, campo.aviso ? idAviso : undefined].filter(Boolean).join(" ") || undefined;
    return (
      <div className="pulso-f6-dato">
        {etiqueta}
        <select id={id} className="pulso-f6-input pulso-f6-dato-select" aria-describedby={describeSelect}
          value={typeof valor === "string" ? valor : String(arg.default ?? "")}
          onChange={(e) => onCambio(e.target.value)}>
          {campo.opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {campo.aviso && <span id={idAviso} className="pulso-f6-dato-ayuda" role="note">{campo.aviso}</span>}
      </div>
    );
  }
  // Decimales y nivel de significancia: pocos valores posibles, como botones en vez de un número a escribir.
  const enBotones = control === "numero" ? opcionesNumeroEnBotones(arg, valor) : null;
  if (enBotones) {
    const actual = typeof valor === "number" ? valor : typeof arg.default === "number" ? arg.default : enBotones[0].valor;
    return (
      <div className="pulso-f6-dato">
        <span className="pulso-f6-dato-rotulo" id={id}>{rotulo}{globo}{sello}</span>
        <Segmentado etiqueta={rotulo} valor={String(actual)} opciones={enBotones.map((o) => ({ clave: String(o.valor), rotulo: o.rotulo }))}
          onCambiar={(k) => onCambio(Number(k))} />
      </div>
    );
  }
  // Ítem 11 (2026-11-08): los acotados de Aspecto con pocos pasos se arrastran (numeroDeslizable.ts).
  if (deslizable) return <NumeroDeslizable id={id} rotulo={rotulo} marcas={<>{globo}{sello}</>} rango={deslizable} valor={valor} porDefecto={arg.default} onCambio={onCambio} />;
  if (control === "numero" && tieneRango(arg)) {
    return (
      <div className="pulso-f6-dato">
        {etiqueta}
        <NumeroAcotado id={id} rotulo={rotulo} arg={arg} valor={valor} describe={describe}
          placeholder={placeholder ?? (arg.default !== undefined && arg.default !== null ? String(arg.default) : "")} onCambio={onCambio} />
      </div>
    );
  }
  if (control === "numero") {
    return (
      <div className="pulso-f6-dato">
        {etiqueta}
        <input id={id} type="number" className="pulso-f6-input pulso-f6-dato-numero" aria-describedby={describe}
          value={typeof valor === "number" ? valor : ""}
          placeholder={placeholder ?? (arg.default !== undefined && arg.default !== null ? String(arg.default) : "")}
          min={arg.min} max={arg.max} step={arg.step ?? "any"}
          onChange={(e) => onCambio(e.target.value === "" ? null : Number(e.target.value))} />
      </div>
    );
  }
  if (control === "regla_preguntas") {
    return <ReglaPreguntas rotulo={rotulo} ayuda={texto} graficador={graficador} args={args} valor={valor} scope={scope}
      onCambio={(r: Regla) => onCambio(r)} />;
  }
  if (control === "grupos_lista") {
    return <AgruparLista id={id} etiqueta={etiqueta} nota={null} valor={valor} args={args} onCambio={onCambio} />;
  }
  if (control === "partes") {
    return <PartesLineas id={id} arg={arg.name} etiqueta={etiqueta} nota={null} valor={valor} variable={categorias?.variable ?? ""}
      scope={categorias?.scope ?? "active"} graficador={graficador} onCambio={onCambio} />;
  }
  if (control === "codigos" && (arg.name === "cortes" || arg.name === "cortes_chip") && placeholder) {
    return <CortesNumericos id={id} etiqueta={etiqueta} nota={null} describe={describe} defectos={textoACodigos(placeholder)} valor={valor} onCambio={onCambio} />;
  }
  if (control === "codigos") {
    const comoTexto = (
      <div className="pulso-f6-dato is-apilado">
        {etiqueta}
        <input id={id} className="pulso-f6-input" value={codigosATexto(valor)} placeholder={placeholder ?? "Ninguna"} aria-describedby={describe}
          onChange={(e) => onCambio(codigosEmitidos(e.target.value, graficador, arg.name))} />
      </div>
    );
    // Con la pregunta elegida, sus categorías como fichas; el texto queda de respaldo (sin lista).
    if (!categorias) return comoTexto;
    // Oleada I2, ítem 1: la ayuda de escribir códigos es del respaldo; las fichas no la llevan.
    const etiquetaFichas = ayuda === AYUDA_CODIGOS ? <label className="pulso-f6-dato-rotulo" htmlFor={id}>{rotulo}<Ayuda id={idAyuda} rotulo={rotulo} detalle={textoAyuda(marcas, detalle)} />{sello}</label> : etiqueta;
    if (arg.name === "excluir_opciones" && conDetalle(graficador)) return <ExcluirRespuestas id={id} etiqueta={etiquetaFichas} variable={categorias.variable} scope={categorias.scope} graficador={graficador} args={args} argName={arg.name} valor={valor} textoRespaldo={comoTexto} onCambio={onCambio} />;
    return (
      <SelectorCategorias id={id} etiqueta={etiquetaFichas} variable={categorias.variable} scope={categorias.scope} graficador={graficador}
        valor={valor} modo={categorias.modo} vacioEsTodos={categorias.vacioEsTodos} sustantivo={categorias.sustantivo} textoRespaldo={comoTexto}
        nota={null}
        onCambio={(cods) => onCambio(arg.name === "corte" && CORTE_EN_CADENA.has(graficador) ? cods.join(",") : cods)} />
    );
  }
  return <FilaTexto rotulo={rotulo} ayuda={texto} placeholder={placeholder} valor={typeof valor === "string" ? valor : ""} onCambio={(t) => onCambio(t)} sello={sello} />;
}

function FilaTexto({ rotulo, ayuda, placeholder = null, valor, onCambio, sello }: {
  rotulo: string; ayuda: string; placeholder?: string | null; valor: string; onCambio: (t: string) => void; sello?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="pulso-f6-dato is-apilado">
      <label className="pulso-f6-dato-rotulo" htmlFor={id}>{rotulo}<Ayuda id={`${id}-ayuda`} rotulo={rotulo} detalle={ayuda} />{sello}</label>
      <input id={id} className="pulso-f6-input" value={valor} placeholder={placeholder ?? undefined}
        aria-describedby={ayuda ? `${id}-ayuda` : undefined} onChange={(e) => onCambio(e.target.value)} />
    </div>
  );
}
