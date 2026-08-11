# GOAL · Gráficos crece con verdad metodológica y una UI cada vez más decidible

Tipo: GOAL finito de producto, motor y experiencia
Estado: Histórico
Fecha: 2026-08-08
Fecha de cierre: 2026-08-09
Cierre: con deuda visual/runtime documentada; el alcance no ejecutado se transfirió, no se declaró entregado
Consolidado en: [Roadmap del motor de Gráficos](roadmap-motor-graficos-2026-08-08.md)
Autoridad: sucede al goal histórico de bibliotecas; no reabre ni reescribe su evidencia

Este loop amplió el catálogo con nuevos tipos de gráfico y mejoró la UI de
Gráficos. El mandato operativo fue permanente hasta el 2026-08-09. Por
instrucción explícita de Gonzalo en esa fecha, el goal deja de ser indefinido:
se cierra el lote vigente con su deuda observable, no se abre otro recenso y
todo alcance no ejecutado se transfiere fuera de este goal sin fingir entrega.

Fuentes que gobiernan el trabajo:

- `docs/qa/goal-loop-popovers-graficos-2026-08-07.md`: antecedente histórico
  cerrado (L1–L7, V1–V8 y evidencia visual).
- `docs/qa/roadmap-motor-graficos-2026-08-08.md`: deuda y candidatos del motor.
- ADR 0063/0064: declaración y equivalencias multibase.
- ADR 0068: autoridad geométrica de layouts; sólo entra si cambia esa frontera.
- `branding/identity.json`, `branding/direccion-creativa-v3.md` y
  `docs/ui-layout-grammar.md`: identidad y gramática visual vigentes.

## Mandato histórico y límites finales

1. Un gráfico nuevo debe cerrar el recorrido motor → registry → editor → preview
   real → PPT/Word/job → pruebas. Visible no significa entregado.
2. La UI falla cerrada: requisito desconocido o insatisfecho nunca se anuncia
   como “Listo para insertar”.
3. Las decisiones metodológicas se declaran; no se deducen por conveniencia de
   render. Si falta autoridad, la decisión entra en la bandeja con recomendación
   conservadora y el loop avanza por otro lote seguro.
4. Cada iteración hace un cambio causal acotado, conserva compatibilidad de
   proyectos y termina con QA independiente y `verificador` serial.
5. `editor-v2.css` permanece congelado. CSS de una capacidad nueva nace en hoja
   propia o en la hoja dueña ya existente cuando el cambio sea estrictamente
   local a esa superficie.
6. Cada lote actualiza este ledger y produce un commit conventional en español.
7. Hasta el 2026-08-09, cerrar un lote obligaba a recensar y tomar el siguiente.
   El mandato de cierre finito revoca esa recurrencia: tras documentar el lote
   vigente, la cola y las decisiones, se ejecuta un único gate serial y se
   marca el goal completo sin abrir trabajo nuevo.
8. El distribuidor dinámico `ChartLayoutEditor` —«Mapa de espacios»— se
   conserva y entra en el loop como superficie de producto. Debe editar los
   args efectivos publicados por metadata/preset y aproximar con mayor
   fidelidad el render R, sin convertirse en un segundo motor geométrico ni
   sustituirse por coordenadas manuales. Su CSS nuevo vive en hoja propia.

## La vara G1–G8

1. **G1 · Utilidad antes que variedad.** Cada tipo responde una pregunta que el
   catálogo no resuelve con igual claridad; no se aceptan duplicados decorativos.
2. **G2 · Verdad del contrato.** Nombre, forma, requisitos, defaults, presets y
   disponibilidad derivan de una fuente canónica y coinciden en todos los
   consumidores.
3. **G3 · Autoría completa.** Todo tipo insertable puede construirse desde la UI
   sin JSON manual; si sólo nace de un generador, se declara y se encamina allí.
4. **G4 · Método explícito.** Unidad, denominador, población, ponderación,
   intervalo y comparación quedan declarados y probados cuando apliquen.
5. **G5 · Decidibilidad de la UI.** La miniatura explica la forma; la descripción
   explica cuándo usarla; el estado explica qué falta y ofrece un próximo paso.
6. **G6 · Paridad de salida.** Preview real, PPT, Word y jobs consumen el mismo
   elemento; una ruta genérica sin prueba vertical no acredita paridad.
7. **G7 · Compatibilidad y propiedad.** Altas aditivas no mutan `.pulso` ni
   cambian la autoridad de equivalencias/layouts sin decisión o ADR explícito.
8. **G8 · Evidencia observable.** Antes/después en 1440×1000 y 1024×600,
   proyecto canónico y panel abierto; tests de contrato, composición y export;
   verde significa conformidad literal, no ausencia de errores.

La gramática visual heredada V1–V8 y las cláusulas C1–C5 del Contrato de
Superficie siguen siendo obligatorias. El acento Processing sólo pertenece al
chrome; nunca codifica series de datos.

## Censo C0 · 2026-08-08

| Superficie | Estado medido | Brecha que abre el loop |
|---|---|---|
| Catálogo | 23 graficadores, 6 familias; 20 layouts | La ola 4 agregó cuatro tipos sin cerrar todo su recorrido de autoría/contrato |
| Dumbbell y Serie temporal | Motores y constructores presentes | Exigen `vars` nombradas pero el picker genérico crea `args={}` y las anuncia listas |
| Preview | Render real por PPT | El preflight sólo reconoce `var/vars` y bloquea falsamente territorio/dimensiones |
| Presets | Backend declara 23 familias aplicables/expresas | El mapa TS omite categóricas, nube, histograma y los cuatro tipos nuevos |
| Iconos | Blueprints de 23 | El icono compacto degrada cuatro tipos nuevos y varios IDs Lucide a fallback |
| Contrato frontend | Histórico 20 slides / 19 graficadores | No existe un censo sucesor que gobierne los 23 actuales |
| Export | Routing genérico por `.graf_names()` | La ola 4 no tiene gate vertical por tipo y el test no exige export público real |
| UI real | V1/V4/V5/V6/V7/V8 conformes | En `acnur_acg` monobase, Dumbbell/Serie dicen “Listo para insertar” (G2/G3/G5) |

Baseline reproducible:

- HEAD inicial: `b290a2a3`.
- Frontend: typecheck verde; 42 archivos / 250 tests verdes.
- R focal: 787 expectativas, cero fallos.
- BEFORE: acta externa de sesión `D1-BEFORE-AUDIT.md`, SHA-256
  `713e1ddcb3498f622588c4ac450f08fcc9f60f58e5d792120333f16abcfea844`.
- AFTER candidato de G2-L0: acta externa de sesión
  `G2-L0-QA-AFTER.md`, SHA-256
  `6d42d227e768b294ddef3c3057e776f5fa14aa8a2232dcd07d3640ed6149047f`
  y probe funcional final SHA-256
  `78704d34713f383be160d2c1dad6d4a1aa8799e692023b653037183fbab4fcdd`.
  Addendum post-shim SHA-256
  `ee0fc6adabc13ac8619ec40acee490e8a0afce7b9ed3d64a41f879aa23a6cc81`
  y reporte dual-view SHA-256
  `47d060301117b224a19d47e77139fa7d6550563d1d99b16879015db8b0e7d807`.
- BEFORE causal de G2-L0.1: acta externa `G2-L0.1-QA-BEFORE.md`,
  SHA-256 `efa69d15da0401e45153878607b09a44b9fbb5282c996fc380ec6bd952e26c8b`,
  y reporte dirigido SHA-256
  `38472e8f03d999b44a47a561e49899086d27e26bbf2491312c61271a51e98427`.
- AFTER causal de G2-L0.1: acta externa `G2-L0.1-QA-AFTER.md`,
  SHA-256 `f69b58784affe92741cc4d5e2a67846792bc6cf112fc0cb43c368f370c7fdb2a`,
  reporte dirigido SHA-256
  `c3de5d9de01c6774efc9dd34bfbefc952dd69160d133c3564c9b7fece7b286a7`
  y manifiesto de las 24 capturas SHA-256
  `efd23f003c4f41a6c8703b5647bbd0212742dd47e1b5048add2e1e3c35432a4d`.
- Scope lock de G2-L1: `prosecnur-graficos-g2-l1-scope-lock.md`, SHA-256
  `8e9afbcd87075d616ac0960dcfcddafa32060529d84cd2d37b2531e9081daa46`.
- Scope lock del copy de familia de G2-L1:
  `prosecnur-graficos-g2-l1-family-copy-scope-lock.md`, SHA-256
  `2ec76bb9df0fb5287eae15306c0cbd458c9fa0d02691bec9aac562b60c02cf4b`.
- BEFORE de G2-L1: acta externa `G2-L1-QA-BEFORE.md`, SHA-256
  `d821de4b82ba70263ba4d3b4cb97d396cbb6d30563d3fe4d6a4fd15b4df1467e`;
  evidencia estructurada SHA-256
  `6ed428ea22870efc0b7b9b6afa6fe05cafe90cd145284ce940d0fb1bf5e47bf5`,
  reporte del runner SHA-256
  `60ff022e148251feff7b568b4f9178ffd5a02e8a55111696873f1aea783461ea`
  y manifiesto de cuatro capturas SHA-256
  `7d76e5a2fbdf91894281c951675755ec2d142210f0dfd8e63a8efbbe6ad20657`.
- AFTER de G2-L1: acta externa `G2-L1-QA-AFTER.md`, SHA-256
  `88fc923256390871d3265d311f44e0880b8599b9b057d9a09676ca593c6b84e0`;
  reporte del runner dual-view SHA-256
  `b4e7a31fc06152ca49e03e89cd3b3c36da86ef6fa9b4dbe342bb4ca4efef9a35`,
  flujo real de autoría y preview SHA-256
  `56d6a3e4eb914d563be18a2b2b0e3015f0640713c0db23bbea4c8a02c5201bfa`,
  inventario dirigido SHA-256
  `0905bce67de39cf46fda10282bc01666f3ec4ab4654ac98246fe63ecd206e375`
  y manifiesto íntegro SHA-256
  `368fc2cc5c91bc26ba50cb4c83c8b2a324c27f7b250757bdb421e583a70286ab`.
- Scope lock de G2-L1.5: `prosecnur-graficos-g2-l1-5-scope-lock.md`,
  SHA-256 `3c6021aaed4b91052ae2b59124f19b1d7cf6ef25d0d9b3a731ddd31bc798beee`.
- Dirección congelada de G2-L1.5:
  `prosecnur-graficos-g2-l1-5-direction.md`, SHA-256
  `1d4c01501ee5c5da76821cdb0580d1b5aa056cb22e859e18c5cd197b4d782997`.
- BEFORE de G2-L1.5: acta externa `G2-L1.5-QA-BEFORE.md`, SHA-256
  `77d52677b730a9aaf2cb8746c09ac9a39d106d4cea30382a5be8dcf9ae81bd2e`;
  evidencia estructurada SHA-256
  `0c490b65072e6ee55648b7005888e3f86fd90e4a738e76f5d72ee249ff6a8eaf`,
  reporte bruto SHA-256
  `c041a4585c4c7c8315df4642864c09e038e8f537a575d871d5cc69e2ba7e7499`
  y manifiesto de 21 artefactos SHA-256
  `b9c3a31930ac97354fec13c2ba98439a0be7b57620b7ab7d91a8a34928ba2c05`.
- AFTER r1 de G2-L1.5a, rechazado: acta externa
  `G2-L1.5a-QA-AFTER.md`, SHA-256
  `036c391f5194c81c4cbf3eb167689094d3e287005e2284f11e45247198e4fd46`;
  evidencia estructurada SHA-256
  `e45656e773ab98a393d3f337e25db5cb96f1cbc60fa47cb1800dc0a2a920894f`,
  reporte SHA-256
  `0997892c9c7fd6521217e6a3ae6cc5c5e6c113bb14451820f838e5ac29add966`
  y manifiesto 49/49 SHA-256
  `cd79d3d7b3422c160bf2b094a8a2aa5d4271c6099adaf116929258864374450d`.
- AFTER r2 de G2-L1.5a, rechazado dirigido: acta externa
  `G2-L1.5a-QA-AFTER-r2.md`, SHA-256
  `4d28b3ae7f21ac624291877ec9a0e723912dd902fa0711844beea06eef902f87`;
  evidencia estructurada SHA-256
  `c4276a92f2fa2e8455bc7914d0f5f26d7f6e656c77b4b2454f0f6c660d683d37`,
  reporte SHA-256
  `168d2e46303a8575cfe265f23783daf42e0baf9231f0f637dfb732b0f2d79429`
  y manifiesto 50/50 SHA-256
  `604b9ae6f6004808ebc3de707654c4dae4b5eb861c85fd00ede8a3641bf14c17`.
- AFTER r3 de G2-L1.5a, aprobado por QA pero rechazado por el gate serial:
  acta externa
  `G2-L1.5a-QA-AFTER-r3.md`, SHA-256
  `5e75061860be221858d0dc4b5e3c984ed0f3d84d1010a099779304e91430152b`;
  evidencia estructurada SHA-256
  `86e6700a63957917caf42cbcb331850323fcc50b000338429d45f15e92ab8ba7`,
  reporte SHA-256
  `614b246f1a1ce1ab4e68d2a120dee66014459517c9bdb32401b57e7f40d4bacd`,
  runner SHA-256
  `8a12eca0c093a68560338f310d147157f5ad47cff467620ff30372ab1e900811`
  y manifiesto 49/49 SHA-256
  `d2475fa02bba59f852d47d10818b86d69b6915c4b42a1cda831b531c9f2b5c31`.
