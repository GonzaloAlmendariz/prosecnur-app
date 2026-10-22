import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { normalizeMonitoreoMailchimpEstado } from "../../../../api/monitoreoMailchimp";
import { AvanceCorreoVista, type AvanceCorreoVistaProps } from "./AvanceCorreoVista";
import {
  ESTADO_CORREO_INICIAL,
  etiquetaTipoEnvio,
  faseCorreo,
  filtrarEnvios,
  marcaReadiness,
  motivoInvalido,
  paginar,
  porcentaje,
  reducirCorreo,
  tasaConBase,
  textoUmbrales,
  type EstadoCorreo,
} from "./avanceCorreoModelo";

// El Node del runner puede no traer ICU completo: se compara la cifra, no el
// carácter que la separa (es-PE escribe «1,234.5»; ver formatoNumero.ts).
const sinSeparador = (texto: string) => texto.replace(/(\d)[.,](\d)/g, "$1|$2");

const CONTRATO = {
  ok: true,
  conectado: true,
  list_id: "e1a9ab97a5",
  leido_at: "2026-10-22T16:00:00Z",
  umbrales: { baja_espaciar: 0.005, queja_espaciar: 0.001, queja_detener: 0.003 },
  avisos: ["2 destinatarios no están en el universo de Monitoreo."],
  publicos: [{
    actor: "Estudiantes de pregrado", universo: 22820, invitados: 22820, invalidos: 41, alcanzable: 22779,
    efectivas: 3120, tasa_universo: 0.1367, tasa_alcanzable: 0.137, bajas: 12, quejas: 1, envios: 2,
    ultimo: { campaign_id: "c2", entregados: 19500, bajas: 9, quejas: 1, respuestas: 610, tasa_baja: 0.00046, tasa_queja: 0.00005 },
    ritmo: "seguir", ritmo_motivo: "Bajas 0.05 % y quejas 0.01 % del último envío, bajo los umbrales.",
  }],
  envios: [{
    campaign_id: "c1", titulo: "Invitación · Pregrado", asunto: "Reacreditación institucional PUCP 2026",
    enviado_at: "2026-10-27T13:00:00Z", etiqueta: "Estudiantes de pregrado", tipo: "invitacion", orden: 1,
    actor: "Estudiantes de pregrado", enviados: 22820, entregados: 22779, rebotes_duros: 38, rebotes_blandos: 3,
    aperturas: 11800, aperturas_sin_proxy: 9100, clics: 3300, bajas: 3, quejas: 0, respuestas: 2510,
    tasa_apertura: 0.3995, tasa_clic: 0.1449, tasa_baja: 0.00013, tasa_queja: 0, por_actor: [],
  }],
  invalidos: {
    total: 41,
    por_actor: [{ actor: "Estudiantes de pregrado", n: 41 }],
    filas: [{ token: "ab12cd34ef", actor: "Estudiantes de pregrado", motivo: "rebote_duro", campaign_id: "c1", fecha: "2026-10-27T13:05:00Z" }],
  },
};

const estadoDe = (cambios: Partial<typeof CONTRATO> & Record<string, unknown> = {}) =>
  normalizeMonitoreoMailchimpEstado({ ...CONTRATO, ...cambios });

const noop = () => {};
const pinta = (s: Partial<EstadoCorreo>, extra: Partial<AvanceCorreoVistaProps> = {}) => renderToStaticMarkup(
  <AvanceCorreoVista
    s={{ ...ESTADO_CORREO_INICIAL, cargando: false, ...s }}
    elegida=""
    cambiando={false}
    ahora={Date.parse("2026-10-22T16:12:00Z")}
    onElegir={noop}
    onGuardarAudiencia={noop}
    onCambiar={noop}
    onCancelarCambio={noop}
    onActualizar={noop}
    onReintentar={noop}
    onPublico={noop}
    {...extra}
  />,
);

