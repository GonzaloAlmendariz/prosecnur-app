# Pendientes de Material de campo al integrar a main

Tipo: Traspaso QA
Estado: Vigente
Fecha: 2026-10-16
Autoridad: Resume el estado de la rama `feat/material-campo-e0a` al pasarla a main; el detalle por ítem vive en el [checklist](checklist-material-de-campo-2026-10-16.md) y el orden en el [plan](plan-material-de-campo-2026-10-16.md)
Referencia visual: canvas aprobado «Revamp de Material de campo», artifact privado <https://claude.ai/artifact/W7xx1vTeBZE2tkdJtQCcSy> (16 artboards: Main, Recursos, Campos, Catálogo, Editor, Componer, Imprenta, Paquetes, Correos, Unidades, Accesos, Entrega, Conexiones, Sistema, Movimiento)

Decisiones de origen: [ADR 0108](../adrs/0108-material-de-campo-catalogo-de-materiales-por-unidad.md),
[ADR 0109](../adrs/0109-material-de-campo-se-compone-e-imprime-por-tipo-de-campo.md),
[ADR 0110](../adrs/0110-material-de-campo-se-conecta-y-escribe-correos-para-mailchimp.md).

La vara de cierre de cada etapa sigue siendo la misma: **la pantalla en la app real se ve como su artboard del
canvas, con datos reales y capturas miradas, gates del área en verde y el verificador en APROBADO**.

## Qué entra a main

| # | Qué | Estado |
|---|---|---|
| E0a | Módulo `/material-campo` (reemplaza Recopiladores), migración del slug y redirecciones con query; Hojas de ruta › «Entrega» pasa a «Selección» | hecho |
| E0b | Tono Musgo `#4F752C`, ícono mochila, identidad 1.4.0 | hecho |
| — | Cinco mejoras de Unidades/Accesos/Catálogo (outline, vacíos útiles, rail en Accesos) y secciones sin numeral | hecho |
| E1a | Catálogo › Tipos con miniaturas reales y «Usar este tipo» para los tres presets | hecho (falta ver el dorso en el editor → E1b) |
| E1f | Correos para Mailchimp: editor por bloques, destinatarios solo en la sesión, revisión y ZIP (plantilla, `audiencia.csv`, imágenes, LEEME, manifest) | hecho |
| H9 | Sembrador `scripts/qa/material_campo_sembrar_plan.R`: plan real sobre hsvg2026 para QA (2.373 unidades) | hecho |
| H21–H23 | Accesos rehidrata Kobo, Paquetes cuenta las fichas guardadas, Entrega no ofrece recibos que no están en la sesión | hecho (eran defectos de main) |
| H25 | Entrega no firma un recibo vacío antes del traspaso | hecho |
| H26 | Volver a sembrar el plan conserva plantillas, cuenta lo que descarta y pide confirmar con un diálogo que previsualiza (`dry_run`) | hecho (falta el verificador sobre el diálogo y H27) |
| H27 | Accesos marca lo deducido del último chequeo y no lo reenvía como observado | hecho |
| — | `collection_state_validate` 7,25 s → 2,05 s con 2.373 unidades | hecho |

## Pendiente de construir (en orden)

| # | Qué falta | Dónde vive | Nota |
|---|---|---|---|
| V1 | Verificador sobre H26 (diálogo) y H27 (Accesos con lo deducido): construidos con gates en verde, sin gate independiente | `ConfirmarResembrado.tsx`, `AccessSection.tsx` | lo primero al retomar |
| V2 | Nota de bóveda para la pestaña Catálogo › Correos (figura «no documentada» en `docs/sistema/direcciones/material-campo.md`) | bóveda de sistema | |
| V3 | `th.rec-plan-num` («Elegibles») desborda a 1024x600 en Unidades | `PlanSection` | preexistente |
| E1e | Unidades › Origen: huella de la fuente, diferencias y «Actualizar desde la fuente» (aulas) | ADR 0110 §1, artboards Unidades y Conexiones | siguiente etapa del plan |
| E1b | Editor sobre la página real, con caras: hoy solo se edita `pages[0]` y el croquis del dorso no aparece | `MaterialsSection.tsx` | cierra también el último pendiente de E1a |
| E1d | Imprenta: carpeta numerada, imposición dúplex y dos por hoja, conteo y LEEME | artboard Imprenta | depende de E1b |
| E1c | Componer a medida con bloques parametrizados y «guardar como tipo nuevo» | artboard Componer | depende de E1b |
| E2 | `ump_territorial_v1`, `collection_state/v2`, Hojas de ruta › Selección «Preparar material de campo» | plan, Fase 2 | |
| E3 | Bloques `quota_grid`, `unit_map`, `place_checklist`, `route_instructions`; port de la ficha de manzana | plan, Fase 2 | |
| H5 | Monitoreo alerta en vez de saltar una unidad sin cuota | `monitoreo_engine.R` | se puede hacer antes de E4 |
| E4 | `fichas_cuota_v1`, hojas comunes y golden de Ser Adolescente | plan, Fase 3 | bloqueado por A9 y H5 |
| E5 | Seguimiento por ficha desde la lista de unidades | Monitoreo | opcional |

