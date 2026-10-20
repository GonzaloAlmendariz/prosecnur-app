import { useCallback, useEffect, useRef } from "react";

import {
  apiMailCampaignCreate,
  apiMailCampaignDelete,
  apiMailCampaignDuplicate,
  apiMailCampaignMeta,
  apiMailCampaigns,
  apiMailPresets,
  apiMailPreview,
  apiMailTemplatePut,
  type MailCampaign,
  type MailCampaignSummary,
} from "../../../api/materialMail";
import {
  AVISO_LISTA_PROVISIONAL,
  ORIGEN_EN_BLANCO,
  avisoDeCampana,
  hayQueReleerCampanas,
  nombreDeCopia,
  plantillaEnBlanco,
  ponerCampana,
  quitarCampana,
  resumenDeCampana,
} from "./modeloCampanas";
import { useCorreosStore } from "./store";

export type ResultadoDeCampana =
  | { ok: true; campaignId: string; aviso?: string }
  | { ok: false; mensaje: string };

export type ResultadoDelBorrado =
  | { ok: true }
  | { ok: false; mensaje: string };

/** Lo que `crearCampanaEncadenada` necesita del backend; en los tests, dobles. */
export type PuertoDeCreacion = {
  crear: typeof apiMailCampaignCreate;
  guardarPlantilla: typeof apiMailTemplatePut;
};

const PUERTO_REAL: PuertoDeCreacion = { crear: apiMailCampaignCreate, guardarPlantilla: apiMailTemplatePut };

/**
 * Crea una campaña y, si es en blanco, guarda encima la plantilla mínima.
 *
 * Son dos escrituras seguidas sobre la misma revisión global: la segunda usa
 * la `state_revision` que devolvió la primera, nunca la que se leyó antes de
 * empezar (eso daría un 409 falso). `anotar` recibe cada revisión nueva en
 * cuanto llega, para que el store y el shell no se queden atrás aunque la
 * segunda falle.
 */
export async function crearCampanaEncadenada(
  puerto: PuertoDeCreacion,
  input: { expected_revision: number; name: string; actor: string; origen: string },
  anotar: (revision: number) => void,
): Promise<{ campana: MailCampaign; aviso?: string }> {
  const enBlanco = input.origen === ORIGEN_EN_BLANCO;
  const creada = await puerto.crear({
    expected_revision: input.expected_revision,
    name: input.name.trim(),
    actor: input.actor.trim(),
    preset_id: enBlanco ? null : input.origen,
  });
  anotar(creada.state_revision);
  let campana = creada.campaign;
  let aviso = creada.recipients_purged_virtual ? AVISO_LISTA_PROVISIONAL : undefined;
  if (enBlanco && campana.template) {
    try {
      const guardada = await puerto.guardarPlantilla({
        template: plantillaEnBlanco(campana.template, campana.name),
        expected_revision: creada.state_revision,
        campaign_id: campana.campaign_id,
      });
      anotar(guardada.state_revision);
      campana = { ...campana, template: guardada.template };
    } catch {
      // La campaña ya existe: se abre con la plantilla de fábrica y se dice.
      aviso = "La campaña se creó con la plantilla de fábrica: no se pudo dejarla en blanco. Puedes editarla igual.";
    }
  }
  return { campana, aviso };
}

/**
 * Lista de campañas de correo y sus escrituras (E1h).
 *
 * Es el dueño del ciclo de vida del editor de correos: al montarse olvida lo
 * de la vista anterior y lee la lista; al cambiar de proyecto, igual; al
 * salir, olvida todo (los destinatarios no sobreviven a la vista).
 *
 * Cada escritura manda la `state_revision` vigente y anota la que devuelve
 * (`anotarRevision`): crear y luego guardar la plantilla en blanco encadena
 * dos escrituras sin un 409 falso. Tras cada una se avisa al shell con
 * `onEscrito`, para que su payload no quede con una revisión vieja (H-f).
 */
