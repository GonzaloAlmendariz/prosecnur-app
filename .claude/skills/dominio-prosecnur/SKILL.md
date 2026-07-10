---
name: dominio-prosecnur
description: Mapa maestro del dominio de Prosecnur - pipeline canónico de encuesta, modelo multibase, contrato del .pulso, taxonomía de estudios PULSO, valores especiales y ponderación. Cargar SIEMPRE antes de trabajar en lógica de dominio (carga, validación, codificación, analítica, monitoreo, muestra) o cuando haya dudas de "dónde vive" un concepto o "cómo se conectan" los módulos.
---

# Dominio Prosecnur

Conocimiento transversal que no se deduce rápido del código. Cinco invariantes; violarlos produce resultados que *parecen* correctos.

## 0. Jerarquía canónica de la UI (vocabulario oficial)

Tres niveles, y solo tres — definidos por el usuario como la jerarquía del producto:

1. **Familia / Módulo** — lo que aparece en el homepage del proyecto, cada uno con su paleta de color propia (Bitácora, Cálculo de muestra, Editor de formularios, Hojas de ruta, Fichas QR, Monitoreo, Procesamiento, Dashboard, Enciclopedia). Catálogo en `frontend/src/lib/modules.ts`. Al abrir un proyecto, el usuario aterriza en el homepage con las cards de avance de sus módulos activos.
2. **Sección** — dentro del módulo, en el top bar. Ej.: Procesamiento tiene las secciones Carga, Validación, Codificación, Analítica y Gráficos; Monitoreo (perfil Aulas) tiene Fuentes, Agenda, Avance, Validación y Consultas.
3. **Pestaña dinámica** — dentro de una sección, cuando aplica (varían según estado/perfil del proyecto).

Reglas derivadas: la navegación de nivel 1 vive SOLO en el homepage/rail; la de nivel 2 SOLO en el top bar del módulo (nunca duplicarla como segunda barra de pasos); UI nueva se cuelga de uno de estos tres niveles, no inventa niveles intermedios. Al hablar con el usuario, usar exactamente estas palabras: familia/módulo, sección, pestaña.

⚠️ En el **backend** la palabra "familia" significa otras cosas (familias de auditoría en `audit_projects.R`, familias metodológicas en docs/tipos-estudio, familias del paquete) — ver §4. En conversación de UI/UX, "familia" = módulo del homepage.

## 1. Pipeline canónico

**Pre-campo**: Bitácora (plan) → Cálculo de muestra → Editor XLSForm → salidas hacia Hojas de Ruta (territorial) / Recopiladores QR (aulas) / Monitoreo (todos).
**Post-campo** (meta-módulo Procesamiento, máquina de estados en `ProcesamientoEntry.tsx` sobre `session.state`): Carga (`!xlsform||!data`) → Validación (`!auditoria_run`) → Codificación (`!codif_aplicado`) → Analítica (`!analitica_prep_ok`) → Gráficos → Dashboard.
Los módulos se conectan por deep-links con query params (`?mesa=`, `?tab=`) y por `session_store.R` como bus de estado (`s$estudio`, fuentes scopeadas por base). Rutas legacy `/diseno-estudio`, `/plan-trabajo`, `/muestra` son puro `<Navigate>` — no revivirlas.

## 2. Modelo multibase (el concepto más transversal)

Un "estudio" tiene 1..N bases (par instrumento+data) en `session_store.R:83-490`. Dos modos: **bases hermanas independientes** vs **base integrada** (apilada). Back-compat: `s$rp_data`/`s$rp_inst` apuntan a la PRIMERA base para routers no migrados — si tocas uno, verifica de cuál lado está. Promoción/propagación de lógica compartida entre hermanas: `session_store.R:259-439`. Docs: `docs/arquitectura-multi-base.md`. Los motores de reporte son single-base por firma; multibase se logra envolviendo con `run_report_multibase()` (prefija `base__archivo`, ZIP si >1 base), nunca reescribiendo el motor.

## 3. Contrato del `.pulso` (portabilidad silenciosamente frágil)

ZIP con `manifest.json` + `state.rds` (env de sesión FILTRADO) + `files/` (solo INPUTS). Invariantes (`project_pulso.R:1-35`, ADRs 0002/0005):
- **Outputs/entregables NO viajan** en el zip; se exportan aparte vía `/api/fs/save-to-project`.
- **Caches derivables se excluyen** del save y se regeneran al load — EXCEPTO `monitoreo_territorial_map_cache` y `territorial_report_cache` que SÍ viajan (recomputar cruces `sf` es carísimo).
- Paths absolutos se reescriben al tempdir destino al cargar.
- **Secretos (tokens Kobo/SM) SIEMPRE fuera del `.pulso`** (`secrets.R`).
- Autosave: cualquier mutación de estado debe llamar `.mark_project_dirty()`.

## 4. Taxonomía de estudios PULSO

La decisión "¿este estudio se calcula, se cubre, se cuotea o queda fuera del calculador?" NO está en el flujo de la app: está en `docs/tipos-estudio-2024-2026.md` + catálogos `api/inst/catalogos/` (`catalogo_tipos_estudio.json`, `tabla_maestra_estudios.json`, `catalogo_metodologias.json`, presets acreditación/HSVG). Anti-patrón explícito: asumir que todo estudio requiere cálculo estadístico de n.
**Ojo con la palabra "familia"** — significa 4 cosas distintas: familias metodológicas (docs/tipos-estudio), familias de auditoría (`audit_projects.R:32-60`: territorial/acreditacion/procesamiento/telefonico), perfiles de Monitoreo (`monitoreo/profiles/registry.ts`: + aulas_universitarias), y familias de código del paquete (`familias_paquete.R`). Nunca las mezcles.

## 5. Valores especiales y ponderación

- Estándar de códigos: 90 No aplica/perdido · 94 NS/NR · 95 No piensa votar · 96 Blanco/Viciado · 97 No votó · 98 No sabe · 99 No responde. En el código, el mecanismo es `codigos_solo_si_presentes` (referencia `c(96,97,98,99)` en `reporte_frecuencias.R:794`, `reporte_codebook.R`, `analitica_multibase.R`): los códigos **no se borran de la data, se condicionan en la presentación** a que existan.
- Ponderación (`ponderacion_engine.R` → `ponderacion_compute(data, config)`): pesos de diseño (share_pob/share_muestra) + raking/IPF a mano (sin paquete `survey`) + trim + diagnósticos (DEFF de Kish, n_eff). La columna `peso` se **recomputa determinísticamente, jamás se persiste** como dato.
- En R los datos van **por código, no por label**: nada de labels en `attributes`/`names`; los labels se re-aplican solo al renderizar, desde el instrumento (fuente de verdad).

## Enrutamiento fino

Ingesta/conectores → skill `integraciones-datos` · trabajo pesado/exports → skill `jobs-asincronos` · PPT/Word/XLSX → skill `entregables-oficina` · reglas/codificación/limpieza/pesos → skill `nucleo-metodologico` · PDF → skill global `prosecnur-pdf-engine` · auditar proyecto de cliente → skill `estudio-real`.