- AFTER r4 de G2-L1.5a, aprobado por QA pero rechazado por el gate serial: acta
  externa `acta-qa-g2-l1-5a-after-r4.md`, SHA-256
  `cbdc2773c43d32b090cef8d71b4bbee4fb20e72a3236aa5cd3e41273e77f7453`;
  resumen estructurado SHA-256
  `5601cb69826e00fe54445d450cf94e1bd00f8110fb47ae686aa4412e4c672064`,
  reporte bruto SHA-256
  `468b755dfa528b366a9c7275e9f3935ff27592a0913c64c2b6d78b40602f82bc`,
  runner dual estricto SHA-256
  `cb1844ea76b0fffebb2c3bb8bd4e5eade24274636ff187ebf819879ae284ea52`
  y manifiesto 53/53 SHA-256
  `70520b0ffc8de42f3c96484cab51d383d8d49598abd5f0709d0dc7a60677685a`.
- AFTER r5 de G2-L1.5a, aprobado por QA y por el gate serial: acta
  externa `acta-qa-g2-l1-5a-after-r5.md`, SHA-256
  `fc8d83890ad7e38a0cb12d7bad23f3007cf82de8c27d6603a812b4ed075ad240`;
  resumen estructurado SHA-256
  `ee5efd7874420c06abc0a20b44c845402de574fda8150ad06a123af9ec81e547`,
  reporte bruto SHA-256
  `4e9098209d85b6231c385498f83a856169d1274bb897bc9f1b4f3a11e0c2e714`,
  runner de contención SHA-256
  `d22ebc8021317e7e3bee2c8f1eed741375df6b06192bc6e3148ca012156d9ef5`
  y manifiesto 53/53 SHA-256
  `47f791c6cf65a4b9a725179e4de1bff39a87298dbfe24bc0df7e06668b337f60`.
- Scope lock de G2-L1.5b:
  `prosecnur-graficos-g2-l1-5b-scope-lock.md`, SHA-256
  `b22acb9e5493a8fc6c71d1936c773ba689ae5c3a4296c53eef689e0becfdcd83`.
- Dirección congelada de G2-L1.5b:
  `prosecnur-graficos-g2-l1-5b-direction.md`, SHA-256
  `cb3c28ce1fcd06f5340d2fef0ce7d514e072af8e64d44b511b323d18175d760a`.
- BEFORE de G2-L1.5b: acta externa `G2-L1.5b-QA-BEFORE.md`, SHA-256
  `9b7450d5a8f9ffcab1deafe7fc467e046682faf59470d38c361e4ec46a1f338c`;
  reporte bruto SHA-256
  `b0d6214cd8494143d02883a719101448fdeecf694609b15b4a7ba4be578d1206`,
  evidencia estructurada SHA-256
  `86ae7ad9ad6aa28f682821e4c5db9d97c5874ddfbaf523ed23a986539350a7e7`,
  runner SHA-256
  `be7d43a2336663ad7b583ea223d0fae2071a79e7d55d6363f85d009f02c0c2b5`
  y manifiesto 32/32 SHA-256
  `be11703784f7c70001dc7b37f6b2ff56508de6b08b2d6632f3eecaabd33b4ca9`.
- Scope lock de la micro-iteración legacy G2-L1.5b r2:
  `prosecnur-g2-l1-5b-r2-scope-lock.md`, SHA-256
  `8938852086d29385e13da5f2c863c7cf26d385cc0de51d875ee3009e8a2f2775`;
  contrato congelado `prosecnur-g2-l1-5b-r2-contract.md`, SHA-256
  `c5aead40fecda20a8cb72d7534ae35856d73e201d535110d042c5c73056bae45`.
- Scope lock de G2-L1.5b r3:
  `prosecnur-g2-l1-5b-r3-scope-lock.md`, SHA-256
  `45fa52107a67430b81ddc6036f25a6b0208f07b61757a2411f06810e3801b315`;
  contrato congelado `prosecnur-g2-l1-5b-r3-contract.md`, SHA-256
  `07898eb640edb33efb61014fbd774dcf24d872f5e98bcaa2d98958db817c5b36`.
- Scope lock de G2-L1.5b r4:
  `prosecnur-g2-l1-5b-r4-scope-lock.md`, SHA-256
  `aa209f352138fc2b1f5295f2eec1d3ea74adae4e3da19dc534c3539645990ddf`;
  contrato congelado `prosecnur-g2-l1-5b-r4-contract.md`, SHA-256
  `0700d34936582cf96feddb04be9615632b1f0ea044a71c8b9b0a8875ae6f0fcc`.
- AFTER r1 de G2-L1.5b, rechazado: acta externa
  `G2-L1.5b-QA-AFTER-r1.md`, SHA-256
  `e198f4424cb17edabdb09f0ae3a4b11752defeac806445e8e028d4235ce51a76`;
  reporte bruto SHA-256
  `6e4d436411dac4a07490c99026563cc04e08576515a311c76e47a3095e0df5ae`,
  evidencia estructurada SHA-256
  `afda11fd507b5510a0a6e79fad14318060ac3c404f2049a028214c5b53cdf04e`,
  runner SHA-256
  `3e9f965775a9204c0ed1d603b8721aebb1a1b3c2accfe09280b98aedac580d84`
  y manifiesto 17/17 SHA-256
  `4690f99f9fef76e334eb6e1c488039a1aa4ec63f048fc85816578f09df5322d2`.
- AFTER r2 de G2-L1.5b, rechazado: acta externa
  `G2-L1.5b-QA-AFTER-r2.md`, SHA-256
  `a7e07a0bfb8765ab68f9777a0cfc9106361791f51d83e4bdfbd5312b021b6310`;
  reporte bruto SHA-256
  `684ac3b22c71e8887bbd7df2879b7ad4620d69aa4c6529e5cc4616396d5000fe`,
  evidencia estructurada SHA-256
  `fed0e266cae9c8c945b6084eb3f1061a7e774d055628bdfaaf9b159562fc9121`,
  runner SHA-256
  `000a17a4acb38a3cb559f0b48216f655fca9a5f6f59763bfcbffaaa6a4ac432d`
  y manifiesto 51/51 SHA-256
  `5a303f3bd6ea4391aee59471e1d710aec9d134eda5357d9b9f5c29232e5f9a2f`.
- AFTER r3 de G2-L1.5b, rechazado: acta externa
  `G2-L1.5b-QA-AFTER-r3.md`, SHA-256
  `5092a773f7db94b1abbe4277a1c5726ebe3fc3aa6bbaae4b8e3361985395f0b7`;
  reporte bruto SHA-256
  `7bfd5eebfd540abd72b340646fb74945b07caeab2646438afe94a7994e27feb5`,
  evidencia estructurada SHA-256
  `4f37c07461324a1678e3d3d3c2e3b0f67d662a70b501782222099cebfb8dab3b`,
  runner SHA-256
  `9201cfe4a90d7b2fc04dab025fd81cbeddbcf53bac24ec27e8f7de4790d6e30b`
  y manifiesto 52/52 SHA-256
  `c5f75a7e7f541646c82ef4c5378f84c5267d1cc4d034e30a615508dc80cf3bff`.
- AFTER r4 de G2-L1.5b, aprobado por QA y por el gate serial: acta
  externa `G2-L1.5b-QA-AFTER-r4.md`, SHA-256
  `bff01633dc751e2e86047ac590ac74511d2e5100f8e7ee16f714088cba903db4`;
  reporte bruto SHA-256
  `3f04e4240565d36de3a40e4523211210f5a2e02f9099d18a587e3b40f6decc1b`,
  evidencia estructurada SHA-256
  `f2c7bd99f394e00d1942fd31f019d7be2d38c0314a39572a1b91c214a8d9af22`,
  runner SHA-256
  `2e2f1d3c36f3199ee671cde435a50e289e486978b639bb53b20beb5e06eec980`
  y manifiesto 54/54 SHA-256
  `13160a3248e8e1ec7985a3e1890a26a15c775109e02cd9488563546413a05974`.
- Dirección congelada de G2-L1.5c:
  `prosecnur-g2-l1-5c-direction.md`, SHA-256
  `73ea19dfffac568498a1a4e996f921b06813b579d3d35a792d1c079193e2b74f`.
- Scope lock de G2-L1.5c:
  `prosecnur-g2-l1-5c-scope-lock.md`, SHA-256
  `d4957eeb9634b7d233f5fb905336560b65f194ae92b8cc59a1d5e00ce159f52a`.
- BEFORE de G2-L1.5c: acta externa `G2-L1.5c-QA-BEFORE.md`, SHA-256
  `1f1763e708a0950759928bd384685a84676c9f5f0af98c74395098af4ebe017f`;
  reporte bruto SHA-256
  `37c6b3ecaf21db881feee11ee881602d3b93e01f489a88bd07404e8c5a8c7805`,
  evidencia estructurada SHA-256
  `9ef37f1f22cd043e8287377f2e2cec877ed169532b8faae845946ad1990305b3`,
  runner SHA-256
  `972408c1bf6ec450d785c683a676c41a683f44dbdabab39cd5ed63c037bfc329`
  y manifiesto 24/24 SHA-256
  `4a048a66f97aa279097f9b79db795cc7268513ba560c1b3f4e412f3d2e943a2d`.
- AFTER intentado de G2-L1.5c, bloqueado antes de montar React: reporte bruto
  SHA-256 `d0e3102c6c20ec0812b48a6b88646fdfeba1578abc7424202f70c9252dfa5ee8`,
  evidencia estructurada SHA-256
  `14e1dad8403bbbcc841949648ae8ae4c5872347c349091d0d13ff7f5c7265a54`,
  runner SHA-256
  `181d1e88bd2ac05ab337c042dae23b1a948ab4fbdd36ca8694f781b9cae2aeb4`
  y manifiesto 20/20 SHA-256
  `16dce23712d67d20155445d5f9b772e5644d7313a4cc29e2f8b9202dda120997`.

## Cola final de lotes

| Lote | Alcance | Vara | Estado |
|---|---|---|---|
| **G2-L0 · Verdad operativa post-ola 4** | Contrato machine-readable, fail-closed de autoría/capacidad, preview por requisito real, args/aliases, presets, iconos y censo 20/23 | G2, G3, G5–G8 | **cerrado · I0–I4 · `feat(graficos): cerrar contrato operativo del catálogo`** |
| **G2-L0.1 · Guardas metodológicas de la ola 4** | Verificar y cerrar escala común de divergentes, elegibilidad/denominador de lollipop, firma/peso de Dumbbell y orden temporal acreditado | G2–G4, G6–G8 | **cerrado · I5–I11 · `fix(graficos): cerrar guardas metodológicas de la ola 4`** |
| **G2-L1 · Puntos comparativos v1** | Una base, indicadores/códigos declarados por grupo, punto + N, sin línea/IC/significancia ni selección múltiple | G1–G8 | **cerrado · I12–I17 · `feat(graficos): incorporar puntos comparativos`** |
| **G2-L1.5 · Distribuidor dinámico profesional** | Preservar `ChartLayoutEditor`/«Mapa de espacios»; recenso de familias, unidades, ratios, mínimos, densidad, fidelidad control→render R/PPT y acabado visual | G2, G5–G8 | **cerrado con deuda · I18–I63 · G2-L1.5a/b cerrados; G2-L1.5c conforme en estático y AFTER bloqueado; d/e diferidos** |
| **G2-L1.5a · Bases dimensionales** | Clasificar particiones, pulgadas fijas/internas/por fila; prohibir pares y porcentajes falsos; C1 + contención compacta en hoja propia | G2, G5–G8 | **cerrado · I28 · `fix(graficos): respetar bases del distribuidor`** |
| **G2-L1.5b · Procedencia explícita** | Consumidores declaran Base PPT / estilo guardado / ajuste del gráfico; no inferir desde heredados ni por igualdad de valores | G2, G5, G7–G8 | **cerrado · I29–I49 · `fix(graficos): declarar procedencia del distribuidor`** |
| **G2-L1.5c · Interacción accesible** | Un handle por límite; teclado, foco, `aria-live` y Escape local | G5, G8 | **cerrado técnicamente con deuda · I50–I63 · guardianía r3 COMPATIBLE; AFTER real no acreditado por bloqueo de runtime** |
| **G2-L1.5d · Radar, pie y defaults efectivos** | Roles y unidades completos, tabla condicional, bandas/márgenes, panel fijo y fallback sin inventar | G2, G5–G8 | **diferido fuera del goal cerrado · requiere contrato metadata propio y nuevo mandato** |
| **G2-L1.5e · Linaje durable de estilo** | Conservar id + snapshot de nombre y procedencia por campo al aplicar un estilo, con lectura legacy fail-closed | G2, G7–G8 | **diferido fuera del goal cerrado · requiere ADR 0070, contrato nuevo y nuevo mandato** |
| **G2-L2 · Heatmap de cruce v1** | `select_one × select_one`, normalización por columna, N visible y S/D para base cero | G1–G8 | **diferido fuera del goal cerrado · no implementado** |
| **G2-L3 · Respuesta múltiple con denominador declarado** | Casos/menciones visibles, elección explícita y guard de grano | G1–G8 | **diferido fuera del goal cerrado · D3 no ratificada** |
| **G2-L4 · Intervalos de confianza** | Congelar varianza, ponderación y diseño; motor + editor + salida vertical | G1–G8 | **diferido fuera del goal cerrado · bloqueo metodológico D2** |
| **G2-L5 · Coroplético de resultados** | Marco geográfico, datos territoriales reales y verificación visual | G1–G8 | **diferido fuera del goal cerrado · falta fixture territorial real** |
| **G2-L6 · Deuda visual/motor** | Recenso A4/A5, el «1 error» heredado del onboarding con 0 slides y nuevas fricciones de UI; un defecto causal por iteración | G2, G5–G8 | **diferido fuera del goal cerrado · no ejecutado** |
| **G2-LR · Recenso recurrente** | Repetir catálogo→motor→UI→outputs, elevar vara y añadir lotes | G1–G8 | **cancelado por revocación expresa del mandato indefinido** |

