// Datos de un gráfico en su tarjeta del inspector (F6.1, parte 2). Reemplaza al editor de ranura viejo incrustado:
// una sola superficie con filas planas (rótulo y control en una línea), sólo los datos que la salida nativa lee
// (lista blanca, argsDatosGrafico.ts), sin buscador de ajustes ni descripciones largas. Lo que no cabe en el inspector
// (bloques de multiapiladas, filtros) se edita en un panel ancho. Cierran la tarjeta el Top/Bottom Two Box de las
// escalas y «En el Word» (F6.2, F-d; tarjetaGrafico/).

import { Fragment, useId, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Filter, Rows3 } from "../../../vendor/lucide-react";
import { AyudaGlobo } from "./AyudaGlobo";
import type { GraficadorRef } from "../../../api/graficos";
import { Switch } from "../../../components/Switch";
import { usePlanStore } from "../store";
import { useGraficosRegistry } from "../useGraficosRegistry";
import VariablePicker from "../VariablePicker";
import {
  camposDeDatos,
  codigosATexto,
  codigosEmitidos,
  textoACodigos,
  CORTE_EN_CADENA,
  conEtiquetaCorta,
  interruptorEncendido,
  leerEtiquetaCorta,
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
import { CriteriosGrafico } from "./CriteriosGrafico";
import { DestacarRespuestas } from "./DestacarRespuestas";
import { criteriosDelRadar, formaEfectivaRadar, rotuloTablaAuto } from "./formaRadar";
import { NotaFormaRadar } from "./NotaFormaRadar";
import { DonaCentro } from "./DonaCentro";
import { PublicoGrafico } from "./PublicoGrafico";
import { SignificanciaPublicos } from "./SignificanciaPublicos";
import { ResaltarGrafico } from "./ResaltarGrafico";
import { EnElWord } from "./tarjetaGrafico/EnElWord";
import { ColoresGrafico } from "./colores/ColoresGrafico";
import { PaletaDelGrafico } from "./colores/PaletaDelGrafico";
import { NombresPorBase } from "./datosBase/NombresPorBase";
import { RedondeoDelGrafico } from "./RedondeoDelGrafico";
import { grupoDeCampo, TITULO_GRUPO, type GrupoTarjeta } from "./gruposTarjeta";
import { esPropio, ranurasDelTipo, SIN_ALCANCE, valorDelTipo } from "./modeloAlcance";
import { SelloAlcance } from "./SelloAlcance";
import { SelectorCategorias } from "./SelectorCategorias";
import { CifraGrafico } from "./CifraGrafico";
import { CitasAprobadas } from "./citas/CitasAprobadas";
import { ObjetivoDimension } from "./ObjetivoDimension";
import { CortesNumericos } from "./CortesNumericos";
import { Segmentado } from "../subpestanas/Segmentado";
import { opcionesNumeroEnBotones } from "./numerosEnBotones";
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
import "./datosGrafico.css";

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
  const delEditor = (name: string) => (cifra && name !== "var") || (citas && name === "citas_aprobadas") ||
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
    if (!tipo || grupoDeCampo(name) === "datos" || SIN_ALCANCE.has(name)) return { valor: args[name], sello: undefined, propio: false };
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
    return { valor: args[name] ?? (enPreset === null ? undefined : enPreset), sello, propio: !!sello };
  };
  // El pie de la tarjeta lleva todos los cambios propios de una vez (los mismos que muestran la marca).
  const propios = tipo ? campos.filter((c) => alcance(c).propio) : [];
  const aplicarTodos = () => {
    if (!tipo || !propios.length) return;
    aplicarAlTipo(tipo, Object.fromEntries(propios.map((c) => [c.arg.name, args[c.arg.name]])));
    toast.exito(`${propios.length === 1 ? "Un cambio aplicado" : `${propios.length} cambios aplicados`} a los gráficos de ${nombreTipo}`, {
      accion: { label: "Deshacer", onSelect: () => undo() },
    });
  };
  // Excluir respuestas y Corte usan las categorías de la pregunta; Excluir grupos, las de la variable de grupo.
  const grupoVar = typeof args.grupo === "string" ? args.grupo : "";
  const categoriasDe = (name: string): CategoriasFila | undefined => {
    if (name === "excluir_opciones" || name === "corte") {
      // Varias preguntas de la misma escala (radar, divergentes): las categorías de la primera, que todas comparten.
      // Con temas por público (objeto, no lista) no hay una sola lista: queda el texto.
      const primera = !variable && Array.isArray(args.vars) && typeof args.vars[0] === "string" ? args.vars[0] : "";
      if (!variable && !primera) return nVars > 0 ? undefined : { variable: "", scope, modo: name === "corte" ? "elegir" : "excluir" };
      return { variable: varCalificada(variable || primera, baseActiva, scope), scope, modo: name === "corte" ? "elegir" : "excluir" };
    }
    if (name === "excluir_grupos") return { variable: grupoVar ? varCalificada(grupoVar, baseActiva, scope) : "", scope, modo: "excluir" };
    return undefined;
  };
  const filaDe = (c: CampoDato) => c.arg.name === "objetivo" && valor.graficador.startsWith("p_dim_") ? (
    <ObjetivoDimension key={c.arg.name} id={`${slideId}-${slot}-objetivo`} modo={args.modo} valor={args.objetivo}
      etiqueta={<label className="pulso-f6-dato-rotulo" htmlFor={`${slideId}-${slot}-objetivo`}>Índice</label>}
      onCambio={(v) => set({ objetivo: v })} />
  ) : (
    <Fragment key={c.arg.name}>
      <Fila campo={c} graficador={valor.graficador} valor={alcance(c).valor} sello={alcance(c).sello} categorias={categoriasDe(c.arg.name)}
            onCambio={(v) => set(valor.graficador === "p_radar" && c.arg.name === "modo" && typeof v === "string" ? patchModoRadar(args.modo, v) : { [c.arg.name]: v })} />
      {radarPublicos && c.arg.name === "forma" && <NotaFormaRadar args={args} />}
      {radarPublicos && c.arg.name === "modo" && <EditorTemasEquivalentes tipo="radar" args={args} onCambio={set} />}
    </Fragment>
  );
  const delGrupo = (g: GrupoTarjeta) => campos.filter((c) => grupoDeCampo(c.arg.name) === g).map(filaDe);

  // O7b: la tarjeta en grupos; cada uno se oculta si ese tipo no tiene nada en él (`.pulso-f6-grupo:not(:has(...))`).
  return (
    <div className="pulso-f6-datos" data-qa-geometry-group="graficos/f6-datos" data-qa-geometry-contract="intrinsic">
      <GrupoDeTarjeta titulo={TITULO_GRUPO.datos}>
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
        {cifra && <CifraGrafico args={args} variable={variable && !sinBaseCompartido ? varCalificada(variable, baseActiva, scope) : ""} scope={scope} onCambio={set} />}
        {citas && <CitasAprobadas args={args} variable={variable && !sinBaseCompartido ? varCalificada(variable, baseActiva, scope) : ""} onCambio={set} />}
        {sinBaseCompartido && <NotaBaseCompartido />}
        {variable && !cifra && (
          <FilaTexto
            rotulo="Etiqueta corta"
            ayuda="Nombre breve de la pregunta en la lámina y el Word. Vacío, usa el del instrumento."
            valor={leerEtiquetaCorta(args, variable)}
            onCambio={(t) => set({ overrides: conEtiquetaCorta(args, variable, t) })}
          />
        )}
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
      </GrupoDeTarjeta>
      <GrupoDeTarjeta titulo={TITULO_GRUPO.orden}>
        {conOrden && variable && !sinBaseCompartido && (
          <OrdenCategoriasGrafico variable={varCalificada(variable, baseActiva, scope)} graficador={valor.graficador} args={args} scope={scope} onCambio={(o) => set({ orden_categorias: o })} />
        )}
        {delGrupo("orden")}
        <ResaltarGrafico slideId={slideId} slot={slot} valor={valor} />
        <DestacarRespuestas slideId={slideId} slot={slot} valor={valor} />
      </GrupoDeTarjeta>
      <GrupoDeTarjeta titulo={TITULO_GRUPO.cifras}>
        {delGrupo("cifras")}
        <TwoBoxGrafico slideId={slideId} slot={slot} valor={valor} onAbrirBloques={() => abrirEditorAmplio({ tipo: "bloques", slideId, slot })} />
        <CasosGrafico slideId={slideId} slot={slot} valor={valor} />
        {/* R4: método y decimales propios, como excepción a la regla del informe. */}
        <RedondeoDelGrafico graficador={valor.graficador} args={args} onCambio={(ov) => set({ overrides: ov })} />
        <DonaCentro slideId={slideId} slot={slot} valor={valor} />
      </GrupoDeTarjeta>
      <GrupoDeTarjeta titulo={TITULO_GRUPO.colores}>
        <ColoresGrafico slideId={slideId} slot={slot} valor={valor} argsDelRegistro={meta?.args ?? []} />
        <PaletaDelGrafico valor={valor} />
      </GrupoDeTarjeta>
      <EnElWord slideId={slideId} slot={slot} valor={valor} argsDelRegistro={meta?.args ?? []} />
      {propios.length > 0 && (
        <div className="pulso-f6-dato pulso-f6-alcance-pie" data-qa="ajustes-del-tipo">
          <span className="pulso-f6-dato-rotulo">
            {propios.length === 1 ? "Un ajuste es sólo de este gráfico" : `${propios.length} ajustes son sólo de este gráfico`}
          </span>
          <button type="button" className="pulso-f6-boton pulso-f6-dato-accion" onClick={aplicarTodos}>
            Aplicar a {nTipo > 1 ? `los ${nTipo} gráficos` : "todos los gráficos"} de {nombreTipo}
          </button>
        </div>
      )}
    </div>
  );
}

