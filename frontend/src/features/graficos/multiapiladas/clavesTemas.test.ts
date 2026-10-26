// Renzo (Arte_v1-7, 2026-10-26): «coloqué el nombre a 2 temas y los ha unificado, y son separados». Dos temas con la misma
// clave (agregar uno después de quitar otro: `tema_${lista.length + 1}` repetía una clave en uso) se guardaban como uno
// solo: el segundo pisaba al primero en `vars` y en `titulos_grupo`.
import { describe, expect, it } from "vitest";
import { temasConClaveUnica } from "./temasPublicos";

const t = (key: string, title: string, vars: string[] = []) => ({ key, title, vars });

describe("temasConClaveUnica", () => {
  it("dos temas con la misma clave quedan con claves distintas y ninguno se pierde", () => {
    const out = temasConClaveUnica([t("tema_2", "Clima laboral", ["docentes$p1"]), t("tema_2", "Reclutamiento", ["docentes$p2"])]);
    expect(new Set(out.map((x) => x.key)).size).toBe(2);
    expect(out.map((x) => x.title)).toEqual(["Clima laboral", "Reclutamiento"]);
    expect(out[0].key).toBe("tema_2");                     // la primera conserva la suya
  });
  it("una clave vacía toma la siguiente tema_N libre y las válidas no cambian", () => {
    const out = temasConClaveUnica([t("tema_1", "A"), t("", "B"), t("tema_3", "C")]);
    expect(out.map((x) => x.key)).toEqual(["tema_1", "tema_2", "tema_3"]);
  });
  it("sin repetidas no toca nada", () => {
    const entrada = [t("tema_1", "A"), t("clima", "B")];
    expect(temasConClaveUnica(entrada).map((x) => x.key)).toEqual(["tema_1", "clima"]);
  });
});