## Gate por lote

- Scope lock y dirección/contrato congelados antes de escribir producto.
- Ownership exacto, máximo dos writers, sin globs solapados.
- Baseline focal antes y después; `git diff --check`.
- Contrato React↔R y compatibilidad revisados independientemente.
- Si cambia lo que el gráfico afirma: revisión metodológica independiente.
- QA real BEFORE/AFTER a 1440×1000 y 1024×600, mismo proyecto y estado.
- `verificador` serial después de integrar las revisiones.
- Ledger + registro de iteración actualizados y commit conventional en español.

## Ledger de cobertura

| Criterio | Evidencia acumulada | Estado |
|---|---|---|
| G1 utilidad | Dictamen G2-D1: puntos comparativos descriptivos primero; heatmap de cruce segundo | verde para cola L1–L2 |
| G2 contrato | Registry 24/24 publica `var_cruces_corte`; constructor, preset y fail-closed React↔R reauditorados. El distribuidor clasifica cada medida por base/unidad/eje y sólo comparte una partición publicada; guardián r2 P0/P1/P2 = 0 | verde |
| G3 autoría | Autoría real desde slot: indicador, grupo y corte; vacío y duplicado bloqueados, combinación válida restituida en ambos viewports | verde |
| G4 método | D9 acreditada: porcentaje ponderado, `n` crudo, peso/filtros, exclusiones, escala, orden, 2–12 grupos y denominador cero fail-closed | verde |
| G5 UI | Tipo 24 abre Comparación. El distribuidor separa reparto publicado de roles intrínsecos, conserva pointer/reset 3/3 y C1; r5 mantiene Medidas exactas legible y contiene 38/32 labels dentro de frame/panel. G2-L1.5c añade separador único, teclado, status y cancelación con guardianía compatible; su AFTER no llegó a montar React | verde acumulado hasta I49 · G2-L1.5c conforme en estático con deuda visual declarada |
| G6 salida | El mismo elemento atraviesa reconstrucción, PPTX/DOCX, jobs y preview PPT real 200 a 1440×1000 y 1024×600 | verde |
| G7 compatibilidad | Alta aditiva, firmas/defaults posicionales idénticos a HEAD; sin bump `.pulso`, ADR ni dispatcher. `editor-v2.css` y `reporte_plan_ppt.R` conservan sus hashes; CSS nuevo vive en hoja propia | verde |
| G8 evidencia | La evidencia acumulada hasta G2-L1.5b permanece íntegra. G2-L1.5c tiene BEFORE 24/24, tres rondas RED→GREEN, guardianía r3 compatible y AFTER bloqueado sellado 20/20 antes de montar React; no se afirma conformidad visual AFTER | cierre con deuda observable · I61–I63 |

## Registro de iteraciones

- **I0 · 2026-08-08 · Arranque y G2-L0** — Se preservó el goal histórico como
  cerrado y se constituyó este sucesor. Tres carriles read-only censaron catálogo,
  contratos y UI real. Primer causal: el registry mezcla requisito técnico con
  prosa y permite insertar dos constructores que necesitan `vars` nombradas que
  el editor no puede producir. Dirección congelada: «Instrumento sereno»,
  geometría estable, explicación honesta y sin color de marca dentro de los
  datos. El scope lock de sesión se identifica como
  `prosecnur-graficos-g2-l0-scope-lock.md`. La revisión metodológica
  independiente fijó el orden seguro `p_puntos_comparativos` descriptivo →
  `p_heatmap_cruce`; ambos conservan numerador, denominador, peso y grano, y
  excluyen inferencia/SM en v1. El mismo dictamen abrió G2-L0.1: antes del tipo
  24 hay que acreditar que la ola 4 actual no mezcla escalas, pesos, temporalidad
  ni normalización de menciones bajo una apariencia descriptiva.

- **I1 · 2026-08-08 · Contrato operativo 20/23** — El registry R agregó de
  forma aditiva `capability_key`, `requirement_label`, `authoring_mode`,
  `data_requirement` y `preset_key`; el wire se normaliza como `unknown` y el
  frontend falla cerrado. Dumbbell y Serie temporal quedaron
  `generated + named_vars`; dimensiones y territorio dejaron de heredar el
  falso requisito `var`. El preset del registry gobierna formulario, slot,
  preview y panel de estilo; el mapa TS queda como fallback. Se promovieron los
  controles antes descartados de divergentes, lollipop y serie; los aliases de
  umbral se normalizan antes del whitelist. El censo sucesor fija 20 slides / 23
  graficadores y ocho iconos/blueprints dejan de degradar a fallback.

- **I2 · 2026-08-08 · Rechazo causal y reparación metodológica** — La primera
  revisión rechazó el lote: excluir «Negativa» reindexaba Neutral como negativa,
  una ref vaciada podía omitirse y el copy prometía una matriz/generador que no
  existe. Las regresiones fallaron antes de la reparación. El plan ahora fija la
  escala original antes de excluir, valida escala común y ambos lados por ref,
  recalcula el denominador después del filtro y pasa un `reparto` semántico
  aditivo al motor. Frecuencia ausente y vaciado son errores distintos que
  nombran la ref. El contraejemplo conserva Neutral y acredita saldo `+37.5 pp`.
  Registry, picker y preflight dicen literalmente que se requiere un plan
  compatible preexistente y que la biblioteca aún no puede crearlo/completarlo.
  La segunda revisión metodológica aprobó: P0=0, P1=0; las deudas restantes
  siguen acotadas a G2-L0.1.

- **I3 · 2026-08-08 · Compatibilidad y candidato de cierre** — El guardián de
  contratos encontró un P1 adicional: tres formals nuevos se habían intercalado
  en constructores exportados. Se movieron a la cola y se añadieron llamadas
  posicionales reales; el recheck acredita `PREFIX_NAMES=TRUE` y
  `PREFIX_DEFAULTS=TRUE`, P0=0/P1=0/P2=0. La curación pre-commit detectó que los
  iconos nuevos evitaban el shim obligatorio; una regresión falló 1/7 antes de
  mover los cuatro exports a `src/vendor/lucide-react.ts`. El registry ya tiene
  una sola fuente vendor y los ocho IDs conservan su SVG. Gate integrado:
  frontend typecheck 0 y 43 archivos / 274 tests; R focal 1,349 expectativas
  verdes (747 metadata, 88
  ola 4, 54 serie y 460 argumentos UI). Las tres advertencias tidyselect de
  argumentos UI y las advertencias de fuente Arial en composición nacen en
  líneas históricas no tocadas. QA AFTER independiente: 8 PASS / 0 FAIL / 0
  DEBT / 0 INVALID, 0 errores de consola/página/API/recurso y 0 requests
  fallidos en 1440×1000 y 1024×600. El addendum post-shim acredita 16/16
  firmas SVG idénticas, los dos estados fail-closed y cero errores en ambos
  viewports. Actas y probes: hashes registrados en C0.
  `editor-v2.css` permanece intacto, SHA-256
  `aed5548e28d8008d8458d51f409487d7b4892d35daa4223492193130daf6bb7f`.
  El primer gate serial rechazó exclusivamente la gobernanza del ledger nuevo;
  el producto, el contrato y la evidencia visual permanecieron verdes.

- **I4 · 2026-08-08 · Gobernanza documental y cierre de G2-L0** — El rechazo
  documental se reparó por causal: `docs/README.md` enlaza el ledger; la cabecera
  usa `Estado: En curso` y `Fecha: 2026-08-08`; la evidencia vigente conserva
  nombres lógicos y SHA-256 sin rutas efímeras. El gate documental pasó de 13 a
  10 errores: `CANDIDATE_ERRORS=0`; nueve pertenecen a archivos tracked intactos
  respecto a HEAD y uno al prompt untracked explícitamente excluido. El
  `verificador` repitió el gate desde cero y emitió **APPROVED, P0=0/P1=0**:
  `git diff --check` 0, typecheck 0, Gráficos 43/43 archivos y 274/274 tests,
  contrato/iconos 19/19, R focal 105 tests y 1.349 expectativas, cuatro probes
  `jq -e` verdaderos y QA 16/16 en ambos viewports. G2-L0 queda cerrado con el
  commit conventional registrado en la cola; el goal continúa en G2-L0.1.

- **I5 · 2026-08-08 · Censo causal y contrato de G2-L0.1** — Tres revisiones
  read-only separaron método y superficie de export. El baseline focal seguía
  verde, pero contraejemplos literales demostraron tres falsos verdes: un 90 %
  ponderado se estimaba como 50 %; una selección múltiple con 8 menciones A y 8
  B sobre 10 casos se normalizaba como 50/50 en vez de conservar 80/80; y dos
  escalas con igual código y etiquetas semánticamente distintas se aceptaban.
  El dictamen metodológico añadió orden de polaridad no declarado, filtros
  guardados pero ignorados, grano `repeat` no gobernado, temas/periodos
  incompletos descartados y errores de referencia tragados. El guardián de
  contratos encontró además divergencia G6: los jobs califican refs históricas
  con la base activa y `/api/graficos/preview-slide` no. Se congeló el scope
  `prosecnur-graficos-g2-l01-scope-lock.md`: firma E1 exacta, peso/filtro por
  fuente, sólo grano plano independiente, orden y matrices completas,
  divergentes con dirección explícita, Lollipop v1 sólo `select_one`, `top_n`
  visual con nota y preview con la misma calificación canónica que export. La
  siguiente iteración debe empezar por regresiones RED; aún no hay producto
  modificado en este lote.

- **I6 · 2026-08-08 · Regresiones RED de método y vertical** — Un autor de
  regresiones con ownership exclusivo creó dos suites nuevas y sólo actualizó
  las expectativas históricas autorizadas de firma/copy. La suite metodológica
  cargó en 3,7 s y falló por el contrato ausente: `.radar_mb_pct` no acepta
  pesos, `.radar_mb_datos` no acepta filtros, el caso 9/1 devuelve 50 % en vez
  de 90 %, y E1, selección múltiple, `repeat`, tipo desconocido, refs/cortes
  incompatibles, matrices incompletas y dirección inversa no fallan como deben.
  La vertical cargó en 5,0 s y llegó a cuatro `ggplot` reales: Dumbbell produjo
  −50 pp en vez de +50 pp al ignorar el filtro, Serie 83,3/33,3 en vez de
  50/100, Lollipop dejó el caption `NULL` y preview conservó `p1` donde el job
  usa `docentes$p1`. Ambos comandos terminaron el runner sin error de carga y
  reportaron exclusivamente expectativas rojas causales; `git diff --check`
  quedó limpio. Queda habilitada la ola del único writer backend.

- **I7 · 2026-08-08 · BEFORE visual dirigido de G2-L0.1** — QA independiente
  abrió el proyecto canónico `acnur_acg` y el panel real direccionable de la
  biblioteca en 1440×1000 y 1024×600. Ocho celdas conservaron geometría estable
  pero fallaron contenido: Barras/Lollipop aparecen listas sin dirección,
  elegibilidad ni denominador; `Opciones a ocultar` sigue en el registry y el
  inspector sólo muestra cuatro decisiones; Dumbbell/Serie mantienen el
  fail-closed `Requiere plan compatible`, pero dicen «respuestas válidas» sin
  peso, grano, firma, referencia/comparación u orden temporal acreditado.
  Veredicto: visual 8/8 PASS, contenido 0/8 PASS; C1–C4 verdes, C5 rojo; G2/G5
  rojos y G8 verde. Cero errores de consola, página, API, red, overflow, scroll
  jail o geometría. Los hashes del acta y reporte quedaron registrados en C0.

- **I8 · 2026-08-08 · Implementación candidata y borde asimétrico** — El único
  writer backend reutilizó los helpers canónicos de peso, filtros, firma E1 y
  grano; añadió las colas internas compatibles `pesos`, `filtros` y
  `direccion_escala`, además del argumento público final `direccion_escala`.
  Dumbbell fija primera fuente como referencia,
  segunda como comparación y matriz completa; Serie exige secuencia o
  permutación completa; Lollipop falla fuera de `select_one` plano, conserva un
  `Total` sustantivo y declara `top_n` en el pie; preview califica refs por el
  mismo helper de los jobs. Durante la integración, el swap inicial de lados
  falló un nuevo contraejemplo de cuatro niveles: con `n_negativas=1` producía
  tres niveles negativos. Una micro-regresión RED fijó 3 vs 1 sin alterar el
  orden visible; el reparto pasó a derivarse sobre la escala invertida y quedó
  verde. Gate repetido por el lead: 119 tests y 1.094 expectativas verdes en
  seis suites (64 metodología, 8 vertical, 126 radar, 88 ola 4, 54 temporal y
  754 metadata). Única advertencia ambiental: `testthat` fue construido bajo R
  4.5.2. `editor-v2.css` sigue intacto con el SHA congelado de I3. El candidato
  pasa ahora a revisión metodológica, contractual y QA AFTER independientes.

