# Plan de acción: Material de campo

Tipo: Plan QA vivo
Estado: En curso
Fecha: 2026-10-16
Autoridad: Ejecuta los ADR [0108](../adrs/0108-material-de-campo-catalogo-de-materiales-por-unidad.md), [0109](../adrs/0109-material-de-campo-se-compone-e-imprime-por-tipo-de-campo.md) y [0110](../adrs/0110-material-de-campo-se-conecta-y-escribe-correos-para-mailchimp.md); el estado de cada ítem vive en el [checklist](checklist-material-de-campo-2026-10-16.md)
Referencia visual: canvas «Revamp de Material de campo» (artifact privado `W7xx1vTeBZE2tkdJtQCcSy`)

## Principio de orden

1. **Integrar antes de crecer.** La rama `feat/material-campo-e0a` lleva 14 commits y main avanzó 98 desde que se abrió.
   Cada etapa nueva sobre una rama vieja encarece el merge. Se integra lo hecho antes de abrir la siguiente fase.
2. **Primero lo que se usa hoy.** El modo aulas es el único vivo (HSVG 2026, CCSS Perfil): sus mejoras rinden de
   inmediato. Territorial y cuotas vienen después porque dependen de otros módulos y de decisiones abiertas.
3. **Cada etapa sale sola**: con su gate, su QA visual mirado por una persona y el verificador, en una rama corta que se
   integra al cerrar.
4. **Nada se construye sobre una decisión abierta.** Lo bloqueado espera su decisión; no se adelanta con supuestos.

## Fase 0 · Cerrar e integrar lo hecho

| Paso | Qué | Quién | Cierre |
|---|---|---|---|
| 0.1 | Veredicto del verificador sobre E1a | `verificador` | APROBADO |
| 0.2 | Gonzalo da por cerradas E0a, E0b, las cinco mejoras y E1a | Gonzalo | visto bueno |
| 0.3 | Decidir el orden de merge con `feat/revamp-formularios` (define quién promueve el kit a `src/components/kit`) | Gonzalo | F3 resuelto |
| 0.4 | Traer main a la rama, resolver conflictos (probable: `theme.css`, `modules.ts`, contratos de navegación) | lead + `curador-commits` | gates del área en verde tras el merge |
| 0.5 | Merge a main | lead, con autorización | main con Material de campo |

Riesgo conocido: el rojo de `readinessQueSeDeclara` por `features/carga/MapaBasesPanel.tsx` existe en main y es de otra
sesión; se avisa a esa sesión, no se arregla aquí.

## Fase 1 · Modo aulas completo (sin dependencias externas)

Orden propuesto, de mayor a menor valor inmediato:

| Etapa | Qué entrega | Depende de | Agentes | Cierre visual |
|---|---|---|---|---|
| **E1f** Correos para Mailchimp | Editor de correos con bloques, campos `*|…|*`, vistas, revisión y exportación (plantilla, audiencia, imágenes) | Fase 0 | `frontend-react` + `especialista-entregables` | Las dos plantillas reales (CCSS, UNSA) reproducidas y exportadas; importación de prueba en Mailchimp hecha por Gonzalo |
| **E1e** Unidades › Origen | Huella de la fuente, lista de diferencias y «Actualizar desde la fuente» para aulas; el aviso del otro lado en Cálculo de muestra | Fase 0 | `backend-r` + `frontend-react` | Cambio simulado en la selección se ve con sus diferencias |
| **E1b** Editor sobre la página real | El pliego que se edita es la página del compilador, con zonas por bloque y caras | E1a | `frontend-react` + `especialista-entregables` | Ficha de aula y ficha de campo editables sobre su render |
| **E1d** Imprenta | Sección nueva: carpeta numerada, imposición (dúplex, dos por hoja), pliego físico, conteo de hojas y `LEEME` | E1b | `especialista-entregables` + `frontend-react` | PNG por página de frente, dorso y corte verificados |
| **E1c** Componer a medida | Bloques parametrizados (tabla con columnas, mapa que sigue a la unidad, lista de lugares) y «guardar como tipo nuevo» | E1b | `backend-r` + `frontend-react` | Un tipo nuevo compuesto y usado en un paquete |

Transversal a la fase: **H9**, un proyecto de referencia con plan de Material de campo, para que el QA mida pantallas
con datos y no solo vacíos. Se arma al inicio de la fase con `api/scripts/pulso_anonimizar.R`.

## Fase 2 · Territorial por manzana

| Etapa | Qué entrega | Depende de | Agentes |
|---|---|---|---|
| **E2** | `field_unit/v1`, `collection_state/v2`, dos registros de adapters, Accesos solo con canal digital, `ump_territorial_v1` con la ficha de manzana y la hoja de zona como layout legacy (misma salida), «Preparar material de campo» en Hojas de ruta › Selección, reemplazos activados leídos desde Monitoreo | Fase 1 | `backend-r` + `frontend-react`; `guardian-contratos` revisa la migración |
| **E3** | Bloques `quota_grid`, `unit_map`, `place_checklist`, `route_instructions`; port de la ficha de manzana; retiro del layout legacy y de `hojas_ruta_generar_zip` (doble confirmación) | E2 | `especialista-entregables` + `revisor-metodologico` |

## Fase 3 · Territorial por cuotas (Ser Adolescente)

| Etapa | Qué entrega | Depende de |
|---|---|---|
| **A9** | ADR del modo `cuotas` de Hojas de ruta: secciones, contrato de la asignación, migración | Decisión de Gonzalo |
| **H5** | Monitoreo alerta en vez de saltar una unidad sin cuota | — (se puede hacer antes) |
| **E4** | `fichas_cuota_v1`, hojas comunes (ruteo, consolidados, consentimiento desde el modelo del formulario) y golden de Ser Adolescente | A9, H5, E3 |

## Fase 4 · Opcionales y nuevos campos

| Etapa | Qué | Bloqueo |
|---|---|---|
| E5 | Seguimiento por ficha desde la misma lista de unidades | Lo decide Monitoreo |
| E6 | Pedido de cambios en palabras | Proveedor del modelo, credencial y modo sin conexión |
| E7 | API de Mailchimp: plantilla o campaña en borrador | Credencial y autorización |
| — | Acreditación multiactor, telefónico y establecimientos como modos | Su fuente de unidades |

## Decisiones que esperan a Gonzalo

| Decisión | Frena |
|---|---|
| Cerrar E0a, E0b, cinco mejoras y E1a | Fase 0 |
| Orden de merge con Formularios (F3) | 0.4 y 0.5 |
| ADR del modo `cuotas` de Hojas de ruta (A9) | Fase 3 |
| Proveedor del modelo para E6 | E6 |
| Credencial de Mailchimp para E7 | E7 |

## Cómo se trabaja cada etapa

`/scope-lock` → contrato congelado si cruza capas → hasta dos escritores con globs disjuntos → QA visual con
`ui-quick-check` y **capturas miradas por una persona** (el QA automático no vio las miniaturas recortadas de E1a) →
`verificador` → commit por nombre → integración a main. El checklist se actualiza al cerrar cada etapa y se dibuja
entero cada vez que se menciona.
