import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PulsoField, PulsoFieldRow, joinDescribedBy } from "./PulsoField";
import { PulsoInput } from "./PulsoInput";
import { PulsoSwitch } from "./PulsoSwitch";

const noop = () => {};

describe("PulsoField", () => {
  it("asocia el label por id y describe el control con el hint", () => {
    const html = renderToStaticMarkup(
      <PulsoField id="meta" label="Meta" labelDetail="opcional" hint="Entrevistas completas">
        <PulsoInput value="" onChange={noop} />
      </PulsoField>,
    );
    expect(html).toContain('<label id="meta-label" for="meta" class="pulso-field-label">Meta<small>opcional</small></label>');
    expect(html).toContain('id="meta"');
    expect(html).toContain('aria-describedby="meta-message"');
    expect(html).toContain('<span id="meta-message" class="pulso-field-hint">Entrevistas completas</span>');
    expect(html).not.toContain("aria-invalid");
  });

  it("el error REEMPLAZA al hint y marca el control aria-invalid", () => {
    const html = renderToStaticMarkup(
      <PulsoField id="meta" label="Meta" hint="Entrevistas completas" error="Debe ser un número entero.">
        <PulsoInput value="1,200 entrevistas" onChange={noop} />
      </PulsoField>,
    );
    expect(html).not.toContain("Entrevistas completas");
    expect(html).toContain('class="pulso-field-error"');
    expect(html).toContain("Debe ser un número entero.");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="meta-message"');
    expect(html).toContain("pulso-field is-error");
  });

  it("sin hint ni error no deja aria-describedby colgando", () => {
    const html = renderToStaticMarkup(
      <PulsoField id="x" label="Buscar">
        <PulsoInput value="" onChange={noop} />
      </PulsoField>,
    );
    expect(html).not.toContain("aria-describedby");
  });

  it("en modo group nombra al conjunto y no reparte un id único entre miembros", () => {
    const html = renderToStaticMarkup(
      <PulsoField id="form" label="Formación" group hint="Resta 30,271">
        <PulsoSwitch variant="chip" checked label="Pregrado" onCheckedChange={noop} />
        <PulsoSwitch variant="chip" checked={false} label="Posgrado" onCheckedChange={noop} />
      </PulsoField>,
    );
    expect(html).toContain('role="group" aria-labelledby="form-label" aria-describedby="form-message"');
    expect(html).not.toContain('id="form" ');
    expect((html.match(/role="switch"/g) ?? []).length).toBe(2);
  });

  it("fila de campos con rol de búsqueda", () => {
    const html = renderToStaticMarkup(
      <PulsoFieldRow role="search" ariaLabel="Filtrar variables" geometryGroup="analitica/filtros"><span /></PulsoFieldRow>,
    );
    expect(html).toBe(
      '<div class="pulso-field-row" role="search" aria-label="Filtrar variables" data-qa-geometry-group="analitica/filtros" data-qa-geometry-contract="intrinsic"><span></span></div>',
    );
  });

  it("joinDescribedBy omite vacíos y duplicados", () => {
    expect(joinDescribedBy(undefined, "a", "", "a", "b")).toBe("a b");
    expect(joinDescribedBy(undefined, null, false)).toBeUndefined();
  });
});
