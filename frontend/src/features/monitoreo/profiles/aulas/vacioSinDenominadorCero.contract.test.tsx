import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasAgendaPorDia } from "./AulasAgendaPorDia";
import { AulasAlcanceDelBanco } from "./AulasAlcanceDelBanco";
import { AulasAlertaDeAnticipacion } from "./AulasAlertaDeAnticipacion";
import { AulasAvanceEnRespuestas } from "./AulasAvanceEnRespuestas";
import { AulasCadenaChart } from "./AulasCadenaChart";
import { AulasCoberturaChart } from "./AulasCoberturaChart";
import { AulasColaDeContacto } from "./AulasColaDeContacto";
import { AulasColchonPorFacultad } from "./AulasColchonPorFacultad";
import { AulasConsumoDelBanco } from "./AulasConsumoDelBanco";
import { AulasLoQueFalta } from "./AulasLoQueFalta";
import { AulasParteContraPlataforma } from "./AulasParteContraPlataforma";
import { AulasPronosticoDeCierre } from "./AulasPronosticoDeCierre";
import { AulasSerieDeRendimiento } from "./AulasSerieDeRendimiento";
import { AulasTrabajoDeLosEquipos } from "./AulasTrabajoDeLosEquipos";
import { AulasFrenteDelOperativo } from "./AulasFrenteDelOperativo";
import { AulasHistoriaCadena } from "./AulasHistoriaCadena";
import { AulasMedioDeContacto } from "./AulasMedioDeContacto";
import { AulasObservacionesDeCampo } from "./AulasObservacionesDeCampo";
import { AulasPerfilPorFacultad } from "./AulasPerfilPorFacultad";
import { AulasRitmoPorFacultad } from "./AulasRitmoPorFacultad";

/**
 * «Ninguno de los 0 partes trae observaciones» describe una ausencia como si
 * fuera un hallazgo sobre datos que existen.
 *
 * Son DOS estados con distinta acción, y el aviso los dice igual:
 *
 * - hay 152 partes y ninguno anotó nada → el campo no está escribiendo lo que
 *   ve, y eso es un aviso sobre el libro;
 * - no hay ni un parte → todavía no hay campo, y no hay nada que avisar.
 *
 * Es la misma familia que `c4af437d` («un 0 de 0 no es 0 %, es una cuenta que no
 * se puede hacer»), en su variante de prosa: el numerador ya excluye lo que el
 * denominador incluye, salvo que aquí el denominador es cero y la frase igual
 * afirma haber mirado.
 *
 * Guard, no reparación puntual: el patrón `Ninguno de los ${n}` está en diez
 * superficies del perfil y `AulasMedioDeContacto` era la única que distinguía
 * las dos causas. Un vacío nuevo que copie la frase cae aquí.
 */

const VACIO = { filas: [], partes: [], resumen: [] } as const;

