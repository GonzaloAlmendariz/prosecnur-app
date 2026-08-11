import { describe, expect, it } from "vitest";

// El buscador de ajustes compara sin tildes: quien escribe rápido no las pone,
// y el ajuste sí las lleva porque su copy está bien escrito. Antes de esto,
// «mayusculas» devolvía 0 aunque la descripción dijera «MAYÚSCULAS».
//
// La regla se prueba aquí, sobre la misma función que usa el componente.
function sinTildes(x: string): string {
  return x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function filtrar(args: { name: string; label: string; descripcion?: string }[], busqueda: string) {
  const q = sinTildes(busqueda.trim());
  if (!q) return args;
  const terminos = q.split(/\s+/);
  return args.filter((a) => {
    const heno = sinTildes([a.name, a.label, a.descripcion].filter(Boolean).join(" "));
    return terminos.every((t) => heno.includes(t));
  });
}

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