describe("modelo de Avance › Correo", () => {
  it("el porcentaje lleva su frecuencia y su base", () => {
    expect(sinSeparador(tasaConBase(9 / 2341, 9, 2341))).toBe("0|38 % · 9 de 2|341");
    expect(sinSeparador(porcentaje(0.137))).toBe("13|7 %");
    expect(porcentaje(0)).toBe("0 %");
  });

  it("una tasa nula se escribe «—», no cero", () => {
    expect(porcentaje(null)).toBe("—");
    expect(tasaConBase(null, 0, 0)).toBe("— · 0 de 0");
  });

  it("las tasas pequeñas no se aplastan contra el umbral", () => {
    // 0.05 % frente a un umbral de 0.1 %: con un decimal ambas serían «0.1 %».
    expect(sinSeparador(porcentaje(0.0005))).toBe("0|05 %");
  });

  it("el tipo sale del orden por público", () => {
    expect(etiquetaTipoEnvio({ tipo: "invitacion", orden: 1 })).toBe("Invitación");
    expect(etiquetaTipoEnvio({ tipo: "recordatorio", orden: 2 })).toBe("Recordatorio 1");
    expect(etiquetaTipoEnvio({ tipo: "recordatorio", orden: 4 })).toBe("Recordatorio 3");
    expect(etiquetaTipoEnvio({ tipo: "recordatorio", orden: null })).toBe("Recordatorio");
  });

  it("motivos de invalidez en lenguaje llano", () => {
    expect(motivoInvalido("rebote_duro")).toBe("Rebote");
    expect(motivoInvalido("limpiado")).toBe("Dado de baja por Mailchimp");
  });

  it("los umbrales se presentan como propuesta", () => {
    const t = sinSeparador(textoUmbrales({ baja_espaciar: 0.005, queja_espaciar: 0.001, queja_detener: 0.003 }));
    expect(t).toMatch(/^Umbrales propuestos, por decidir/);
    expect(t).toContain("detener si las quejas llegan a 0|3 %");
    expect(t).toContain("espaciar si las bajas llegan a 0|5 %, las quejas llegan a 0|1 % o hay menos respuestas que bajas");
  });

  it("filtrar por público incluye los envíos que lo tocaron en su desglose", () => {
    const e = estadoDe({
      envios: [
        { ...CONTRATO.envios[0], campaign_id: "c1", actor: "A", por_actor: [] },
        { ...CONTRATO.envios[0], campaign_id: "c2", actor: "B", por_actor: [{ actor: "B" }, { actor: "A" }] },
        { ...CONTRATO.envios[0], campaign_id: "c3", actor: "C", por_actor: [] },
      ],
    } as Record<string, unknown>);
    expect(filtrarEnvios(e.envios, "A").map((x) => x.campaign_id)).toEqual(["c1", "c2"]);
    expect(filtrarEnvios(e.envios, "")).toHaveLength(3);
  });

  it("paginar acota y no se sale de rango", () => {
    const filas = Array.from({ length: 45 }, (_, i) => i);
    expect(paginar(filas, 3, 20)).toMatchObject({ pagina: 3, paginas: 3, desde: 41, hasta: 45, total: 45 });
    expect(paginar(filas, 99, 20).pagina).toBe(3);
    expect(paginar([], 1, 20)).toMatchObject({ paginas: 1, desde: 0, hasta: 0 });
  });

  it("fases y readiness: false solo mientras carga", () => {
    expect(faseCorreo({ estado: null, cargando: true, error: "" })).toBe("cargando");
    expect(faseCorreo({ estado: null, cargando: false, error: "boom" })).toBe("error");
    expect(faseCorreo({ estado: estadoDe({ conectado: false }), cargando: false, error: "" })).toBe("sin-conexion");
    expect(faseCorreo({ estado: estadoDe({ list_id: "" }), cargando: false, error: "" })).toBe("sin-audiencia");
    expect(faseCorreo({ estado: estadoDe({ leido_at: "" }), cargando: false, error: "" })).toBe("sin-lecturas");
    expect(faseCorreo({ estado: estadoDe({ envios: [] }), cargando: false, error: "" })).toBe("sin-envios");
    expect(faseCorreo({ estado: estadoDe(), cargando: false, error: "" })).toBe("listo");
    expect(marcaReadiness("cargando")).toBe("false");
    for (const f of ["error", "sin-conexion", "sin-audiencia", "sin-lecturas", "sin-envios", "listo"] as const) {
      expect(marcaReadiness(f)).not.toBe("false");
    }
    expect(marcaReadiness("sin-lecturas")).toBe("vacio:sin-lecturas");
  });

  it("el reducer cierra la lectura y conserva el estado ante un fallo", () => {
    const cargado = reducirCorreo(ESTADO_CORREO_INICIAL, { tipo: "cargado", estado: estadoDe() });
    const leyendo = reducirCorreo(cargado, { tipo: "lectura-inicio" });
    expect(leyendo.lectura).toEqual({ percent: null, message: "" });
    const fallo = reducirCorreo(leyendo, { tipo: "fallo", error: "sin red" });
    expect(fallo.lectura).toBeNull();
    expect(fallo.estado?.list_id).toBe("e1a9ab97a5");
    expect(faseCorreo({ estado: fallo.estado, cargando: fallo.cargando, error: fallo.error })).toBe("listo");
  });
});

