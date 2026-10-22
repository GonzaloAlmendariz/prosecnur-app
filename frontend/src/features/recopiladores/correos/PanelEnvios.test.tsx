// Envíos (e12): la apertura se edita con chips y formato visibles pero guarda
// el mismo texto del contrato; la fecha se lee como se dice; el vacío del
// asunto dice qué sale; y lo que dejó la sincronización sigue en su sitio.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mailSendInvitation, type MailSend, type MailTemplate } from "../../../api/materialMail";
import type { CampoConCampos } from "./CampoConCampos";
import { domDePrueba } from "./domDePrueba.test-util";
import { agregarRecordatorio, conApertura, editarEnvio } from "./modeloEnvios";
import { EJEMPLO_DE_APERTURA, PanelEnvios, ayudaDeVacio, fechaHumana } from "./PanelEnvios";
import { htmlDelTexto, textoDelDom, type OpcionesDeTexto } from "./serializarTexto";
import { avisosDeRecordatorio } from "./sincronizacionModel";

type PropsDelCampo = ComponentProps<typeof CampoConCampos>;
const campos: PropsDelCampo[] = [];
const sincronizaciones: (string | null)[] = [];

vi.mock("./CampoConCampos", () => ({
  CampoConCampos: (props: PropsDelCampo) => {
    campos.push(props);
    return <div role="textbox" data-campo-con-campos={props.label} />;
  },
}));

vi.mock("./SincronizarRespuestas", () => ({
  SincronizarRespuestas: ({ campana }: { campana: string | null }) => {
    sincronizaciones.push(campana);
    return <i data-sincronizar={campana ?? ""} />;
  },
}));

const AQUI = dirname(fileURLToPath(import.meta.url));

const PLANTILLA: MailTemplate = {
  schema: "collection_mail_template/v2",
  template_id: "arte",
  revision: 1,
  subject: "Invitación al estudio",
  preheader: "",
  theme: { accent: "#001f60", band: "acento" },
  header: { kind: "banner", image_ref: "arte1-960" },
  images: {},
  fields: [
    { key: "enlace", tag: "ENLACE", label: "Enlace a la encuesta", sm: "SurveyLink", destino: "encuesta" },
    { key: "carrera", tag: "CARRERA", label: "Carrera", fallback: "su carrera" },
  ],
  blocks: [{ block_id: "saludo", type: "greeting", text: "Estimado(a) {{nombre}},", fallback: "Estimado(a)," }],
};

const APERTURA = "Hola **{{nombre}}**, le recordamos que puede responder *hasta el viernes* en [este enlace]({{enlace}}).\nGracias, {{carrera}}.";

const noop = () => {};

function pintar(envios: MailSend[], activo: MailSend, plataforma: "mailchimp" | "surveymonkey", onEditar: ComponentProps<typeof PanelEnvios>["onEditar"] = noop) {
  return renderToStaticMarkup(
    <PanelEnvios
      envios={envios}
      activo={activo}
      template={PLANTILLA}
      plataforma={plataforma}
      porGuardar={false}
      ocupado={false}
      exportando={false}
      onElegir={noop}
      onAgregar={noop}
      onQuitar={noop}
      onEditar={onEditar}
      onExportar={noop}
    />,
  );
}

function conRecordatorio(opening?: string) {
  const { envios, sendId } = agregarRecordatorio([{ ...mailSendInvitation(), date: "2026-10-28" }]);
  const con = opening === undefined ? envios : conApertura(envios, sendId!, opening);
  const fechada = editarEnvio(con, sendId!, { date: "2026-10-30" });
  return { envios: fechada, recordatorio: fechada[1] };
}

const apertura = () => {
  const campo = [...campos].reverse().find((c) => c.label === "Apertura");
  if (!campo) throw new Error("La apertura no se pintó con CampoConCampos");
  return campo;
};

