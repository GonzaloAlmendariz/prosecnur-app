# Checklist — Contactos de campañas de correo (2026-10-22)

Pedido de Gonzalo, textual: «me parece que la lista de contacto sí se debe guardar en el .pulso»; «sí, avanza con el
ADR y el backend y además para campañas por correo debe haber una vista que muestre los contactos y las podamos ver
como un dashboard por tipo de perfil y todo en base a variables de control que podemos seleccionar de forma
profesional»; antes: «la custom variable t aleatoria la generamos usando Claude pero la idea es que la app pueda
generarla de forma intuitiva en la lista de contactos».

Gobierna: [ADR 0112](../adrs/0112-los-contactos-de-una-campana-de-correo-viajan-en-el-pulso.md).

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | ADR que enmienda 0110: contactos en el `.pulso` | `docs/adrs/0112-…` + README | ☑ escrito |
| 2 | Contactos se guardan y restauran con el proyecto (`files/contactos/<campaña>.rds`), sin purga automática | `api/R/collection_mail_recipients.R`, `project_pulso.R` | ☐ |
| 3 | Token `t` aleatorio por persona y campo «Enlace a la encuesta» generado por la app | backend nuevo `collection_mail_enlace.R` | ☐ |
| 4 | «Actualizar quién respondió» guarda la marca por contacto | `collection_mail_mailchimp.R` | ☐ |
| 5 | Endpoints de lista (búsqueda/filtros/página) y de tablero por variables de control | backend nuevo `collection_mail_contactos.R` + router | ☐ |
| 6 | Pestaña Contactos: lista + tablero por perfil con variables de control elegibles | `frontend/src/features/recopiladores/correos/contactos/` + `modules.ts` | ☐ |
| 7 | Enlace a la encuesta en la UI (pegar enlace del recopilador, generar) | pestaña Contactos | ☐ |
| 8 | Resguardos: anonimizador vacía contactos, aviso al guardar, modo público sin rutas | `api/scripts/pulso_anonimizar.R`, barra de guardado | ☐ |
| 9 | Gates + QA visual + verificador | — | ☐ |
