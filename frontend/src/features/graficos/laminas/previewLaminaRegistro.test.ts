// U6 del QA de CCSS (2026-10-24): «Previsualizar» volvía a dibujar cada lámina (~20 s) aunque ya estuviera dibujada.
// Los coordinadores vivían en un `useRef` del hook y se perdían al desmontar el visor. Viven ahora en un registro de
// módulo, con las respuestas guardadas por la clave de la lámina y del plan.
import { describe, expect, it } from "vitest";
import type { PreviewSlideResponse } from "../../../api/graficos";
import { crearCoordinadorPreviewLamina, type EstadoPreviewLamina } from "../previewLaminaCoordinador";
import { crearRegistroPreviewLaminas } from "./previewLaminaRegistro";

const resp = (id: string) => ({ ok: true, file_id: id, size: 1, type: "pptx", images: [] }) as PreviewSlideResponse;

function temporizadorManual() {
  const tareas = new Map<number, () => void>();
  let n = 0;
  return {
    t: { programar: (fn: () => void) => (tareas.set(++n, fn), n), cancelar: (id: unknown) => tareas.delete(id as number) },
    correr: () => { const fs = [...tareas.values()]; tareas.clear(); fs.forEach((f) => f()); },
  };
}

function montaje() {
  const tm = temporizadorManual();
  const pedidas: string[] = [];
  const registro = crearRegistroPreviewLaminas((slideId, cache) =>
    crearCoordinadorPreviewLamina(async (clave) => (pedidas.push(`${slideId}:${clave}`), resp(clave)), { temporizador: tm.t, cache }), 3);
  /** Un «montaje» del visor: pide la clave, deja correr el debounce y desmonta (cancelar). */
  const ver = async (ambito: string, slideId: string, clave: string) => {
    const estados: EstadoPreviewLamina[] = [];
    const c = registro.coordinador(ambito, slideId);
    const fin = c.solicitar(clave, (e) => estados.push(e));
    tm.correr(); await fin;
    c.cancelar();
    return estados;
  };
  return { registro, pedidas, ver };
}

describe("U6 · la vista previa sobrevive al desmontaje del visor", () => {
  it("volver a una lámina ya dibujada, tras desmontar, responde al instante sin pedir otra vez", async () => {
    const { pedidas, ver } = montaje();
    await ver("sid1", "a", "k1");
    const segunda = await ver("sid1", "a", "k1");
    expect(pedidas).toEqual(["a:k1"]);
    expect(segunda).toEqual([expect.objectContaining({ estado: "lista", clave: "k1" })]);
  });

  it("una versión anterior de la lámina (deshacer) también sale de la caché por su clave", async () => {
    const { pedidas, ver } = montaje();
    await ver("sid1", "a", "k1");
    await ver("sid1", "a", "k2");
    const deshacer = await ver("sid1", "a", "k1");
    expect(pedidas).toEqual(["a:k1", "a:k2"]);
    expect(deshacer.at(-1)).toMatchObject({ estado: "lista", clave: "k1" });
  });

  it("otro proyecto o sesión no reutiliza las imágenes", async () => {
    const { pedidas, ver } = montaje();
    await ver("sid1", "a", "k1");
    await ver("sid2", "a", "k1");
    expect(pedidas).toEqual(["a:k1", "a:k1"]);
  });

  it("olvidar() (cambio de base o de datos) vuelve a pedir; la caché tiene tope", async () => {
    const { registro, pedidas, ver } = montaje();
    await ver("sid1", "a", "k1");
    registro.olvidar();
    await ver("sid1", "a", "k1");
    expect(pedidas).toEqual(["a:k1", "a:k1"]);
    for (const k of ["k2", "k3", "k4"]) await ver("sid1", "b", k);   // tope 3: k1 sale de la caché
    await ver("sid1", "c", "k1");
    expect(pedidas.at(-1)).toBe("c:k1");
  });
});
