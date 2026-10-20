// Material de campo (ADR 0111): la campaña es la entidad de primer nivel.
//
// `/material-campo` aterriza en la lista de campañas; al abrir una se ven sólo
// sus secciones, con el modo igual a su tipo. Este componente decide la vista
// a partir de la dirección y del registro (`redirecciones.ts`), reescribe con
// `replace` lo que llegue en forma vieja y es el dueño de lo que se comparte
// entre la lista y una campaña abierta: el registro, el ciclo de vida de los
// correos (`useCampanas`) y los diálogos de renombrar y borrar.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { CampanaMaterial } from "../../../api/materialCampanas";
import type { MailPlatform } from "../../../api/materialMail";
import { conNivel } from "../../../lib/navegacion/direccion";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { useDireccion } from "../../../lib/navegacion/useDireccion";
import { ConfirmarBorrarCampana } from "../correos/ConfirmarBorrarCampana";
import { DialogoImportarHtml } from "../correos/DialogoImportarHtml";
import { cabeceraSinAlt } from "../correos/modeloCorreo";
import { nombreLibre } from "../correos/modeloCampanas";
import { PANEL_CORREO_CAMPANA_BORRAR, PANEL_CORREO_IDENTIDAD, PANEL_CORREO_IMPORTAR } from "../correos/panelesCorreos";
import { useCorreosStore } from "../correos/store";
import { useCampanas, type AccionesDeCampanas } from "../correos/useCampanas";
import { RecopiladoresShell } from "../RecopiladoresShell";
import { accionesDeCampana, type IdDeAccion } from "./accionesDeCampana";
import { CabeceraDeCampana } from "./CabeceraDeCampana";
import { CampanaCorreoShell } from "./CampanaCorreoShell";
import { DialogoNuevaCampana, type Resultado } from "./DialogoNuevaCampana";
import { DialogoRenombrarCampana } from "./DialogoRenombrarCampana";
import { RUTA_MATERIAL_CAMPO, direccionDeApertura, hrefDeCampana, searchDeCampanas } from "./direccionDeCampanas";
import { ListaDeCampanas, type AvisoDeLaLista } from "./ListaDeCampanas";
import { useMiniaturasDeCorreo } from "./miniaturaDeCorreo";
import { ID_CAMPANA_AULAS, campanaPorId, idDeCorreo, refDeCorreo } from "./modeloRegistro";
import { PANEL_NUEVA_CAMPANA, PANEL_RENOMBRAR_CAMPANA } from "./panelesCampanas";
import { resolverVistaDeCampanas } from "./redirecciones";
import { useRegistroDeCampanas } from "./useRegistroDeCampanas";

/** «Importar un correo existente» desde «Nueva campaña»: crea la campaña y la abre. */
function ImportarDesdeLaLista({ campanasAcc, plataforma, onAbrir }: {
  campanasAcc: AccionesDeCampanas;
  plataforma: MailPlatform;
  onAbrir: (campaignId: string, aviso: string | undefined, conPanelDeIdentidad: boolean) => void;
}) {
  const panel = usePanelDireccionable(PANEL_CORREO_IMPORTAR);
  const campanas = useCorreosStore((s) => s.campanas);
  const ocupado = useCorreosStore((s) => s.ocupado === "campanas");
  return (
    <DialogoImportarHtml
      panel={panel}
      activa={null}
      campanas={campanas}
      plataformaPorDefecto={plataforma}
      conCambios={false}
      ocupado={ocupado}
      onCrear={campanasAcc.crearImportada}
      onReemplazar={() => undefined}
      onAbrir={(campaignId, aviso, importada) => {
        const sinAlt = cabeceraSinAlt(importada);
        useCorreosStore.getState().setPedirAlt(sinAlt);
        onAbrir(campaignId, aviso, Boolean(sinAlt));
      }}
    />
  );
}

