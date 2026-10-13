// Datos de un gráfico en su tarjeta del inspector (F6.1, parte 2). Reemplaza al editor de ranura viejo incrustado:
// una sola superficie con filas planas (rótulo y control en una línea), sólo los datos que la salida nativa lee
// (lista blanca, argsDatosGrafico.ts), sin buscador de ajustes ni descripciones largas. Lo que no cabe en el inspector
// (bloques de multiapiladas, filtros) se edita en un panel ancho. Cierran la tarjeta el Top/Bottom Two Box de las
// escalas y «En el Word» (F6.2, F-d; tarjetaGrafico/).

import { useId } from "react";
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
  conEtiquetaCorta,
  interruptorEncendido,
  leerEtiquetaCorta,
  textoACodigos,
  type CampoDato,
} from "./argsDatosGrafico";
import { useLaminasUi } from "./laminasStore";
import { useGraficosReportScope } from "../reportScope";
import { aplicaOrden, varCalificada } from "./ordenCategorias";
import { useSession } from "../../../lib/SessionContext";
import { OrdenCategoriasGrafico } from "./OrdenCategoriasGrafico";
import { TwoBoxGrafico } from "./tarjetaGrafico/TwoBoxGrafico";
import { CasosGrafico } from "./CasosGrafico";
import { AjustesDelTipo } from "./AjustesDelTipo";
import { ResaltarGrafico } from "./ResaltarGrafico";
import { EnElWord } from "./tarjetaGrafico/EnElWord";
import { ColoresGrafico } from "./colores/ColoresGrafico";
import { PaletaDelGrafico } from "./colores/PaletaDelGrafico";
import { NombresPorBase } from "./datosBase/NombresPorBase";
import { BrechaEntreGrupos } from "./brecha/BrechaEntreGrupos";
import { MatrizCuadrantes } from "./matriz/MatrizCuadrantes";
import { NotaBaseCompartido } from "./datosBase/NotaBaseCompartido";
import { faltaBaseEnCompartido } from "./datosBase/baseEnCompartido";
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
  const campos = camposDeDatos(meta?.args ?? [], args, valor.graficador).filter((c) => !(conOrden && ORDEN_ANTERIOR.has(c.arg.name)));
  const scope = useGraficosReportScope(useLocation().search);
  const baseActiva = useSession().state?.active_base;
  const set = (patch: Record<string, unknown>) => updateSlotArgs(slideId, slot, patch);
  const variable = typeof args.var === "string" ? args.var : "";
  // En el informe compartido una pregunta sin base no se califica con la activa: se pide elegirla (H9).
  const sinBaseCompartido = faltaBaseEnCompartido(variable, scope);
  const esMulti = valor.graficador === "p_barras_multiapiladas";
  // Las láminas de equivalencias traen `vars` por tema ({ tema_1: [docentes$p1, estudiantes$p1], … }): se cuentan los temas.
  const varsPorTema = !Array.isArray(args.vars) && args.vars && typeof args.vars === "object" ? (args.vars as Record<string, unknown>) : null;
  const nVars = Array.isArray(args.vars) ? args.vars.length : varsPorTema ? Object.keys(varsPorTema).length : 0;
  const nPublicos = varsPorTema ? Math.max(0, ...Object.values(varsPorTema).map((v) => (Array.isArray(v) ? v.length : 0))) : 0;
  const filtros = Array.isArray(args.filtros) ? args.filtros.length : 0;
  const admiteFiltros = (meta?.args ?? []).some((a) => a.name === "filtros");

  return (
    <div className="pulso-f6-datos" data-qa-geometry-group="graficos/f6-datos" data-qa-geometry-contract="intrinsic">
      {esMulti && (
        <div className="pulso-f6-dato">
          <span className="pulso-f6-dato-rotulo">Bloques</span>
          <button type="button" className="pulso-f6-boton pulso-f6-dato-accion" onClick={() => abrirEditorAmplio({ tipo: "bloques", slideId, slot })}>
            <Rows3 size={14} aria-hidden="true" />
            {nVars
              ? varsPorTema
                ? `${nVars} ${nVars === 1 ? "tema" : "temas"} en ${nPublicos} ${nPublicos === 1 ? "público" : "públicos"} · Editar…`
                : `${nVars} ${nVars === 1 ? "pregunta" : "preguntas"} · Editar…`
              : "Elegir preguntas…"}
          </button>
        </div>
      )}
      {valor.graficador === "p_dumbbell" && <BrechaEntreGrupos args={args} onCambio={set} />}
      {valor.graficador === "p_matriz_cuadrantes" && <MatrizCuadrantes args={args} onCambio={set} />}
      {campos.map((c) => (
        <Fila key={c.arg.name} campo={c} valor={args[c.arg.name]} onCambio={(v) => set({ [c.arg.name]: v })} />
      ))}
      {sinBaseCompartido && <NotaBaseCompartido />}
      {conOrden && variable && !sinBaseCompartido && (
        <OrdenCategoriasGrafico variable={varCalificada(variable, baseActiva, scope)} graficador={valor.graficador} args={args} scope={scope} onCambio={(o) => set({ orden_categorias: o })} />
      )}
      {variable && (
        <FilaTexto
          rotulo="Etiqueta corta"
          ayuda="Rótulo de la pregunta en la lámina y el Word; vacío usa el del instrumento."
          valor={leerEtiquetaCorta(args, variable)}
          onCambio={(t) => set({ overrides: conEtiquetaCorta(args, variable, t) })}
        />
      )}
      {admiteFiltros && (
        <div className="pulso-f6-dato">
          <span className="pulso-f6-dato-rotulo">Filtrar respuestas</span>
          <button type="button" className="pulso-f6-boton pulso-f6-dato-accion" onClick={() => abrirEditorAmplio({ tipo: "filtros", slideId, slot })}>
            <Filter size={14} aria-hidden="true" />
            {filtros ? `${filtros} ${filtros === 1 ? "regla" : "reglas"} · Editar…` : "Sin filtro · Agregar…"}
          </button>
        </div>
      )}
      <ColoresGrafico slideId={slideId} slot={slot} valor={valor} argsDelRegistro={meta?.args ?? []} />
      <PaletaDelGrafico valor={valor} />
      <TwoBoxGrafico slideId={slideId} slot={slot} valor={valor} onAbrirBloques={() => abrirEditorAmplio({ tipo: "bloques", slideId, slot })} />
      <ResaltarGrafico slideId={slideId} slot={slot} valor={valor} />
      <CasosGrafico slideId={slideId} slot={slot} valor={valor} />
      <EnElWord slideId={slideId} slot={slot} valor={valor} argsDelRegistro={meta?.args ?? []} />
      <AjustesDelTipo valor={valor} />
    </div>
  );
}

