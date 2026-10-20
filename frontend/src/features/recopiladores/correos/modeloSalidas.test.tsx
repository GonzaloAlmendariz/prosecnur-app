import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MAIL_PLATFORMS } from "../../../api/materialMail";
import { SALIDAS_DEL_ENVIO } from "./modeloSalidas";
import { SalidasDelEnvio } from "./SalidasDelEnvio";

describe("cada plataforma dice cuál es su salida principal y para qué sirve cada una", () => {
  it("una sola principal por plataforma, con su línea", () => {
    for (const p of MAIL_PLATFORMS) {
      expect(SALIDAS_DEL_ENVIO[p].filter((s) => s.principal)).toHaveLength(1);
      for (const s of SALIDAS_DEL_ENVIO[p]) {
        expect(s.para.length).toBeGreaterThan(10);
        // Una línea: cabe al pie del inspector sin quitarle alto al panel.
        expect(`${s.corto}: ${s.para}`.length).toBeLessThanOrEqual(80);
      }
    }
  });

  it("en SurveyMonkey la principal es copiar el HTML y el paquete se dice como respaldo", () => {
    const [principal, paquete] = SALIDAS_DEL_ENVIO.surveymonkey;
    expect(principal).toMatchObject({ accion: "Copiar HTML para SurveyMonkey", principal: true });
    expect(paquete.accion).toBe("Paquete del envío");
    expect(paquete.para).toContain("contactos con su saludo");
  });

  it("los rótulos son los de los botones de los paneles", () => {
    const sm = renderToStaticMarkup(<SalidasDelEnvio plataforma="surveymonkey" />);
    expect(sm).toContain("principal");
    expect(sm.match(/rec-mail-salida-principal/g)).toHaveLength(1);
  });
});
