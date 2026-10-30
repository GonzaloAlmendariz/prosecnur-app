import { useCallback, useEffect, useReducer, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { apiMonitoreoConfig, type MonitoreoInterestVariable, type MonitoreoState } from "../../../../api/client";
import { postMonitoreoCuotaProponer, postMonitoreoCuotas } from "../../../../api/monitoreoCuotas";
import { generacionDeCuotas, leerCuotas, recordarCuotas } from "./insumos/cuotasRecientes";
import { serializarDireccion } from "../../../../lib/navegacion/direccion";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { useDireccion } from "../../../../lib/navegacion/useDireccion";
import { AvanceCuotasPanel, PANEL_CUOTA } from "./AvanceCuotasPanel";
import { claveDeSeguida } from "./seguidas";

export { claveDeSeguida };
import {
  borradorDeCuota,
  borradorNuevo,
  entradasConBorrador,
  entradasSinCuota,
  ESTADO_CUOTAS_INICIAL,
  idGuardado,
  reducirBorrador,
  reducirCuotas,
  textoACobertura,
} from "./avanceCuotasModelo";

// Configuración de cuotas de acreditación: lee `/api/monitoreo/cuotas`,
// conecta la cuota elegida y el panel de configuración a la dirección
// (`?foco=<id>` elige; `?panel=cuota` abre el panel) y manda proponer, guardar y
// quitar. Salió de `AvanceCuotas` sin cambiar lógica para que Modelo › Cuotas
// (M2) defina con los mismos llamados y Avance › Por cuota solo lea.

function mensajeDeError(e: unknown, respaldo: string) {
  return e instanceof Error && e.message ? e.message : respaldo;
}

/** El estudio, para seguir una variable sin metas (`operational_model.interest_variables`). */
type OpcionesDeCuotas = { state?: MonitoreoState | null; onStateChange?: (state: MonitoreoState) => void };

export function useConfiguracionDeCuotas({ state, onStateChange }: OpcionesDeCuotas = {}) {
  const [s, despachar] = useReducer(reducirCuotas, ESTADO_CUOTAS_INICIAL);
  const [borrador, despacharBorrador] = useReducer(reducirBorrador, borradorNuevo([]));
  const panel = usePanelDireccionable(PANEL_CUOTA);
  const direccion = useDireccion();
  const navigate = useNavigate();
  const foco = direccion?.foco ?? "";
  const vivo = useRef(true);
  // Público y variable con que abre una cuota nueva («Definir cuota» desde Modelo).
  const semilla = useRef({ actor: "", variable: "" });
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const cargar = useCallback(async () => {
    despachar({ tipo: "cargar" });
    try {
      const estado = await leerCuotas();
      if (vivo.current) despachar({ tipo: "cargado", estado });
    } catch (e) {
      if (vivo.current) despachar({ tipo: "fallo", error: mensajeDeError(e, "No se pudieron leer las cuotas.") });
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  // Mientras Monitoreo prepara el cruce, la vista vuelve a pedir sola.
  const preparando = s.estado?.preparando === true;
  useEffect(() => {
    if (!preparando) return undefined;
    const t = window.setTimeout(() => { void cargar(); }, 15000);
    return () => window.clearTimeout(t);
  }, [preparando, cargar, s.estado]);

  // Escribe la dirección por la gramática compartida: `panel` y `foco` son
  // los dos únicos niveles que esta pestaña toca.
  const irA = useCallback((cambios: { panel: boolean; foco: string }) => {
    if (!direccion) return;
    const destino = {
      ...direccion,
      panel: cambios.panel ? PANEL_CUOTA.id : undefined,
      foco: cambios.foco || undefined,
    };
    navigate(serializarDireccion(destino), { replace: true });
  }, [direccion, navigate]);

  // El borrador se arma al abrir el panel (o al cambiar la cuota que edita):
  // con `foco` de una cuota existente, la edita; sin él, una nueva.
  const estado = s.estado;
  const editando = panel.abierto ? estado?.cuotas.find((q) => q.id === foco) ?? null : null;
  const claveBorrador = panel.abierto && estado ? editando?.id ?? "nueva" : "";
  const ultimaClave = useRef("");
  useEffect(() => {
    // Solo al abrir o al cambiar de cuota: una relectura no pisa lo que se escribe.
    if (claveBorrador === ultimaClave.current) return;
    ultimaClave.current = claveBorrador;
    if (!claveBorrador || !estado) return;
    despachar({ tipo: "limpiar-panel" });
    const nueva = borradorNuevo(estado.publicos, semilla.current.actor);
    const conVariable = semilla.current.variable ? { ...nueva, variable: semilla.current.variable } : nueva;
    semilla.current = { actor: "", variable: "" };
    despacharBorrador({ tipo: "iniciar", borrador: editando ? borradorDeCuota(editando) : conVariable });
  }, [claveBorrador, editando, estado]);

  const cerrar = useCallback(() => irA({ panel: false, foco }), [irA, foco]);

  const proponer = async () => {
    despachar({ tipo: "proponer" });
    try {
      const propuesta = await postMonitoreoCuotaProponer({
        actor: borrador.actor,
        variable: borrador.variable,
        cobertura: textoACobertura(borrador.cobertura),
      });
      if (!vivo.current) return;
      despacharBorrador({ tipo: "propuesta", propuesta });
      despachar({ tipo: "propuesto" });
    } catch (e) {
      if (vivo.current) despachar({ tipo: "fallo-panel", error: mensajeDeError(e, "No se pudieron proponer las metas.") });
    }
  };

  const guardar = async () => {
    if (!estado) return;
    despachar({ tipo: "guardar" });
    try {
      const generacion = generacionDeCuotas();
      const nuevo = await postMonitoreoCuotas(entradasConBorrador(estado.cuotas, borrador));
      recordarCuotas(nuevo, generacion);
      if (!vivo.current) return;
      despachar({ tipo: "guardado", estado: nuevo, aviso: `Cuota de ${borrador.actor} por ${borrador.variable} guardada.` });
      irA({ panel: false, foco: idGuardado(nuevo, borrador) });
    } catch (e) {
      if (vivo.current) despachar({ tipo: "fallo-panel", error: mensajeDeError(e, "No se pudo guardar la cuota.") });
    }
  };

  const quitar = async (id: string) => {
    if (!estado) return;
    despachar({ tipo: "guardar" });
    try {
      const generacion = generacionDeCuotas();
      const nuevo = await postMonitoreoCuotas(entradasSinCuota(estado.cuotas, id));
      recordarCuotas(nuevo, generacion);
      if (!vivo.current) return;
      despachar({ tipo: "guardado", estado: nuevo, aviso: "Cuota quitada." });
      irA({ panel: false, foco: "" });
    } catch (e) {
      if (vivo.current) despachar({ tipo: "fallo-panel", error: mensajeDeError(e, "No se pudo quitar la cuota.") });
    }
  };

  // «Solo seguimiento» (Gonzalo, 30/10): la variable no lleva metas; se compara la
  // distribución de las efectivas con la del universo en Variables de control.
  const seguidas = new Set((state?.config?.operational_model?.interest_variables ?? []).map((item) => claveDeSeguida(item.actor, item.variable)));
  const escribirSeguidas = async (siguientes: MonitoreoInterestVariable[], aviso: string, debeQuedar: boolean) => {
    if (!estado || !state?.config) return;
    despachar({ tipo: "guardar" });
    try {
      const result = await apiMonitoreoConfig({
        ...state.config,
        operational_model: { ...state.config.operational_model, interest_variables: siguientes },
      });
      onStateChange?.(result.state);
      // El motor descarta la variable que no está en la base: no se anuncia lo que no quedó.
      const vuelta = (result.state?.config?.operational_model?.interest_variables ?? [])
        .some((item) => claveDeSeguida(item.actor, item.variable) === claveDeSeguida(borrador.actor, borrador.variable));
      if (!vivo.current) return;
      if (vuelta !== debeQuedar) {
        despachar({ tipo: "fallo-panel", error: debeQuedar ? `El motor no aceptó ${borrador.variable}: no está entre las columnas de la base de ${borrador.actor}.` : `${borrador.variable} sigue en seguimiento: el motor no la quitó.` });
        return;
      }
      despachar({ tipo: "guardado", estado, aviso });
      irA({ panel: false, foco });
    } catch (e) {
      if (vivo.current) despachar({ tipo: "fallo-panel", error: mensajeDeError(e, "No se pudo cambiar el seguimiento de la variable.") });
    }
  };
  const seguir = async () => {
    if (!state?.config || !borrador.actor || !borrador.variable) return;
    if (seguidas.has(claveDeSeguida(borrador.actor, borrador.variable))) return;
    const previas = state.config.operational_model?.interest_variables ?? [];
    await escribirSeguidas(
      [...previas, { actor: borrador.actor, variable: borrador.variable, normalization: "ninguna" }],
      `${borrador.variable} de ${borrador.actor} queda en seguimiento: su distribución se compara con la del universo en Avance › Variables de control.`,
      true,
    );
  };
  const dejarDeSeguir = async () => {
    if (!state?.config || !borrador.actor || !borrador.variable) return;
    const clave = claveDeSeguida(borrador.actor, borrador.variable);
    const previas = state.config.operational_model?.interest_variables ?? [];
    await escribirSeguidas(previas.filter((item) => claveDeSeguida(item.actor, item.variable) !== clave), `${borrador.variable} de ${borrador.actor} deja de estar en seguimiento.`, false);
  };

  const abrirNueva = useCallback((actor = "", variable = "") => {
    semilla.current = { actor, variable };
    irA({ panel: true, foco: "" });
  }, [irA]);

  const panelNode = panel.abierto && estado ? (
    <AvanceCuotasPanel
      borrador={borrador}
      publicos={estado.publicos}
      cuotas={estado.cuotas}
      proponiendo={s.proponiendo}
      guardando={s.guardando}
      error={s.errorPanel}
      panelProps={panel.props}
      onBorrador={despacharBorrador}
      onProponer={() => { void proponer(); }}
      onGuardar={() => { void guardar(); }}
      onQuitar={(id) => { void quitar(id); }}
      onSeguir={state?.config ? () => { void seguir(); } : undefined}
      onDejarDeSeguir={state?.config ? () => { void dejarDeSeguir(); } : undefined}
      seguidas={seguidas}
      onCerrar={cerrar}
    />
  ) : null;

  return { s, foco, irA, cargar, abrirNueva, panelNode, seguidas };
}