- **I9 · 2026-08-08 · Rechazo independiente y reparación causal** — La primera
  revisión metodológica post-candidato rechazó dos P1: el adaptador sólo veía
  una columna literal `peso` e ignoraba `attr(data, "var_peso")`; y Serie
  validaba el formal, pero un `orden_periodos` inválido podía entrar después por
  preset u override. Un autor independiente añadió tres regresiones que dejaron
  cinco fallos causales: 50/2 en vez de 90/10, override duplicado o ajeno y
  preset duplicado aceptados. El mismo writer backend reparó sólo dos archivos:
  el adaptador local honra la columna de peso pública con fallback canónico, y
  el orden efectivo se fusiona y valida antes del cálculo, usando el mismo
  vector en matriz y gráfico. La reauditoría ejecutó los contraejemplos
  literales y aprobó **P0=0/P1=0/P2=0**; D5–D8 siguen conformes y D3 permanece
  deuda explícita. Gate del lead: las seis suites focales suman 1.105
  expectativas verdes y las tres suites de refs/jobs/args otras 100; el
  comparador de preview terminó verde con su warning ambiental conocido de
  timeout del render headless y fallback, y typecheck terminó en cero.

- **I10 · 2026-08-08 · QA AFTER y rechecks independientes** — QA abrió la
  biblioteca real en `acnur_acg` a 1440×1000 y 1024×600 y comparó las mismas
  ocho celdas del BEFORE. Resultado: 8/8 PASS visual, 8/8 PASS de contenido y
  8/8 combinadas, C1–C5, V1–V8 y G2/G5/G8 conformes, sin errores de consola,
  página, requests, respuestas HTTP, geometría ni scroll jail. Barras muestra
  `Dirección de la escala`; Lollipop, `Excluir del denominador`; y
  Dumbbell/Serie conservan `Requiere plan compatible` mientras declaran
  selección plana, peso/filtros, E1 y referencia/orden. Los hashes de acta,
  reporte y manifiesto de 24 capturas están en C0; el fixture y el status del
  producto quedaron idénticos pre/post. El guardián contractual rechecó el
  candidato post-I9: **COMPATIBLE, P0=0/P1=0/P2=0**, prefijos/defaults públicos
  estables, tres colas internas compatibles, paridad preview/jobs, persistencia
  intacta y sin necesidad de ADR o migración. Frontend repitió typecheck cero y
  43/43 archivos con 274/274 tests. `editor-v2.css` conserva el SHA congelado.
  El lote pasa ahora, y sólo ahora, al `verificador` serial.

- **I11 · 2026-08-08 · Gate serial y cierre de G2-L0.1** — El `verificador`
  ejecutó el candidato ya integrado y emitió **APPROVED, P0=0/P1=0/P2=0**.
  Acreditó ownership exacto de 11 paths, tres paths del usuario excluidos,
  staging vacío y `git diff --check` cero; 1.105 expectativas en seis suites R,
  100 en refs/jobs/args y 56 en preview/export, todas verdes. El único warning
  del comparador es el timeout conocido del renderer primario con fallback
  exitoso. Typecheck terminó en cero y Gráficos pasó 43/43 archivos y 274/274
  tests; AST confirmó firmas, prefijos/defaults y tres colas internas
  compatibles. `shasum -c` verificó el acta y las 24 capturas, el fixture
  `.pulso` quedó idéntico y el CSS congelado conserva su hash. La stopping rule
  queda satisfecha y el commit conventional registrado en la cola cierra este
  lote. El goal permanece activo y toma inmediatamente G2-L1.

- **I12 · 2026-08-08 · Censo, método y BEFORE de G2-L1** — Tres carriles
  read-only congelaron arquitectura, estimando y dirección visual antes de
  escribir producto. El tipo 24 será `p_puntos_comparativos`: una sola base,
  `var` y `cruces` `select_one` planas e independientes, uno o más códigos
  objetivo y 2–12 grupos observados. El porcentaje usa el peso efectivo; `n`
  cuenta filas válidas crudas con peso positivo y jamás reutiliza la frecuencia
  ponderada. Filtros y exclusiones actúan antes del denominador, un grupo con
  base cero falla cerrado y el orden proviene del instrumento salvo permutación
  completa explícita. La gramática usa un punto uniforme por grupo, eje 0–100 y
  ningún tallo, segmento, IC, significancia o ranking implícito. El contrato
  operativo nuevo es `var_cruces_corte`, simétrico en React y R; no requiere
  CSS, migración `.pulso`, nuevo ADR ni editar el dispatcher PPT congelado. QA
  real en `acnur_acg` acreditó 2/2 viewports, cero errores/overflow/jail y fijó
  el orden AFTER `Puntos comparativos → Brecha → Serie → Radar → Tabla`, los
  contadores 24/5 y la tercera fila alcanzable a 1024×600. El scope lock y los
  hashes BEFORE constan en C0. La oleada siguiente comienza con regresiones RED
  bajo ownership exclusivo de tests.

- **I13 · 2026-08-08 · Regresiones RED de G2-L1** — Un autor independiente
  con ownership exclusivo de tests fijó firma pública, corte multicode,
  estimando 9/1 frente a 1/1 con el mismo `n` crudo, filtros, exclusiones,
  código 99 explícito, corte trivial, denominador cero, peso, grano, fuente,
  cardinalidad y orden. La suite metodológica cargó y produjo un único fallo
  causal por constructor ausente, con cinco bloques subordinados skipped. La
  vertical reconstruye el mismo plan y lo encamina a workers PPTX/DOCX en un
  directorio temporal; falla antes de exportar porque el graficador no está
  registrado. El registry R mide 23 frente a 24. En frontend, 31 expectativas
  pasan y cinco fallan por `comparison-dots`/`var_cruces_corte` desconocidos,
  preset nulo, preflight permisivo y blueprint ausente. El blueprint esperado
  fija cuatro puntos, marca `n =` y cero conectores. Typecheck permanece verde,
  el test histórico de refs conserva 11 expectativas y `git diff --check` es
  cero. La implementación puede comenzar con dos writers de producto y globs
  R/React no solapados.

- **I14 · 2026-08-08 · Candidato GREEN y copy verdadero de familia** — Dos
  writers no solapados integraron el motor R y el contrato React. El backend
  añadió estimador, graficador, constructor, renderer dinámico, registry 24/24,
  preset, preflight por `var_cruces_corte` y exports sin tocar el dispatcher
  PPT congelado. Peso declarado, filtros, escala, códigos, exclusiones, grano,
  cardinalidad, orden y denominador fallan cerrados; cada grupo conserva un
  punto azul `#002457`, porcentaje y `n` crudo sobre eje 0–100. La nota
  metodológica no puede ser reemplazada y cualquier nota de usuario se anexa.
  React reconoce el requisito, acepta corte multicode, normaliza
  `comparison-dots` y dibuja cuatro puntos con `n =`, sin conectores y sin usar
  Processing como dato. El QA BEFORE encontró además que `Series y tablas`
  quedaba falso: una micro-regresión falló 1/7 y un único cambio lo dejó en
  `Grupos, series y tablas`, 7/7 verde. El gate del lead instaló el candidato en
  una biblioteca R temporal —sin tocar la instalación del usuario— y acreditó
  950 expectativas en método, vertical, metadata, refs, borradores y jobs;
  PPTX/DOCX reales suman 12. Frontend pasó 44/44 archivos y 277/277 tests,
  typecheck cero y `git diff --check` cero. El CSS congelado conserva su hash.
  El candidato pasa ahora a método, contratos y QA AFTER independientes.

- **I15 · 2026-08-08 · Revisión adversarial y segundo GREEN de G2-L1** — La
  revisión independiente rechazó el primer candidato con divergencias
  falsables. Un peso almacenado como factor se convertía a los códigos internos
  de R: etiquetas `9/1` producían 66,7 % en vez de 90 % y una etiqueta `-1`
  evadía la guarda. React, a su vez, anunciaba listo un corte con blancos o
  duplicados post-`trim` y permitía que indicador y agrupación fueran la misma
  referencia, mientras R fallaba cerrado. El blueprint declaraba los puntos
  con `--pulso-primary`, token que el frame de Gráficos redefine al teal de
  Procesamiento pese a que D9 exige tinta de datos `#002457`. El copy de
  exclusiones nombraba además un solape con «el indicador» cuando la frontera
  real son los códigos objetivo del corte. Un typecheck forzado encontró además
  que el primer narrowing releía propiedades `unknown`, y el registry anunciaba
  `preset_key = puntos_comparativos` sin publicarlo en `/presets-metadata`, por
  lo que el formulario ocultaba sus overrides. Un autor independiente fijó los
  contraejemplos visuales y de preflight en RED; el contrato catálogo→preset se
  congeló con otro RED causal. El segundo GREEN parsea factores por sus
  etiquetas literales, conserva el rechazo de negativos, normaliza y exige
  códigos no vacíos/únicos, separa `var` de `cruces`, usa locales tipados, fija
  los cuatro puntos en `#002457`, corrige el copy y cataloga nueve formals reales
  del preset sin permitir reemplazar subtítulo ni nota metodológica. En proceso
  fresco contra una instalación temporal del candidato pasaron 1.651
  expectativas R —incluidas 86 metodológicas, 12 verticales reales, metadata,
  presets y argumentos UI—; frontend pasó 44/44 archivos y 281/281 tests,
  `tsc -b --force` cero y `git diff --check` limpio. Las reauditorías
  metodológica y contractual cerraron GO con P0/P1/P2 = 0. El CSS congelado
  conserva su SHA-256; el AFTER dual-view permanece como gate abierto.

- **I16 · 2026-08-08 · AFTER real y cierre de QA de G2-L1** — QA visual
  independiente abrió el catálogo y el editor sobre una copia aislada de
  `acnur_acg`, sin editar producto. El runner y el inventario pasaron 2/2
  viewports: catálogo 24, familia Comparación 5, orden
  `Puntos comparativos → Brecha → Serie → Radar → Tabla`, hint
  `Grupos, series y tablas`, blueprint con cuatro puntos `#002457` y `n =`,
  sin conectores ni uso del teal Processing como tinta de datos. El flujo real
  creó slide y slot, insertó el tipo 24 desde Datos, bloqueó el estado vacío,
  configuró `A1_leg × E2_sex` con corte `4 = De acuerdo`, obtuvo preview PPT
  real 200 mediante `artifact-tool`, expandió nueve argumentos de preset,
  persistió `size_punto` de 4,2 a 4,8, bloqueó un corte duplicado y restauró el
  estado válido también a 1024×600. No hubo errores de consola, página,
  request o HTTP, ni overflow, scroll jail o geometría inválida. La aserción
  cruda `defaultsPublished=false` se descartó porque preguntaba por una entrada
  monolítica inexistente en `/presets-defaults`: el contrato público vive en
  `/presets-metadata` y sus defaults por argumento sí coinciden con el renderer.
  Acta, reportes, capturas y manifiesto pasaron `shasum -a 256 -c`; los puertos
  5174/8788 quedaron sin listeners. QA cierra APROBADO con P0/P1/P2 = 0 y el
  lote pasa al `verificador` serial.

- **I17 · 2026-08-08 · Gate serial y cierre de G2-L1** — El `verificador`
  independiente cerró COMPLETE/GO con P0/P1/P2 = 0. En proceso fresco contra
  la instalación temporal del candidato repitió los 11 archivos contratados:
  166 tests, 1.651 expectativas, cero fallos, errores o skips; las 12
  expectativas verticales ejercitaron PPTX y DOCX reales. Frontend repitió
  44/44 archivos y 281/281 tests, y `tsc -b --force` salió cero. La firma
  pública conserva nueve formals exactos; registry, blueprint, categoría,
  requisito, modo de autoría y preset coinciden, y los nueve argumentos del
  preset no exponen subtítulo ni nota metodológica. El scope contiene 21/21
  candidatos, excluye 3/3 paths del usuario, no incluye sorpresas y mantiene el
  staging vacío antes del cierre. `git diff --check` salió cero, el CSS
  congelado conserva SHA-256
  `aed5548e28d8008d8458d51f409487d7b4892d35daa4223492193130daf6bb7f`,
  el dispatcher PPT no tiene diff y BEFORE/AFTER validan todos sus manifiestos.
  Un barrido suplementario ajeno al set contratado observó sólo un skip
  ambiental por ausencia de `{callr}`; no afecta el gate y la repetición exacta
  contratada terminó sin skips. G2-L1 cumple G1–G8 y se cierra con commit
  conventional; el goal global sigue activo y toma inmediatamente G2-L1.5.

