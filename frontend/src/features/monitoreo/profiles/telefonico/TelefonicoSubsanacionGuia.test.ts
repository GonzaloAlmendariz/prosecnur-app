import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * El perfil Telefónico es un fork deliberado del de Acreditación (no se
 * fusionan en un core parametrizado), así que las mejoras se aplican dos veces.
 * Este contrato comprueba que la segunda copia quedó realmente cableada: no hay
 * proyecto de referencia con `family === "telefonico"` con el que abrir esta
 * vista en la app, y sin él un cambio a medias pasaría inadvertido.
 */
const page = readFileSync(
  resolve(__dirname, "TelefonicoMonitoreoPage.tsx"),
  "utf8",
);

describe("Telefónico: la bandeja de subsanación sigue el patrón de Acreditación", () => {
  it("no conserva la ruta decorativa de tres pasos", () => {
    // Era un <div> con Prioriza/Comprueba/Decide que no filtraba nada y competía
    // con los pasos de la ficha del caso.
    expect(page).not.toContain("function AcreditacionSubsanacionWorkflow");
    expect(page).not.toContain("mon-acr-subsanacion-workflow");
  });

  it("usa la ruta navegable compartida", () => {
    expect(page).toContain('from "../../components/RutaDeSubsanacion"');
    expect(page).toMatch(/<RutaDeSubsanacion\s+paso=\{paso\}\s+conteo=\{conteo\}\s+onPaso=\{setPaso\}\s*\/>/);
  });

  it("agrupa por recuperabilidad en vez de por accionable/explicativo", () => {
    expect(page).toContain("useBandejaDeSubsanacion(cases)");
    expect(page).toContain("{grupos.map((group) => (");
    expect(page).not.toContain('{ title: "Accionables", rows: actionable }');
  });

  it("la lista se recorta sobre los casos visibles del paso activo, no sobre todos", () => {
    // Si el conteo del encabezado siguiera leyendo `cases`, al filtrar por un
    // paso la cabecera anunciaría más casos de los que muestra.
    expect(page).toContain("<em>{fmt(visibles.length)} casos</em>");
  });

  it("cada fila declara su motivo concreto, no la regla que agrupa a todas", () => {
    expect(page).toContain('<span className="mon-acr-motivo">{motivo.etiqueta}</span>');
    expect(page).not.toContain("function caseSubsanacionActionDetail");
  });

  it("la segunda línea de la fila distingue casos que comparten motivo", () => {
    expect(page).toMatch(
      /formatInternalQueryDateLabel\(item\.date\)\}\s*·\s*\{internalQueryCollectorDisplayLabel\(item\)\}/,
    );
  });
});

describe("Telefónico: la tabla de cruces declara su balance", () => {
  it("la lectura de la cabecera cuenta cuántos cruzaron, salvo en modo teléfono", () => {
    // En modo teléfono hay un resumen propio de alineación barrido↔Kobo que no
    // se sustituye; el balance aplica al otro modo, donde no había ninguno.
    expect(page).toContain("lecturaDeCruceDeCasos(cases)");
    expect(page).toContain("Kobo manda el avance");
  });

  it("agrupa las filas y respeta el número de columnas de cada modo", () => {
    expect(page).toContain("filasDeCruceDeCasos(cases, 45)");
    expect(page).toContain("colSpan={isPhoneMode ? 4 : 5}");
  });

  it("el flex del encabezado de grupo va dentro del th, no en la celda", () => {
    // `display:flex` sobre un `th` lo saca del modelo de tabla y anula el
    // colSpan: la celda se queda en su ancho intrínseco y aplasta el texto.
    const bloque = page.match(/mon-acr-crossing-group is-\$\{fila\.clave\}[\s\S]{0,420}/)?.[0] ?? "";
    expect(bloque).toMatch(/<th\s+scope="rowgroup"\s+colSpan=\{[^}]+\}>\s*<span>/);
  });
});

describe("Telefónico: el rail de Fuentes nombra el objeto del estudio, no el servicio", () => {
  it("no rotula pestañas con el nombre del proveedor", () => {
    // Hallazgo A1: Fuentes estaba organizado por servicio ("Kobo",
    // "Plataforma", "Bases en Sheets") en vez de por lo que responde cada
    // pestaña. El proveedor sigue visible dentro de la tarjeta, no en el rail.
    //
    // La comprobación se acota al bloque del rail: "Kobo" es legítimo en el
    // catálogo de canales y en la métrica de efectivas, donde nombra un dato
    // real del estudio y no una pestaña.
    // Hay más de un `if (view === "fuentes")` en el archivo; el del rail es el
    // que construye pestañas con `railTab`.
    const railDeFuentes = Array.from(
      page.matchAll(/if \(view === "fuentes"\) \{[\s\S]*?\n  \}/g),
      (match) => match[0],
    ).find((bloque) => bloque.includes("railTab(survey")) ?? "";
    expect(railDeFuentes).not.toBe("");
    expect(railDeFuentes).not.toContain('label: "Kobo"');
    expect(railDeFuentes).not.toContain('label: "Plataforma"');
    expect(railDeFuentes).toContain('label: "Encuestas"');
    expect(railDeFuentes).toContain('label: "Universo"');
    expect(railDeFuentes).toContain('label: "Universo y barrido"');
  });

  it("toma las pestañas por clave y no por posición", () => {
    // Insertar una pestaña corría todas las etiquetas una casilla, en silencio.
    const catalogo = readFileSync(resolve(__dirname, "pestanasDeFuentes.ts"), "utf8");
    expect(page).not.toMatch(/const \[survey, sheets, ?,? ?\w*\] = ACREDITACION_SOURCE_TABS/);
    expect(page).toContain("pestanasDeFuentesPorClave()");
    expect(catalogo).toContain("Pestaña de fuentes desconocida");
  });
});

