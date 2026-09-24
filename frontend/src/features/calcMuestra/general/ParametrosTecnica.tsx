import { AlertTriangle, RefreshCw } from "lucide-react";

import type {
  CalcMuestraAvisoParametro,
  CalcMuestraComponente,
  CalcMuestraParametros,
} from "../../../api/calcMuestra";
import type { CalcMuestraParametroDeTecnica } from "../../../api/calcMuestraGeneral";
import { ErrorBlock, LoadingBlock } from "../../../components/States";
import type { ComponentePatch } from "../sharedCore";
import {
  avisosVigentes,
  ayudaDeParametro,
  formatearZ,
  limitesDe,
  neymanSinPPorEstrato,
  nivelDeZ,
  NIVELES_CONFIANZA,
  opcionesDe,
  parametrosDeTecnica,
  parametrosVisibles,
  pasoDe,
  patchDeParametro,
  placeholderDe,
  tipoDeCampo,
  valorDeOpcion,
  valorNumerico,
} from "./modeloParametros";
import { useCatalogoParametros, type EstadoCatalogo } from "./useCatalogoParametros";
import "./general.css";

/**
 * Método › Parámetros (G2): sólo los que la técnica del componente consume,
 * con el rótulo y la ayuda del motor. La confianza se elige como nivel y la
 * ayuda dice el z. Un valor que el motor corrigió lleva su aviso al lado (F1).
 */
export function ParametrosTecnica({
  comp,
  onComponente,
}: {
  comp: CalcMuestraComponente;
  onComponente: (id: string, patch: ComponentePatch) => void;
}) {
  const { estado, reintentar } = useCatalogoParametros();
  return (
    <ParametrosTecnicaVista
      comp={comp}
      estado={estado}
      onReintentar={reintentar}
      onParametro={(clave, valor) => {
        const parametros = patchDeParametro(clave, valor);
        if (parametros) onComponente(comp.id, { parametros });
      }}
    />
  );
}

/** Los campos con el catálogo ya resuelto (separada para probarla sin efectos). */
export function ParametrosTecnicaVista({
  comp,
  estado,
  onReintentar,
  onParametro,
}: {
  comp: CalcMuestraComponente;
  estado: EstadoCatalogo;
  onReintentar: () => void;
  onParametro: (clave: string, valor: number | string) => void;
}) {
  if (estado.fase === "cargando") return <LoadingBlock label="Leyendo los parámetros de la técnica…" variant="inline" />;
  if (estado.fase === "error") {
    return (
      <div className="cmg-parametros-error">
        <ErrorBlock label="No se pudo leer qué parámetros usa la técnica" detail={estado.mensaje} />
        <button type="button" className="cmv2-ghost" onClick={onReintentar}>
          <RefreshCw size={14} aria-hidden="true" /> Reintentar
        </button>
      </div>
    );
  }
  const declarados = parametrosDeTecnica(estado.catalogo, comp.tecnica);
  const parametros = declarados ? parametrosVisibles(declarados, comp.parametros) : null;
  if (!parametros || parametros.length === 0) {
    return <p className="cmg-nota">Esta técnica no usa parámetros de cálculo en esta mesa.</p>;
  }
  const avisos = avisosVigentes(comp);
  return (
    <div
      className="cmg-parametros cmg-parametros--tecnica"
      role="group"
      aria-label="Parámetros de la técnica"
      data-qa-geometry-group="calc-muestra/general-parametros" data-qa-geometry-contract="intrinsic"
    >
      {parametros.map((param) => (
        <CampoParametro
          key={param.clave}
          compId={comp.id}
          nota={param.clave === "asignacion" && neymanSinPPorEstrato(comp)
            ? "Ningún estrato tiene su p: Neyman reparte igual que proporcional."
            : null}
          param={param}
          parametros={comp.parametros}
          aviso={avisos[param.clave] ?? null}
          onParametro={onParametro}
        />
      ))}
    </div>
  );
}

export function CampoParametro({
  compId,
  nota,
  param,
  parametros,
  aviso,
  onParametro,
}: {
  compId: string;
  /** Una condición del valor elegido que el usuario debe ver (no un error). */
  nota: string | null;
  param: CalcMuestraParametroDeTecnica;
  parametros: CalcMuestraParametros;
  aviso: CalcMuestraAvisoParametro | null;
  onParametro: (clave: string, valor: number | string) => void;
}) {
  const id = `cmg-param-${compId}-${param.clave}`;
  const ayudaId = `${id}-ayuda`;
  const avisoId = `${id}-aviso`;
  const describedBy = aviso ? `${ayudaId} ${avisoId}` : ayudaId;
  const tipo = tipoDeCampo(param.clave, param.tipo);
  const valor = valorNumerico(parametros, param.clave);

  let control: JSX.Element;
  let ayuda = ayudaDeParametro(param, parametros);
  const limites = limitesDe(param.clave);
  if (tipo === "confianza") {
    const nivel = nivelDeZ(valor);
    // Un z fuera de los tres niveles (fijado por un preset) se conserva como opción.
    const actual = nivel ? String(nivel.z) : valor != null ? String(valor) : "";
    control = (
      <select id={id} value={actual} aria-describedby={describedBy} onChange={(e) => onParametro("z", Number(e.currentTarget.value))}>
        {!nivel && valor != null && <option value={String(valor)}>Otro (z = {formatearZ(valor)})</option>}
        {NIVELES_CONFIANZA.map((n) => <option key={n.z} value={String(n.z)}>{n.etiqueta}</option>)}
      </select>
    );
    ayuda = valor != null ? `z = ${formatearZ(valor)}` : "";
  } else if (tipo === "opciones") {
    control = (
      <select id={id} value={valorDeOpcion(parametros, param)} aria-describedby={describedBy} onChange={(e) => onParametro(param.clave, e.currentTarget.value)}>
        {opcionesDe(param).map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
      </select>
    );
  } else {
    control = (
      <input
        id={id}
        type="number"
        min={limites.min}
        max={limites.max}
        step={pasoDe(param.clave)}
        placeholder={placeholderDe(param.clave)}
        value={valor == null ? "" : String(valor)}
        aria-describedby={describedBy}
        aria-invalid={aviso ? true : undefined}
        onChange={(e) => {
          const n = Number(e.currentTarget.value);
          if (!Number.isFinite(n)) return;
          onParametro(param.clave, tipo === "entero" ? Math.round(n) : n);
        }}
      />
    );
  }

  return (
    <div className="cmg-campo" data-param={param.clave}>
      <label htmlFor={id}>{tipo === "confianza" ? "Nivel de confianza" : param.rotulo}</label>
      {control}
      <small id={ayudaId}>{ayuda}{nota && <strong className="cmg-nota-param"> {nota}</strong>}</small>
      {aviso && (
        <small id={avisoId} className="cmg-aviso-param" role="status">
          <AlertTriangle size={12} aria-hidden="true" />
          {aviso.texto}
        </small>
      )}
    </div>
  );
}