- **I18 · 2026-08-09 · Censo causal, BEFORE y dirección de G2-L1.5** — Dos
  revisiones read-only censaron 13 presets: tres barras, ocho verticales o
  circulares y dos radar. El transporte React→store→merge→`do.call` conserva
  los escalares; la primera divergencia nace antes, al componer el mapa. React
  conserva por drag la suma de cualquier par no-gap, pero R multiplica
  `alto_por_categoria` por N y talla `canvas_h_toprow_in` dentro del panel. Con
  seis categorías, mover 0,10 de header a fila conserva 1,18 en React y cambia
  el oracle de 3,58 a 4,08 pulgadas; una fixture independiente con cuatro filas
  cambió panel 2,16→1,76 y total 2,36→1,96 pese a conservar 0,64. QA real abrió
  Base PPT en `acnur_acg`, barras apiladas y radar+tabla, a 1440×1000 y
  1024×600. Pointer, reset, recorrido vertical y preview PPT 200 funcionan;
  aun así el baseline queda RECHAZADO con P0=0/P1=4/P2=1: procedencia
  contradictoria, bases/unidades incompletas, 56/9 descendientes recortados en
  compacto y handles enfocables sin teclado/foco, duplicados y con Escape
  propagado. Los cuatro casos tuvieron cero errores de consola, página,
  request o HTTP; el proyecto y los congelados conservaron hashes, y 21/21
  artefactos validaron. El baseline lógico local pasó 3/3 helpers y typecheck
  forzado. La dirección profesional y su primera frontera G2-L1.5a quedaron
  congeladas antes de código: particiones explícitas, no mezclar magnitudes,
  shares sólo con base común, hoja propia, C1 y contención compacta; procedencia,
  interacción accesible y Radar/pie permanecen como sublotes obligatorios.

- **I19 · 2026-08-09 · Regresiones RED de G2-L1.5a** — Un autor independiente
  obtuvo ownership exclusivo sobre los dos tests del mapa, sin tocar producto.
  La política pura exige `resolveLayoutMeasureContract` y
  `canShareLayoutMeasurePair`: etiquetas y barras comparten la partición
  `bars-horizontal`; header es `fixed-inch`, fila auxiliar `nested-inch` y
  alto por fila `per-category-inch`, con unidad `pulgadas por categoría`; una
  medida sin oracle queda `measure-only`. El SSR de Barras agrupadas conserva
  el reparto horizontal, prohíbe cualquier botón que prometa repartir header
  con filas, fija el alcance `Controla parámetros del render. La vista PPT
  confirma el resultado final.`, declara C1 `graficos/distribucion-espacio`
  intrínseco y rechaza porcentaje relativo en claims por fila. La corrida focal
  terminó RED con 2/2 archivos fallando y 3 fallos / 3 pases: primero falta el
  resolver público; el componente actual publica además dos handles falsos
  header↔fila y carece del copy/C1. `git diff --check` permanece limpio. Un
  writer frontend puede implementar ahora sólo los tres paths de producto.

- **I20 · 2026-08-09 · Primer candidato y rechazo independiente** — El writer
  añadió una política explícita `basis + axis + unit + partition`, separó
  `alto_por_categoria` y `canvas_h_toprow_in`, declaró C1 intrínseco y movió
  el acabado a `chartLayoutEditor.css`; el focal inicial pasó 6/6 y el
  typecheck forzado salió cero. El gate no aceptó ese verde nominal. El
  guardián encontró que la whitelist todavía promovía a proporción campos de
  `multi_apiladas` sin unidad y que vertical/pie seguían dejando que
  `measure-only` gobernara tracks. QA r1 midió la contradicción: Box plot
  0,30→0,58 movía 104,156 px y Pie 0,08→0,184 movía 37,375 px. Además, la
  primera contención compacta eliminó los 56/9 descendientes fuera del panel,
  pero recortó entre 6 y 24 textos operativos por familia. r1 quedó RECHAZADO
  P0=0/P1=2/P2=0, con 49/49 artefactos íntegros, preview 200, diagnósticos 0 y
  fixture inmutable.

- **I21 · 2026-08-09 · Fail-closed e intrínseco falsables** — El autor de
  regresiones añadió tres pruebas: whitelist sin unidad fail-closed,
  estabilidad geométrica de vertical/pie con valor exacto cambiante y ayuda de
  arrastre sólo cuando existe una partición compatible. El agregado quedó RED
  6/9 antes de reparar. El mismo writer exigió unidad proporcional publicada,
  sacó roles sin oracle y leyenda lateral de `buildGridTracks`/`flexTrackStyle`,
  convirtió vertical, pie y radar en mapas cualitativos intrínsecos y
  condicionó el aria. También cambió Medidas exactas a una columna con wrap
  completo a 1024–1199. El focal quedó 9/9, `tsc -b --force` cero y el guardián
  reabrió el contrato como COMPATIBLE P0/P1/P2=0: la única geometría relativa
  restante vive después del filtro `ratio-partition`.

- **I22 · 2026-08-09 · Rechazo dirigido r2 y micro-C4** — La matriz r2
  confirmó delta geométrico 0 px, `multi_apiladas` intrínseco, pointer/reset
  3/3, C1, preview 200, diagnóstico cero y cero descendientes fuera. Aun así no
  se cerró: a 1024 el chip sintético «Área del gráfico · Estimado» encogía de
  138 a 122 px en Box plot y Pie. r2 quedó RECHAZADO dirigido
  P0=0/P1=1/P2=0, con 50/50 artefactos íntegros. Una micro-iteración sólo en la
  hoja propia hizo el chip no encogible y dejó que la ayuda cualitativa
  absorbiera y envolviera el resto; el guardián dirigido mantuvo GO
  P0/P1/P2=0, sin scroll owner, hex, `transition: all` ni cambios congelados.

- **I23 · 2026-08-09 · AFTER r3 y candidato de cierre** — QA independiente
  repitió desde cero seis familias por 1440×1000 y 1024×600: PASS 12/12,
  contenido 12/12 y todos los booleanos verdaderos. Box plot y Pie conservan
  tracks y rectángulos con delta 0 px al editar `measure-only`, restauran el
  valor exacto y ya no recortan el chip; las seis familias tienen cero textos
  operativos cortados, cero descendientes horizontales fuera y cero nuevos
  dueños de scroll. Las tres barras mantienen pointer/reset, los campos sin
  unidad de Multi no exponen handle/share/porcentaje, el aria es veraz y C1–C4
  terminó 24/24 sin issues ni misses. Preview PPT real devolvió 200,
  diagnósticos fueron cero, fixture y candidato quedaron inmutables, puertos
  cerraron y 49/49 artefactos validaron. Los manifiestos r1/r2/r3 revalidaron;
  el lote queda candidato para el `verificador` serial, no cerrado todavía.

- **I24 · 2026-08-09 · NO-GO serial por clipping desktop no cubierto** — El
  `verificador` repitió el focal 9/9, la suite frontend completa 3824/3824 y
  `tsc -b --force` con salida cero; confirmó alcance exacto de seis archivos,
  índice vacío, hashes congelados intactos, contrato lógico conforme y los
  manifiestos BEFORE/r1/r2/r3 íntegros (21/21, 49/49, 50/50 y 49/49). Al
  contrastar el resumen de r3 con el reporte crudo y las capturas a 1440×1000,
  encontró 87 textos operativos y dos labels visibles recortados: las
  aserciones nuevas sólo cubrían la guarda compacta a 1024. La primera causa es
  falsable y acotada a C4: dentro de unos 842 px, el `auto-fit` de
  `minmax(190px, 1fr)` produce cuatro columnas y la pista del input deja apenas
  18.75 px al texto; además el chip de ratio «Columna derecha» no envuelve su
  label. Veredicto serial: **NO-GO P0=0/P1=1/P2=0**. La auditoría de gobernanza
  documental también devolvió diez incidencias ajenas al lote —nueve
  preexistentes y una en el documento no rastreado excluido—, registradas sin
  ampliar alcance. Siguiente micro-iteración: sólo hoja propia y runner de QA,
  con aserciones de clipping en ambos viewports y en estados inicial/final.

- **I25 · 2026-08-09 · Micro-C4 y AFTER r4 dual estricto** — El mismo writer
  tocó sólo `chartLayoutEditor.css`: a partir de 1200 px, Medidas exactas usa
  dos columnas seguras; copy e inputs quedan contenidos y los labels no-gap
  envuelven sin alterar ratios, tracks ni handles. El focal terminó 9/9,
  `tsc -b --force` y `git diff --check` salieron cero, la hoja propia quedó en
  SHA-256 `104ef9f7db80b97483d1287342868abfb7bd2486025e5bb3acda797cfd439f60`
  y el guardián dio GO P0/P1/P2=0. QA independiente endureció el runner antes
  de ejecutarlo: 24 estados obligatorios —dos viewports, seis familias,
  top/end—, auditorías anti-vacío y tolerancia de ancho **y** alto por nodo.
  r4 redujo los 87 textos y dos labels desktop recortados a cero; auditó
  183 textos/140 labels a 1440 y 183/134 a 1024, todos conformes. Las 33/33
  aserciones quedaron verdaderas, 42 PNG se inspeccionaron, `measure-only`
  mantuvo delta 0, drag/reset fue 3/3, C1 cerró 24 auditorías sin
  issues/misses/scroll-jails, preview fue 200 y diagnósticos cero. Fixture y
  candidato permanecieron inmutables, puertos cerraron y el manifiesto validó
  53/53. El lote vuelve a candidato; sólo el `verificador` serial puede
  cerrarlo.

- **I26 · 2026-08-09 · Segundo NO-GO serial por contención externa** — El
  `verificador` repitió el focal 9/9, la suite frontend 3824/3824 y
  `tsc -b --force` en verde; validó alcance, congelados, hashes C0 y
  manifiestos BEFORE/r1/r2/r3/r4. También confirmó que r4 supera literalmente
  I24: 24 estados, 33/33 aserciones y 87+2 recortes internos reducidos a cero.
  Sin embargo, el reporte crudo contiene una regresión C4 que el resumen no
  elevó: a 1440×1000, `horizontalDescendantsOutsidePanel` vale 2 en
  barras apiladas, 4 en agrupadas y 1 en multi-apiladas, tanto top como end;
  r3 tenía cero en las seis familias. Las capturas muestran pérdida real del
  inicio de «Etiquetas» y contención defectuosa de «Columna derecha». Primera
  causa: el bloque desktop combina wrap con `inline-size: 100%`,
  `flex: 1 1 100%` y `overflow: visible` en el `span`; el hijo rebasa el frame
  y el ancestro lo recorta, condición invisible para `scrollWidth` del propio
  texto. Veredicto: **NO-GO P0=0/P1=1/P2=0**. Siguiente guard obligatorio:
  en los 24 estados, cero descendientes fuera del panel y rect de cada label
  dentro de su frame/panel ±1 px, además de clipping interno cero.

- **I27 · 2026-08-09 · Micro-C4 de sizing intrínseco y AFTER r5** — El mismo
  writer cambió sólo dos declaraciones del label desktop en la hoja propia:
  `inline-size: fit-content` y `flex: 0 1 auto`, conservando el wrap, el límite
  `max-inline-size: 100%`, la cuadrícula de dos columnas, las métricas, los
  handles y los tracks de ratio. Focal 9/9, typecheck, diff-check y auditoría
  CSS quedaron verdes; la hoja propia terminó en SHA-256
  `b2a6ce70f440791883e4aa1d04d8bab28dac6451b0c2c58ce9a676f6e53c0b4b`
  y el guardián dio GO P0/P1/P2=0. Antes de abrir servidores, QA añadió una
  guarda no vacía label→frame→panel con rectángulos y tolerancia ±1 px, además
  de conservar las mediciones width/height por nodo y de detallar cada
  descendiente externo. En 24 estados, r5 auditó 183 textos y 140 labels a
  1440, 183/134 a 1024 y 38/32 labels de frame: clipping interno, labels fuera
  de frame/panel y descendientes fuera de panel/viewport quedaron todos en
  cero. Así eliminó literalmente tanto el 87+2 de r3 como el 2/4/1 de r4.
  Las 38/38 aserciones, 42 PNG, drag/reset 3/3, delta `measure-only` 0, C1
  24/0, preview 200, diagnósticos e inmutabilidad fueron conformes; 53/53
  artefactos y manifiestos r1–r5 validaron. El lote vuelve a candidato del gate
  serial, no cerrado.

- **I28 · 2026-08-09 · Gate serial GO y cierre de G2-L1.5a** — El
  `verificador` aprobó con **GO P0=0/P1=0/P2=0**. Repitió focal 9/9, suite
  frontend 3824/3824 y `tsc -b --force` cero; validó alcance, índice,
  congelados, hashes C0 y los seis manifiestos 21/49/50/49/53/53. Recalculó
  independientemente los 24 estados: mínimos 4/7/1 auditorías por estado,
  totales 183/140/38 a 1440 y 183/134/32 a 1024, `badStates=[]`, clipping
  interno, rect label→frame→panel ±1, descendientes fuera de panel/viewport y
  detalles, todos en cero. Confirmó r3 87+2→r5 0+0, r4 2/4/1 top/end→r5
  cero, C1 24 auditorías sin issues/misses/scroll-jails, tracks y geometría
  idénticos r4→r5, drag/reset 3/3 y dos casos `measure-only` con delta 0.
  Capturas, preview 200, diagnósticos, inmutabilidad y puertos fueron
  conformes. Las diez incidencias de gobernanza documental siguen ajenas al
  lote —nueve preexistentes y el prompt no rastreado excluido—. G2-L1.5a se
  cierra con commit conventional y el goal pasa inmediatamente a G2-L1.5b.

