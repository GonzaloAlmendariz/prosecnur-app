# Catálogo visual real de Prosecnur

Este directorio contiene el censo descriptivo de la interfaz existente. No
define todavía qué variante es canónica: conserva diferencias, duplicaciones y
outliers para que una sesión posterior pueda unificarlos con evidencia.

## Unidad y jerarquía

- Unidad: una ocurrencia JSX declarada en código productivo.
- Jerarquía obligatoria: `módulo → sección → pestaña`.
- Procedencia: archivo React, línea, columna, componente contenedor, import de
  origen, clases CSS y fuentes de estilo localizables.
- Cobertura: todos los `.tsx`/`.jsx` bajo `frontend/src`, excepto pruebas y
  snapshots.

Una ocurrencia dentro de un `map()` representa el patrón visual que se repite
en runtime. Los gráficos, mapas o canvas creados por librerías se registran por
su componente anfitrión y por los nodos JSX declarados en el repositorio.

## Artefactos

- `catalogo.json`: fuente auditable y consumible por herramientas.
- `catalogo-data.js`: transporte generado y comprimido con gzip para abrir el
  manual mediante `file://` sin depender de `fetch` ni duplicar el JSON en
  claro.
- `inventario-contextual.md`: índice humano de módulos, secciones, pestañas,
  familias de controles, condiciones de uso y fuentes.
- `../manual-identidad.html#catalogo-real`: vista integrada con filtros,
  jerarquía y paginación.

## Regeneración

```bash
node scripts/build-visual-catalog.mjs
node scripts/build-visual-catalog.mjs --check
node --test scripts/tests/visual-catalog.test.mjs
```

No se editan a mano `catalogo.json` ni `catalogo-data.js`.
