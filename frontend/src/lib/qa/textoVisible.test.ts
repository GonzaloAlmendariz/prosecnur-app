import { describe, expect, it } from "vitest";
import { jergaVisibleEn, textoVisibleDe } from "./textoVisible";

/**
 * El extractor es la infraestructura de dos guardianes de vocabulario y no
 * tenía pruebas propias: se comprobaba sólo por sus efectos, así que cada vez
 * que se afinaba un filtro no había forma de saber si había ganado precisión o
 * perdido vista.
 *
 * Las dos mitades importan por igual. Un extractor que no ve deja pasar jerga
 * —«sin deployment» estuvo meses en pantalla con el guardián en verde— y uno
 * que grita de más se acaba ignorando, que es la otra manera de no servir.
 */

describe("textoVisibleDe · lo que SÍ tiene que ver", () => {
  it("el texto entre etiquetas", () => {
    expect(textoVisibleDe("<p>Ninguna de las aulas tiene acceso</p>"))
      .toContain("Ninguna de las aulas tiene acceso");
  });

  it("los atributos que son copy", () => {
    expect(textoVisibleDe('<Panel title="Qué aula usa qué acceso" />'))
      .toContain("Qué aula usa qué acceso");
  });

  it("los literales dentro de una expresión, que es donde vive el estado", () => {
    // El agujero que dejó «sin deployment» en pantalla: ni entre etiquetas ni
    // en un atributo.
    const fuente = '<dd>{listo ? etiqueta(x) : "sin preparar todavía"}</dd>';
    expect(textoVisibleDe(fuente)).toContain("sin preparar todavía");
  });

  it("los mensajes de error, que se leen en el peor momento", () => {
    expect(textoVisibleDe('setError("No se pudieron preparar los accesos.");'))
      .toContain("No se pudieron preparar los accesos.");
  });

  it("una frase con un código de reserva DENTRO de una expresión", () => {
    // El filtro de «acceso a propiedad» se escribió como `\w.\w` y se llevaba
    // por delante «R 1.2»: el guardián quedaba ciego justo en el vocabulario
    // del operativo, que es el que hay que vigilar.
    //
    // Tiene que ir por la vía de las EXPRESIONES —que es donde vive ese
    // filtro—, no entre etiquetas: en la primera versión de este test la frase
    // iba en un `<p>`, entraba por la vía JSX y pasaba aunque el filtro
    // estuviera mal. Un test que aprueba por el camino equivocado no fija nada.
    expect(textoVisibleDe('setError("La R 1.2 no se pudo activar");'))
      .toContain("La R 1.2 no se pudo activar");
  });
});

describe("textoVisibleDe · lo que NO puede confundir con copy", () => {
  it("los comentarios, donde los nombres del motor SÍ deben usarse", () => {
    const fuente = "// el deployment se prepara aquí\n<p>Accesos listos</p>";
    expect(textoVisibleDe(fuente).join(" ")).not.toContain("deployment");
  });

  it("un className con varias clases", () => {
    // Dos clases separadas por espacio pasaban el filtro de «dos palabras».
    expect(textoVisibleDe('<div className="mon-profile-panel mon-aulas-handoff-panel">'))
      .toEqual([]);
  });

  it("un acceso a propiedad", () => {
    expect(textoVisibleDe("const x = cond ? handoff.linked : otro.valor;").join(" "))
      .not.toContain("handoff.linked");
  });

  it("una firma genérica, que deja código entre `>` y `<`", () => {
    const fuente = "const [preview, setPreview] = useState<Foo | null>(null); const [otro] = useState<Bar>";
    expect(textoVisibleDe(fuente).join(" ")).not.toContain("setPreview");
  });

  it("una ruta de API", () => {
    expect(textoVisibleDe('await apiFetch("/api/recopiladores/reseed", init)').join(" "))
      .not.toContain("/api/");
  });
});

describe("jergaVisibleEn", () => {
  it("señala el término y la frase donde salió", () => {
    const hallazgos = jergaVisibleEn('<p>El deployment aún no está preparado</p>');
    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0]).toContain("«deployment»");
    expect(hallazgos[0]).toContain("El deployment aún no está preparado");
  });

  it("señala los dos términos cuando una frase lleva dos", () => {
    const hallazgos = jergaVisibleEn('<p>No se pudo iniciar el render del payload</p>');
    expect(hallazgos).toHaveLength(2);
  });

  it("no dice nada de una frase limpia", () => {
    expect(jergaVisibleEn('<p>No se pudieron preparar los accesos</p>')).toEqual([]);
  });

  it("no confunde una palabra dentro de otra que sí es castellano", () => {
    // «target» no puede saltar dentro de una frase que no lo usa como término.
    expect(jergaVisibleEn('<p>Las aulas de esta facultad ya están asignadas</p>')).toEqual([]);
  });
});
