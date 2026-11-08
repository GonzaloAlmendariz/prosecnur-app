// @vitest-environment happy-dom
// Ítem 7 de la oleada I2: los grupos del cruce con su n exacto, «pocos casos» bajo 30 y, si el gráfico admite excluir
// grupos, un clic los manda ahí. Sin una barra por grupo, nada.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DetalleCifras, PedidoCifrasDetalleLote } from "../../../../api/graficosCifras";
import { detalle, fila } from "../cifrasInspector/fixturaDetalle.test-utils";

const lote = vi.hoisted(() => vi.fn());
vi.mock("../../../../api/graficosCifras", async (original) => ({ ...(await original<object>()), apiGraficosCifrasDetalleLote: lote }));
// R7-16: la lista ORIGINAL de la pregunta numera Selva como 2; el recodificado que agrupa el render la renumera. Si el
// componente leyera esta lista, mandaría «2» y excluiría otro grupo.
vi.mock("../useCategoriasGrafico", () => ({ useCategoriasGrafico: () => ({ fase: "lista", reintentar: () => undefined, datos: { categorias: [
  { codigo: "1", etiqueta: "Lima", n: 300, pct: 0, residual: false }, { codigo: "2", etiqueta: "Selva", n: 12, pct: 0, residual: false },
] } }) }));

import { olvidarDetalles } from "../cifrasInspector/cacheDetalle";
import { ESPERA_DETALLE_MS } from "../cifrasInspector/useDetalleCifras";
import { GruposDelCruce } from "./GruposDelCruce";
import { conGrupoExcluido, gruposDe } from "./modeloGrupos";

const CATS = [{ clave: "Sí", valor: 60 }, { clave: "No", valor: 40 }];
const POR_GRUPO = detalle(CATS, { forma: "escala", filas: [fila("Total", CATS, { esTotal: true }, 312), fila("Lima", CATS, {}, 300), fila("Selva", CATS, {}, 12)] });
let respuesta: DetalleCifras | null = POR_GRUPO;

let host: HTMLDivElement;
let root: Root;
const excluidos: string[] = [];
const pintar = (conExcluir: boolean) => act(() => root.render(
  <GruposDelCruce graficador="p_barras_apiladas" scope="active" args={{ var: "p1", cruces: "region" }}
    onExcluir={conExcluir ? (c) => { excluidos.push(c); } : undefined} />,
));
const esperar = async () => {
  await act(async () => { vi.advanceTimersByTime(ESPERA_DETALLE_MS); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  olvidarDetalles();
  respuesta = POR_GRUPO;
  excluidos.length = 0;
  lote.mockReset();
  lote.mockImplementation(async (p: PedidoCifrasDetalleLote) => Object.fromEntries(p.laminas.map((l) => [l.id, {
    cifras: { tipo: "", cifras: [], avisos: [] }, error: null, detalle: respuesta,
  }])));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); });

describe("grupos del cruce", () => {
  it("cada grupo con su n; el de pocos casos, marcado y excluible con un clic", async () => {
    pintar(true);
    await esperar();
    const fichas = [...host.querySelectorAll(".pulso-f6-cat")].map((e) => e.textContent);
    expect(fichas).toEqual(["Liman=300", "Selvan=12pocos casos"]);
    act(() => { host.querySelector<HTMLButtonElement>('[data-qa="grupo-pocos"]')!.click(); });
    // R7-16: el rótulo del grupo que se ve, no el código de la lista original.
    expect(excluidos).toEqual(["Selva"]);
  });
  it("R7-16: con un recodificado que renumera, se manda el rótulo del grupo mostrado y se suma sin partir por comas", async () => {
    respuesta = detalle(CATS, { forma: "escala", filas: [fila("Total", CATS, { esTotal: true }, 312), fila("1", CATS, { rotulo: "Lima" }, 300), fila("7", CATS, { rotulo: "Selva, Amazonía" }, 12)] });
    pintar(true);
    await esperar();
    act(() => { host.querySelector<HTMLButtonElement>('[data-qa="grupo-pocos"]')!.click(); });
    expect(excluidos).toEqual(["Selva, Amazonía"]);
    expect(conGrupoExcluido(["3"], "Selva, Amazonía")).toEqual(["3", "Selva, Amazonía"]);
    expect(conGrupoExcluido(["Selva, Amazonía"], "Selva, Amazonía")).toEqual(["Selva, Amazonía"]);
    expect(conGrupoExcluido(undefined, "Selva")).toEqual(["Selva"]);
  });
  it("sin Excluir grupos en el gráfico, las fichas sólo informan", async () => {
    pintar(false);
    await esperar();
    expect(host.querySelector('[data-qa="grupo-pocos"]')).toBeNull();
    expect(host.textContent).toContain("pocos casos");
  });
  it("sin detalle o con una sola barra, nada", async () => {
    respuesta = null;
    pintar(true);
    await esperar();
    expect(host.querySelector('[data-qa="grupos-cruce"]')).toBeNull();
    expect(gruposDe(detalle(CATS))).toEqual([]);
  });
});
