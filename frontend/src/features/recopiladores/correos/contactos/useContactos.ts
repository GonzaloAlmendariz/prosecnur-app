// Lecturas y escrituras de la pestaña Contactos contra el backend (ADR 0112).
//
// Dos consultas independientes —el perfil (tablero) y la página de la lista—
// que comparten los filtros del tablero. Cada una lleva su turno: si el filtro
// cambia dos veces seguidas, la respuesta vieja que llega tarde se descarta en
// vez de pisar a la nueva.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  apiMailContactos,
  apiMailContactosControl,
  apiMailContactosEnlace,
  apiMailContactosPerfil,
  filtrosComoJson,
} from "../../../../api/mailContactos";
import { columnasFiltradas, cruceVigente, filtrosSin, validarEnlace, validarVariable } from "./modeloContactos";
import { useContactosStore } from "./store";

export const POR_PAGINA = 50;
const ESPERA_BUSQUEDA_MS = 300;

function mensajeDe(causa: unknown, porDefecto: string): string {
  return causa instanceof Error && causa.message ? causa.message : porDefecto;
}

/** La búsqueda se aplica cuando se deja de escribir, no en cada tecla. */
function useBusquedaAplicada(busqueda: string): string {
  const [aplicada, setAplicada] = useState(busqueda);
  useEffect(() => {
    if (busqueda.trim() === aplicada.trim()) return;
    const timer = window.setTimeout(() => setAplicada(busqueda), ESPERA_BUSQUEDA_MS);
    return () => window.clearTimeout(timer);
  }, [aplicada, busqueda]);
  return aplicada;
}

export type AccionesDeContactos = {
  guardarControl: (variables: readonly string[]) => Promise<boolean>;
  generarEnlaces: () => Promise<void>;
  /** `true` mientras alguna de las dos lecturas no haya terminado. */
  cargando: boolean;
};

export function useContactos(campaignId: string | null): AccionesDeContactos {
  const s = useContactosStore;
  const campana = useContactosStore((st) => st.campana);
  const filtros = useContactosStore((st) => st.filtros);
  const estado = useContactosStore((st) => st.estado);
  const respondio = useContactosStore((st) => st.respondio);
  const pagina = useContactosStore((st) => st.pagina);
  const crucePedido = useContactosStore((st) => st.cruce);
  const refresco = useContactosStore((st) => st.refresco);
  const busqueda = useContactosStore((st) => st.busqueda);
  const control = useContactosStore((st) => st.perfil?.control);
  const perfilCarga = useContactosStore((st) => st.perfilCarga);
  const listaCarga = useContactosStore((st) => st.listaCarga);
  const busquedaAplicada = useBusquedaAplicada(busqueda);
  const turnoPerfil = useRef(0);
  const turnoLista = useRef(0);
  const turnoFacetas = useRef(0);

  useEffect(() => {
    s.getState().abrirCampana(campaignId);
  }, [campaignId, s]);

  const filtrosClave = filtrosComoJson(filtros) ?? "";
  const cruce = cruceVigente(control ?? [], crucePedido);
  const cruceClave = cruce ? cruce.join(",") : "";

  useEffect(() => {
    if (!campana) return;
    const turno = ++turnoPerfil.current;
    const st = s.getState();
    st.perfilInicio();
    const par = cruceClave ? (cruceClave.split(",") as [string, string]) : null;
    apiMailContactosPerfil({ campaignId: campana, filtros: st.filtros, cruce: par })
      .then((perfil) => { if (turno === turnoPerfil.current) s.getState().perfilListo(perfil); })
      .catch((causa: unknown) => {
        if (turno === turnoPerfil.current) s.getState().perfilFallo(mensajeDe(causa, "No se pudo leer el perfil de los contactos."));
      });
  }, [campana, cruceClave, filtrosClave, refresco, s]);

  // Una tarjeta filtrada no colapsa a la categoría elegida: por cada columna
  // que filtra se pide su distribución sin su propio filtro (OR dentro de la
  // variable, AND con las demás). Son pocas —una por variable filtrada— y van
  // en paralelo; si los filtros cambian, las que llegan tarde se descartan.
  useEffect(() => {
    if (!campana) return;
    const turno = ++turnoFacetas.current;
    const st = s.getState();
    for (const columna of columnasFiltradas(st.filtros)) {
      const resto = filtrosSin(st.filtros, columna);
      const clave = filtrosComoJson(resto) ?? "";
      apiMailContactosPerfil({ campaignId: campana, filtros: resto, cruce: null })
        .then((perfil) => {
          if (turno !== turnoFacetas.current) return;
          const variable = perfil.variables.find((v) => v.key === columna);
          if (variable) s.getState().facetaLista(columna, { variable, base: perfil.base, clave });
        })
        // Sin la faceta la tarjeta se ve con el filtro aplicado: peor, no roto.
        .catch(() => undefined);
    }
  }, [campana, filtrosClave, refresco, s]);

  useEffect(() => {
    if (!campana) return;
    const turno = ++turnoLista.current;
    const st = s.getState();
    st.listaInicio();
    apiMailContactos({
      campaignId: campana,
      q: busquedaAplicada,
      estado,
      respondio,
      filtros: st.filtros,
      page: pagina,
      perPage: POR_PAGINA,
    })
      .then((lista) => { if (turno === turnoLista.current) s.getState().listaLista(lista); })
      .catch((causa: unknown) => {
        if (turno === turnoLista.current) s.getState().listaFallo(mensajeDe(causa, "No se pudo leer la lista de contactos."));
      });
  }, [busquedaAplicada, campana, estado, filtrosClave, pagina, refresco, respondio, s]);

  const guardarControl = useCallback(async (variables: readonly string[]) => {
    const id = s.getState().campana;
    if (!id) return false;
    s.getState().controlInicio();
    try {
      const guardadas = await apiMailContactosControl(id, variables);
      if (s.getState().campana === id) s.getState().controlListo(guardadas);
      return true;
    } catch (causa) {
      if (s.getState().campana === id) s.getState().controlFallo(mensajeDe(causa, "No se pudieron guardar las variables de control."));
      return false;
    }
  }, [s]);

  const generarEnlaces = useCallback(async () => {
    const st = s.getState();
    const id = st.campana;
    if (!id) return;
    const validacion = validarEnlace(st.enlace.url);
    if (!validacion.ok) {
      st.enlaceFallo(validacion.motivo, "url");
      return;
    }
    const variable = validarVariable(st.enlace.variable);
    if (!variable.ok) {
      st.enlaceFallo(variable.motivo, "variable");
      return;
    }
    st.enlaceInicio();
    try {
      const resultado = await apiMailContactosEnlace(id, validacion.url, variable.variable);
      if (s.getState().campana === id) s.getState().enlaceListo(resultado);
    } catch (causa) {
      if (s.getState().campana === id) s.getState().enlaceFallo(mensajeDe(causa, "No se pudieron generar los enlaces."));
    }
  }, [s]);

  const terminada = (carga: string) => carga === "lista" || carga === "error";
  return {
    guardarControl,
    generarEnlaces,
    cargando: !campana || !terminada(perfilCarga) || !terminada(listaCarga),
  };
}
