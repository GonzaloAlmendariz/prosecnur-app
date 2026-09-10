import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasSenalesPorAula } from "./AulasSenalesPorAula";

describe("el relevo, que es la salida de la tabla", () => {
  // La tabla decía quién rindió por debajo y ahí se paraba. Medido el
  // 2026-09-10: 13 de los 14 por debajo tenían una reserva de cadena viva, o
  // sea una decisión que tomar hoy.
  const bloqueConSenal = {
    criterio: "banda", aulas: [
      { codigo: "CH 82", facultad: "DERECHO", senal: "bajo",
        tasa_prevista: 0.558, tasa_observada: 0.0, tasa_facultad: 0.568,
        efectivas: 0, elegibles: 45, numerador: "plataforma", banda: 0.15 },
      { codigo: "CH 7", facultad: "CIENCIAS E INGENIERIA", senal: "sobre",
        tasa_prevista: 0.519, tasa_observada: 0.9, tasa_facultad: 0.53,
        efectivas: 27, elegibles: 30, numerador: "plataforma", banda: 0.18 },
    ],
  } as unknown as Parameters<typeof AulasSenalesPorAula>[0]["bloque"];

  it("una fila por debajo con relevo dice CUÁL activar", () => {
    const html = renderToStaticMarkup(
      <AulasSenalesPorAula bloque={bloqueConSenal}
        relevos={{ "CH 82": { disponibles: 9, siguiente: "R 82.1" } }} />,
    );
    expect(html).toContain("relevo listo: R 82.1");
  });

  it("una fila por debajo SIN relevo lo dice: es lo que hay", () => {
    // La ausencia de la clave significa «no tiene», nunca «no se calculó», y
    // por eso se puede afirmar en pantalla.
    const html = renderToStaticMarkup(
      <AulasSenalesPorAula bloque={bloqueConSenal} relevos={{}} />,
    );
    expect(html).toContain("sin relevo");
  });

  it("una fila por ENCIMA de su margen no menciona el relevo", () => {
    // «Tiene 9 reservas» sobre un curso-horario que rindió de más es ruido:
    // nadie va a activar ese relevo.
    const html = renderToStaticMarkup(
      <AulasSenalesPorAula bloque={bloqueConSenal}
        relevos={{ "CH 7": { disponibles: 9, siguiente: "R 7.1" } }} />,
    );
    expect(html).not.toContain("R 7.1");
  });

  it("sin el BLOQUE no se afirma nada: ni «relevo listo» ni «sin relevo»", () => {
    // El aserto anterior sólo miraba «relevo listo» y por eso no vio que la
    // pantalla decía «sin relevo» en las nueve filas señaladas teniendo 13 de
    // 14 un relevo vivo. Un tablero construido antes de que el motor emitiera
    // el bloque no SABE, y no saber no es lo mismo que no tener.
    const html = renderToStaticMarkup(<AulasSenalesPorAula bloque={bloqueConSenal} />);
    expect(html).toContain("CH 82");
    expect(html).not.toContain("relevo listo");
    expect(html).not.toContain("sin relevo");
  });
});
