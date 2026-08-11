import { describe, expect, it } from "vitest";
import type { ArgMetadata } from "../../../api/client";
import { filtrarAjustes } from "../buscarAjustes";

// Se prueba el módulo REAL, no una copia: cuando esto se escribió la regla
// vivía dentro del componente y el test la duplicaba, que es la forma más
// fácil de que un test pase mientras el producto falla.
function filtrar(args: { name: string; label: string; descripcion?: string }[], busqueda: string) {
  return filtrarAjustes(args as unknown as ArgMetadata[], busqueda);
}

// El buscador de ajustes compara sin tildes: quien escribe rápido no las pone,
// y el ajuste sí las lleva porque su copy está bien escrito. Antes de esto,
// «mayusculas» devolvía 0 aunque la descripción dijera «MAYÚSCULAS».
//
// La regla se prueba aquí, sobre la misma función que usa el componente.
const ARGS = [
  { name: "normalizar_etiquetas", label: "Normalización de etiquetas",
    descripcion: "«Mayúscula inicial» arregla listas transcritas en MAYÚSCULAS." },
  { name: "size_texto_barras", label: "Tamaño del texto", descripcion: "Cuerpo numérico de la cifra." },
  { name: "canvas_w_etiquetas", label: "Ancho del canal", descripcion: "Espacio para las etiquetas del eje." },
];

describe("buscador de ajustes", () => {
  it("encuentra sin tildes lo que está escrito con tildes", () => {
    expect(filtrar(ARGS, "mayusculas")).toHaveLength(1);
    expect(filtrar(ARGS, "normalizacion")).toHaveLength(1);
    expect(filtrar(ARGS, "numerico")).toHaveLength(1);
    expect(filtrar(ARGS, "tamano")).toHaveLength(1);
  });

  it("sigue encontrando con las tildes puestas", () => {
    expect(filtrar(ARGS, "MAYÚSCULAS")).toHaveLength(1);
    expect(filtrar(ARGS, "numérico")).toHaveLength(1);
  });

  it("exige todos los términos, no cualquiera", () => {
    expect(filtrar(ARGS, "ancho canal")).toHaveLength(1);
    expect(filtrar(ARGS, "ancho tamano")).toHaveLength(0);
  });

  it("con el campo vacío no filtra nada", () => {
    expect(filtrar(ARGS, "")).toHaveLength(3);
    expect(filtrar(ARGS, "   ")).toHaveLength(3);
  });

  it("sin resultados devuelve lista vacía, no todo", () => {
    expect(filtrar(ARGS, "zzzz")).toHaveLength(0);
  });
});