const ORDEN_ANTERIOR = new Set(["orden_barras", "ordenar_categorias"]);

function Ayuda({ rotulo, detalle }: { rotulo: string; detalle: string }) {
  return <AyudaGlobo rotulo={rotulo} detalle={detalle} />;
}

function Fila({ campo, valor, onCambio }: { campo: CampoDato; valor: unknown; onCambio: (v: unknown) => void }) {
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
  if (control === "nombres_base") {
    return <NombresPorBase argName={arg.name} rotulo={rotulo} ayuda={ayuda} valor={valor} onCambio={(p) => onCambio(p[arg.name])} />;
  }
  if (control === "interruptor") {
    // Sin valor guardado manda el default del registro: un interruptor apagado sobre un dibujo encendido mentiría.
    const encendido = interruptorEncendido(arg, valor);
    return (
      <div className="pulso-f6-dato">
        <span className="pulso-f6-dato-rotulo" id={id}>{rotulo}<Ayuda rotulo={rotulo} detalle={detalle} /></span>
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
  if (control === "codigos") {
    return (
      <div className="pulso-f6-dato is-apilado">
        {etiqueta}
        <input id={id} className="pulso-f6-input" value={codigosATexto(valor)} placeholder={placeholder ?? "Ninguna"} aria-describedby={describe}
          onChange={(e) => onCambio(textoACodigos(e.target.value))} />
        {nota}
      </div>
    );
  }
  return <FilaTexto rotulo={rotulo} ayuda={ayuda} placeholder={placeholder} valor={typeof valor === "string" ? valor : ""} onCambio={(t) => onCambio(t)} />;
}

function FilaTexto({ rotulo, ayuda, placeholder = null, valor, onCambio }: {
  rotulo: string; ayuda: string | null; placeholder?: string | null; valor: string; onCambio: (t: string) => void;
}) {
  const id = useId();
  return (
    <div className="pulso-f6-dato is-apilado">
      <label className="pulso-f6-dato-rotulo" htmlFor={id}>{rotulo}</label>
      <input id={id} className="pulso-f6-input" value={valor} placeholder={placeholder ?? undefined}
        aria-describedby={ayuda ? `${id}-ayuda` : undefined} onChange={(e) => onCambio(e.target.value)} />
      {ayuda && <span id={`${id}-ayuda`} className="pulso-f6-dato-ayuda">{ayuda}</span>}
    </div>
  );
}