describe("Telefónico: el contrato de fuentes prioriza enlaces sobre identificadores", () => {
  const acreditacion = readFileSync(
    resolve(__dirname, "..", "acreditacion", "AcreditacionMonitoreoPage.tsx"),
    "utf8",
  );

  // El modelo telefónico de Fuentes se renderiza en los dos perfiles: en el
  // fork y también dentro de Acreditación cuando el estudio es telefónico. Las
  // dos copias tienen que decir lo mismo o el rediseño valdría a medias.
  const copias = [
    ["telefonico", page],
    ["acreditacion", acreditacion],
  ] as const;

  it.each(copias)("%s no muestra el identificador técnico recortado como dato principal", (_perfil, fuente) => {
    // Era `shortenMiddle(sourceExternalId(primary), 38)`: 38 caracteres de
    // asset_uid que no dicen nada y no llevan a ninguna parte.
    const tarjeta = fuente.match(/<div className="mon-phone-source-slot-data">[\s\S]*?<\/div>/)?.[0] ?? "";
    expect(tarjeta).not.toBe("");
    expect(tarjeta).not.toContain("shortenMiddle(sourceExternalId(primary), 38)");
    expect(tarjeta).toContain("enlacePrimario?.estado === \"enlace\"");
    expect(tarjeta).toContain("nombreDeFuente(primary)");
  });

  it.each(copias)("%s nombra el objeto del estudio y no el servicio en los rótulos", (_perfil, fuente) => {
    const tarjeta = fuente.match(/<div className="mon-phone-source-slot-data">[\s\S]*?<\/div>/)?.[0] ?? "";
    expect(tarjeta).not.toContain('"Spreadsheet"');
    expect(tarjeta).not.toContain('"Encuesta / asset"');
    // R2 sigue verificado, pero por el enlace y no por su rótulo: la tarjeta
    // dejó de tener un campo «Abrir» aparte —decía el nombre de la hoja tres
    // veces— y ahora el enlace ES el nombre.
    expect(tarjeta).toContain("<a");
    expect(tarjeta).toContain("nombreDeFuente(primary)");
    // Y el rango de la hoja (`Barrido!A1:Y2297`) baja al `title`: es metadato,
    // no un dato que el usuario venga a leer.
    expect(tarjeta).toMatch(/title=\{\[enlacePrimario\.titulo/);
  });

  it.each(copias)("%s no rotula la pestaña con el proveedor ni explica con \"Aquí se…\"", (_perfil, fuente) => {
    expect(fuente).not.toContain('eyebrow: "Kobo"');
    expect(fuente).not.toContain('eyebrow: "Bases en Sheets"');
    expect(fuente).not.toContain('detail: "Aquí se');
  });

  it("el nombre por pregunta vive en el catálogo de pestañas, no en el panel", () => {
    // El panel llevaba un antetítulo que repetía el nombre de la pestaña activa
    // —el chrome ya lo dice justo encima—, así que «Universo y barrido» se leía
    // tres veces en la misma pantalla. El nombre por pregunta se conserva; lo
    // que se retira es la tercera copia.
    const catalogo = readFileSync(resolve(__dirname, "pestanasDeFuentes.ts"), "utf8");
    expect(catalogo).toContain('label: "Encuestas"');
    expect(catalogo).toContain('label: "Universo y barrido"');
    expect(page).not.toContain('eyebrow: "Universo y barrido"');
  });

  it.each(copias)("%s dice qué falta sin nombrar el producto", (_perfil, fuente) => {
    expect(fuente).not.toContain('"Falta Kobo"');
    expect(fuente).toContain('"Falta la encuesta"');
  });
});

describe("el texto recortado de la bandeja conserva su contenido", () => {
  const acreditacion = readFileSync(
    resolve(__dirname, "..", "acreditacion", "AcreditacionMonitoreoPage.tsx"),
    "utf8",
  );

  it.each([["telefonico", page], ["acreditacion", acreditacion]])(
    "%s da `title` a la línea que se recorta",
    (_perfil, fuente) => {
      // Con nombres de recopilador largos se recortan las 45 filas. El recorte
      // es aceptable —la ficha tiene el detalle—, pero sin `title` el dato se
      // perdía del todo y no había forma de leerlo.
      expect(fuente).toMatch(
        /<small title=\{`\$\{item\.actor \|\| "Sin actor"\} · \$\{formatInternalQueryDateLabel\(item\.date\)\}/,
      );
    },
  );
});

