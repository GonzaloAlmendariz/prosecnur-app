// «Usa estos códigos internos y no se ve nada amigable» —Gonzalo.
//
// La tabla pone delante las columnas preferidas y RELLENA el resto con lo que
// traiga el payload, en su orden. En Agenda las preferidas son el ciclo de
// contacto —a quién llamo, por qué medio, cuándo, cuántas veces—, que está vacío
// hasta que el equipo sale a campo; al no tener dato desaparecen, y el hueco se
// llenaba con `sel_aulas_20260822204345_bf10d14c`, `slot_001` y la secuencia
// operativa. Cuanto menos trabajo de campo hay, más metadatos enseñaba la tabla.
//
// La lista vive sin exportar en el módulo; se lee del fuente para no abrir su
// superficie pública sólo por un test, igual que `COLUMNAS_DE_PORCENTAJE`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fuenteDelPageDeAulas } from "./fuenteDelPerfil";

const aqui = path.dirname(fileURLToPath(import.meta.url));
// Las dos listas (`const … = new Set([…])`) siguen declarándose en el
// page-file, pero las `preferredColumns` viajaron a `AulasSeccion*` al
// partirlo. Se lee el page MÁS sus trozos: es la misma superficie.
const fuente = fuenteDelPageDeAulas();

const listaDe = (nombre: string) => {
  const bloque = (fuente.match(new RegExp(`const ${nombre} = new Set\\(\\[([\\s\\S]*?)\\]\\)`)) ?? [])[1] ?? "";
  return [...bloque.matchAll(/"(\w+)"/g)].map((m) => m[1]);
};

const infraestructura = listaDe("COLUMNAS_DE_INFRAESTRUCTURA");

describe("las columnas de infraestructura no rellenan la tabla", () => {
  it("se encontró la lista", () => {
    expect(infraestructura.length).toBeGreaterThan(6);
  });

  it("están las que aparecían en la Agenda del estudio real", () => {
    // Vistas en pantalla con el proyecto abierto: la corrida entera, la ranura
    // del sorteo y la secuencia, en una tabla cuyo trabajo es agendar.
    for (const campo of ["selection_run_id", "selection_slot_id", "operational_sequence"]) {
      expect(infraestructura, `falta ${campo}`).toContain(campo);
    }
  });

  it("los códigos legibles NO se excluyen", () => {
    // «CH 1» y «R 1.2» dicen de qué cadena es la fila: son lo contrario de un
    // dato interno, y esconderlos habría sido pasarse de largo.
    for (const campo of ["operational_code", "titular_operational_code", "replacement_chain_code"]) {
      expect(infraestructura, `${campo} no debería excluirse`).not.toContain(campo);
    }
  });

  it("ninguna tabla del perfil pide una columna de infraestructura", () => {
    // Una preferida declarada gana sobre la exclusión —si una tabla necesita ver
    // la corrida, la enseña—, así que la lista sólo es efectiva si nadie las pide
    // de propio. Esto lo comprueba.
    const preferidas = [...fuente.matchAll(/preferredColumns=\{\[([\s\S]*?)\]\}/g)]
      .flatMap((m) => [...m[1].matchAll(/"(\w+)"/g)].map((x) => x[1]));
    expect(preferidas.length).toBeGreaterThan(10);
    const pedidas = preferidas.filter((c) => infraestructura.includes(c));
    expect(pedidas, `tablas que piden infraestructura: ${pedidas.join(", ")}`).toEqual([]);
  });
});

describe("el sexo dominante del aula no entra en las tablas del operativo", () => {
  // Gonzalo, 2026-08-31: «las columnas de sexo del plan nos sirven para ver las
  // cuotas por sexo de cada facultad; a nivel operativo no nos importa a qué
  // segmentos pertenezca el aula, eso sólo es a nivel de la selección del aula».
  it("las cuatro columnas del sorteo están excluidas", () => {
    for (const campo of ["sex_top_1", "sex_top_2", "sex_top_1_n", "sex_top_2_n"]) {
      expect(infraestructura, `falta ${campo}`).toContain(campo);
    }
  });

  it("y donde el sexo SÍ decide, se resuelve a mujeres y hombres", () => {
    // La decisión no es esconder el sexo: es no enseñar el DOMINANTE crudo.
    // Las dos superficies que lo usan para decidir traducen la «F» a su
    // conteo, y eso tiene que seguir así. Ya hay precedente de que la
    // construcción se malinterpreta: `sub_a` es el sexo más frecuente y se leyó
    // como «mujeres», lo que invirtió una tabla de cuotas entera.
    /* **La lectura se unificó en `composicionDelAula` el 2026-09-10.** Vivía
       escrita tres veces —el popover, la puntuación de ayuda y el chip nuevo— y
       este guard comprobaba la FORMA en cada archivo: el `toUpperCase()`, la
       comparación contra «M», las dos variables. Al mudarla a su módulo el
       guard se puso rojo sin que nada se hubiera roto: es la trampa del guard
       anclado a un símbolo que se renombra.

       Ahora exige lo que de verdad importa: que exista UN sitio que resuelva el
       dominante, y que quien decide con el sexo pase por él en vez de volver a
       leer `sex_top_*` por su cuenta. */
    const casa = fs.readFileSync(path.join(aqui, "composicionDelAula.ts"), "utf8");
    expect(casa, "la casa del reparto ya no lee sex_top_1").toContain("sex_top_1");
    expect(casa, "la casa dejó de normalizar la caja").toContain("toUpperCase()");
    expect(casa, "la casa ya no compara contra F ni M").toMatch(/===\s*"[FM]"/);
    expect(casa, "la casa ya no deriva mujeres y hombres").toMatch(/mujeres[\s\S]{0,300}hombres/);

    for (const archivo of ["AulasPopoverReemplazo.tsx", "candidatosDeReemplazo.ts"]) {
      const src = fs.readFileSync(path.join(aqui, archivo), "utf8");
      expect(src, `${archivo} decide con el sexo y no pasa por composicionDelAula`)
        .toContain("composicionDelAula");
      const codigo = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
      expect(codigo, `${archivo} volvió a leer sex_top_* por su cuenta`)
        .not.toMatch(/sex_top_[12]_n/);
    }
  });
});
