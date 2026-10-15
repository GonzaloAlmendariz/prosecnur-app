import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { BuilderNode } from "../types";
import { PaperSettingsBlock } from "../canvas/PaperSettingsBlock";
import { InspectorField } from "./InspectorPrimitives";
import { MarkdownField } from "./MarkdownField";
import { MoreTab } from "./MoreTab";
import { NameField } from "./NameField";

// Este repo no trae Testing Library ni un DOM de pruebas: se renderiza con
// `renderToStaticMarkup` y se resuelve el rótulo como lo hace `getByLabelText`
// (`<label for>` → elemento con ese id; si no, `aria-labelledby`). Lo que se
// afirma es la asociación en el markup, que es lo que lee el lector de
// pantalla: el rótulo visible nombra al control sin `aria-label` de parche.

const noop = () => undefined;

function node(overrides: Partial<BuilderNode> = {}): BuilderNode {
  return {
    rowIndex: 7,
    depth: 0,
    kind: "question",
    label: "¿Cuántos años tienes?",
    name: "p1_edad",
    sectionId: "root",
    typeInfo: { raw: "integer", base: "integer", listName: "" },
    required: false,
    relevant: "",
    constraint: "",
    calculation: "",
    choiceFilter: "",
    hint: "",
    appearance: "",
    ...overrides,
  };
}

function texto(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function escapar(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function atributo(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

/** Equivalente estático de `getByLabelText`: un único control por rótulo. */
function controlPorRotulo(html: string, rotulo: RegExp): string {
  const porFor = [...html.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/g)]
    .filter((m) => rotulo.test(texto(m[2])))
    .map((m) => atributo(m[1], "for"))
    .filter((id): id is string => Boolean(id))
    .map((id) => new RegExp(`<(?:input|textarea|select)\\b[^>]*\\sid="${escapar(id)}"[^>]*>`).exec(html)?.[0])
    .filter((tag): tag is string => Boolean(tag));
  const porLabelledBy = [...html.matchAll(/<[a-z]+\b[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/(?:span|label)>/g)]
    .filter((m) => rotulo.test(texto(m[2])))
    .flatMap((m) =>
      [...html.matchAll(new RegExp(`<[a-z]+\\b[^>]*\\saria-labelledby="${escapar(m[1])}"[^>]*>`, "g"))]
        .map((c) => c[0])
        .filter((tag) => !/role="group"/.test(tag)),
    );
  const hallados = [...new Set([...porFor, ...porLabelledBy])];
  expect(hallados, `controles para ${rotulo}`).toHaveLength(1);
  return hallados[0];
}

function ayudaDe(html: string, control: string): string {
  const ids = atributo(control, "aria-describedby");
  expect(ids, "aria-describedby").toBeTruthy();
  const hint = new RegExp(`<span[^>]*\\sid="${escapar(ids ?? "")}"[^>]*>([\\s\\S]*?)</span>`).exec(html);
  return texto(hint?.[1] ?? "");
}

describe("InspectorField asocia su rótulo al control", () => {
  test("Ajustes de papel: cada input se nombra por su rótulo, sin aria-label de parche", () => {
    const html = renderToStaticMarkup(
      <PaperSettingsBlock node={node({ paperSubgroup: "D.4. Apoyo" })} onFieldChange={noop} />,
    );

    const subgrupo = controlPorRotulo(html, /^Subsección impresa/);
    expect(subgrupo).toContain('value="D.4. Apoyo"');
    expect(ayudaDe(html, subgrupo)).toMatch(/^Banda de segundo nivel/);

    for (const rotulo of [
      /^Número visible/,
      /^Texto alternativo/,
      /^Salto impreso manual/,
      /^Agrupación impresa/,
      /^Letra impresa/,
      /^Layout impreso/,
    ]) {
      expect(controlPorRotulo(html, rotulo)).toMatch(/^<input/);
    }
    expect(html).not.toContain("aria-label=");
  });

  test("pestaña Más: paper_subgroup y parámetros también quedan asociados", () => {
    const html = renderToStaticMarkup(<MoreTab node={node()} onFieldChange={noop} />);
    expect(controlPorRotulo(html, /^Subsección en papel/)).toMatch(/^<input/);
    expect(controlPorRotulo(html, /^Parámetros técnicos/)).toMatch(/^<input/);
  });

  test("un editable con formato toma el rótulo por aria-labelledby y no por su placeholder", () => {
    const html = renderToStaticMarkup(
      <InspectorField label="Texto principal" hint="La pregunta que verá el encuestado.">
        {(campo) => (
          <MarkdownField
            id={campo.id}
            ariaLabelledBy={campo.labelId}
            ariaDescribedBy={campo.hintId}
            value=""
            onChange={noop}
            placeholder="Ej. ¿Cuál es tu edad?"
          />
        )}
      </InspectorField>,
    );
    const editable = controlPorRotulo(html, /^Texto principal$/);
    expect(editable).toContain('role="textbox"');
    expect(editable).not.toContain("aria-label=");
    expect(ayudaDe(html, editable)).toBe("La pregunta que verá el encuestado.");
  });

  test("el nombre interno se asocia aunque el campo lleve un asistente al lado", () => {
    const html = renderToStaticMarkup(
      <InspectorField label="Nombre de columna">
        {(campo) => (
          <>
            <NameField id={campo.id} value="p1_edad" onChange={noop} />
            <button type="button">Sugerir</button>
          </>
        )}
      </InspectorField>,
    );
    expect(controlPorRotulo(html, /^Nombre de columna$/)).toContain('value="p1_edad"');
  });

  test("un control compuesto sin opt-in queda como grupo nombrado por el rótulo", () => {
    const html = renderToStaticMarkup(
      <InspectorField label="Lista de opciones" hint="Reasigna para reusar una lista.">
        <button type="button">sexo</button>
      </InspectorField>,
    );
    expect(html).not.toContain("<label");
    const grupo = /<div[^>]*role="group"[^>]*>/.exec(html)?.[0] ?? "";
    const labelId = atributo(grupo, "aria-labelledby") ?? "";
    expect(html).toContain(`id="${labelId}"`);
    expect(texto(new RegExp(`id="${escapar(labelId)}"[^>]*>([^<]*)<`).exec(html)?.[1] ?? "")).toBe(
      "Lista de opciones",
    );
  });
});
