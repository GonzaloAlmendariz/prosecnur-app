import { beforeEach, describe, expect, test } from "vitest";
import {
  coerceOrdenCategorias,
  DEFAULT_CONFIG,
  normalizeAnaliticaConfig,
  useAnaliticaStore,
  type AnaliticaConfig,
} from "./store";

function resetStore() {
  useAnaliticaStore.setState({ config: DEFAULT_CONFIG, hydrated: false, dirty: false });
}

describe("orden_categorias — setters del store", () => {
  beforeEach(resetStore);

  test("setOrdenCategorias guarda la secuencia y marca dirty", () => {
    useAnaliticaStore.getState().setOrdenCategorias("satisfaccion", ["3", "2", "1"]);
    const s = useAnaliticaStore.getState();
    expect(s.dirty).toBe(true);
    expect(s.config.orden_categorias.satisfaccion).toEqual(["3", "2", "1"]);
  });

  test("setOrdenCategorias con array vacío borra la entrada (restaura instrumento)", () => {
    const st = useAnaliticaStore.getState();
    st.setOrdenCategorias("acuerdo", ["1", "2", "3"]);
    expect(useAnaliticaStore.getState().config.orden_categorias.acuerdo).toBeDefined();

    useAnaliticaStore.getState().setOrdenCategorias("acuerdo", []);
    expect("acuerdo" in useAnaliticaStore.getState().config.orden_categorias).toBe(false);
  });

  test("setOrdenCategorias ignora list_name vacío", () => {
    resetStore();
    useAnaliticaStore.getState().setOrdenCategorias("  ", ["1"]);
    expect(useAnaliticaStore.getState().config.orden_categorias).toEqual({});
    expect(useAnaliticaStore.getState().dirty).toBe(false);
  });

  test("clearOrdenCategorias borra la entrada y marca dirty", () => {
    const st = useAnaliticaStore.getState();
    st.setOrdenCategorias("canales", ["1", "2"]);
    useAnaliticaStore.setState({ dirty: false });

    useAnaliticaStore.getState().clearOrdenCategorias("canales");
    const s = useAnaliticaStore.getState();
    expect("canales" in s.config.orden_categorias).toBe(false);
    expect(s.dirty).toBe(true);
  });

  test("clearOrdenCategorias sobre entrada ausente es no-op (no marca dirty)", () => {
    resetStore();
    useAnaliticaStore.getState().clearOrdenCategorias("inexistente");
    expect(useAnaliticaStore.getState().dirty).toBe(false);
  });

  test("no muta el objeto orden_categorias previo (inmutabilidad)", () => {
    const st = useAnaliticaStore.getState();
    st.setOrdenCategorias("a", ["1"]);
    const primero = useAnaliticaStore.getState().config.orden_categorias;
    useAnaliticaStore.getState().setOrdenCategorias("b", ["2"]);
    const segundo = useAnaliticaStore.getState().config.orden_categorias;
    expect(primero).not.toBe(segundo);
    expect(primero).toEqual({ a: ["1"] });
  });
});

describe("orden_categorias — coerción y migración v3→v4", () => {
  test("coerceOrdenCategorias descarta valores no-array y stringifica códigos", () => {
    const raw = {
      buena: [1, "2", 3],
      mala: "no soy array",
      vacia: [],
      nula: null,
    } as unknown;
    expect(coerceOrdenCategorias(raw)).toEqual({ buena: ["1", "2", "3"], vacia: [] });
  });

  test("coerceOrdenCategorias tolera entradas no-objeto", () => {
    expect(coerceOrdenCategorias(undefined)).toEqual({});
    expect(coerceOrdenCategorias(null)).toEqual({});
    expect(coerceOrdenCategorias(["a", "b"])).toEqual({});
    expect(coerceOrdenCategorias("texto")).toEqual({});
  });

  test("normalizeAnaliticaConfig rellena orden_categorias {} en config v3 y bumpea a v4", () => {
    const legacy = {
      ...DEFAULT_CONFIG,
      version: 3,
    } as unknown as AnaliticaConfig;
    // Simula un proyecto previo a v4 sin la clave.
    delete (legacy as Partial<AnaliticaConfig>).orden_categorias;

    const migrado = normalizeAnaliticaConfig(legacy);
    expect(migrado.version).toBe(4);
    expect(migrado.orden_categorias).toEqual({});
  });

  test("normalizeAnaliticaConfig preserva y sanea orden_categorias existente", () => {
    const config = {
      ...DEFAULT_CONFIG,
      version: 4,
      orden_categorias: { satisfaccion: ["4", "3", "2", "1"], sucia: "x" },
    } as unknown as AnaliticaConfig;

    const out = normalizeAnaliticaConfig(config);
    expect(out.orden_categorias).toEqual({ satisfaccion: ["4", "3", "2", "1"] });
  });

  test("hydrate corre normalize y deja el override disponible sin dirty", () => {
    resetStore();
    const config = {
      ...DEFAULT_CONFIG,
      version: 3,
      orden_categorias: { acuerdo: ["3", "2", "1"] },
    } as unknown as AnaliticaConfig;

    useAnaliticaStore.getState().hydrate(config);
    const s = useAnaliticaStore.getState();
    expect(s.dirty).toBe(false);
    expect(s.hydrated).toBe(true);
    expect(s.config.version).toBe(4);
    expect(s.config.orden_categorias.acuerdo).toEqual(["3", "2", "1"]);
  });
});