export function MaterialCampoShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const direccion = useDireccion();
  const reg = useRegistroDeCampanas();
  const { recargar, marcarExportacion } = reg;
  const onEscrito = useCallback(() => { void recargar(); }, [recargar]);
  const campanasAcc = useCampanas({ onEscrito });
  const correos = useCorreosStore((s) => s.campanas);
  const miniaturasDeCorreo = useMiniaturasDeCorreo(correos);
  const presets = useCorreosStore((s) => s.presets);
  const miniaturas = useCorreosStore((s) => s.miniaturas);
  const ocupadoCorreos = useCorreosStore((s) => s.ocupado === "campanas");
  const exportacion = useCorreosStore((s) => s.exportacion);
  const correoAbierto = useCorreosStore((s) => s.campana);
  const nueva = usePanelDireccionable(PANEL_NUEVA_CAMPANA);
  const renombrar = usePanelDireccionable(PANEL_RENOMBRAR_CAMPANA);
  const borrar = usePanelDireccionable(PANEL_CORREO_CAMPANA_BORRAR);
  const [aviso, setAviso] = useState<AvisoDeLaLista | null>(null);
  const [plataformaImportar, setPlataformaImportar] = useState<MailPlatform>("mailchimp");

  const registro = reg.registro;
  const resolucion = useMemo(() => (registro
    ? resolverVistaDeCampanas({
      modo: direccion?.modo,
      campana: direccion?.campana,
      seccion: direccion?.seccion,
      pestana: direccion?.pestana,
      panel: direccion?.panel,
      foco: direccion?.foco,
    }, registro)
    : null), [direccion?.campana, direccion?.foco, direccion?.modo, direccion?.panel, direccion?.pestana, direccion?.seccion, registro]);

  // Una dirección vieja o en desacuerdo se reescribe a la canónica, sin historial.
  useEffect(() => {
    if (!resolucion?.reescribir) return;
    const search = searchDeCampanas(location.search, resolucion.reescribir);
    if (search === location.search || search === `?${location.search.replace(/^\?/, "")}`) return;
    navigate({ pathname: location.pathname, search }, { replace: true });
  }, [location.pathname, location.search, navigate, resolucion]);

  const vista = resolucion && !resolucion.reescribir ? resolucion.vista : null;
  const abierta = vista?.vista === "campana" ? vista.campana : null;

  // Volver a la lista relee el registro: lo que se hizo dentro de la campaña
  // (sembrar, preparar accesos, entregar) cambia su tarjeta.
  const vistaAnterior = useRef<string | null>(null);
  useEffect(() => {
    const ahora = vista?.vista ?? null;
    if (ahora === "lista" && vistaAnterior.current === "campana") void recargar();
    if (ahora) vistaAnterior.current = ahora;
  }, [recargar, vista?.vista]);

  // Cada exportación registrada sube el avance de su tarjeta sin releer todo.
  useEffect(() => {
    const rec = exportacion?.export_recorded;
    if (rec && correoAbierto) marcarExportacion(idDeCorreo(correoAbierto), rec);
  }, [correoAbierto, exportacion, marcarExportacion]);

  const accionesDe = useCallback((c: CampanaMaterial) => accionesDeCampana(c, {
    fuente: reg.fuente,
    correos: registro?.campaigns.filter((x) => x.tipo === "correo").length ?? 0,
  }), [reg.fuente, registro]);

  /** La campaña sobre la que actúa un panel: la del foco en la lista, la abierta dentro. */
  const objetivo = registro
    ? campanaPorId(registro, direccion?.foco) ?? campanaPorId(registro, direccion?.campana)
    : null;
  const resumenDelObjetivo = objetivo ? correos.find((c) => idDeCorreo(c.campaign_id) === objetivo.id) ?? null : null;

  const abrirPanelSobre = useCallback((panelId: string, campana: CampanaMaterial) => {
    let search = conNivel(location.search, "panel", panelId);
    if (direccion?.campana !== campana.id) search = conNivel(search, "foco", campana.id);
    navigate({ pathname: location.pathname, search }, { replace: true });
  }, [direccion?.campana, location.pathname, location.search, navigate]);

  const cerrarPanel = useCallback(() => {
    let search = conNivel(location.search, "panel", null);
    if (!direccion?.campana) search = conNivel(search, "foco", null);
    navigate({ pathname: location.pathname, search }, { replace: true });
  }, [direccion?.campana, location.pathname, location.search, navigate]);

  const aLaLista = useCallback(() => navigate(RUTA_MATERIAL_CAMPO, { replace: true }), [navigate]);

  const onAccion = useCallback((accion: IdDeAccion, campana: CampanaMaterial) => {
    setAviso(null);
    if (accion === "renombrar") return abrirPanelSobre(PANEL_RENOMBRAR_CAMPANA.id, campana);
    if (accion === "borrar") return abrirPanelSobre(PANEL_CORREO_CAMPANA_BORRAR.id, campana);
    if (accion === "duplicar") {
      const resumen = correos.find((c) => idDeCorreo(c.campaign_id) === campana.id);
      if (!resumen) return;
      void campanasAcc.duplicar(resumen).then((out) => setAviso(out.ok
        ? { tono: "ok", texto: "Campaña duplicada. Los destinatarios no se copian: se importan en la copia." }
        : { tono: "error", texto: out.mensaje }));
      return;
    }
    const archivar = accion === "archivar";
    void reg.cambiarAulas(campana.id, { archived: archivar }).then((out) => {
      if (!out.ok) {
        setAviso({ tono: "error", texto: out.mensaje });
        return;
      }
      setAviso({
        tono: "ok",
        texto: archivar
          ? `«${campana.name}» se archivó: sale de la lista sin perder plan, fichas ni traspaso. Se reabre desde «Archivadas».`
          : `«${campana.name}» volvió a la lista.`,
      });
      if (archivar && direccion?.campana === campana.id) aLaLista();
    });
  }, [aLaLista, abrirPanelSobre, campanasAcc, correos, direccion?.campana, reg]);

  const guardarNombre = useCallback(async (campana: CampanaMaterial, cambio: { name: string; actor: string; platform?: MailPlatform }): Promise<Resultado> => {
    if (campana.tipo === "aulas") {
      const out = await reg.cambiarAulas(campana.id, { name: cambio.name });
      if (!out.ok) return out;
    } else {
      const ref = refDeCorreo(campana.id);
      if (!ref) return { ok: false, mensaje: "Esa campaña ya no existe en el proyecto." };
      const out = await campanasAcc.renombrar(ref, cambio.name, cambio.actor, cambio.platform);
      if (!out.ok) return out;
      if (out.aviso) setAviso({ tono: "ok", texto: out.aviso });
    }
    cerrarPanel();
    return { ok: true };
  }, [campanasAcc, cerrarPanel, reg]);

  const borrarCorreo = useCallback(async (campaignId: string, confirmName: string) => {
    const out = await campanasAcc.borrar(campaignId, confirmName);
    if (!out.ok) return out;
    useCorreosStore.getState().setBorrarPedido(null);
    setAviso({ tono: "ok", texto: "Campaña borrada con su plantilla y sus destinatarios." });
    // Borrar la abierta vuelve a la lista.
    if (direccion?.campana === idDeCorreo(campaignId)) aLaLista();
    else cerrarPanel();
    return out;
  }, [aLaLista, campanasAcc, cerrarPanel, direccion?.campana]);

  const crearAulas = useCallback(async (name: string): Promise<Resultado> => {
    if (reg.fuente !== "registro") {
      // Sin registro en el backend la campaña de aulas nace al abrirla.
      navigate(hrefDeCampana({ id: ID_CAMPANA_AULAS, tipo: "aulas" }));
      return { ok: true };
    }
    const out = await reg.crearAulas(name);
    if (!out.ok) return out;
    navigate(hrefDeCampana(out.campana));
    return { ok: true };
  }, [navigate, reg]);

  const crearCorreo = useCallback(async (input: { name: string; actor: string; origen: string; platform: MailPlatform }): Promise<Resultado> => {
    const out = await campanasAcc.crear({ ...input, name: nombreLibre(input.name, correos) });
    if (!out.ok) return out;
    if (out.aviso) setAviso({ tono: "ok", texto: out.aviso });
    navigate(hrefDeCampana({ id: idDeCorreo(out.campaignId), tipo: "correo" }));
    return { ok: true };
  }, [campanasAcc, correos, navigate]);

  const cabecera = abierta ? <CabeceraDeCampana campana={abierta} acciones={accionesDe(abierta)} onAccion={onAccion} /> : null;

  const dialogosComunes = registro ? (
    <>
      <DialogoRenombrarCampana
        panel={renombrar}
        campana={renombrar.abierto ? objetivo : null}
        ocupado={reg.ocupado || ocupadoCorreos}
        onGuardar={guardarNombre}
        onCerrar={cerrarPanel}
      />
      <ConfirmarBorrarCampana
        panel={borrar}
        campana={resumenDelObjetivo}
        onBorrar={borrarCorreo}
        onCancelar={cerrarPanel}
      />
    </>
  ) : null;

  if (vista?.vista === "campana" && vista.modo === "aulas") {
    return (
      <>
        <RecopiladoresShell cabecera={cabecera} />
        {dialogosComunes}
      </>
    );
  }

  if (vista?.vista === "campana" && vista.modo === "correo") {
    return (
      <>
        <CampanaCorreoShell nombre={vista.campana.name} cabecera={cabecera} campanasAcc={campanasAcc} onStateRefresh={onEscrito} />
        {dialogosComunes}
      </>
    );
  }

  return (
    <>
      <ListaDeCampanas
        registro={vista ? registro : null}
        carga={reg.carga}
        error={reg.error}
        fuente={reg.fuente}
        aviso={aviso}
        onCerrarAviso={() => setAviso(null)}
        hrefDe={hrefDeCampana}
        accionesDe={accionesDe}
        onAccion={onAccion}
        onNueva={nueva.abrir}
        onReintentar={() => { void recargar(false); }}
        miniaturas={miniaturasDeCorreo}
      />
      {vista ? (
        <>
          <DialogoNuevaCampana
            panel={nueva}
            registro={registro}
            fuente={reg.fuente}
            presets={presets}
            miniaturas={miniaturas}
            ocupado={reg.ocupado || ocupadoCorreos}
            onCrearAulas={crearAulas}
            onCrearCorreo={crearCorreo}
            onImportar={(platform) => {
              setPlataformaImportar(platform);
              navigate({ pathname: location.pathname, search: conNivel(location.search, "panel", PANEL_CORREO_IMPORTAR.id) }, { replace: true });
            }}
          />
          <ImportarDesdeLaLista
            campanasAcc={campanasAcc}
            plataforma={plataformaImportar}
            onAbrir={(campaignId, avisoDeCreacion, conIdentidad) => {
              if (avisoDeCreacion) setAviso({ tono: "ok", texto: avisoDeCreacion });
              const apertura = direccionDeApertura({ id: idDeCorreo(campaignId), tipo: "correo" });
              navigate(`${RUTA_MATERIAL_CAMPO}${searchDeCampanas("", conIdentidad ? { ...apertura, panel: PANEL_CORREO_IDENTIDAD.id } : apertura)}`);
            }}
          />
          {dialogosComunes}
        </>
      ) : null}
    </>
  );
}
