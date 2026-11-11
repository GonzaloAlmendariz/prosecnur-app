import { describe, expect, test } from "vitest";
import { cleanCodificacionLabel, displayCodificacionValueLabel, displayRespuestaLabel } from "./codificacionLabels";

describe("codificacion labels", () => {
  test("uses one language for yes/no option labels", () => {
    expect(displayCodificacionValueLabel("Si", "Yes")).toMatchObject({ label: "Sí" });
    expect(displayCodificacionValueLabel("No", "No")).toMatchObject({ label: "No" });
  });

  test("keeps technical codes separate from cleaned human labels", () => {
    expect(displayCodificacionValueLabel("NoTell", "Prefiere no responder Prefers not to answer")).toMatchObject({
      code: "NoTell",
      label: "Prefiere no responder",
    });
  });

  test("removes the second-language tail in bilingual choice labels", () => {
    expect(cleanCodificacionLabel("Buenas referencias de familiares / conocidos Good references from family")).toBe(
      "Buenas referencias de familiares / conocidos",
    );
  });
});

describe("el texto de una respuesta abierta se muestra entero", () => {
  const larga = "Que expliquen bien los requisitos antes de mandar a la gente a hacer la cola";

  test("una respuesta en castellano con la preposición \"a\" no se corta", () => {
    expect(displayRespuestaLabel(larga).label).toBe(larga);
    expect(displayRespuestaLabel("En las calles o buses cuando suben migrantes a pedir una colaboración.").label).toBe(
      "En las calles o buses cuando suben migrantes a pedir una colaboración.",
    );
  });

  test("tampoco se corta con palabras que en inglés abren una etiqueta", () => {
    for (const texto of [
      "Fueron an another place y no volvieron",
      "Me dijeron que the staff no atiende",
      "No tengo how saber eso todavía",
      "Atención Only para adultos mayores",
    ]) {
      expect(displayRespuestaLabel(texto).label).toBe(texto);
    }
  });

  test("solo normaliza los espacios y conserva el texto en el título", () => {
    expect(displayRespuestaLabel("  mucha   cola  ")).toEqual({ label: "mucha cola", title: "  mucha   cola  " });
  });

  test("un \"si\" o un \"no\" sueltos se siguen escribiendo \"Sí\" y \"No\"", () => {
    expect(displayRespuestaLabel("si").label).toBe("Sí");
    expect(displayRespuestaLabel(" NO ").label).toBe("No");
    // Solo cuando son la respuesta entera: dentro de una frase no se tocan.
    expect(displayRespuestaLabel("si me atendieron pero no a tiempo").label).toBe("si me atendieron pero no a tiempo");
  });

  test("una respuesta que es el código de una opción sigue mostrando la etiqueta de la opción", () => {
    expect(displayRespuestaLabel("NoTell", "Prefiere no responder Prefers not to answer")).toMatchObject({
      code: "NoTell",
      label: "Prefiere no responder",
    });
  });
});

describe("la cola en inglés de una etiqueta de opción", () => {
  test("no confunde la preposición castellana \"a\" con el artículo inglés", () => {
    expect(cleanCodificacionLabel("Atención a migrantes")).toBe("Atención a migrantes");
    expect(cleanCodificacionLabel("Derivación a otra institución")).toBe("Derivación a otra institución");
    expect(displayCodificacionValueLabel("7", "Apoyo a familiares").title).toBe("7. Apoyo a familiares");
    expect(cleanCodificacionLabel("Apoyo a familiares")).toBe("Apoyo a familiares");
  });

  test("sigue quitando la cola cuando empieza en mayúscula", () => {
    expect(cleanCodificacionLabel("Un familiar o amigo A relative or friend")).toBe("Un familiar o amigo");
    expect(cleanCodificacionLabel("Ninguna de las anteriores None of the above")).toBe("Ninguna de las anteriores");
  });
});
