# ADR 0049: Fronteras de confianza de Electron y credenciales HF

Estado: Aceptado

Implementacion: Completa

Fecha: 2026-07-30

Fecha de decision: 2026-07-30

Reemplaza: —

Extiende: [0005](0005-secretos-fuera-del-proyecto.md),
[0007](0007-integraciones-salientes-dashboard-publicable.md) y
[0008](0008-proyecto-canonico-auditoria.md)

## Contexto

El renderer de Prosecnur está aislado y sin integración Node, pero el preload
seguía exponiendo operaciones privilegiadas sin validar el frame emisor. A la
vez, la navegación aceptaba cualquier `data:` y enviaba HTTP/HTTPS arbitrario a
`shell.openExternal`; tampoco aplicaba la misma política a redirects.

La publicación de Dashboard agravaba esa frontera: un token HF guardado se
descifraba en el proceso principal y regresaba como texto al renderer. Un XSS
en la SPA podía combinar esa lectura con una apertura externa y extraer la
credencial. Cuando `safeStorage` no estaba disponible, el fallback persistía el
valor en base64, que no constituye cifrado.

El puerto CDP y DevTools también necesitan distinguir desarrollo de una
auditoría reproducible. Un flag de entorno aislado no basta si no existe el
manifest que enlaza la instancia, el proyecto y el directorio `userData`.

## Decision

1. La navegación del shell usa una política pura común para navegación,
   subframes, redirects y `window.open`. Solo se permite el origen exacto del
   renderer; una `data:` interna debe coincidir con la página pendiente y se
   consume una vez. Solo HTTPS validado puede salir al navegador del sistema.
2. Cada handler IPC valida simultáneamente el `webContents`, el frame principal
   y el origen actual del renderer. Un frame distinto no hereda confianza por
   compartir origen.
3. Un token HF guardado nunca cruza hacia React. El renderer entrega
   `session_id`, `token_id`, namespace, Space y privacidad a un broker del
   proceso principal. El broker resuelve el secreto y llama únicamente a
   `http://127.0.0.1:<puerto>/api/dashboard/publish`, sin aceptar URL, path,
   headers ni token en el payload público. Antes de usar una credencial
   persistida, un diálogo nativo confirma el destino externo.
4. Un token pegado por el usuario puede seguir viajando directamente al
   backend local durante esa acción explícita. Si se solicita recordarlo, solo
   se persiste cuando `safeStorage` ofrece cifrado real; `basic_text` en Linux
   se considera no seguro. Registros antiguos `encrypted:false` se conservan
   como metadata y exigen reautenticación, sin borrado ni migración silenciosa.
5. Los JSON sensibles se publican mediante temporal en el mismo directorio,
   `fsync` y `rename`, con directorio `0700` y archivo `0600`.
6. Producción usa CSP sin `unsafe-inline` ni `unsafe-eval` en `script-src`,
   deniega permisos web y desactiva DevTools. Las concesiones de scripts quedan
   limitadas al modo de desarrollo. `style-src 'unsafe-inline'` permanece como
   deuda separada porque retirarlo exige migrar estilos dinámicos.
7. CDP solo se activa con `PULSO_AUDIT_RUN_MANIFEST` y un `userData` distinto
   del perfil normal. La auditoría conserva así su manifest, instancia y
   perfil aislados.

## Consecuencias

Una inyección en React ya no obtiene secretos guardados ni convierte IPC en una
API privilegiada para subframes. La superficie externa queda reducida a HTTPS
y la publicación con credencial guardada tiene un único destino loopback
tipado.

En equipos sin almacén seguro el usuario debe pegar el token en cada uso. Es
una degradación explícita y recuperable, no una falsa promesa de persistencia.
Los registros base64 previos siguen visibles para permitir quitarlos o volver a
autenticarlos, pero no se descifran.

El broker mantiene compatibilidad con el endpoint R vigente; mover todas las
credenciales HF al subsistema R de Conexiones requeriría otra decisión y una
migración deliberada. La firma, notarización y updater siguen gobernados por el
[ADR 0048](0048-identidad-version-y-canales-distribucion.md).

## Cumplimiento

- `node --test desktop/tests/security.test.cjs` cubre navegación, redirects,
  IPC, CSP, CDP, backend seguro y escritura atómica.
- `node --test desktop/tests/hf-publish-broker.test.cjs` prueba endpoint,
  payload, resolución local del token, rechazo de campos arbitrarios y ausencia
  del secreto en resultado y logs.
- `pnpm -C frontend exec vitest run
  src/api/dashboardSavedTokenBoundary.contract.test.ts` impide reintroducir
  `getHfToken` o plaintext en el bridge y sus consumidores.
- `desktop/package.json` incluye los módulos de seguridad y broker en el bundle.
- `pnpm -C desktop test` y `pnpm -C frontend exec tsc -b` son gates mínimos de
  cualquier cambio posterior a esta frontera.

## Notas

La política sigue la guía de seguridad de Electron: limitar navegación y
ventanas, no pasar contenido no confiable a `shell.openExternal`, definir CSP y
validar el emisor de IPC.
