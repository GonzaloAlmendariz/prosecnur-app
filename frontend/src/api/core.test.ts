import { describe, expect, test } from "vitest";

import { ApiError, handle } from "./core";

function errorResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("handle() y el detalle de collection_contract_problem_lines()", () => {
  test("sin details.problems, el mensaje queda igual que antes (mensaje · código)", async () => {
    const res = errorResponse(422, {
      error: { code: "E_COLLECTION_MATERIAL_INSTANCE_INVALID", message: "La instancia no cumple collection_material_instance/v1." },
    });
    await expect(handle(res)).rejects.toMatchObject({
      message: "La instancia no cumple collection_material_instance/v1. · E_COLLECTION_MATERIAL_INSTANCE_INVALID",
      code: "E_COLLECTION_MATERIAL_INSTANCE_INVALID",
    });
  });

  test("con 12 problemas repetidos (un binding por unidad), se deduplica a uno solo", async () => {
    const linea = "deployment.bindings[%d].access_ref [bad_access_ref]: Si se declara, access_ref debe ser una referencia escalar no vacía.";
    const res = errorResponse(422, {
      error: {
        code: "E_COLLECTION_DEPLOYMENT_INVALID",
        message: "El deployment no cumple collection_deployment/v1.",
        details: { problems: Array.from({ length: 12 }, (_, i) => linea.replace("%d", String(i + 1))) },
      },
    });
    let caught: ApiError | null = null;
    await handle(res).catch((e) => { caught = e; });
    expect(caught).toBeInstanceOf(ApiError);
    const message = caught!.message;
    expect(message).toBe(
      "El deployment no cumple collection_deployment/v1. · Si se declara, access_ref debe ser una referencia escalar no vacía. · E_COLLECTION_DEPLOYMENT_INVALID"
    );
    // no se filtra la ruta técnica cruda (`deployment.bindings[N]...`) ni el
    // código interno del problema (`bad_access_ref`) — solo la frase legible.
    expect(message).not.toContain("bindings[");
    expect(message).not.toContain("bad_access_ref");
  });

  test("con más de 3 problemas distintos, muestra 3 y cuenta el resto", async () => {
    const res = errorResponse(422, {
      error: {
        code: "E_COLLECTION_STATE_MUTATION_INVALID",
        message: "La mutación produciría un collection_state/v1 inválido.",
        details: {
          problems: [
            "plan.units[0].label [missing_string]: `label` debe ser un string no vacío.",
            "plan.units[1].label [missing_string]: `label` debe ser un string no vacío 2.",
            "plan.units[2].label [missing_string]: `label` debe ser un string no vacío 3.",
            "plan.units[3].label [missing_string]: `label` debe ser un string no vacío 4.",
            "plan.units[4].label [missing_string]: `label` debe ser un string no vacío 5.",
          ],
        },
      },
    });
    let caught: ApiError | null = null;
    await handle(res).catch((e) => { caught = e; });
    expect(caught!.message).toContain("(+2 más)");
    expect(caught!.message.match(/debe ser un string no vacío/g)?.length).toBe(3);
  });

  test("problems con formato inesperado (no 'path [code]: detalle') no rompe, usa la línea entera", async () => {
    const res = errorResponse(422, {
      error: {
        code: "E_ALGO",
        message: "Algo falló.",
        details: { problems: ["un problema sin el formato canónico"] },
      },
    });
    let caught: ApiError | null = null;
    await handle(res).catch((e) => { caught = e; });
    expect(caught!.message).toBe("Algo falló. · un problema sin el formato canónico · E_ALGO");
  });
});