const opcionesDe = (c: PropsDelCampo): OpcionesDeTexto => ({ enlaces: Boolean(c.enlaces), multilinea: Boolean(c.multilinea), ...c.opciones });

beforeEach(() => {
  campos.length = 0;
  sincronizaciones.length = 0;
});

describe("la apertura del envío se edita como el texto de un bloque", () => {
  it("usa CampoConCampos multilínea y con enlaces, sin textarea ni asteriscos en el ejemplo", () => {
    const { envios, recordatorio } = conRecordatorio();
    const html = pintar(envios, recordatorio, "mailchimp");
    const c = apertura();
    expect(c.multilinea).toBe(true);
    expect(c.enlaces).toBe(true);
    expect(c.formato).not.toBe(false);
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("**viernes**");
    expect(EJEMPLO_DE_APERTURA).toBe("Ej.: Le recordamos que aún puede responder hasta el viernes");
    expect(html).toContain("is-vacia");
    expect(html).toContain(EJEMPLO_DE_APERTURA);
  });

  it("ida y vuelta: el DOM del campo devuelve el mismo string del contrato (serializador del lienzo)", () => {
    const { envios, recordatorio } = conRecordatorio(APERTURA);
    const cambios: Partial<MailSend>[] = [];
    pintar(envios, recordatorio, "mailchimp", (_id, cambio) => cambios.push(cambio));
    const c = apertura();
    expect(c.valor).toBe(APERTURA);
    const opts = opcionesDe(c);
    const dom = htmlDelTexto(c.valor, opts);
    // Lo que se ve: chips, negrita y cursiva; nunca llaves ni asteriscos.
    expect(dom).toContain("data-campo=\"nombre\"");
    expect(dom).toContain("<strong>");
    expect(dom).toContain("<em>");
    expect(dom.replace(/<[^>]+>/g, "")).not.toMatch(/\*|\{\{|\}\}/);
    const vuelta = textoDelDom(domDePrueba(dom) as unknown as Node, opts);
    expect(vuelta).toBe(APERTURA);
    // Lo que vuelve del campo se guarda tal cual en `opening`.
    c.onCambio(vuelta);
    expect(cambios).toEqual([{ opening: APERTURA }]);
    // Los campos se nombran como en el lienzo.
    expect(c.opciones.rotuloDeCampo?.("nombre")).toBe("Nombre");
    expect(c.opciones.rotuloDeCampo?.("carrera")).toBe("Carrera");
    expect(c.opciones.campoValido?.("carrera")).toBe(true);
    expect(c.opciones.campoValido?.("inventado")).toBe(false);
  });

  it("una apertura de puro espacio no se repinta (editarEnvio la quita)", () => {
    const { envios, recordatorio } = conRecordatorio();
    pintar(envios, recordatorio, "mailchimp");
    expect(apertura().normalizar?.("   ")).toBe("");
    expect(apertura().normalizar?.(APERTURA)).toBe(APERTURA);
  });

  it("una apertura que pasa del largo avisa en el campo", () => {
    const { envios, recordatorio } = conRecordatorio("a".repeat(601));
    pintar(envios, recordatorio, "mailchimp");
    expect(apertura().problemas?.[0]?.detail).toContain("600");
  });
});

describe("avisosGmail sigue leyendo el opening del contrato", () => {
  it("sin apertura avisa; con la apertura escrita con formato, no", () => {
    const sin = conRecordatorio();
    expect(pintar(sin.envios, sin.recordatorio, "mailchimp")).toContain("Sin apertura, el cuerpo es idéntico");
    const con = conRecordatorio(APERTURA);
    const html = pintar(con.envios, con.recordatorio, "mailchimp");
    expect(html).not.toContain("Sin apertura, el cuerpo es idéntico");
    // El mismo string que llega a avisosDeRecordatorio es el que edita el campo.
    expect(apertura().valor).toBe(con.recordatorio.opening);
    expect(avisosDeRecordatorio("Otro asunto", "Invitación al estudio", con.recordatorio.opening)).toEqual([]);
  });

  it("el asunto igual al de la invitación sigue avisando", () => {
    const { envios, recordatorio } = conRecordatorio(APERTURA);
    expect(pintar(envios, recordatorio, "mailchimp")).toContain("El asunto es igual al de la invitación");
  });
});

