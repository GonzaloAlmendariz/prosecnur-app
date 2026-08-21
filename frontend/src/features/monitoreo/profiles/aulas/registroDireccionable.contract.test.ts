import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const aulasDir = path.dirname(fileURLToPath(import.meta.url));
const registro = fs.readFileSync(path.join(aulasDir, "RegistroDeCampo.tsx"), "utf8");
const pagina = fs.readFileSync(path.join(aulasDir, "AulasMonitoreoPage.tsx"), "utf8");

describe("el registro de campo se abre por dirección", () => {
  test("la página le pasa el aula en foco y le devuelve la elegida", () => {
    // El registro es donde vive la ÚNICA acción que activa un reemplazo. Sin
    // esto había que buscar el aula entre 196 filas, y quien la veía caer en la
    // ruta del día no tenía cómo llegar hasta aquí.
    expect(pagina).toMatch(/codigoEnFoco=\{foco\?\.tipo === "aula" \? foco\.valor : ""\}/);
    expect(pagina).toMatch(/onElegir=\{\(codigo\) => cambiarFoco\(\{ tipo: "aula", valor: codigo \}\)\}/);
  });

  test("la selección no vive sólo en un useState suelto", () => {
    // Regla de la casa: una superficie direccionable se conecta a la dirección,
    // no a un estado local que la URL no puede alcanzar.
    expect(registro).toMatch(/codigoEnFoco/);
    expect(registro).toMatch(/useEffect\(/);
  });

  test("el código de la URL se compara sin distinguir mayúsculas ni espacios", () => {
    // Viaja por la URL y vuelve con el formato que le dé el navegador
    // (`aula:CH+52`), así que una comparación exacta fallaría de forma
    // intermitente.
    const efecto = registro.slice(registro.indexOf("useEffect("), registro.indexOf("useEffect(") + 900);
    expect(efecto).toMatch(/toLowerCase\(\)/);
    expect(efecto).toMatch(/replace\(/);
  });
});
