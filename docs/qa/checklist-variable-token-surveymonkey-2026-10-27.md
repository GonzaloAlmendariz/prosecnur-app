# Checklist · La variable del token no depende de que se llame `t` (2026-10-27)

Tipo: Checklist de pedido con varias indicaciones
Estado: En curso
Fecha: 2026-10-27
Autoridad: Pedido de Gonzalo (citado abajo); sólo él da por terminado un ítem

Pedido de Gonzalo (textual): «¿Y no se puede cambiar para que la app lea t o id de forma equitativa?» · «hazlo ahora en la app y deja todo sumamente limpio y pulcro; es más, hasta podemos hacer campañas de prueba de SurveyMonkey con los cuestionarios para ver si todo funciona bien».

Contexto: las 6 encuestas de Acreditación Institucional 2026 declaran la variable personalizada `id`; la app generaba los enlaces siempre con `?t=` y leía solo `custom_variables$t`. SurveyMonkey guarda un parámetro del enlace solo si se llama igual que una variable declarada en la encuesta: con `?t=` hacia una encuesta con `id`, el token se pierde y nadie queda como «Respondió».

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | El nombre de la variable del enlace se declara por campaña («Variable en SurveyMonkey», `t` por defecto) y los enlaces se generan con ese nombre; reimportar y regenerar lo conservan | `collection_mail_enlace.R`, `collection_mail_contactos.R`; `EnlaceDeEncuesta.tsx`, `store.ts`, `modeloContactos.ts`, `api/mailContactos.ts` | ☑ campo «Variable» junto al enlace, prellenado con la guardada; error marca solo su campo; visto a 1440 con un .pulso sintético (`id` guardada, regenerar con `t`: 12 conservados) |
| 2 | Al sincronizar, el token se reconoce por su valor, se llame `t`, `id` u otro nombre | `collection_mail_mailchimp.R` (`.mc_sync_run`, `.mc_response_token`) | ☑ test: token en `id` con campaña en `t` y encuesta con ambas se marca |
| 3 | Chequeo: al elegir la encuesta, la app dice si recibe la variable de la campaña, y la sincronización se niega con causa y arreglo si no la recibe (en vez de «0 respondieron») | `collection_mail_mailchimp.R` + ruta `GET mail-sync/check`; `SincronizarRespuestas.tsx`, `api/mailchimpSync.ts` | ☑ contra SurveyMonkey real: Egresados Pregrado, Estudiantes Pregrado y Profesores declaran `id`; con la campaña en `t` sale el aviso ámbar y «Actualizar» se bloquea; en `id`, verde y habilitado |
| 4 | Prueba de punta a punta con los cuestionarios reales de SurveyMonkey: enlaces con la variable de cada encuesta, respuesta de prueba, «quién respondió» la reconoce | encuestas de SurveyMonkey + proyecto de prueba (fuera del repo) | ☑ 2026-10-27, con OK de Gonzalo: campaña de prueba en `id` con el recopilador real de Egresados Pregrado (`/r/HR35XJ3`); «Persona 1» respondió por su enlace personal; SurveyMonkey guardó `id=XWSfJPoFHH` en la respuesta 119234263304; «solo marcar» la dejó como «Respondió» (1 de 12) y las otras 11 pendientes. Esa respuesta y la parcial 119230901830 (22/10) se borran antes del campo |

Revisión del verificador (rechazo 1, corregido): Monitoreo › Correo (`.mcm_token`) leía solo `?t=` y dejaba sin llave a una campaña en `id`; ahora toma `t` o, con otro nombre, un valor con la forma de los tokens de la app. Dos mensajes con «token»/«?t=» reescritos; la variable se prellena aparte del enlace (pegar el enlace antes de cargar la lista no la devuelve a `t`); el bloqueo del botón vive en `puedeActualizar`, con test.

Revisión del verificador (rechazo 2, corregido): con un recopilador que ya trae una `t` ajena y la campaña en `id` (`…?t=1&id=<token>`), Monitoreo tomaba «1» para todos; ahora manda el valor con la forma de los tokens de la app y la `t` solo cuenta si no hay ninguno. Fijado con un test de ese enlace en ambos lados. Queda una diferencia menor y visible: un enlace importado con `?id=` y un valor que no tiene la forma de la app se lee en «quién respondió» pero en Monitoreo cae a «sin enlace personal» (avisado, no silencioso).

Paquete reinstalado el 2026-10-27 tras el commit: el worker de «Actualizar quién respondió» ya corre el código nuevo. Comprobado con el job real (solo marcar) contra Egresados Pregrado (528820204): con la campaña en `t` devuelve `E_COLLECTION_MAIL_SYNC_VARIABLE` con causa y arreglo; en `id` termina y lee la respuesta que hay (1 parcial, sin enlace personal).

Verificador: APROBADO CON PENDIENTES sobre `56fb669b8` (3392 pass collection-mail, 328 pass monitoreo mailchimp, 1559 pass frontend, tsc limpio; mutaciones M1–M7 detectadas). Ítem 4 cerrado después (ver tabla).

Sin jerga en pantalla: la ayuda del campo no dice «token» ni «t=» (guardián de ContactosVista.test.tsx), y los mensajes del chequeo tampoco.

Gate: `make gate-area AREA=collection-mail`, `pnpm -C frontend exec tsc --noEmit`, `make gate-front AREA=recopiladores`, vista de Contactos y del paso «Quién ya respondió».
