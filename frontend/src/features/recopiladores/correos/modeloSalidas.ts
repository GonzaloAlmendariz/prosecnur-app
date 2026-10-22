// modeloSalidas.ts — qué hace cada botón de salida y cuál es el principal.
//
// En SurveyMonkey había dos botones del mismo peso aparente —«Copiar HTML para
// SurveyMonkey» y «Paquete del envío»— y quien lo usaba por primera vez no
// sabía cuál le servía. Cada plataforma tiene UNA acción principal (lo que se
// lleva a la plataforma) y el resto son respaldos; aquí se dice en una línea
// para qué sirve cada uno. La lista vive fuera del render para que el texto se
// pruebe sin montar los paneles.

import type { MailPlatform } from "../../../api/materialMail";

export type SalidaDelEnvio = {
  /** El rótulo del botón, tal cual. */
  accion: string;
  /** Cómo se nombra en la línea de ayuda, sin repetir el rótulo entero. */
  corto: string;
  /** Para qué sirve, en una línea. */
  para: string;
  principal: boolean;
};

export const SALIDAS_DEL_ENVIO: Readonly<Record<MailPlatform, readonly SalidaDelEnvio[]>> = {
  surveymonkey: [
    { accion: "Copiar HTML para SurveyMonkey", corto: "Copiar HTML", para: "lo que pegas en el mensaje del recopilador.", principal: true },
    { accion: "Paquete del envío", corto: "Paquete", para: "un archivo de respaldo; con la lista trae los contactos con su saludo.", principal: false },
  ],
  mailchimp: [
    { accion: "Plantilla para importar en Mailchimp", corto: "Plantilla", para: "el archivo que importas en Mailchimp.", principal: true },
    { accion: "Plantilla + audiencia", corto: "Con audiencia", para: "lo mismo y la lista en CSV, con datos personales.", principal: false },
    { accion: "Copiar para Outlook", corto: "Outlook", para: "para un envío a mano.", principal: false },
  ],
};
