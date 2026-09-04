import { describe, expect, it } from "vitest";

import { normalizarDrivePublicacion } from "../../api/recopiladores";

/**
 * B6(b): la respuesta de `materials/drive` cruza la frontera con normalizador
 * defensivo, como todo payload crítico. El enlace es lo que el equipo va a
 * abrir: si viene torcido, mejor un error de contrato aquí que un href vacío
 * en la pantalla.
 */
describe("la publicación en Drive se normaliza en la frontera", () => {
  it("acepta la respuesta canónica y conserva el enlace", () => {
    const pub = normalizarDrivePublicacion({
      ok: true,
      drive_file_id: "drive-1",
      web_view_link: "https://drive.google.com/file/d/drive-1/view",
      folder_id: "carpeta-1",
      folder_name: "Fichas QR - HSVG 2026",
      filename: "fichas_qr.zip",
      receipt_id: "receipt-1",
    });
    expect(pub.driveFileId).toBe("drive-1");
    expect(pub.webViewLink).toMatch(/^https:\/\/drive\.google\.com\//);
    expect(pub.folderName).toBe("Fichas QR - HSVG 2026");
    expect(pub.filename).toBe("fichas_qr.zip");
  });

  it("un enlace ausente o que no es de Drive es error de contrato, no un href hueco", () => {
    expect(() => normalizarDrivePublicacion({ ok: true, drive_file_id: "x" })).toThrow();
    expect(() =>
      normalizarDrivePublicacion({
        ok: true,
        drive_file_id: "x",
        web_view_link: "javascript:alert(1)",
      }),
    ).toThrow();
  });

  it("los campos decorativos ausentes caen a vacío declarado, sin tumbar la publicación", () => {
    const pub = normalizarDrivePublicacion({
      drive_file_id: "drive-2",
      web_view_link: "https://drive.google.com/file/d/drive-2/view",
    });
    expect(pub.folderName).toBe("");
    expect(pub.filename).toBe("");
  });
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("el botón de Drive llega a la pantalla de Materiales", () => {
  // Patrón de FichaPruebaControl.test.tsx: un control puede estar escrito y
  // no montarse nunca. Se fija por fuente que el botón existe, llama al
  // cliente y muestra el enlace resultante.
  const fuente = readFileSync(
    fileURLToPath(new URL("./MaterialsSection.tsx", import.meta.url)),
    "utf8",
  );

  it("existe, dispara la subida y enseña el enlace", () => {
    expect(fuente).toContain("Enviar al Drive del operativo");
    expect(fuente).toContain("apiRecopiladoresMaterialDrive({");
    expect(fuente).toContain("expected_revision: payload.state_revision");
    expect(fuente).toContain("drivePub.webViewLink");
    expect(fuente).toContain('import "./driveDeFichas.css"');
  });

  it("el fallo se muestra con su causa, no se traga", () => {
    expect(fuente).toContain("setDriveError(");
    expect(fuente).toContain("{driveError ?");
  });
});