/** Un grupo de la tarjeta con su título; el cuerpo vacío lo oculta por CSS. */
function GrupoDeTarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="pulso-f6-grupo" aria-labelledby={id}>
      <h4 id={id} className="pulso-f6-grupo-titulo">{titulo}</h4>
      <div className="pulso-f6-grupo-cuerpo" data-qa-geometry-group="graficos/f6-grupo-cuerpo" data-qa-geometry-contract="intrinsic">{children}</div>
    </section>
  );
}

const ORDEN_ANTERIOR = new Set(["orden_barras", "ordenar_categorias"]);

function Ayuda({ rotulo, detalle }: { rotulo: string; detalle: string }) {
  return <AyudaGlobo rotulo={rotulo} detalle={detalle} />;
}

type CategoriasFila = { variable: string; scope: "active" | "consolidated"; modo: "excluir" | "elegir" };

function Fila({ campo, graficador, valor, onCambio, sello, categorias }: {
  campo: CampoDato; graficador: string; valor: unknown; onCambio: (v: unknown) => void; sello?: ReactNode;
  /** Para los campos de códigos que son categorías de una pregunta: cuál y cómo se marcan. */
  categorias?: CategoriasFila;
}) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const { arg, rotulo, ayuda, detalle, control, placeholder } = campo;
  const describe = ayuda ? idAyuda : undefined;
  // La guarda (C40) se lee junto al control, en todas las formas de fila: no sólo en las apiladas.
  const nota = ayuda ? <span id={idAyuda} className="pulso-f6-dato-ayuda">{ayuda}</span> : null;
  const etiqueta = (
    <label className="pulso-f6-dato-rotulo" htmlFor={id}>
      {rotulo}
      <Ayuda rotulo={rotulo} detalle={detalle} />
      {sello}
    </label>
  );
  if (control === "variable" || control === "variable_opcional") {
    return (
      <div className="pulso-f6-dato is-apilado">
        {etiqueta}
        <div id={id} className="pulso-f6-dato-control">
          <VariablePicker
            value={typeof valor === "string" ? valor : null}
            onChange={(v) => onCambio(v ?? (control === "variable_opcional" ? null : ""))}
            allowEmpty={control === "variable_opcional"}
            placeholder={control === "variable_opcional" ? "Sin dividir" : "Elige una pregunta…"}
          />
        </div>
        {nota}
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
        {nota}
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
        <span className="pulso-f6-dato-rotulo" id={id}>{rotulo}<Ayuda rotulo={rotulo} detalle={detalle} />{sello}</span>
        <Switch checked={encendido} ariaLabel={rotulo} onToggle={() => onCambio(!encendido)} />
        {nota}
      </div>
    );
  }
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
        {nota}
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
        <span className="pulso-f6-dato-rotulo" id={id}>{rotulo}<Ayuda rotulo={rotulo} detalle={detalle} />{sello}</span>
        <Segmentado etiqueta={rotulo} valor={String(actual)} opciones={enBotones.map((o) => ({ clave: String(o.valor), rotulo: o.rotulo }))}
          onCambiar={(k) => onCambio(Number(k))} />
        {nota}
      </div>
    );
  }
  if (control === "numero" && tieneRango(arg)) {
    return (
      <div className="pulso-f6-dato">
        {etiqueta}
        <NumeroAcotado id={id} rotulo={rotulo} arg={arg} valor={valor} describe={describe}
          placeholder={placeholder ?? (arg.default !== undefined && arg.default !== null ? String(arg.default) : "")} onCambio={onCambio} />
        {nota}
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
        {nota}
      </div>
    );
  }
  if (control === "codigos" && (arg.name === "cortes" || arg.name === "cortes_chip") && placeholder) {
    return <CortesNumericos id={id} etiqueta={etiqueta} nota={nota} describe={describe} defectos={textoACodigos(placeholder)} valor={valor} onCambio={onCambio} />;
  }
  if (control === "codigos") {
    const comoTexto = (
      <div className="pulso-f6-dato is-apilado">
        {etiqueta}
        <input id={id} className="pulso-f6-input" value={codigosATexto(valor)} placeholder={placeholder ?? "Ninguna"} aria-describedby={describe}
          onChange={(e) => onCambio(codigosEmitidos(e.target.value, graficador, arg.name))} />
        {nota}
      </div>
    );
    // Con la pregunta elegida, sus categorías como fichas; el texto queda de respaldo (sin lista o con error).
    if (!categorias) return comoTexto;
    return (
      <SelectorCategorias id={id} etiqueta={etiqueta} variable={categorias.variable} scope={categorias.scope} graficador={graficador}
        valor={valor} modo={categorias.modo} textoRespaldo={comoTexto}
        nota={<span className="pulso-f6-dato-ayuda">{categorias.modo === "excluir" ? "Las marcadas no salen en el gráfico." : "Las marcadas forman el corte."}</span>}
        onCambio={(cods) => onCambio(arg.name === "corte" && CORTE_EN_CADENA.has(graficador) ? cods.join(",") : cods)} />
    );
  }
  return <FilaTexto rotulo={rotulo} ayuda={ayuda} placeholder={placeholder} valor={typeof valor === "string" ? valor : ""} onCambio={(t) => onCambio(t)} sello={sello} />;
}

function FilaTexto({ rotulo, ayuda, placeholder = null, valor, onCambio, sello }: {
  rotulo: string; ayuda: string | null; placeholder?: string | null; valor: string; onCambio: (t: string) => void; sello?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="pulso-f6-dato is-apilado">
      <label className="pulso-f6-dato-rotulo" htmlFor={id}>{rotulo}{sello}</label>
      <input id={id} className="pulso-f6-input" value={valor} placeholder={placeholder ?? undefined}
        aria-describedby={ayuda ? `${id}-ayuda` : undefined} onChange={(e) => onCambio(e.target.value)} />
      {ayuda && <span id={`${id}-ayuda`} className="pulso-f6-dato-ayuda">{ayuda}</span>}
    </div>
  );
}
