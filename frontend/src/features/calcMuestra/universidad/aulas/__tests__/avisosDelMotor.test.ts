/**
 * V2 del goal loop de Selección: el motor no habla en la UI.
 *
 * El caso que abrió esta línea es el primero: llegaba literal a la pantalla,
 * sin tildes y con `pi_design` adentro.
 */
import { describe, expect, it } from "vitest";

import { avisoEsTecnico, traducirAvisoDelMotor } from "../avisosDelMotor";

const CRUDO_PI = [
  "Comparacion de metodos con descuento secuencial aplicado al sorteo:",
  "las pi de esta tarjeta son referenciales del diseno estatico",
  "(pi_design); la pi del proceso secuencial solo se estima por Monte",
  "Carlo en la seleccion final, no en la comparacion.",
].join(" ");

describe("avisos del motor · no se leen crudos", () => {
  it("el aviso de las pi referenciales se traduce y guarda su crudo", () => {
    const aviso = traducirAvisoDelMotor(CRUDO_PI);
    expect(aviso.titulo).toBe("Las probabilidades de esta tarjeta son del diseño, no del sorteo");
    expect(aviso.mostrarCrudo).toBe(true);
    // Lo que se lee primero no trae identificadores ni palabras sin tilde.
    expect(aviso.resumen).not.toMatch(/pi_design|comparacion|seleccion|diseno/);
    expect(aviso.resumen).toContain("descuento de repetidos");
  });

  it("dos avisos distintos del motor dejan de llamarse igual", () => {
    // R mandaba los dos bajo «Fallback metodológico»; dos cosas distintas con
    // el mismo nombre se leen como una repetida (V3).
    const a = traducirAvisoDelMotor(CRUDO_PI);
    const b = traducirAvisoDelMotor("sampling::samplecube() no disponible o fallo; se uso sistematico_pps.");
    expect(a.titulo).not.toBe(b.titulo);
    expect(a.titulo).toBeTruthy();
    expect(b.titulo).toBeTruthy();
  });

  it("detecta la jerga por identificador Y por falta de tildes", () => {
    expect(avisoEsTecnico("sampling::UPsystematic falló")).toBe(true);
    expect(avisoEsTecnico("el eligible_n del estrato quedó en 0")).toBe(true);
    // Sin `::` ni identificadores: la única señal es el castellano sin tilde,
    // que es lo que dejaba pasar la detección anterior.
    expect(avisoEsTecnico("La comparacion de metodos no cerro")).toBe(true);
  });

  it("un aviso ya escrito para el usuario pasa intacto y sin disclosure", () => {
    const humano = "7 celda(s) tienen menos reservas que titulares.";
    const aviso = traducirAvisoDelMotor(humano);
    expect(aviso.resumen).toBe(humano);
    expect(aviso.mostrarCrudo).toBe(false);
    expect(aviso.titulo).toBeNull();
  });

  it("un aviso técnico desconocido se resume sin prometer de más", () => {
    const aviso = traducirAvisoDelMotor("el stratum quedó sin discount_step publicado");
    expect(aviso.mostrarCrudo).toBe(true);
    expect(aviso.titulo).toBeNull();
    expect(aviso.resumen).not.toMatch(/stratum|discount_step/);
  });

  it("un detalle vacío no inventa contenido", () => {
    expect(traducirAvisoDelMotor("").mostrarCrudo).toBe(false);
    expect(traducirAvisoDelMotor("   ").resumen).toContain("auditoría técnica");
  });
});
