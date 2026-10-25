import { AvanceCorreoVista } from "./AvanceCorreoVista";
import { useCorreoMailchimp } from "./control/contacto/useCorreoMailchimp";

// Monitoreo › Acreditación › Avance › Correo (checklist T3, 2026-10-22).
//
// Muestra los reportes de Mailchimp del estudio cruzados con el universo de
// Monitoreo: por público, por envío y los correos inválidos. Todo lo calcula
// el backend (`/api/monitoreo/mailchimp/*`); la lectura vive en
// `useCorreoMailchimp`, que comparte con Control › Correo. El panel es el
// dueño del scroll.

export function AvanceCorreo() {
  return <AvanceCorreoVista {...useCorreoMailchimp()} />;
}

export default AvanceCorreo;
