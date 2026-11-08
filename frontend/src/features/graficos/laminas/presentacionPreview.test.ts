// Hallazgo 7 (auditoría de Arte): con la vista previa activa, un cambio de args pide la nueva tras ~600 ms y, mientras
// llega, la imagen anterior queda nítida con «Actualizando»; un error no la borra.
import { describe, expect, it } from "vitest";
import type { PreviewSlideResponse } from "../../../api/graficos";
import { crearCoordinadorPreviewLamina, type EstadoPreviewLamina } from "../previewLaminaCoordinador";
import { presentacionPreview, type EntradaPresentacion } from "./presentacionPreview";

const resp = (id: string) => ({ ok: true, file_id: id, size: 1, type: "pptx", images: [] }) as PreviewSlideResponse;

/** Temporizador que registra la espera pedida y corre a mano. */
function temporizador() {
  const tareas = new Map<number, { fn: () => void; ms: number }>();
  let n = 0;
  return {
    t: { programar: (fn: () => void, ms: number) => (tareas.set(++n, { fn, ms }), n), cancelar: (id: unknown) => tareas.delete(id as number) },
    esperas: () => [...tareas.values()].map((x) => x.ms),
    correr: () => { const fs = [...tareas.values()]; tareas.clear(); fs.forEach((x) => x.fn()); },
  };
}

const base: EntradaPresentacion = { verComoQueda: true, falta: null, fase: "lista", imagenMotor: "v1.png", imagenLote: null, error: null };

describe("vista previa: debounce de ~600 ms y la imagen anterior a la vista", () => {
  it("un cambio de args espera 600 ms y una ráfaga pide una sola vez, la última", async () => {
    const tm = temporizador();
    const pedidas: string[] = [];
    const c = crearCoordinadorPreviewLamina(async (clave) => (pedidas.push(clave), resp(clave)), { temporizador: tm.t });
    const estados: EstadoPreviewLamina[] = [];
    c.solicitar("a", (e) => estados.push(e));
    c.solicitar("b", (e) => estados.push(e));
    const fin = c.solicitar("c", (e) => estados.push(e));
    expect(tm.esperas()).toEqual([600]);
    expect(pedidas).toEqual([]);
    tm.correr(); await fin;
    expect(pedidas).toEqual(["c"]);
  });

  it("mientras llega la nueva, el estado conserva la anterior y un error también", async () => {
    const tm = temporizador();
    let fallar = false;
    const c = crearCoordinadorPreviewLamina(async (clave) => { if (fallar) throw new Error("LibreOffice tardó"); return resp(clave); }, { temporizador: tm.t });
    const estados: EstadoPreviewLamina[] = [];
    const p1 = c.solicitar("v1", (e) => estados.push(e)); tm.correr(); await p1;
    fallar = true;
    const p2 = c.solicitar("v2", (e) => estados.push(e));
    expect(estados.at(-1)).toMatchObject({ estado: "esperando", anterior: { file_id: "v1" } });
    tm.correr(); await p2;
    expect(estados.at(-1)).toMatchObject({ estado: "error", anterior: { file_id: "v1" } });
  });

  it("con imagen y otra en camino: nítida con «Actualizando», sin aviso de primera vez", () => {
    for (const fase of ["esperando", "cargando"] as const) {
      expect(presentacionPreview({ ...base, fase })).toEqual({ src: "v1.png", actualizando: true, dibujandoPrimera: false, error: null });
    }
  });

  it("sin imagen todavía: la maqueta con «Dibujando»; la del lote sirve de anterior", () => {
    expect(presentacionPreview({ ...base, fase: "cargando", imagenMotor: null })).toMatchObject({ src: null, actualizando: false, dibujandoPrimera: true });
    expect(presentacionPreview({ ...base, fase: "cargando", imagenMotor: null, imagenLote: "lote.png" })).toMatchObject({ src: "lote.png", actualizando: true });
  });

  it("un error se dice sin borrar la última imagen buena", () => {
    expect(presentacionPreview({ ...base, fase: "error", error: "LibreOffice tardó" })).toEqual({ src: "v1.png", actualizando: false, dibujandoPrimera: false, error: "LibreOffice tardó" });
  });

  it("en maqueta o con un dato pendiente no hay imagen, chip ni error", () => {
    expect(presentacionPreview({ ...base, verComoQueda: false, fase: "cargando", error: "x" })).toEqual({ src: null, actualizando: false, dibujandoPrimera: false, error: null });
    expect(presentacionPreview({ ...base, falta: "la pregunta", fase: "cargando" })).toMatchObject({ src: null, actualizando: false, dibujandoPrimera: false });
  });
});