describe("la fecha del envío se lee como se dice (es-PE)", () => {
  const HOY = new Date(2026, 9, 22);

  it("«viernes 30 de octubre», con el año sólo si es otro", () => {
    expect(fechaHumana("2026-10-30", HOY)).toBe("viernes 30 de octubre");
    expect(fechaHumana("2026-09-02", HOY)).toBe("miércoles 2 de septiembre");
    expect(fechaHumana("2027-01-01", HOY)).toBe("viernes 1 de enero de 2027");
    expect(fechaHumana("2026-02-30", HOY)).toBe("");
    expect(fechaHumana(undefined, HOY)).toBe("");
    expect(fechaHumana("30/10/2026", HOY)).toBe("");
  });

  it("el panel muestra la fecha humana y nunca dd/mm/aaaa", () => {
    const { envios, recordatorio } = conRecordatorio(APERTURA);
    const html = pintar(envios, recordatorio, "mailchimp");
    expect(html).toContain(fechaHumana("2026-10-30"));
    expect(html).not.toMatch(/\d{2}\/\d{2}\/\d{4}|dd\/mm/i);
    // El botón se nombra con su rótulo y su valor; el input nativo no entra al orden de foco.
    expect(html).toMatch(/<button[^>]*aria-labelledby="[^"]*-fecha [^"]*-fecha-valor"/);
    expect(html).toMatch(/<input[^>]*type="date"[^>]*tabindex="-1"[^>]*aria-hidden="true"/);
  });

  it("sin fecha, el botón invita a elegirla", () => {
    const { envios } = agregarRecordatorio([mailSendInvitation()]);
    expect(pintar(envios, envios[0], "mailchimp")).toContain("Elegir fecha");
  });
});

describe("el vacío del asunto y la vista previa dice qué sale", () => {
  it("«Si lo dejas vacío, va: «…»»", () => {
    expect(ayudaDeVacio("Invitación al estudio")).toBe("Si lo dejas vacío, va: «Invitación al estudio».");
    expect(ayudaDeVacio("")).toBe("Si lo dejas vacío, va el de la plantilla.");
    const { envios, recordatorio } = conRecordatorio(APERTURA);
    const html = pintar(envios, recordatorio, "mailchimp");
    expect(html).toContain("Si lo dejas vacío, va: «Invitación al estudio».");
    expect(html).toContain("Si lo dejas vacío, va el de la plantilla.");
    expect(html).not.toContain("Vacío: ");
  });
});

describe("SincronizarRespuestas queda como lo dejó la sincronización", () => {
  it("sólo se monta en un recordatorio de Mailchimp", () => {
    const { envios, recordatorio } = conRecordatorio(APERTURA);
    expect(pintar(envios, recordatorio, "mailchimp")).toContain("data-sincronizar");
    expect(pintar(envios, envios[0], "mailchimp")).not.toContain("data-sincronizar");
    expect(pintar(envios, recordatorio, "surveymonkey")).not.toContain("data-sincronizar");
    expect(sincronizaciones).toHaveLength(1);
  });

  it("con su key por campaña y la campaña del store", () => {
    const fuente = readFileSync(join(AQUI, "PanelEnvios.tsx"), "utf8");
    expect(fuente).toContain("const campana = useCorreosStore((s) => s.campana);");
    expect(fuente).toContain('{esRecordatorio && plataforma === "mailchimp" ? <SincronizarRespuestas key={campana ?? ""} campana={campana} /> : null}');
    expect(fuente).toContain("avisosDeRecordatorio(asuntoDe(activo), asuntoDe(invitacion), activo.opening)");
  });
});