const SUPERFICIES: ReadonlyArray<{ nombre: string; render: () => string }> = [
  { nombre: "AulasObservacionesDeCampo", render: () => renderToStaticMarkup(<AulasObservacionesDeCampo partes={VACIO.partes} />) },
  { nombre: "AulasRitmoPorFacultad", render: () => renderToStaticMarkup(<AulasRitmoPorFacultad partes={VACIO.partes} />) },
  { nombre: "AulasMedioDeContacto", render: () => renderToStaticMarkup(<AulasMedioDeContacto filas={VACIO.filas} />) },
  { nombre: "AulasAgendaPorDia", render: () => renderToStaticMarkup(<AulasAgendaPorDia filas={VACIO.filas} />) },
  { nombre: "AulasAvanceEnRespuestas", render: () => renderToStaticMarkup(<AulasAvanceEnRespuestas filas={VACIO.filas} />) },
  { nombre: "AulasHistoriaCadena", render: () => renderToStaticMarkup(<AulasHistoriaCadena filas={VACIO.filas} />) },
  { nombre: "AulasFrenteDelOperativo", render: () => renderToStaticMarkup(<AulasFrenteDelOperativo filas={VACIO.filas} partes={VACIO.partes} corte="2026-08-21" />) },
  { nombre: "AulasCadenaChart", render: () => renderToStaticMarkup(<AulasCadenaChart filas={VACIO.filas} />) },
  { nombre: "AulasCoberturaChart", render: () => renderToStaticMarkup(<AulasCoberturaChart filas={VACIO.filas} />) },
  { nombre: "AulasPerfilPorFacultad", render: () => renderToStaticMarkup(<AulasPerfilPorFacultad filas={VACIO.filas} />) },
  // Segunda tanda: el guard existia y estas superficies no estaban dentro, asi
  // que `AulasPronosticoDeCierre` decia «0 de 0 aulas del plan tienen parte de
  // campo» con el patron ya escrito para cazarlo. Una capacidad existe solo si
  // alguien la consume — tambien cuando la capacidad es un test.
  { nombre: "AulasAlcanceDelBanco", render: () => renderToStaticMarkup(<AulasAlcanceDelBanco banco={null} control={VACIO.filas} quotas={VACIO.filas} agenda={VACIO.filas} partes={VACIO.partes} />) },
  { nombre: "AulasAlertaDeAnticipacion", render: () => renderToStaticMarkup(<AulasAlertaDeAnticipacion partes={VACIO.partes} />) },
  { nombre: "AulasColaDeContacto", render: () => renderToStaticMarkup(<AulasColaDeContacto filas={VACIO.filas} />) },
  { nombre: "AulasColchonPorFacultad", render: () => renderToStaticMarkup(<AulasColchonPorFacultad filas={VACIO.filas} />) },
  { nombre: "AulasConsumoDelBanco", render: () => renderToStaticMarkup(<AulasConsumoDelBanco filas={VACIO.filas} />) },
  { nombre: "AulasLoQueFalta", render: () => renderToStaticMarkup(<AulasLoQueFalta filas={VACIO.filas} />) },
  { nombre: "AulasParteContraPlataforma", render: () => renderToStaticMarkup(<AulasParteContraPlataforma partes={VACIO.partes} agenda={VACIO.filas} />) },
  { nombre: "AulasPronosticoDeCierre", render: () => renderToStaticMarkup(<AulasPronosticoDeCierre partes={VACIO.partes} plan={VACIO.filas} />) },
  { nombre: "AulasSerieDeRendimiento", render: () => renderToStaticMarkup(<AulasSerieDeRendimiento partes={VACIO.partes} />) },
  { nombre: "AulasTrabajoDeLosEquipos", render: () => renderToStaticMarkup(<AulasTrabajoDeLosEquipos partes={VACIO.partes} />) },
];

/**
 * Se busca el DENOMINADOR en cero dentro de una frase que afirma haber contado:
 * «de los 0 partes», «de las 0 aulas», «de 0 cursos-horario». Un «0» suelto en
 * un contador (`0 con parte en el libro`) es legítimo —ahí no se afirma nada
 * sobre un conjunto vacío— y por eso el patrón exige la preposición delante.
 */
const DENOMINADOR_CERO = /\bde (los |las )?0\b/;

describe("un aviso de vacío no cuenta sobre un denominador de cero", () => {
  for (const { nombre, render } of SUPERFICIES) {
    it(`${nombre} no afirma haber contado cuando no hay nada`, () => {
      // **Los espacios se colapsan.** Sin esto el guard estaba medio ciego:
      // quitar las etiquetas de `<strong>0</strong> de <strong>0</strong>` deja
      // «0  de  0» con espacio doble, y el patron exige uno solo — asi que
      // cazaba el texto plano y NO los numeros en `<strong>`, que es el estilo
      // de la casa. Medido con un mutante que reintrodujo «0 de 0 aulas del
      // plan» en `AulasPronosticoDeCierre` y sobrevivio a los 20 asertos.
      const texto = render().replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
      expect(texto, `${nombre} dice: ${texto.trim().slice(0, 160)}`).not.toMatch(DENOMINADOR_CERO);
    });
  }
});
