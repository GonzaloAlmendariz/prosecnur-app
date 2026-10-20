import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { normalizarRegistroDeCampanas, type RegistroDeCampanas } from "../../../api/materialCampanas";
import { REGISTRO_CRUDO, REGISTRO_VACIO_CRUDO } from "../../../api/materialCampanas.fixture";
import { accionesDeCampana } from "./accionesDeCampana";
import { TiposDeCampana } from "./DialogoNuevaCampana";
import { hrefDeCampana } from "./direccionDeCampanas";
import { ListaDeCampanas } from "./ListaDeCampanas";

const LLENO = normalizarRegistroDeCampanas(REGISTRO_CRUDO);
const VACIO = normalizarRegistroDeCampanas(REGISTRO_VACIO_CRUDO);
const noop = () => undefined;

function lista(registro: RegistroDeCampanas | null, carga: "cargando" | "lista" | "error" = "lista") {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ListaDeCampanas
        registro={registro}
        carga={carga}
        error="sin red"
        fuente="registro"
        aviso={null}
        onCerrarAviso={noop}
        hrefDe={hrefDeCampana}
        accionesDe={(c) => accionesDeCampana(c, { fuente: "registro", correos: 1 })}
        onAccion={noop}
        onNueva={noop}
        onReintentar={noop}
      />
    </MemoryRouter>,
  );
}

function conCorreos(n: number): RegistroDeCampanas {
  const base = LLENO.campaigns[1];
  return { ...LLENO, campaigns: Array.from({ length: n }, (_, i) => ({ ...base, id: `correo.c${i}`, name: `Correo ${i}` })) };
}

describe("la lista de campañas (ADR 0111 §2)", () => {
  it("sin campañas: el vacío vive en su caja y ofrece «Nueva campaña» (C3)", () => {
    const html = lista(VACIO);
    expect(html).toContain("Todavía no hay campañas");
    expect(html).toContain('data-audit-ready="vacio:sin-campanas"');
    expect(html).toContain('class="rec-campanas-vacio" data-qa-geometry-capacity="owned"');
    expect(html).not.toContain('data-qa-geometry-group="material-campo/campanas"');
  });

  it("una campaña: una tarjeta, miembro del grupo equal, que enlaza a su dirección canónica", () => {
    const html = lista(conCorreos(1));
    expect(html).toContain('data-qa-geometry-group="material-campo/campanas" data-qa-geometry-contract="equal"');
    expect(html.match(/data-qa-geometry-member/g)).toHaveLength(1);
    expect(html).toContain('href="/material-campo?modo=correo&amp;campana=correo.c0&amp;seccion=correo&amp;pestana=editor"');
    expect(html).toContain('data-audit-ready="material-campo/campanas"');
  });

  it("varias: el mismo marco para cada una (C2), con tipo, estado y avance", () => {
    const html = lista(LLENO);
    expect(html.match(/class="rec-campana-tarjeta is-/g)?.length).toBe(2);
    expect(html).toContain("Campo en aulas");
    expect(html).toContain("120/175 titulares con enlace");
    // Cifras grandes de aulas y cada envío en su línea con su punto de estado.
    expect(html).toContain('<dt>titulares</dt><dd>175</dd>');
    expect(html).toContain("Invitación · exportado 02/09");
    expect(html).toContain("Recordatorio 1 · pendiente");
    expect(html).toContain('href="/material-campo?modo=aulas&amp;campana=aulas.principal&amp;seccion=unidades&amp;pestana=lista"');
    expect(lista(conCorreos(12)).match(/data-qa-geometry-member/g)).toHaveLength(12);
  });

  it("una archivada sale de la grilla y queda en «Archivadas», sin enlace", () => {
    const archivada: RegistroDeCampanas = {
      ...LLENO,
      campaigns: LLENO.campaigns.map((c) => (c.tipo === "aulas" ? { ...c, archived: true } : c)),
    };
    const html = lista(archivada);
    expect(html).toContain("<summary>Archivadas (1)</summary>");
    expect(html).toContain('data-qa-geometry-group="material-campo/campanas-archivadas"');
    expect(html).not.toContain("campana=aulas.principal");
  });

  it("mientras lee no se declara lista; si falla, publica el vacío con reintento", () => {
    expect(lista(null, "cargando")).toContain('data-audit-ready="false"');
    const error = lista(null, "error");
    expect(error).toContain("No se pudo leer la lista de campañas");
    expect(error).toContain("Reintentar");
  });

  it("aulas se archiva (no se borra); correo se duplica, renombra y borra", () => {
    const [aulas, correo] = LLENO.campaigns;
    expect(accionesDeCampana(aulas, { fuente: "registro", correos: 1 }).map((a) => a.id)).toEqual(["renombrar", "archivar"]);
    expect(accionesDeCampana({ ...aulas, archived: true }, { fuente: "registro", correos: 1 }).map((a) => a.id)).toEqual(["reabrir"]);
    expect(accionesDeCampana(correo, { fuente: "registro", correos: 1 }).map((a) => a.id)).toEqual(["renombrar", "duplicar", "borrar"]);
    // Sin registro en el backend, archivar se ve deshabilitado con su motivo.
    expect(accionesDeCampana(aulas, { fuente: "derivada", correos: 1 }).every((a) => a.motivo)).toBe(true);
  });
});

describe("«Nueva campaña»", () => {
  function tipos(registro: RegistroDeCampanas) {
    return renderToStaticMarkup(<TiposDeCampana registro={registro} elegido={null} ocupado={false} onElegir={noop} />);
  }

  it("muestra los tres tipos; territorial deshabilitada con su motivo", () => {
    const html = tipos(VACIO);
    expect(html.match(/data-qa-geometry-member/g)).toHaveLength(3);
    expect(html).toContain("Campo en aulas");
    expect(html).toContain("Requiere leer las UMP de Hojas de ruta");
    expect(html.match(/disabled=""/g)).toHaveLength(1);
  });

  it("aulas se deshabilita si el proyecto ya tiene la suya", () => {
    const html = tipos(LLENO);
    expect(html).toContain("El proyecto ya tiene su campaña de aulas.");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
});
