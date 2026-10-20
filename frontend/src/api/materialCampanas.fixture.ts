// Respuesta de `GET /api/recopiladores/campaigns` con la forma del backend real
// (ff91e3baf: `ref` es un objeto, `motivo` falta cuando se puede crear),
// endurecida con lo que R puede serializar: escalares en vector de largo uno y
// una lista vacía con nombres como `{}`. Es la fuente de los tests de normalización y de la lista;
// no la consume producción.

export const REGISTRO_CRUDO = {
  ok: [true],
  schema: ["material_campaigns/v1"],
  registry_revision: [3],
  state_revision: [41],
  campaigns: [
    {
      id: ["aulas.principal"],
      tipo: ["aulas"],
      name: ["Campo en aulas 2026-2"],
      created_at: ["2026-10-02T09:00:00Z"],
      archived: [false],
      persisted: [true],
      ref: { store: ["collection_state"], plan_id: ["plan-aulas-1"] },
      estado: {
        unidades: [2468],
        titulares: [175],
        con_enlace: [120],
        deployment_status: ["prepared"],
        plan_desfasado: [false],
      },
    },
    {
      id: ["correo.egresados"],
      tipo: ["correo"],
      name: ["Invitación egresados"],
      actor: ["Egresados"],
      created_at: ["2026-10-05T12:00:00Z"],
      archived: [false],
      persisted: [false],
      ref: { store: ["collection_state.mail_campaigns"], campaign_id: ["egresados"] },
      estado: {
        platform: ["mailchimp"],
        envios: [2],
        bloques: [7],
        recipients_loaded: [true],
        envios_detalle: [
          { send_id: ["invitacion"], label: ["Invitación"], last_export_at: ["2026-09-02T15:20:00Z"], last_export_platform: ["mailchimp"] },
          { send_id: ["recordatorio-1"], label: ["Recordatorio 1"], last_export_at: null, last_export_platform: null },
        ],
      },
    },
    // Un tipo que esta versión no conoce: se descarta.
    { id: ["panel.x"], tipo: ["panel"], name: ["Panel"] },
    // Un id que no cumple la forma: se descarta.
    { id: ["correo.Con Espacios"], tipo: ["correo"], name: ["Mal"] },
  ],
  tipos: [
    { tipo: ["aulas"], disponible: [false], motivo: ["El proyecto ya tiene su campaña de aulas."] },
    { tipo: ["territorial"], disponible: [false], motivo: ["Requiere leer las UMP de Hojas de ruta"] },
    { tipo: ["correo"], disponible: [true] },
  ],
} as const;

/** Un registro sin campañas: el proyecto todavía no prepara material. */
export const REGISTRO_VACIO_CRUDO = {
  ok: true,
  schema: "material_campaigns/v1",
  registry_revision: 0,
  state_revision: 1,
  campaigns: {},
  tipos: [
    { tipo: "aulas", disponible: true },
    { tipo: "territorial", disponible: false, motivo: "Requiere leer las UMP de Hojas de ruta" },
    { tipo: "correo", disponible: true },
  ],
} as const;
