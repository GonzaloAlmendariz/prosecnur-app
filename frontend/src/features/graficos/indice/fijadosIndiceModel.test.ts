import { describe, expect, it } from "vitest";
import type { Slide } from "../../../api/graficos";
import { ARGS_FIJADOS_INDICE, indicePorRutaAnterior, lineasFijadasIndice, valorGuardado } from "./fijadosIndiceModel";
import { leerIndice, serializarIndice } from "./modeloIndice";

const indice = (payload: Record<string, unknown>): Slide => ({ id: "ix", tipo: "p_slide_indice", payload: { secciones: "Perfil\nResultados", ...payload } });
const linea = (s: Slide, arg: string) => lineasFijadasIndice(s).find((l) => l.arg === arg)!;

describe("ajustes de los focos del índice fijados por el recetario (decisión 32)", () => {
  it("los cuatro se muestran siempre, con candado, aunque el plan no guarde nada", () => {
    const ls = lineasFijadasIndice(indice({}));
    expect(ls.map((l) => l.arg)).toEqual([...ARGS_FIJADOS_INDICE]);
    expect(ls.every((l) => l.motivo.startsWith("Fijo por diseño"))).toBe(true);
    expect(ls.every((l) => l.nota === null)).toBe(true);
  });

  it("mostrar_iconos_focos = FALSE lo respeta el motor nativo y se dice", () => {
    const l = linea(indice({ mostrar_iconos_focos: false }), "mostrar_iconos_focos");
    expect(l.sinEfecto).toBe(false);
    expect(l.valor).toMatch(/^No/);
    expect(l.nota).toContain("quita todos los íconos");
    expect(linea(indice({ mostrar_iconos_focos: true }), "mostrar_iconos_focos").valor).toMatch(/^Sí/);
  });

  it("los ajustes sin equivalente no se aplican y su valor guardado se nombra, no se pierde", () => {
    const s = indice({ redibujar_focos: true, iconos_focos_fill: ["#111111", "", "#222222"], iconos_focos_objeto_unico: false });
    expect(linea(s, "redibujar_focos")).toMatchObject({ sinEfecto: true, nota: expect.stringContaining("«Sí»") });
    expect(linea(s, "iconos_focos_fill").nota).toContain("«2 colores»");
    expect(linea(s, "iconos_focos_objeto_unico").nota).toContain("«No»");
  });

  it("lee también lo que el plan guarda en `estilo`", () => {
    const s = indice({ estilo: { redibujar_focos: true } });
    expect(valorGuardado(s.payload, "redibujar_focos")).toBe(true);
    expect(linea(s, "redibujar_focos").nota).toContain("«Sí»");
  });

  it("por la ruta anterior (estilo de focos o motor apagado) manda el valor guardado", () => {
    const focos = indice({ meta: { composicion: "focos" }, iconos_focos_fill: ["#111111"] });
    expect(indicePorRutaAnterior(focos)).toBe(true);
    expect(linea(focos, "iconos_focos_fill")).toMatchObject({ sinEfecto: false, valor: "1 color" });
    const apagado = indice({ meta: { motor_nativo: false } });
    expect(indicePorRutaAnterior(apagado)).toBe(true);
    expect(linea(apagado, "redibujar_focos").valor).toBe("No");
    expect(indicePorRutaAnterior(indice({}))).toBe(false);
  });

  it("editar el índice no toca esos ajustes: viajan intactos en el plan", () => {
    const guardados = { redibujar_focos: true, mostrar_iconos_focos: false, iconos_focos_fill: ["#111111"], iconos_focos_objeto_unico: false };
    const s = indice(guardados);
    const r = serializarIndice(s, leerIndice(s.payload));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const k of ARGS_FIJADOS_INDICE) expect(Object.keys(r.patch)).not.toContain(k);
    expect({ ...s.payload, ...r.patch }).toMatchObject(guardados);
  });
});
