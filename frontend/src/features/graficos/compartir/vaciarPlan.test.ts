// C14: vaciar el plan desde Láminas, con confirmación explícita y deshacible, y su comportamiento por alcance.
// Mutantes que estas pruebas matan: vaciar sin confirmación, deshabilitar en el informe compartido (o habilitar sin
// láminas), texto que niegue Deshacer, la barra que llame a `reset` directo o que vuelva a mandar al Editor anterior.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { usePlanStore } from "../store";
import { disponibilidadCompartir } from "./disponibilidadCompartir";
import { textoConfirmarVaciar, VACIAR_SE_DESHACE } from "./textosConfirmacion";
import {
  disponibilidadVaciarPlan,
  ESTADO_VACIAR_INICIAL,
  itemVaciarMenu,
  MENSAJE_PLAN_VACIADO,
  MOTIVO_VACIAR_SIN_LAMINAS,
  vaciarReducer,
  vaciarSiConfirmado,
} from "./vaciarPlan";

const dir = path.dirname(new URL(import.meta.url).pathname);
const leer = (...p: string[]) => fs.readFileSync(path.join(dir, "..", ...p), "utf8");
const sinComentarios = (fuente: string) => fuente
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("vaciar sólo con confirmación", () => {
  it("sin confirmación no llama a reset; con confirmación, sí y una vez", () => {
    const reset = vi.fn();
    const d = { habilitado: true } as const;
    expect(vaciarSiConfirmado(false, d, reset)).toBe(false);
    expect(reset).not.toHaveBeenCalled();
    expect(vaciarSiConfirmado(true, d, reset)).toBe(true);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("aunque se confirme, no vacía si no está disponible", () => {
    const reset = vi.fn();
    expect(vaciarSiConfirmado(true, { habilitado: false, motivo: MOTIVO_VACIAR_SIN_LAMINAS }, reset)).toBe(false);
    expect(reset).not.toHaveBeenCalled();
  });

  it("pedir abre la confirmación; cancelar la cierra; hecho deja el aviso para lectores de pantalla", () => {
    const abierto = vaciarReducer(ESTADO_VACIAR_INICIAL, { tipo: "pedir" });
    expect(abierto.pendiente).toBe(true);
    expect(vaciarReducer(abierto, { tipo: "cancelar" }).pendiente).toBe(false);
    const hecho = vaciarReducer(abierto, { tipo: "hecho" });
    expect(hecho).toEqual({ pendiente: false, mensaje: MENSAJE_PLAN_VACIADO });
    expect(vaciarReducer(hecho, { tipo: "limpiar-mensaje" }).mensaje).toBe("");
  });
});

describe("disponibilidad por alcance y por contenido", () => {
  it("en el informe compartido vaciar sigue habilitado (escribe en su borrador, no en la base activa)", () => {
    expect(disponibilidadVaciarPlan(disponibilidadCompartir("consolidated"), 3)).toEqual({ habilitado: true });
    expect(disponibilidadVaciarPlan(disponibilidadCompartir("active"), 3)).toEqual({ habilitado: true });
  });

  it("sin láminas queda deshabilitado con motivo, en cualquier alcance", () => {
    for (const scope of ["active", "consolidated"] as const) {
      const d = disponibilidadVaciarPlan(disponibilidadCompartir(scope), 0);
      expect(d, scope).toEqual({ habilitado: false, motivo: MOTIVO_VACIAR_SIN_LAMINAS });
      const item = itemVaciarMenu(d);
      expect(item.habilitado).toBe(false);
      expect(item.detalle).toBe(MOTIVO_VACIAR_SIN_LAMINAS);
    }
  });
});

describe("la confirmación dice qué vacía y que se deshace", () => {
  it("en una base habla del plan de esta base", () => {
    const t = textoConfirmarVaciar("active", 4);
    expect(t).toMatchObject({ titulo: "¿Vaciar el plan?", accion: "Vaciar" });
    expect(t.detalle).toContain("las 4 láminas");
    expect(t.detalle).toContain("del plan de esta base");
    expect(t.detalle).toContain(VACIAR_SE_DESHACE);
    expect(t.detalle).not.toMatch(/No se puede revertir/);
  });

  it("en el informe compartido nombra ese informe y que las bases no cambian", () => {
    const t = textoConfirmarVaciar("consolidated", 1);
    expect(t.titulo).toBe("¿Vaciar el informe compartido?");
    expect(t.detalle).toContain("la 1 lámina");
    expect(t.detalle).toContain("el plan de cada base no cambia");
  });

  it("es verdad que se deshace: reset es un paso del historial del store", () => {
    usePlanStore.setState({ plan: { slides: [{ id: "s-a", tipo: "p_slide_portada", payload: {} }] }, past: [], future: [] });
    usePlanStore.getState().reset();
    expect(usePlanStore.getState().plan.slides).toHaveLength(0);
    expect(usePlanStore.getState().past.length).toBe(1);
    usePlanStore.getState().undo();
    expect(usePlanStore.getState().plan.slides.map((s) => s.id)).toEqual(["s-a"]);
  });
});

describe("la barra de Láminas y el header usan la misma puerta", () => {
  it("la barra abre la confirmación y no vacía directo; el header pregunta por el hook, sin copia", () => {
    const barra = sinComentarios(leer("laminas", "BarraLaminas.tsx"));
    expect(barra).toContain("useVaciarPlan(reportScope)");
    expect(barra).toContain("abrir: vaciar.pedir");
    expect(barra).toContain("<ConfirmacionVaciar control={vaciar}");
    expect(barra).not.toMatch(/\.reset\b|s\.reset/);
    const header = sinComentarios(leer("GraficosHeader.tsx"));
    expect(header).toContain("useVaciarPlan(reportScope)");
    expect(header).toContain("vaciar.vaciarSi(");
    expect(header).not.toMatch(/s\.reset\b|resetPlan/);
    const hook = leer("compartir", "useVaciarPlan.ts");
    expect(hook.match(/vaciarSiConfirmado\(/g)?.length).toBe(2);
    expect(hook).not.toMatch(/\breset\(\)/);
  });
});

describe("textos de Láminas y compartir sin «Editor anterior» (A10 W-C)", () => {
  it("el estilo del cliente lleva a su pestaña, sin el texto «Mientras llega su pestaña»", () => {
    const barra = sinComentarios(leer("laminas", "BarraLaminas.tsx"));
    expect(barra).toMatch(/irA\("pestana", "estilo"\)/);
    expect(barra).not.toMatch(/Mientras llega su pestaña/);
    expect(barra).not.toMatch(/onClick=\{item\(onIrEditorAnterior\)\}/);
  });

  it("ningún texto visible de laminas/ ni compartir/ dice «Editor anterior»", () => {
    const raiz = path.join(dir, "..");
    const archivos = ["laminas", "compartir"].flatMap((d) => listar(path.join(raiz, d)));
    const culpables = archivos.filter((p) => /Editor anterior/.test(sinComentarios(fs.readFileSync(p, "utf8"))));
    expect(culpables.map((p) => path.relative(raiz, p))).toEqual([]);
  });
});

function listar(raiz: string): string[] {
  return fs.readdirSync(raiz, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(raiz, e.name);
    if (e.isDirectory()) return listar(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}