export function useCampanas(opciones: { onEscrito?: () => void } = {}) {
  const s = useCorreosStore;
  const vivo = useRef(true);
  const onEscrito = useRef(opciones.onEscrito);
  onEscrito.current = opciones.onEscrito;

  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const cargarCampanas = useCallback(async () => {
    s.getState().campanasInicio();
    try {
      const conocidos = s.getState().presets;
      const [lista, presets] = await Promise.all([
        apiMailCampaigns(),
        conocidos.length ? Promise.resolve(null) : apiMailPresets(),
      ]);
      if (!vivo.current) return;
      if (presets) s.getState().setPresets(presets.presets);
      s.getState().campanasLista(lista.campaigns, lista.state_revision);
      // Miniaturas de las plantillas reales: el mismo render, con la persona de ejemplo.
      for (const preset of s.getState().presets) {
        if (preset.preset_id in s.getState().miniaturas) continue;
        // Con dos o más campañas el backend pide una aunque la plantilla vaya en el cuerpo.
        apiMailPreview({ mode: "preview", template: preset.template, campaign_id: lista.campaigns[0]?.campaign_id ?? null }).then(
          (preview) => { if (vivo.current) s.getState().setMiniatura(preset.preset_id, preview.html); },
          () => { if (vivo.current) s.getState().setMiniatura(preset.preset_id, null); },
        );
      }
    } catch (cause) {
      if (vivo.current) s.getState().campanasFallo(avisoDeCampana(cause, "No se pudieron leer las campañas de correo."));
    }
  }, [s]);

  useEffect(() => {
    s.getState().reiniciar();
    void cargarCampanas();
    const onSession = () => {
      s.getState().reiniciar();
      void cargarCampanas();
    };
    window.addEventListener("pulso:session-changed", onSession);
    return () => {
      window.removeEventListener("pulso:session-changed", onSession);
      s.getState().reiniciar();
    };
  }, [cargarCampanas, s]);

  /** Revisión para escribir; si todavía no hay una, se lee la lista. */
  const revisionVigente = useCallback(async (): Promise<number | null> => {
    const actual = s.getState().stateRevision;
    if (actual !== null) return actual;
    await cargarCampanas();
    return s.getState().stateRevision;
  }, [cargarCampanas, s]);

  /** Tras un 409 o un 404 la lista local ya no es la del servidor. */
  const fallo = useCallback((cause: unknown, fallback: string): { ok: false; mensaje: string } => {
    if (hayQueReleerCampanas(cause) && vivo.current) void cargarCampanas();
    return { ok: false, mensaje: avisoDeCampana(cause, fallback) };
  }, [cargarCampanas]);

  const escrito = useCallback((revision: number) => {
    s.getState().anotarRevision(revision);
    onEscrito.current?.();
  }, [s]);

  /** `origen`: un `preset_id` real o `ORIGEN_EN_BLANCO`. */
  const crear = useCallback(async (input: { name: string; actor: string; origen: string }): Promise<ResultadoDeCampana> => {
    const revision = await revisionVigente();
    if (revision === null) return { ok: false, mensaje: "No se sabe qué versión del módulo está guardada. Vuelve a cargar." };
    s.getState().setOcupado("campanas");
    try {
      const { campana, aviso } = await crearCampanaEncadenada(
        PUERTO_REAL,
        { expected_revision: revision, name: input.name, actor: input.actor, origen: input.origen },
        escrito,
      );
      if (vivo.current) s.getState().setCampanas((lista) => ponerCampana(lista, resumenDeCampana(campana)));
      return { ok: true, campaignId: campana.campaign_id, aviso };
    } catch (cause) {
      return fallo(cause, "No se pudo crear la campaña.");
    } finally {
      if (vivo.current) s.getState().setOcupado(null);
    }
  }, [escrito, fallo, revisionVigente, s]);

  const duplicar = useCallback(async (origen: MailCampaignSummary): Promise<ResultadoDeCampana> => {
    const revision = await revisionVigente();
    if (revision === null) return { ok: false, mensaje: "No se sabe qué versión del módulo está guardada. Vuelve a cargar." };
    s.getState().setOcupado("campanas");
    try {
      const copia = await apiMailCampaignDuplicate({
        expected_revision: revision,
        campaign_id: origen.campaign_id,
        name: nombreDeCopia(origen.name, s.getState().campanas),
        actor: origen.actor,
      });
      escrito(copia.state_revision);
      if (vivo.current) s.getState().setCampanas((lista) => ponerCampana(lista, resumenDeCampana(copia.campaign)));
      return { ok: true, campaignId: copia.campaign.campaign_id };
    } catch (cause) {
      return fallo(cause, "No se pudo duplicar la campaña.");
    } finally {
      if (vivo.current) s.getState().setOcupado(null);
    }
  }, [escrito, fallo, revisionVigente, s]);

  const renombrar = useCallback(async (campaignId: string, name: string, actor: string): Promise<ResultadoDeCampana> => {
    const revision = await revisionVigente();
    if (revision === null) return { ok: false, mensaje: "No se sabe qué versión del módulo está guardada. Vuelve a cargar." };
    s.getState().setOcupado("campanas");
    try {
      const out = await apiMailCampaignMeta({ expected_revision: revision, campaign_id: campaignId, name: name.trim(), actor: actor.trim() });
      if (!out.noop) escrito(out.state_revision);
      if (vivo.current) {
        s.getState().setCampanas((lista) => {
          const previo = lista.find((c) => c.campaign_id === campaignId) ?? null;
          return ponerCampana(lista, resumenDeCampana(out.campaign, previo));
        });
      }
      return { ok: true, campaignId };
    } catch (cause) {
      return fallo(cause, "No se pudo renombrar la campaña.");
    } finally {
      if (vivo.current) s.getState().setOcupado(null);
    }
  }, [escrito, fallo, revisionVigente, s]);

  /** `confirmName` es lo que la persona escribió: el backend lo compara con el nombre. */
  const borrar = useCallback(async (campaignId: string, confirmName: string): Promise<ResultadoDelBorrado> => {
    const revision = await revisionVigente();
    if (revision === null) return { ok: false, mensaje: "No se sabe qué versión del módulo está guardada. Vuelve a cargar." };
    s.getState().setOcupado("campanas");
    try {
      const out = await apiMailCampaignDelete({ expected_revision: revision, campaign_id: campaignId, confirm_name: confirmName });
      escrito(out.state_revision);
      if (vivo.current) s.getState().setCampanas((lista) => quitarCampana(lista, out.deleted));
      return { ok: true };
    } catch (cause) {
      return fallo(cause, "No se pudo borrar la campaña.");
    } finally {
      if (vivo.current) s.getState().setOcupado(null);
    }
  }, [escrito, fallo, revisionVigente, s]);

  return { cargarCampanas, crear, duplicar, renombrar, borrar };
}

export type AccionesDeCampanas = ReturnType<typeof useCampanas>;