describe("vista de Avance › Correo", () => {
  it("con datos pinta cabecera, embudo, públicos, cronología, envíos e inválidos", () => {
    const html = pinta({ estado: estadoDe(), audiencias: [{ id: "e1a9ab97a5", name: "PULSO PUCP", member_count: 22820 }] });
    expect(html).toContain('data-audit-ready="monitoreo-correo"');
    expect(html).toContain("PULSO PUCP");
    expect(html).toContain("Leído hace 12 min");
    expect(html).toContain("Actualizar desde Mailchimp");
    expect(html).toContain("Embudo del correo");
    expect(html).toContain("Clic en la encuesta");
    expect(html).toContain("Públicos");
    expect(html).toContain("Cronología de envíos");
    expect(html).toContain("Detalle de envíos");
    expect(html).toContain("Entrega");
    expect(html).toContain("Interacción");
    expect(html).toContain("Salida");
    expect(html).toContain("Correos inválidos");
    expect(html).toContain("2 destinatarios no están en el universo de Monitoreo.");
    expect(html).toContain("Seguir");
    expect(html).toContain("Invitación");
    expect(html).toContain("Rebote");
    expect(html).toContain("ab12cd34ef");
    expect(html).toContain("Umbrales propuestos");
    // Tasa con frecuencia y base.
    expect(sinSeparador(html)).toContain("3|120 de 22|779");
    // Embudo: respondieron sobre los que hicieron clic, con la base nombrada.
    expect(sinSeparador(html)).toContain("de 3|300 con clic");
    // C1: el cuerpo y las colecciones declaran su grupo y su contrato.
    expect(html).toContain('data-qa-geometry-group="monitoreo/acreditacion/avance/correo"');
    expect(html).toContain('data-qa-geometry-group="monitoreo/acreditacion/avance/correo/embudo"');
    expect(html).toContain('data-qa-geometry-group="monitoreo/acreditacion/avance/correo/carriles"');
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
    // El color del público es el mismo en todas las piezas.
    expect(html).toMatch(/es-publico-\d/);
  });

  it("ningún correo llega a la vista: solo tokens", () => {
    expect(pinta({ estado: estadoDe() })).not.toMatch(/@/);
  });

  it("nueve públicos sin envíos: el estado se dice una vez, no nueve", () => {
    const publicos = Array.from({ length: 9 }, (_, i) => ({
      ...CONTRATO.publicos[0], actor: `Público ${i + 1}`, ritmo: "sin_envios", ritmo_motivo: "El público todavía no recibe envíos.", ultimo: null,
    }));
    const html = pinta({ estado: estadoDe({ publicos, envios: [], invalidos: { total: 0, por_actor: [], filas: [] } } as Record<string, unknown>) });
    expect(html.match(/Sin envíos/g)).toHaveLength(1);
    expect(html).toContain("Ningún público ha recibido correos de esta audiencia.");
    expect(html).toContain('data-audit-ready="vacio:sin-envios"');
  });

  it("el público elegido recalcula el embudo y se marca en la matriz", () => {
    const html = pinta({ estado: estadoDe(), publico: "Estudiantes de pregrado" });
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("is-elegida");
  });

  it("un público que ya no existe no deja el embudo vacío", () => {
    const html = pinta({ estado: estadoDe(), publico: "Desaparecido" });
    expect(html).not.toContain("Desaparecido todavía no recibe envíos");
    expect(html).toContain("Clic en la encuesta");
  });

  it("sin conexión dice dónde se conecta Mailchimp", () => {
    const html = pinta({ estado: estadoDe({ conectado: false }) });
    expect(html).toContain("Falta conectar Mailchimp");
    expect(html).toContain("Configuración › Conexiones");
    expect(html).toContain('data-audit-ready="vacio:sin-conexion"');
    expect(html).not.toContain("Actualizar desde Mailchimp");
  });

  it("sin audiencia ofrece el selector", () => {
    const html = pinta({
      estado: estadoDe({ list_id: "", leido_at: "" }),
      audiencias: [{ id: "e1", name: "PULSO PUCP", member_count: 22820 }],
    });
    expect(html).toContain("Elige la audiencia del estudio");
    expect(html).toContain("<select");
    expect(html).toContain("PULSO PUCP");
    expect(html).toContain('data-audit-ready="vacio:sin-audiencia"');
  });

  it("sin lecturas invita a actualizar", () => {
    const html = pinta({ estado: estadoDe({ leido_at: "" }) });
    expect(html).toContain("Actualiza desde Mailchimp para traer los envíos.");
    expect(html).toContain("Sin lecturas");
    expect(html).toContain('data-audit-ready="vacio:sin-lecturas"');
  });

  it("sin envíos conserva los públicos y declara su vacío dentro de su bloque", () => {
    const html = pinta({ estado: estadoDe({ envios: [], invalidos: { total: 0, por_actor: [], filas: [] } }) });
    expect(html).toContain("Públicos");
    expect(html).toContain("Esta audiencia todavía no tiene envíos");
    expect(html).toContain("Sin correos inválidos");
    expect(html).toContain('data-audit-ready="vacio:sin-envios"');
  });

  it("mientras carga la marca queda en false", () => {
    expect(pinta({ cargando: true })).toContain('data-audit-ready="false"');
  });

  it("la lectura en curso muestra su avance dentro del botón y como estado", () => {
    const html = pinta({ estado: estadoDe(), lectura: { percent: 45, message: "Leyendo destinatarios" } });
    expect(html).toContain("Leyendo Mailchimp — Leyendo destinatarios");
    expect(html).toContain("Leyendo 45 %");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="45"');
  });

  it("un envío con varios públicos se puede desplegar", () => {
    const html = pinta({
      estado: estadoDe({
        envios: [{
          ...CONTRATO.envios[0],
          por_actor: [
            { actor: "Estudiantes de pregrado", aperturas: 9000, aperturas_sin_proxy: null },
            { actor: "Docentes", aperturas: 300, aperturas_sin_proxy: null },
          ],
        }],
      } as Record<string, unknown>),
    });
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Ver por público");
  });
});