- **I29 · 2026-08-09 · Censo causal y contrato BEFORE de G2-L1.5b** — Dos
  censos read-only localizaron la primera divergencia: `ChartLayoutEditor`
  deduce un supuesto origen dominante por presencia de `values` o
  `inheritedValues`, y tres consumidores reconstruyen un estilo por igualdad o
  subconjunto. Al aplicar un estilo, sin embargo, React sólo copia sus valores
  a `args.overrides`; no persiste id ni linaje. El mismo snapshot puede venir de
  un ajuste manual, dos estilos pueden compartir valores y editar la biblioteca
  altera retroactivamente el match. La guardianía contractual congeló el
  supuesto conservador de D12: G2-L1.5b no inventa persistencia; cada callsite
  declara su owner, el editor jamás deriva fuente desde valores heredados y un
  gráfico activo con overrides se rotula `Ajuste de este gráfico`, aunque
  coincida con un estilo. Sólo el editor dueño de la biblioteca puede afirmar
  `Estilo guardado: <nombre>`. Identidad durable se separa como G2-L1.5e porque
  exige ADR 0070, versión contractual y lectura legacy fail-closed. Scope lock
  y dirección quedaron sellados antes de código; HEAD reutiliza el gate de
  I28 —3824/3824, focal 9/9 y typecheck forzado cero— y el árbol conserva sólo
  los tres cambios ajenos excluidos. Siguiente paso: BEFORE dual propio y
  regresión RED independiente.

- **I30 · 2026-08-09 · Regresión RED de procedencia** — Un autor independiente
  obtuvo ownership exclusivo sobre dos tests y no tocó producto. El SSR fija
  los mismos `values` e `inheritedValues` para tres ejecuciones y cambia sólo
  la prop discriminada: esperaba `Base PPT/base`, `Estilo guardado: <nombre
  largo>/mode` y `Ajuste de este gráfico/manual`; el componente actual devolvió
  `Ajustes adicionales/manual` en las tres. Dos guards adicionales exigen que
  origin ausente/inválido sea `Procedencia no declarada/unknown` y que el reset
  nombre `Base PPT`, `estilo guardado` o `este gráfico`; hoy el origen inválido
  vuelve a manual y los tres resets dicen `Quitar ajustes`. El agregado queda
  en 3 fallos y 4 pases. Un contrato
  puro adicional exige `resolveActiveChartLayoutOrigin(overrides)`: mapa vacío
  es Base PPT y cualquier snapshot propio es ajuste, aunque sea idéntico o
  superset de un estilo reusable; la suite falla primero porque ese módulo aún
  no existe. Baseline previo 4/4 y `git diff --check` cero. El RED es causal,
  tests-only y deja al writer un contrato cerrado sin acceso a la biblioteca.

- **I31 · 2026-08-09 · BEFORE visual dual de procedencia** — QA independiente
  abrió una copia sellada de `acnur_acg` y recorrió Base PPT, gráfico activo con
  snapshot idéntico a un reusable, editor dueño del estilo y Base Word en
  1440×1000 y 1024×600. Los ocho casos conservaron C1–C4, último contenido
  alcanzable, cero scroll interno, cero clipping/overflow y diagnósticos cero;
  proyecto y congelados quedaron inmutables. C5 falló 8/8 y el acta cerró
  **RECHAZADO VISUAL P0=0/P1=4/P2=0**: Base PPT se presenta manual, el editor
  del estilo se presenta manual, Word heredado se presenta como estilo y el
  slot fabrica `Estilo guardado` por igualdad mientras su propio mapa dice
  `Ajustes adicionales`. Los cuatro endpoints respondieron 200, 25 PNG se
  sellaron, el manifiesto validó 32/32 y los puertos 5188/8799 cerraron. Con
  BEFORE y RED íntegros, el único writer frontend puede implementar el contrato
  explícito sin contaminar evidencia.

- **I32 · 2026-08-09 · Primer candidato GREEN de G2-L1.5b** — El único writer
  frontend trabajó en los nueve paths materializados, sin tocar tests, ledger,
  R, persistencia ni congelados. Añadió la unión discriminada y un resolver cuya
  firma sólo acepta el mapa propio; `ChartLayoutEditor` exige `origin`, falla
  cerrado en runtime y limita reset a campos propios visibles. Presets declara
  Base PPT, el editor de biblioteca entrega id+nombre, Word declara desde su
  patch y el gráfico activo conserva cualquier snapshot nested/legacy como
  ajuste aunque iguale la Base PPT. `GraficadorSlot`, `GraficadorForm` y
  `StylePanel` dejaron de reconstruir `exactMatch`, subset, `appliedMode` o
  `from-mode`; la igualdad restante sólo normaliza contra Base PPT o evita una
  confirmación redundante. La acción de biblioteca ahora declara copia sin
  vínculo. RED→GREEN terminó 13/13, el set focal+vecinos 36/36, typecheck
  forzado cero y `git diff --check` limpio; el lead repitió 13/13 y censó cero
  símbolos prohibidos. El candidato aún no está aceptado: pasa a guardianía y
  QA AFTER dual independientes.

- **I33 · 2026-08-09 · Rechazo contractual r1 y frontera legacy** — La
  guardianía AFTER rechazó el candidato con **P0=0/P1=2/P2=2**. Para un slot
  legacy con `canvas_w_bars` top-level y `overrides={}`, `GraficadorForm`
  declara ajuste porque conoce los nombres visuales, pero el badge y
  `StylePanel` declaran Base PPT; «Volver a Base PPT» sólo reemplaza el mapa
  anidado y el merge del store conserva la key top-level. Copiar biblioteca
  tiene la misma deuda y ni siquiera confirma el reemplazo cuando el mapa
  anidado está vacío. El gate real de toda la feature confirmó alcance: 45/46
  archivos y 290 tests verdes, con un único fallo que exige a `StylePanel`
  resolver el `preset_key` real, justo la metadata necesaria para excluir
  `var/cruces/filtros`. Cero matches exact/subset reaparecieron, R/persistencia
  y congelados siguen intactos. Los P2 son copy técnico `owner/snapshot` y aria
  genérico que oculta el claim visible. La micro r2 quedó congelada antes de
  producto: collector común nested+legacy por nombres de metadata, patch de
  reemplazo que nulifica sólo visuales legacy y paridad accesible en español.

- **I34 · 2026-08-09 · QA AFTER r1 dirigido y rechazo visual** — QA cambió su
  stopping rule al primer defecto del guardián y sembró de forma segura
  `canvas_h_header_in=1.26` top-level con `overrides={}`. En 1440×1000 y
  1024×600, acordeón, trigger y resumen dicen Base PPT mientras el mapa dice
  `Ajuste de este gráfico/manual`; «Usar Base PPT» conserva la contradicción al
  cerrar/reabrir. El reset interno del mapa sí limpia esa key, confirmando que
  la causa es el patch incompleto del menú, no el store general. C1–C4 pasan en
  ambos viewports, C5 falla, diagnósticos son cero, fixture/congelados quedan
  inmutables y los puertos cierran. AFTER r1 termina **RECHAZADO VISUAL
  P0=0/P1=1/P2=0**, con 17/17 artefactos; los estados modernos no se declaran
  verdes por ausencia y pasan a r2.

- **I35 · 2026-08-09 · Regresión RED de legacy, copy y accesibilidad** — El
  autor independiente amplió sólo los dos tests que ya poseía. El helper puro
  fija precedencia nested, inclusión exclusiva de nombres visuales top-level,
  exclusión de `var/vars/cruces/filtro/null` y patch que nulifica sólo keys
  visuales presentes al usar Base o copiar biblioteca. El SSR exige además que
  el `aria-label` de la tarjeta incluya `Base PPT`, nombre guardado o ajuste
  exacto, y que ningún detalle/tooltip publique `owner` o `snapshot`. Baseline
  fue 1/1 y 7/7; el agregado queda **RED 8 pases / 4 fallos**: collector y
  builder ausentes, aria genérico y jerga técnica. `git diff --check` permanece
  limpio. El mismo writer frontend puede reparar ahora sólo cinco paths.

- **I36 · 2026-08-09 · GREEN técnico r2 de procedencia legacy** — El mismo
  writer frontend reparó únicamente los cinco paths autorizados. Un collector
  común combina `args.overrides` con claves top-level legacy permitidas por la
  metadata visual, da precedencia al mapa anidado y excluye datos, filtros y
  nulos; un builder reemplaza el mapa y nulifica sólo aquellas claves visuales
  legacy al usar Base PPT o copiar biblioteca. `GraficadorForm`,
  `GraficadorSlot` y `StylePanel` consumen esa misma verdad; Slot y StylePanel
  resuelven el preset real más `titulo`, sin reescribir al abrir. El claim
  accesible reproduce estado y conteos visibles y el copy quedó en español,
  sin `owner` ni `snapshot`. RED→GREEN terminó 17/17, los contratos de metadata
  16/16 y toda la feature 46/46 archivos, 295/295 tests; `tsc -b --force`,
  `git diff --check` y los dos hashes congelados salieron limpios. El lead
  repitió 17/17 y 16/16. Es candidato técnico, no cierre: pasa a guardianía
  contractual y QA AFTER r2 dual antes del `verificador` serial.

- **I37 · 2026-08-09 · Guardianía r2 compatible** — La revisión contractual
  independiente emitió **COMPATIBLE P0=0/P1=0/P2=0** y no editó archivos. En
  el caso causal `canvas_h_header_in` top-level más `var/filtro`, los tres
  consumidores declaran ajuste; Base produce `overrides={}` y nulifica sólo la
  key visual, los datos sobreviven al merge y la reapertura declara Base PPT.
  Copiar biblioteca comparte la misma limpieza y conserva los datos. La matriz
  completa de nueve superficies no encontró identidad por igualdad, escritura
  al abrir, persistencia nueva ni cruces de D12; el único `shallowEqualArgs`
  evita confirmaciones redundantes y `sameValue` sólo normaliza contra Base.
  La revisión repitió focal 17/17, metadata 16/16, feature 295/295, typecheck
  forzado y diff-check limpios, con congelados y contratos sellados intactos.
  C1 y C5 son conformes estáticamente; C2–C4 y nombre largo siguen reservados
  al QA visual real, por lo que el lote aún no cierra.

- **I38 · 2026-08-09 · AFTER r2 dual y rechazo por dos causales** — QA
  independiente completó seis ámbitos en 1440×1000 y 1024×600: 12/12 casos,
  44 PNG y manifiesto 51/51 íntegro. C1–C4 pasaron 12/12; C5 pasó 10/12, Word
  reset/reapertura, Escape con foco devuelto, click-outside, aria/conteos,
  endpoints y diagnósticos fueron conformes. El P1 legacy de r1 sí mejoró:
  badge, trigger, StylePanel y mapa concuerdan antes, tras Base y tras copia, y
  `var/cruces/filtro` sobreviven. Sin embargo, el backend devuelve la key
  top-level limpiada como `{}` tanto para Base como para copia, residuo que no
  satisface eliminación durable. El segundo P1 es visual: el nombre largo usa
  `nowrap + ellipsis` en lista, focus-card y opción del popover en ambos
  viewports, aunque la tarjeta del mapa ya envuelve completa. Proyecto,
  candidato y congelados quedaron inmutables, puertos cerraron. Veredicto:
  **RECHAZADO VISUAL P0=0/P1=2/P2=0**. r3 separa diagnóstico de serialización y
  diagnóstico CSS antes de congelar un nuevo scope; el `verificador` no se
  lanza todavía.

- **I39 · 2026-08-09 · Diagnóstico causal y scope r3** — Dos carriles
  read-only aislaron los P1. El tombstone sale de React como `null`, pero
  `updateSlotArgs` lo retiene por spread; R guarda ese `NULL` nombrado y el
  serializer global lo devuelve como `{}`. Tras reload, React lo considera
  ajuste mientras el motor lo descarta, creando drift UI↔render. El fix mínimo
  queda en el merge del store: borrar sólo keys top-level parcheadas con
  `null/undefined`, preservando todo otro dato y sin tocar R/API/D12. El clipping
  nace de tres reglas `nowrap + ellipsis` del CSS congelado; selectores más
  específicos en `chartLayoutEditor.css` pueden permitir wrap íntegro sin
  alterar scroll owners. Scope r3 SHA-256 `45fa5210…b315` y contrato
  `07898eb6…5b36` congelaron un writer de producto con sólo `store.ts` y hoja
  propia, y un autor RED con `store.test.ts` más el contrato de bibliotecas.
  Siguiente gate: demostrar ambos fallos antes de producto.

- **I40 · 2026-08-09 · RED r3 de tombstone y nombre íntegro** — El autor
  independiente verificó los hashes del scope/contrato y tocó sólo los dos
  tests asignados. El contrato de bibliotecas partió 9/9 verde y añadió un
  guard que exige los tres selectores y las cuatro declaraciones de wrap; hoy
  queda 9 pases/1 fallo porque ninguna regla completa existe en la hoja propia.
  El nuevo test de store aplica el builder real a Base y copia sobre un slot
  legacy y exige key ausente, JSON limpio, datos preservados y nested exacto;
  queda 0/1 por `mergeSlotArgsPatch is not a function`, con colección válida.
  Agregado: **9 pases/2 fallos causales**, `git diff --check` limpio. Producto
  queda habilitado para un solo writer en `store.ts` y
  `chartLayoutEditor.css`.

