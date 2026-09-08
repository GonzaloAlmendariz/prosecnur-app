import { describe, expect, expectTypeOf, it } from "vitest";
import { avisoConversacion } from "./avisoConversacion";
import type {
  apiMonitoreoAulasSync,
  MonitoreoAulasLibroConversacion,
} from "../../../../api/monitoreo";

/**
 * Qué cuenta el sync cuando conversó con el Sheets del operativo (unidad B7).
 *
 * El gesto único —leer lo del equipo y re-publicar lo de la app— pasa entero
 * dentro del Recargar, así que si el aviso no lo cuenta, nadie sabe que el
 * ciclo corrió. Las dos mitades van en una línea; los fallos dicen la causa Y
 * la consecuencia; y SIN bloque el sync se comunica exactamente como siempre:
 * cero ruido nuevo.
 *
 * Números chicos a propósito: `fmt` usa es-PE y el runner sin ICU degrada el
 * separador de miles; por debajo de 1.000 el texto es igual en ambos.
 */

// El bloque que viaja en la respuesta del sync ES el tipo que este aviso
// consume: si el tipo de la API y el del consumidor divergen, esto no compila.
type RespuestaSync = Awaited<ReturnType<typeof apiMonitoreoAulasSync>>;

describe("avisoConversacion", () => {
  it("el bloque de la respuesta del sync es exactamente el tipo del aviso", () => {
    expectTypeOf<RespuestaSync["libro_conversacion"]>().toEqualTypeOf<
      MonitoreoAulasLibroConversacion | undefined
    >();
  });

  it("sin bloque no hay aviso: el sync sin destino se comunica como siempre", () => {
    expect(avisoConversacion(undefined)).toBeNull();
    expect(avisoConversacion(null)).toBeNull();
  });

  /**
   * **Cuando todo va bien, el aviso calla** (Gonzalo, 2026-09-08: «este mensaje
   * no debería estar aquí»). El inventario de qué hoja se leyó y cuál se
   * respetó narraba una operación que salió bien: ocupaba el sitio de la
   * pantalla que se mira y no pedía ninguna decisión.
   *
   * La redacción no se perdió y sigue pineada donde importa: los casos de
   * ATENCIÓN la usan entera —`publicacion_fallo` cuenta «3 partes del equipo
   * entraron» más abajo—, que es cuando alguien tiene que hacer algo.
   */
  it("con todo en orden no dice nada: no hay nada que corregir", () => {
    const res = avisoConversacion({
      conversado: true,
      leido: {
        fusion: { actualizadas: 3, nuevas: 0, intactas: 187 },
        hojas_ausentes: [],
        resumen: { partes_de_campo: 3 },
      },
      publicado: {
        hojas: [
          { hoja: "Base de control", accion: "actualizada", filas: 174 },
          { hoja: "Plan del día", accion: "sin_cambios", filas: 12 },
        ],
      },
    });
    expect(res).toBeNull();
  });

  it("una sola parte, y todo en orden, tampoco se anuncia", () => {
    const res = avisoConversacion({
      conversado: true,
      leido: { resumen: { partes_de_campo: 1 } },
      publicado: { hojas: [{ hoja: "Base de control", accion: "sin_cambios", filas: 174 }] },
    });
    expect(res).toBeNull();
  });

  it("sin partes nuevas y sin nada roto, tampoco hay aviso", () => {
    const res = avisoConversacion({
      conversado: true,
      leido: { resumen: { partes_de_campo: 0 } },
      publicado: { hojas: [{ hoja: "Base de control", accion: "sin_cambios", filas: 174 }] },
    });
    expect(res).toBeNull();
  });

  it("una hoja respetada no es un fallo, así que tampoco se anuncia", () => {
    const res = avisoConversacion({
      conversado: true,
      leido: { resumen: { partes_de_campo: 2 } },
      publicado: {
        hojas: [
          { hoja: "Aulas Agendadas", accion: "respetada", filas: 45 },
          { hoja: "Base de control", accion: "actualizada", filas: 45 },
        ],
      },
    });
    expect(res).toBeNull();
  });

  it("una acción desconocida sin nada roto tampoco interrumpe", () => {
    const res = avisoConversacion({
      conversado: true,
      leido: { resumen: { partes_de_campo: 2 } },
      publicado: { hojas: [{ hoja: "Base de control", accion: "reescrita", filas: 174 }] },
    });
    expect(res).toBeNull();
  });

  it("documento virgen: el libro completo se sembró por primera vez", () => {
    // En esta rama `leido` viene null con `conversado = true`: no es un fallo,
    // es «nada que leer aún» — y el copy es el dictado, entero y sin adornos.
    const res = avisoConversacion({
      conversado: true,
      motivo_lectura: "documento_virgen",
      leido: null,
      publicado: {
        hojas: [
          { hoja: "Aulas Agendadas", accion: "sembrada", filas: 196 },
          { hoja: "Base de control", accion: "sembrada", filas: 196 },
        ],
      },
    });
    expect(res?.tono).toBe("ok");
    expect(res?.texto).toBe(
      "El Sheets estaba vacío: el libro completo se sembró por primera vez.",
    );
  });

  it("lectura_fallo: el mensaje y la consecuencia, en tono de atención", () => {
    const res = avisoConversacion({
      conversado: false,
      motivo: "lectura_fallo",
      mensaje: "HTTP 403 al leer «Aulas Agendadas».",
    });
    expect(res?.tono).toBe("atencion");
    expect(res?.texto).toContain("HTTP 403");
    // La consecuencia, no solo el hecho: nada se escribió encima del remoto.
    expect(res?.texto).toContain("No se publicó nada");
    expect(res?.texto).toMatch(/datos viejos/);
  });

  it("publicacion_fallo: lo leído del equipo sí entró, y la publicación dice por qué falló", () => {
    const res = avisoConversacion({
      conversado: false,
      motivo: "publicacion_fallo",
      mensaje: "sin permiso de escritura en el documento",
      leido: { resumen: { partes_de_campo: 3 } },
    });
    expect(res?.tono).toBe("atencion");
    expect(res?.texto).toContain("sí entró");
    expect(res?.texto).toContain("3 partes del equipo entraron");
    expect(res?.texto).toContain("sin permiso de escritura en el documento");
  });

  it("publicacion_fallo SIN nada leído no afirma que algo entró", () => {
    // Documento virgen cuya siembra falló: `leido` viene null y decir
    // «sí entró» sería mentir sobre la mitad que nunca corrió.
    const res = avisoConversacion({
      conversado: false,
      motivo: "publicacion_fallo",
      mensaje: "cuota de escritura agotada",
      leido: null,
    });
    expect(res?.tono).toBe("atencion");
    expect(res?.texto).not.toContain("entró");
    expect(res?.texto).toContain("cuota de escritura agotada");
  });

  it("un motivo desconocido viaja con su nombre", () => {
    const res = avisoConversacion({
      conversado: false,
      motivo: "cuota_excedida",
      mensaje: "HTTP 429",
    });
    expect(res?.tono).toBe("atencion");
    expect(res?.texto).toContain("cuota_excedida");
    expect(res?.texto).toContain("HTTP 429");
  });

  it("un motivo de lectura desconocido viaja con su nombre", () => {
    const res = avisoConversacion({
      conversado: true,
      motivo_lectura: "solo_cabeceras",
      leido: null,
      publicado: { hojas: [{ hoja: "Base de control", accion: "actualizada", filas: 10 }] },
    });
    expect(res?.tono).toBe("atencion");
    expect(res?.texto).toContain("solo_cabeceras");
  });

  it("si el Sheets no traía una hoja del equipo, se dice con la hoja por nombre", () => {
    // «Sin partes nuevas» a secas escondería la causa: la hoja no estaba.
    const res = avisoConversacion({
      conversado: true,
      leido: {
        resumen: { partes_de_campo: 0 },
        hojas_ausentes: ["Aulas Aplicadas (Campo)"],
      },
      publicado: { hojas: [{ hoja: "Base de control", accion: "actualizada", filas: 174 }] },
    });
    expect(res?.tono).toBe("atencion");
    expect(res?.texto).toContain("no traía Aulas Aplicadas (Campo)");
  });

  it("una conversación que no dice qué publicó no finge un verde", () => {
    const res = avisoConversacion({
      conversado: true,
      leido: { resumen: { partes_de_campo: 3 } },
      publicado: { hojas: [] },
    });
    expect(res?.tono).toBe("atencion");
    expect(res?.texto).toContain("no dijo qué pasó con cada hoja");
  });
});
