import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MAIL_PLATFORMS } from "../../../api/materialMail";
import { SALIDAS_DEL_ENVIO } from "./modeloSalidas";
import { PanelMailchimp } from "./PanelMailchimp";
import { PanelSurveyMonkey } from "./PanelSurveyMonkey";

const noop = () => undefined;

describe("cada plataforma dice cuál es su salida principal y para qué sirve cada una", () => {
  it("una sola principal por plataforma, con su línea", () => {
    for (const p of MAIL_PLATFORMS) {
      expect(SALIDAS_DEL_ENVIO[p].filter((s) => s.principal)).toHaveLength(1);
      for (const s of SALIDAS_DEL_ENVIO[p]) {
        expect(s.para.length).toBeGreaterThan(10);
        // Una línea: cabe bajo su rótulo en «Exportar ▾».
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

  it("los rótulos son los de los botones de «Exportar ▾», con una sola principal", () => {
    const sm = renderToStaticMarkup(
      <PanelSurveyMonkey
        envio={{ send_id: "invitacion", kind: "invitacion", label: "Invitación", audience: "todos" }}
        revision={null} exportacion={null} exportando={false} ocupado={false}
        onHtml={async () => null} onExportar={noop} onGuardarJunto={noop}
      />,
    );
    const mc = renderToStaticMarkup(
      <PanelMailchimp revision={null} exportacion={null} exportando={null} ocupado={false} htmlActual={null} onExportar={noop} onGuardarJunto={noop} />,
    );
    for (const [html, p] of [[sm, "surveymonkey"], [mc, "mailchimp"]] as const) {
      expect(html.match(/rec-mail-salida-principal/g)).toHaveLength(1);
      for (const s of SALIDAS_DEL_ENVIO[p]) {
        expect(html).toContain(s.accion);
        expect(html).toContain(s.para);
      }
    }
  });
});
