---
name: dominio-prosecnur
description: Mapa maestro del dominio de Prosecnur - pipeline canónico de encuesta, modelo multibase, contrato del .pulso, taxonomía de estudios PULSO, valores especiales y ponderación. Cargar SIEMPRE antes de trabajar en lógica de dominio (carga, validación, codificación, analítica, monitoreo, muestra) o cuando haya dudas de "dónde vive" un concepto o "cómo se conectan" los módulos.
---

# Dominio Prosecnur

Mapa transversal del producto. La autoridad de estas reglas es repo-local:
`CLAUDE.md`, `frontend/src/lib/modules.ts`,
`frontend/src/lib/navegacion/direccion.ts`, `api/R/` y los ADR aceptados.
Si la prosa y esas fuentes divergen, corrige este skill; no inventes una tercera
variante.

## 0. Jerarquía canónica de la UI (vocabulario oficial)

El contrato `PROSECNUR_NAVIGATION_CONTRACT` es v3 y tiene cinco dimensiones,
en este orden exacto:

1. **Módulo** — homepage, ruta y tono propios.
2. **Modo** — variante opcional que reescribe el juego de secciones y la
   determina el estudio, no un click.
3. **Sección** — recorrido del módulo en su top bar.
4. **Pestaña** — subdivisión de una sección.
5. **Panel** — popover, sideover, drawer, diálogo o inspector direccionable.

`foco` identifica una entidad seleccionada y no añade un sexto nivel. UI nueva
se cuelga de una de las cinco dimensiones y no duplica la navegación de una
dimensión en otra.

Los ocho módulos vigentes son Bitácora, Cálculo de muestra, Editor de
formularios, Hojas de ruta, Recopiladores, Monitoreo, Procesamiento y
Dashboard. Enciclopedia es una utilidad global, no un noveno módulo del
proyecto. El catálogo ejecutable —slugs, rutas, modos, secciones, pestañas y
tonos— vive en `frontend/src/lib/modules.ts`; no copies otro catálogo al código
o a docs.

Una dirección serializada usa ruta para el módulo y query para el resto:

```text
/<modulo>?modo=<modo>&seccion=<seccion>&pestana=<pestana>&panel=<panel>&foco=<id>
```

Los parámetros canónicos son `modo`, `seccion`, `pestana`, `panel` y `foco`;
`pulso` es un parámetro de desarrollo ortogonal. Los nombres heredados
(`perfil`, `family`, `camino`, `ruta`, `tab`, `vista`, `view`, `stage`,
`etapa`, `mesa`, `desk`, `tipo`, `step`, `paso`, `reporte`) se aceptan solo al
parsear, por módulo. Nunca se escriben en enlaces nuevos. El parser y
serializador únicos viven en `frontend/src/lib/navegacion/direccion.ts`.

En el backend, `family` sigue siendo parte del cable R↔React y del `.pulso`;
la traducción a `modo` ocurre en el borde. Además, “familia” nombra familias de
auditoría, metodológicas y de paquete: no la uses como sinónimo nuevo de módulo
en contratos de navegación.

## 1. Pipeline canónico

**Pre-campo**: Bitácora → Cálculo de muestra → Formularios → Hojas de ruta
(territorial) / Recopiladores (despliegue y acceso) / Monitoreo.

**Post-campo**: Procesamiento recorre Carga → Validación → Codificación →
Analítica → Gráficos; Dashboard consume las salidas. La máquina de entrada se
apoya en `session.state`, pero el estado duro sigue en `api/R/session_store.R`.

Los módulos se conectan con direcciones canónicas y con estado scopeado por
base. Las rutas heredadas declaradas como redirecciones en
`frontend/src/app/App.tsx` no vuelven a ser destinos.

## 2. Modelo multibase (el concepto más transversal)

Un estudio tiene una o más bases, cada una como par instrumento+data, en
`api/R/session_store.R`. Hay bases hermanas independientes y base integrada.
`s$rp_data`/`s$rp_inst` son compatibilidad con routers aún single-base y apuntan
a la primera base: cualquier uso nuevo debe demostrar qué base necesita.

La promoción de lógica compartida entre hermanas y sus invariantes están en
`docs/arquitectura-multi-base.md`. Los motores de reporte conservan firma
single-base; `run_report_multibase()` los envuelve, prefija archivos y produce
ZIP cuando corresponde. No dupliques el motor por base.

## 3. Contrato del `.pulso` (portabilidad silenciosamente frágil)

ZIP con `manifest.json`, `state.rds` filtrado y `files/` para inputs. Autoridad:
`api/R/project_pulso.R` y ADR 0005.

- Los entregables no viajan dentro del ZIP; se exportan por separado.
- Las caches derivables se excluyen y se regeneran, salvo las excepciones
  explícitas de cartografía/reporte declaradas en el contrato de persistencia.
- Los paths absolutos se reescriben al directorio temporal de destino.
- Tokens, OAuth y credenciales viven en `api/R/secrets.R`, fuera del `.pulso`.
- Toda mutación persistible marca el proyecto dirty.

No agregues una rama a `state.rds` sin revisar save, load, anonimización y
compatibilidad con proyectos anteriores.

## 4. Taxonomía de estudios PULSO

La decisión “¿se calcula, se cubre, se cuotea o queda fuera del calculador?”
vive en `docs/tipos-estudio-2024-2026.md` y `api/inst/catalogos/`, no en una
heurística de UI. No todo estudio requiere cálculo estadístico de `n`.

Antes de tocar muestra o Monitoreo, distingue taxonomía metodológica, familia de
auditoría, modo de navegación y familia de código. Parecerse en el nombre no
los vuelve intercambiables.

## 5. Valores especiales y ponderación

- Códigos estándar: 90 No aplica/perdido · 94 NS/NR · 95 No piensa votar ·
  96 Blanco/Viciado · 97 No votó · 98 No sabe · 99 No responde. No se borran
  de la base: su presentación se condiciona a que estén presentes.
- `api/R/ponderacion_engine.R` calcula pesos de diseño, raking/IPF, trim, DEFF
  de Kish y `n_eff`. `peso` se recompone de forma determinista; no se trata
  como dato fuente persistido.
- En R los datos viajan por código. Los labels se recuperan del instrumento al
  renderizar, no se convierten en una fuente paralela dentro de atributos.

## Enrutamiento fino

- Ingesta y conectores → `integraciones-datos`.
- Trabajo pesado, progreso, cancelación o archivos → `jobs-asincronos`.
- PDF, PPT, Word, XLSX, SAV, HTML, gráficos e interactivos →
  `entregables-oficina`.
- Reglas, codificación, limpieza y ponderación → `nucleo-metodologico`.
- Auditoría de cliente, fixture anonimizado o seed sintético → `estudio-real`.

Checklist de salida: vocabulario v3 correcto; dirección serializada canónica;
estado scopeado por base; persistencia `.pulso` revisada; denominador y grano
de evidencia declarados; tests del dominio afectado ejecutados.