## Pendiente de verificar

- **Mailchimp real:** importar `audiencia.csv` y pegar `mailchimp_template.html` con «Code your own». Las
  condicionales `*|IF:…|*` solo se verificaron por texto.
- **Modo oscuro del correo:** existe como vista simulada en el front; no hay chequeo en la revisión.
- **Captura con scroll del panel lateral** de Correos: la franja completa de Identidad y el «Enlace personal» quedan
  bajo el pliegue (cubiertos por test, no por captura).
- **QA de Material de campo con proyectos grandes** necesita `--timeout-ms 420000`: `/state` responde en ~4–5 s con
  2.373 unidades.

## Decisiones que esperan a Gonzalo

| Decisión | Qué cambia |
|---|---|
| Sombra bajo la cabecera oscura del correo y ancho 640 px (hoy 600) | Presets de correo |
| Accesos pide «Confirmar» al reabrir antes de Vista previa/Preparar (decidido así; es una línea quitarlo para Preparar) | `AccessSection.tsx` |
| Cachear `collection_state_validate` por revisión (no aplicado: no es seguro si alguien escribe la sesión por fuera) | Rendimiento |
| ADR del modo `cuotas` de Hojas de ruta (A9) | Frena E4 |
| Proveedor del modelo (E6) y credencial de Mailchimp (E7) | E6, E7 |
| «Listo para entregar» repite el texto de abajo en Entrega (`handoffModel.ts`) | Pulido |

## Hallazgos abiertos

- **H24:** el fixture anonimizado de hsvg2026 muestra facultades y cursos como nombres de persona (trampa del
  anonimizador, no de la app).
- **H10, H12, H13:** Hojas de ruta › Selección (Reemplazos esconde 250 px; sin grupo geométrico; ventana de 173 px a
  1024). Preexistentes.
- **H17:** íconos de sección declarados que ninguna vista dibuja.
- **H18:** Musgo queda a ΔE76 18,2 del verde de éxito; ningún gate mide esa cercanía.
- `SectionPillbar` no pinta ni anuncia `done` sin numeral (componente compartido).
- `open in_place` deja una entrada duplicada en `.session_env` (preexistente).

## Cómo retomar

- Proyecto con plan para QA: `Rscript scripts/qa/material_campo_sembrar_plan.R --render png` (~3 min; deja un `.pulso` no versionado, la ruta sale por stdout).
- Gate R del área: `Rscript scripts/gate-area.R material --patron "collection|mail|material-campo-qa"`.
- Gate front: `make gate-front AREA=recopiladores`.
- QA visual: `node scripts/ui-quick-check.mjs --project <pulso> --route "/material-campo?seccion=<s>" --viewport 1440x1000 --viewport 1024x600 --require-geometry --fail-on-issues --timeout-ms 420000`, en serie y nunca en el 8787.
- A `especialista-entregables` y `revisor-metodologico` hay que darles en el encargo los invariantes de
  `dominio-prosecnur` y `entregables-oficina`, o devuelven BLOCKED.
- Un runner que arranca `launcher/launch.R` puede reinstalar `prosecnurapp` en la librería compartida si lo ve
  desactualizado; eso cambia el código que usan los jobs del backend del usuario.