- **I41 · 2026-08-09 · GREEN técnico r3** — El único writer frontend editó
  sólo los dos paths autorizados. `mergeSlotArgsPatch` clona el mapa, borra
  únicamente keys top-level parcheadas con `null/undefined` y conserva
  literalmente falsos, ceros, cadenas vacías, arrays, objetos y
  `overrides={}`; `updateSlotArgs` ya usa esa operación sin limpieza recursiva.
  La hoja propia añade un bloque de mayor especificidad para lista, focus-card
  y opción portada, con wrap/clip íntegros y sin altura ni scroll nuevos.
  RED→GREEN terminó 11/11, procedencia 17/17, registry+bibliotecas 17/17 y toda
  la feature 47/47 archivos, 297/297 tests; typecheck forzado, diff-check y
  hashes congelados salieron limpios. Es candidato técnico, no cierre: debe
  superar guardianía r3 y AFTER r3 dual con reload real.

- **I42 · 2026-08-09 · Guardianía r3 compatible** — La revisión contractual
  independiente emitió **COMPATIBLE P0=0/P1=0/P2=0**. Confirmó borrado
  top-level sin mutación/recursión, preservación de falsy, arrays, objetos y
  `overrides={}`, y censó que los consumidores existentes usan `null` como
  tombstone/default sin conflicto transversal. Los tres selectores CSS
  coinciden con DOM real, vencen al congelado incluso con su orden de import y
  cubren el portal global sin alturas, scroll owners ni `word-break`. Repitió
  focal 11/11, suite frontend completa 464/464 archivos, 3834/3834 tests,
  typecheck y diff-check; scope, contratos y congelados coinciden. Clipping,
  C1–C5 y autosave→GET→reload siguen reservados al QA real, por lo que no hay
  cierre todavía.

- **I43 · 2026-08-09 · AFTER r3 rechaza solape en lista compacta** — QA
  independiente completó 12 casos y 45 PNG. El causal legacy quedó realmente
  cerrado: Base y copia pasan autosave→GET→`page.reload()`, no dejan key
  top-level, preservan sentinelas y rehidratan Base/Ajuste respectivamente.
  Lista, focus-card y popover publican `clip/normal/anywhere`; Word, aria,
  interacciones y C1–C3 pasan. La inspección visual impidió un falso verde del
  resumen: en 1024×600 el flex column comprime ocho filas a 42 px mientras el
  bloque largo necesita 98.84 px, produce 8/8 contenidos fuera de fila y siete
  solapes adyacentes. En 1440×1000 es 0/0. Veredicto sellado:
  **RECHAZADO VISUAL P0=0/P1=1/P2=0**, manifiesto 52/52, puertos cerrados.

- **I44 · 2026-08-09 · Diagnóstico y scope r4 de flex-shrink** — El censo
  read-only localizó la primera divergencia en el ítem hijo: el listado ya es
  el scroll owner correcto, pero cada `.pulso-gv2-mode-list-item` hereda
  `flex: 0 1 auto`; con espacio vertical negativo encoge hacia el mínimo y el
  label con overflow visible pinta sobre filas vecinas. Copy/meta no fijan
  altura y no son causales. El único patch permitido es
  `.pulso-gv2-overrides-list > .pulso-gv2-mode-list-item { flex: 0 0 auto; }`
  en hoja propia. Scope `aa209f35…0ddf` y contrato `0700d349…0fcc` congelan un
  archivo de producto y un guard estático antes de código.

- **I45 · 2026-08-09 · RED r4 de fila no comprimible** — El autor
  independiente verificó ambos hashes y partió del contrato de bibliotecas
  10/10 verde. Añadió un único guard tolerante a whitespace para el selector
  hijo directo y `flex: 0 0 auto`; el archivo queda **10 pases/1 fallo**, con
  primera aserción `expected false to be true`. `git diff --check` sigue limpio
  y producto permanece intacto. El writer queda habilitado sólo para la hoja
  propia.

- **I46 · 2026-08-09 · GREEN técnico r4** — El único writer añadió exactamente
  la regla hija directa `flex: 0 0 auto` en `chartLayoutEditor.css`, sin tocar el
  bloque r3 ni introducir otra declaración. RED→GREEN terminó 11/11, store r3
  1/1, procedencia 17/17 y feature 47/47 archivos, 298/298 tests; typecheck,
  diff-check y congelados son conformes. El selector r4 sólo aparece en la hoja
  propia. El candidato pasa a guardianía y AFTER r4 dual; todavía no cierra.

- **I47 · 2026-08-09 · Guardianía r4 compatible** — La revisión read-only
  emitió **COMPATIBLE P0=0/P1=0/P2=0**. La regla aparece una vez, tiene un único
  `flex: 0 0 auto`, especificidad 0,2,0 frente a 0,1,0 congelada y mantiene el
  bloque r3 intacto. El padre conserva su único `overflow-y:auto`; el hijo no
  encoge, copy/meta no cambian y `align-items:center` sigue centrando icono y
  badge. No hay alturas, overflow, media, scroll owners ni `word-break` nuevos.
  Contrato 11/11, focal procedencia+store 18/18, diff-check y hashes salieron
  conformes; C4 geométrico queda correctamente reservado a QA.

- **I48 · 2026-08-09 · AFTER r4 elimina compresión y solapes** — QA visual
  independiente recorrió seis owners en 1440×1000 y 1024×600, 12/12 casos con
  C1–C5 conformes, y emitió **APROBADO VISUAL P0=0/P1=0/P2=0**. En el causal
  compacto, r3 tenía 8/8 contenidos fuera de sus filas y siete intersecciones
  adyacentes; r4 deja 0/8 y cero, mientras 1440 permanece 0/8 y cero. Cada fila
  contiene label/meta, no adquiere scroll propio, conserva alto intrínseco y
  centra icono/badge con delta máximo 0.01 px; el listado sigue como único dueño
  vertical, alcanza la última fila y el nombre largo permanece íntegro en
  lista, foco y popover. Legacy Base/copia pasó autosave→GET→reload sin
  tombstones, Word, ARIA, Escape, foco, click-outside, endpoints e invariantes
  pasaron y los diagnósticos quedaron vacíos. Se sellaron 45 PNG AFTER más dos
  causales BEFORE r3; el manifiesto validó 54/54 y los puertos 5195/8806
  cerraron. El lote es candidato, no cierre: pasa al `verificador` serial.

- **I49 · 2026-08-09 · Gate serial y cierre de G2-L1.5b** — El `verificador`
  independiente emitió **GO · P0=0/P1=0/P2=0** tras auditar los 15 paths
  exactos, staged vacío, diff-check y todos los hashes congelados. Repitió el
  frontend completo con 464/464 archivos y 3835/3835 tests, la feature con
  47/47 y 298/298, procedencia 17/17, bibliotecas 11/11, store 1/1 y typecheck
  forzado sin output. Los manifiestos BEFORE/r1/r2/r3/r4 validaron
  32/32, 17/17, 51/51, 52/52 y 54/54. Recalculó desde los reportes y revisó los
  cuatro PNG causales: a 1024×600 r3 `8/8 + 7` pasa a r4 `0/8 + 0`, y 1440
  permanece `0/8 + 0`; verificó scroll owner único, última fila alcanzable,
  nombre largo íntegro, legacy Base/copia autosave→GET→reload, Word, ARIA,
  interacciones, cuatro endpoints, diagnósticos vacíos, fixture idéntico y todos
  los puertos cerrados. No quedan pendientes del lote. G2-L1.5b cierra con
  `fix(graficos): declarar procedencia del distribuidor`; el goal permanece
  activo y toma inmediatamente G2-L1.5c.

- **I50 · 2026-08-09 · Censo y dirección congelada de G2-L1.5c** — Dos
  carriles read-only localizaron la primera divergencia en
  `BarsHorizontalRow`: cada par compatible aparece como dos botones idénticos
  —trailing de A y leading de B—, sólo con pointerdown; el Tab visita ambos,
  flechas no mutan, `DragGuide` está oculto al árbol accesible y no existen
  separator, valores ARIA, status ni cancelación local. Los inputs exactos
  además propagan Escape al host y pueden confirmar otra vez por blur. La
  guardianía declaró la frontera **COMPATIBLE** y sin ADR: un separador neutral
  vertical por pair key, rango/paso exclusivamente de metadata, Left/Right por
  patch atómico, foco estable, status polite/atomic sólo para commit/cancel y
  Escape consumido únicamente durante una transacción; Home/End, collapse,
  callers, store, API/R y rediseño quedan fuera. Dirección `73ea19df…b74f` y
  scope `d4957eeb…f52a` congelan un autor RED sobre dos tests y un solo writer
  sobre componente+helper; CSS propio sólo entra si QA demuestra foco
  insuficiente. El BEFORE dual continúa sin habilitar producto.

- **I51 · 2026-08-09 · BEFORE dual de interacción accesible** — QA
  independiente abrió `acnur_acg` en 1440×1000 y 1024×600 y recorrió Barras
  agrupadas con una partición real y Box plot sin partición. El segundo caso
  pasó 2/2 y el primero falló 2/2 exclusivamente en C5; C1–C4 pasaron 4/4,
  pointer conservó suma y límites, reset funcionó y el foco visible ya es
  suficiente, por lo que CSS queda fuera. El acta cerró **RECHAZADO VISUAL
  P0=0/P1=4/P2=0**: un límite publica dos botones/dos stops, ninguno es
  separator ni declara orientación/rango/valor, Left/Right no muta ni consume
  el evento, no existe status/live region y Escape desde handle o input cierra
  `Estilo global` —el input sólo marca defaultPrevented, no detiene burbuja—.
  Los cuatro endpoints respondieron 200, diagnósticos quedaron vacíos,
  fixture/congelados/producto/dirty permanecieron idénticos, el manifiesto
  validó 24/24 y 5197/8808 cerraron preservando 8787. Home/End quedó fuera del
  veredicto por contrato. BEFORE y scope habilitan al autor RED, no al writer.

- **I52 · 2026-08-09 · RED causal de separador, flechas y Escape** — El autor
  independiente verificó dirección/scope y editó sólo los dos tests asignados.
  La baseline fue 2 archivos y 14/14 tests; el agregado termina con **seis
  fallos causales y 13 pases**. La primera aserción recibe dos handles, cero
  separators y un `is-leading` frente a 1/1/0. Los demás RED exigen nombre,
  orientación, rango/valor/texto/controls, un status polite/atomic persistente,
  copy puntero+flechas y cero handles para Box plot; además congelan
  `adjustLayoutPairByArrowKey` —Right `.45/.52→.46/.51`, suma y clamp, sin
  Home/End ni fallback— y `resolveLayoutEscapePolicy` —cancelar sin callback,
  blur ni pérdida de foco—. El entorno Node acredita política, no finge eventos:
  propagación/foco quedan obligatoriamente para browser AFTER. Diff-check está
  limpio y producto/CSS siguen intactos. Un único writer puede implementar
  ahora sólo componente+helper.

- **I53 · 2026-08-09 · Candidato GREEN de interacción accesible** — El
  único writer editó sólo `ChartLayoutPopover.tsx` y
  `chartLayoutHelpers.ts`, sin CSS, tests, ledger, callers, store, API/R ni
  motor PPT. Cada par horizontal compatible conserva un único separador
  neutral trailing con nombre, orientación, controls, rango y valor derivados
  de metadata; Left/Right usa el step publicado, conserva la suma y confirma un
  patch atómico. Pointer enfoca y mantiene snapshot, Escape activo y
  `pointercancel` restauran sin callback, Escape ocioso queda al host y los dos
  inputs exactos cancelan localmente sin blur. El editor publica un solo status
  polite/atomic para confirmación o cancelación pointer, mientras teclado usa
  el propio valor ARIA. RED→GREEN terminó 19/19; el set canónico de
  layout+procedencia creció de 17/17 a 22/22 por las cinco regresiones nuevas;
  toda Gráficos pasó 47/47 archivos y 303/303 tests, typecheck forzado y
  diff-check salieron limpios. `editor-v2.css` y `reporte_plan_ppt.R`
  conservaron sus hashes. Es candidato técnico, no cierre: pasa a guardianía
  contractual independiente y después a AFTER real dual.

- **I54 · 2026-08-09 · Guardianía r1 rechaza cascada y fallbacks** — La
  revisión independiente repitió 22/22 en layout+procedencia, 47/47 archivos y
  303/303 tests de Gráficos, typecheck, diff-check, hashes y censo, pero emitió
  **RECHAZADO P0=0/P1=2/P2=0**. Primera divergencia: el separador neutral es un
  `span` y el selector congelado `.is-compact span` lo lleva a opacidad cero
  cuando el primario ocupa ≤10%, dejando un control focusable invisible.
  Segunda: pointer sustituye una suma no positiva por `1`, mientras ARIA y el
  clamp usan `0/Infinity` si falta metadata, de modo que fabrican un dominio en
  vez de fallar cerrados. La micro-ronda r2 congela un `div` neutral y un
  resolver puro compartido: cuatro bounds finitos y ordenados, valores finitos
  dentro de dominio, suma positiva e intervalo combinado factible; cualquier
  incumplimiento devuelve `null`, no materializa control ni abre transacción.
  Contrato `868364e7…dad7a` y scope `7cc21f5f…dd651` mantienen exactamente los
  mismos dos tests y los mismos dos archivos de producto. QA browser continúa
  bloqueado hasta RED→GREEN y guardianía r2.

