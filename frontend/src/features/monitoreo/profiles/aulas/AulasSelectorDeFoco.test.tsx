import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AulasSelectorDeFoco } from "./AulasSelectorDeFoco";
import type { FocoDeCuota } from "./AulasCuotasResumen";

/**
 * El selector que manda sobre toda la sección.
 *
 * Subió a la cabecera porque dentro de un panel se movía con el scroll y sólo
 * existía en la pestaña que lo montaba. Al hacerlo, los nombres de las nueve
 * listas dejaron de ser botones: este control es ahora el ÚNICO sitio desde el
 * que se pone el foco, así que lo que aquí falle no tiene otra puerta.
 *
 * Ofrecía una sola dimensión y se llamaba `AulasSelectorDeFacultad`. Con el eje
 * declarable ofrece **el eje más carrera y sexo** (decisión 11 del plan), y el
 * eje puede no ser la facultad.
 */

const FACULTADES = ["ARTE Y DISEÑO", "DERECHO", "PSICOLOGÍA"];
const NIVEL = { clave: "nivel", etiqueta: "Nivel", etiqueta_plural: "Niveles", etiqueta_sin: "Sin nivel" };

function pintar(foco: FocoDeCuota, onFoco: (f: FocoDeCuota) => void = () => {}) {
  return renderToStaticMarkup(
    <AulasSelectorDeFoco valores={{ eje: FACULTADES }} foco={foco} onFoco={onFoco} />,
  );
}

describe("AulasSelectorDeFoco: el eje", () => {
  it("ofrece «todas» y una opción por valor del eje", () => {
    const html = pintar(null);
    expect(html).toContain("Todos: Facultades");
    // Los nombres se pintan con la etiqueta del perfil, no crudos: es lo que
    // evita «ARTE Y DISEÑO» al lado de «CC. e Ingeniería» en la misma lista.
    expect(html).toContain("Arte y Diseño");
    expect(html).toContain("Derecho");
  });

  it("marca «Todas» sólo cuando no hay nada en foco", () => {
    expect(pintar(null)).toContain("is-activa");
    // Con uno elegido, «Todas» deja de estar activa: es el botón que lo suelta,
    // y marcarlo siempre haría creer que se está viendo todo.
    expect(pintar({ tipo: "facultad", valor: "DERECHO" })).not.toContain("is-activa");
  });

  it("sin valores no se pinta", () => {
    // Un selector vacío en la cabecera ocuparía el sitio privilegiado para no
    // ofrecer nada. El caso es real: un estudio recién abierto, sin plan.
    expect(renderToStaticMarkup(
      <AulasSelectorDeFoco valores={{ eje: [] }} foco={null} onFoco={() => {}} />,
    )).toBe("");
  });

  it("la opción en foco viene seleccionada, no sólo resaltada", () => {
    // Es lo que hace que la dirección de la URL y lo que se ve coincidan: al
    // llegar por enlace con `?foco=facultad:DERECHO`, el desplegable abre ya
    // en Derecho.
    expect(pintar({ tipo: "facultad", valor: "DERECHO" })).toMatch(/<select[^>]*>[\s\S]*selected/);
  });

  it("los rótulos salen del eje del estudio, no del código", () => {
    const html = renderToStaticMarkup(
      <AulasSelectorDeFoco valores={{ eje: ["6", "7"] }} foco={null} onFoco={() => {}} eje={NIVEL} />,
    );
    expect(html).toContain("Todos: Niveles");
    expect(html).toContain('aria-label="Nivel en foco"');
    // Y el valor se dice con su palabra: un «7» suelto en la lista se lee como
    // un conteo.
    expect(html).toContain("Nivel 7");
  });
});

describe("AulasSelectorDeFoco: las tres dimensiones", () => {
  const VALORES = { eje: ["6", "7"], carrera: ["ECONOMÍA", "SOCIOLOGÍA"], sexo: ["F", "M"] };

  it("el conmutador aparece SÓLO si hay más de una dimensión con valores", () => {
    // Un estudio sin composición publicada —o sin padrón, que es de donde salen
    // carrera y sexo— enseñaría dos botones muertos.
    const solaEje = renderToStaticMarkup(
      <AulasSelectorDeFoco valores={{ eje: ["6"] }} foco={null} onFoco={() => {}} eje={NIVEL} />,
    );
    expect(solaEje).not.toContain('aria-label="Dimensión en foco"');
    const tres = renderToStaticMarkup(
      <AulasSelectorDeFoco valores={VALORES} foco={null} onFoco={() => {}} eje={NIVEL} />,
    );
    expect(tres).toContain('aria-label="Dimensión en foco"');
    expect(tres).toContain("Carrera");
    expect(tres).toContain("Sexo");
  });

  it("la dimensión en juego la dice el FOCO, no un estado propio", () => {
    // El foco viaja en la URL; guardar aquí «qué dimensión miro» crearía un
    // segundo sitio donde vive lo mismo, y al volver por un enlace las dos
    // discreparían.
    const html = renderToStaticMarkup(
      <AulasSelectorDeFoco valores={VALORES} foco={{ tipo: "carrera", valor: "ECONOMÍA" }}
        onFoco={() => {}} eje={NIVEL} />,
    );
    expect(html).toContain('aria-label="Carrera en foco"');
    expect(html).toContain("Todas las carreras");
    // Y el sexo se pinta en palabras, reusando el traductor del perfil.
    const sexo = renderToStaticMarkup(
      <AulasSelectorDeFoco valores={VALORES} foco={{ tipo: "sexo", valor: "F" }}
        onFoco={() => {}} eje={NIVEL} />,
    );
    expect(sexo).toContain("Mujeres");
    // Y su «todas» está escrito, no derivado: añadirle una «s» al rótulo daba
    // «Todas las sexos», que es una frase mala en el sitio más visto.
    expect(sexo).toContain("Mujeres y hombres");
    expect(sexo).not.toContain("sexos");
  });

  it("un foco de AULA no secuestra el selector ni se borra", () => {
    // `aula` no es una dimensión de este control —abre una ficha, no acota—, así
    // que el selector se queda en el eje y no toca el foco.
    const html = renderToStaticMarkup(
      <AulasSelectorDeFoco valores={VALORES} foco={{ tipo: "aula", valor: "CH 31" }}
        onFoco={() => {}} eje={NIVEL} />,
    );
    expect(html).toContain('aria-label="Nivel en foco"');
    expect(html).toContain("is-activa");
  });
});