- **I55 · 2026-08-09 · RED r2 de visibilidad y dominio fail-closed** — El
  mismo autor independiente partió de 19/19 y editó sólo los dos tests que ya
  poseía. El agregado queda en **cuatro fallos y 18 pases**. La primera
  aserción acredita marco compacto y un control, pero recibe tag `span` frente
  a `div`; otro SSR prueba que suma cero y metadata sin bounds aún publican un
  handle/separator. El helper exige el nuevo `resolveLayoutPair`, hoy ausente,
  y demuestra que flechas con bounds incompletos o no finitos devuelven un
  patch en vez de `null`. Diff-check está limpio, producto/CSS/congelados no
  cambiaron durante el carril y los hashes de contrato/scope coinciden. El
  mismo writer queda habilitado únicamente sobre componente+helper; QA browser
  sigue bloqueado.

- **I56 · 2026-08-09 · Candidato GREEN r2 sin dominio fabricado** — El
  mismo único writer mantuvo ownership exclusivo de componente+helper. Sustituyó
  el neutral por `div` y centralizó `resolveLayoutPair`: ambos metadatos, cuatro
  bounds finitos/ordenados, valores finitos dentro de dominio, suma positiva e
  intervalo combinado factible son obligatorios. ARIA sólo materializa el
  separador con esa resolución; pointer la consulta antes de prevenir, enfocar o
  abrir snapshot y usa el total exacto; flechas agregan step izquierdo positivo
  y conservan el clamp común. Un lado en cero puede reabrirse si el dominio es
  válido, ambos cero fallan cerrados. RED→GREEN terminó 22/22, el set
  layout+procedencia 25/25 y toda Gráficos 47/47 archivos y 306/306 tests;
  typecheck forzado, diff-check, censo y hashes congelados fueron conformes.
  Es candidato técnico: guardianía r2 debe aceptarlo antes de habilitar AFTER.

- **I57 · 2026-08-09 · Guardianía r2 rechaza el cero accesible** — La
  revisión independiente confirmó literalmente el resolver, `div`, pointer,
  ARIA, flechas, Escape/status/inputs, rutas únicas, congelados y gates
  25/25 + 306/306 + typecheck, pero emitió **RECHAZADO P0=0/P1=1/P2=0**.
  Con primario `0` y secundario positivo, el dominio es válido y el separador
  existe; sin embargo, el marco recibe `is-zero` y la hoja congelada aplica
  opacidad cero, `pointer-events:none` y `display:none` a descendientes. El
  control sale del árbol accesible y no puede reabrir el primario. La r3
  congela una sola regla: `is-zero` sólo entra si el valor es cero y no existe
  separador saliente válido; `is-compact` permanece y el mismo resultado
  gobierna clase+render. Contrato `a4404dcb…072f70e` y scope
  `f84530fb…24cfb60` reducen RED y producto a un archivo cada uno, sin CSS. Los
  dos paths de calcMuestra observados concurrentemente quedaron fuera y ya
  pertenecen a commits ajenos en HEAD; este loop no los modifica. AFTER sigue
  bloqueado.

- **I58 · 2026-08-09 · RED r3 de marco cero con separador saliente** — El
  autor independiente modificó sólo `ChartLayoutPopover.test.tsx`. Partió de
  22/22 y dejó **un fallo y 21 pases**: con A `0` y B `.52`, el control ya es un
  único `div`, publica now `0`, rango `0..0.32`, controls correcto y marco
  compacto, pero el mismo frame aún declara `is-zero=true`. Ambos cero y
  metadata incompleta siguen cubiertos por los guards r2. Helper, producto,
  CSS, contrato/scope y congelados conservaron hashes durante el carril;
  diff-check quedó limpio. Un writer de un solo archivo queda habilitado para
  reutilizar el resultado saliente en clase+render.

- **I59 · 2026-08-09 · Candidato GREEN r3 con cero reabrible** — El mismo
  writer tocó sólo `ChartLayoutPopover.tsx`. Conservó una única
  `pairResolution`, derivó un único `outgoingSeparator` y reutilizó ese objeto
  tanto para render como para negar `is-zero`; `is-compact` no cambió. El caso
  A `0` / B `.52` mantiene ahora su separador saliente visible y accesible sin
  alterar ambos-cero ni los guards r2. RED→GREEN terminó 22/22;
  layout+procedencia pasó 25/25, Gráficos 47/47 archivos y 306/306 tests,
  typecheck forzado y diff-check fueron verdes. Helper, CSS y motor PPT
  conservaron hashes. Candidato técnico: guardianía r3 decide si puede abrirse
  AFTER real.

- **I60 · 2026-08-09 · Guardianía r3 compatible** — La revisión
  independiente emitió **COMPATIBLE P0=0/P1=0/P2=0**. Confirmó una sola
  resolución y un solo `outgoingSeparator` gobernando clase+JSX; A `0` / B
  `.52` publica `div[separator]`, now `0`, rango `0..0.32` y marco compacto sin
  cero, mientras ambos cero o metadata inválida fallan cerrados. Repitió
  layout+procedencia 25/25, Gráficos 47/47 y 306/306, typecheck, diff-check,
  hashes y censo sobre HEAD concurrente `ec60ba4b`; no halló cambios nuevos en
  helper, CSS, callers, store ni R/PPT. La conformidad queda reservada al AFTER
  real: dos viewports, un tab stop, flechas/suma/patch/foco, cero reabrible,
  drag+status, Escape activo/ocioso, pointercancel, inputs exactos, live region,
  scroll y host.

- **I61 · 2026-08-09 · AFTER bloqueado por la pila de ejecución** — QA
  independiente intentó la matriz real de G2-L1.5c sobre una copia aislada de
  `acnur_acg`, 1440×1000 y 1024×600, sin modificar producto. La sesión nueva
  contra la API preservada en 8787 abrió el proyecto y obtuvo 200 en metadata,
  defaults, config y variables; HEAD y censo permanecieron estables, la
  fixture canónica y su copia conservaron SHA-256 idéntico y los hashes de
  componente, helper, CSS congelado y motor PPT coincidieron antes/después.
  Sin embargo, Vite respondió 500 para `src/main.tsx` durante la corrida
  sellada y el runner agotó 120 s esperando
  `[data-audit-ready="graficos"]`: React nunca montó, no se ejecutó ningún caso
  y no existen capturas AFTER que comparar. El veredicto literal es
  **BLOQUEADO P0=0/P1=3/P2=0**, donde P1-02/P1-03 no acreditan defectos del
  candidato —son checks vacíos derivados de que la navegación no ocurrió—.
  Una única reprueba de bajo consumo confirmó que la raíz ya servía 200 pero la
  transformación de `main.tsx` volvió a quedar sin respuesta; no se reinstaló
  `node_modules`, no se abrió otra pila y el Vite 5202 propio quedó cerrado.
  El arranque fresco de la API del HEAD concurrente también dejó evidencia
  ajena al lote: `router_graficos.R` se carga antes de que exista
  `.slide_names()`. La API 8787, de propiedad del usuario, permaneció intacta.
  Reporte, estructurado, runner, fixture y logs validan **20/20** entradas del
  manifiesto. Este registro no convierte el AFTER en verde ni invalida la
  conformidad estática de I60; deja una deuda visual/runtime explícita.

- **I62 · 2026-08-09 · Recorte finito y disposición de la cola** — Gonzalo
  revocó expresamente el mandato indefinido y ordenó finalizar el goal con
  bajo consumo de RAM. La stopping rule pasa a ser finita: documentar sin
  ambigüedad el candidato vigente, conservar el AFTER bloqueado como deuda,
  disponer cada lote y decisión restante, ejecutar un gate serial acotado y
  crear un commit exacto; no se abre recenso ni otro lote. G2-L1.5d/e y
  G2-L2–L6 quedan diferidos fuera de este goal y no se consideran entregados;
  G2-LR queda cancelado. D1–D3 y la rama durable de D12 conservan sus supuestos
  fail-closed pero pasan fuera del goal; D4–D11 quedan cerradas sólo para el
  alcance histórico que realmente gobernaron. Cualquier continuación exige un
  goal nuevo. El cierre final queda condicionado al gate serial registrado en
  I63 y al commit exacto que materializa este ledger.

- **I63 · 2026-08-09 · Gate serial del cierre finito** — El verificador
  independiente emitió **GO exclusivamente para el cierre
  administrativo/técnico finito** sobre HEAD `59d8717f7c8f`: diff-check de los
  cinco paths limpio y staging vacío; hashes de componente, helper, CSS
  congelado y motor PPT 4/4 exactos; focal 3/3 archivos y 25/25 tests; Gráficos
  47/47 archivos y 306/306 tests; typecheck forzado exit 0. El AFTER sellado
  validó 20/20 hashes y conserva **BLOQUEADO P0=0/P1=3/P2=0**, con
  `P1-01-RUNTIME` como primera divergencia, cero casos ejecutados y cero
  capturas porque React nunca montó. Este cierre no acredita conformidad visual
  AFTER. La cola 15/15 y D1–D12 12/12 quedaron dispuestas; 5202 estaba cerrado
  y la API de usuario 8787 permaneció en PID 40553. El gate habilita únicamente
  el commit exacto de los cinco paths del cierre.

## Bandeja de decisiones

| ID | Decisión | Recomendación y supuesto conservador | Estado |
|---|---|---|---|
| D1 | ¿Dumbbell/Serie se editan manualmente o sólo nacen de equivalencias? | Mantener `generated` y fail-closed en picker hasta diseñar un editor tema→refs por base con E1 y orden temporal acreditado | **diferida fuera del goal; no se decidió editor manual** |
| D2 | Método de IC (B5) | Rechazar el alcance general: Wilson 95% sólo es recomendación para proporción plana no ponderada; falta ratificar método ponderado/repeat, alcance y simultaneidad | **diferida fuera del goal; G2-L4 no implementado** |
| D3 | Denominador múltiple (B7) | Recomendar `casos_validos`: unidad con ≥1 código elegible declarado; casos y menciones siempre rotulados y seleccionados explícitamente | **diferida fuera del goal; recomendación no ratificada y G2-L3 no implementado** |
| D4 | Primer tipo descriptivo tras L0 | `p_puntos_comparativos` v1: una base, punto + N por grupo, indicador explícito, sin líneas/IC/significancia/SM; después `p_heatmap_cruce` por columna | **resuelta para puntos comparativos; heatmap diferido y no entregado** |
| D5 | Dirección semántica de la escala divergente | Añadir `direccion_escala` de cola; default compatible `negativo_positivo`, alternativa `positivo_negativo`; los ítems invertidos se recodifican antes del gráfico | **resuelta y aplicada en G2-L0.1** |
| D6 | Peso, filtros, grano y firma multibase | Aplicar peso/filtro por fuente; exigir plano independiente y firma E1 código+etiqueta idéntica; `repeat`, desconocido, ref ausente o corte fuera de escala fallan cerrados | **resuelta y aplicada en G2-L0.1** |
| D7 | Elegibilidad de Lollipop antes de resolver D3 | V1 sólo `select_one` plano; exclusión cambia denominador, `top_n` sólo visibilidad y debe notificar truncamiento; selección múltiple/repeat no se normalizan | **resuelta para Lollipop v1; selección múltiple diferida con D3** |
| D8 | Orden de Dumbbell y Serie temporal | Dumbbell usa primera fuente como referencia y segunda como comparación; Serie exige orden completo acreditado; tema o periodo incompleto falla en vez de desaparecer o puentearse | **resuelta y aplicada en G2-L0.1** |
| D9 | Estimando y gramática de puntos comparativos v1 | Una base, indicador `select_one` + códigos objetivo, corte `select_one`, peso efectivo y filtros estrictos; porcentaje ponderado con `n` crudo visible, orden del instrumento, 2–12 grupos, eje 0–100 y puntos sin conectores/IC/significancia/SM | **resuelta y aplicada en G2-L1** |
| D10 | Frontera del distribuidor dinámico de espacios | Conservar `ChartLayoutEditor` como control de los args efectivos; metadata/presets fijan nombres, unidades, defaults y límites, y el render R/PPT es el oracle visual. React puede mostrar y editar la distribución, pero no inventar semántica ni una geometría alternativa. La matriz de placeholders de slide de ADR 0068 permanece separada e intacta | **resuelta por mandato de Gonzalo y aplicada al alcance ejecutado de G2-L1.5** |
| D11 | Base dimensional del Mapa de espacios | Cada arg se clasifica por eje, unidad y composición; sólo una partición común admite conservación y porcentaje. `alto_por_categoria` es pulgadas por fila y `canvas_h_toprow_in` vive dentro del panel; ninguno se pareará con bandas fijas. Sin unidad canónica, medida exacta y sin drag | **resuelta y aplicada en G2-L1.5a** |
| D12 | ¿La procedencia de un estilo copiado se declara por contexto o se persiste como linaje durable? | G2-L1.5b usa contrato contextual explícito y fail-closed: sólo el owner de biblioteca afirma `Estilo guardado`; el snapshot de un gráfico es `Ajuste de este gráfico`. Persistir id + nombre snapshot + mapa por campo se difiere a G2-L1.5e con ADR 0070, bump de contrato y lectura legacy `unknown`, nunca migración por igualdad | **rama contextual resuelta en G2-L1.5b; linaje durable diferido fuera del goal** |

## Cierre finito

El gate de I63 satisface la stopping rule para el cierre finito
administrativo/técnico; el commit exacto materializa el cierre. Éste acredita
sólo los lotes marcados como
cerrados; no acredita implementación, QA ni decisión sustantiva de ningún lote
diferido o cancelado y, en particular, no acredita conformidad visual AFTER de
G2-L1.5c. Esa deuda y los bloqueos de la pila quedan deliberadamente visibles.
Cualquier reapertura requiere un goal nuevo.
