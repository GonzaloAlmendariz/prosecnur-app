/* eslint-disable max-lines */
// Escenas de la pantalla de inicio y carga del proyecto (6 nov 2026, propuesta aprobada por Gonzalo:
// https://claude.ai/artifact/3cVPEhL8NGz3Nem4vSM5jg). Cinco escenas por módulo, cada una sacada de una vista real de
// la app y reducida a su geometría (viewBox 320×200, color del módulo en currentColor). Se animan con el repertorio
// común de movimientos de `recorrido-carga.css` (caer, subir, encender, trazar, crecer, viajar, girar, barrer,
// atenuar); --k es el instante de cada pieza dentro del ciclo. Los colores son tokens de boot.css: la pantalla se
// pinta desde el chunk de arranque. Las cifras son ilustrativas; el vocabulario es el de la UI.
import { A, C, R, T, TA, rng, uid } from "./escenasMotor";

export type EscenaCarga = {
  id: string;
  marca?: boolean;
  accion: string;
  donde: string;
  titulo: string;
  svg: () => string;
};

export type ClaveEscenas = "calc" | "form" | "rutas" | "material" | "monitoreo" | "proc" | "dash";

const ESCENAS = {} as Record<ClaveEscenas, EscenaCarga[]>;


// ---------------------------------------------------------------- Cálculo de muestra
ESCENAS.calc = [
  { id: 'embudo', marca: true, accion: 'Sorteo de titulares', donde: 'Marco › Selección', titulo: 'Marco y sorteo de titulares',
    svg() {
      let s = T(16, 22, 'MARCO DE CURSOS-HORARIO', 's-eyebrow');
      const filtros = ['Facultad del estudio', 'Con 15 o más alumnos', 'Misma facultad ≥ 70 %'];
      const cifras = ['5,263', '2,934', '2,561'];
      const ks = [0, 0.24, 0.42];
      filtros.forEach((f, i) => {
        const fin = i < 2 ? `animation-name:a-pasa;` : '';
        s += `<g${A('sube', ks[i], { s: i < 2 ? `--k2:${ks[i + 1]}` : '' , c: i < 2 ? 'pasa' : '' })}>${R(16, 30, 128, 16, 8, C('s-chip'))}<circle cx="27" cy="38" r="3"${C('s-ok')}/>${T(34, 41.5, f, 's-t s-ink')}</g>`;
        s += `<g${A('sube', ks[i], { c: i < 2 ? 'pasa' : '', s: i < 2 ? `--k2:${ks[i + 1]}` : '' })}>${T(212, 42, cifras[i], 's-num-s s-ink', 'end')}</g>`;
      });
      s += T(212, 52, 'cursos-horario elegibles', 's-micro s-mute', 'end');
      // Campo de unidades: 11 × 6
      const elegidos = [3, 9, 14, 20, 27, 31, 38, 45, 51, 58, 62];
      const fuera1 = new Set([0, 1, 6, 11, 12, 17, 22, 23, 34, 40, 44, 55, 56, 60, 65]);
      const fuera2 = new Set([5, 18, 29, 41, 50, 63]);
      let n = 0;
      for (let j = 0; j < 6; j++) for (let i = 0; i < 11; i++) {
        const x = 22 + i * 18, y = 76 + j * 18, id = j * 11 + i;
        const desc = fuera1.has(id) ? 0.24 : fuera2.has(id) ? 0.42 : null;
        s += `<circle cx="${x}" cy="${y}" r="4.2"${A(desc ? 'pop-atenua' : 'pop', (i + j) * 0.008, { c: 's-dot', s: desc ? `--k2:${desc}` : '' })}/>`;
      }
      elegidos.forEach((id, m) => {
        const i = id % 11, j = Math.floor(id / 11), x = 22 + i * 18, y = 76 + j * 18;
        s += `<circle cx="${x}" cy="${y}" r="6"${A('pop', 0.55 + m * 0.018, { c: 's-tone' })}/>`;
        const cy = 72 + m * 10.6;
        s += `<g${A('viaja', 0.74 + m * 0.012, { s: `--dx:${x - 250}px;--dy:${y - cy}px` })}>${R(242, cy - 4.5, 64, 9, 4.5, C('s-soft'))}<circle cx="248" cy="${cy}" r="2.6"${C('s-tone')}/>${T(254, cy + 2.4, `CH ${m + 1} titular`, 's-micro s-tonetxt')}</g>`;
      });
      s += `<line x1="232" x2="232" y1="66" y2="184"${C('s-hair')}/>`;
      s += TA(306, 40, '186', 'sube', 0.86, 's-num s-tonetxt', 'end');
      s += TA(306, 52, 'titulares sorteados', 'sube', 0.88, 's-micro s-mute', 'end');
      return s;
    } },
  { id: 'cadena', accion: 'Tamaño de muestra', donde: 'Cálculo › Propuestas', titulo: 'Tamaño de muestra y cursos-horario',
    svg() {
      let s = T(16, 22, 'CÁLCULO P1 UNIVERSIDAD', 's-eyebrow');
      ([['z', '1.96'], ['p', '0.30'], ['e', '±2.5 %'], ['deff', '2']] as const).forEach(([a, b], i) => {
        const x = 16 + i * 72;
        s += `<g${A('pop', i * 0.04)}>${R(x, 32, 64, 18, 5, C('s-mono-chip'))}${T(x + 8, 44.5, a, 's-mono s-mute')}${T(x + 56, 44.5, b, 's-mono s-ink', 'end')}</g>`;
      });
      const pasos = [['N FÓRMULA', '2,304', 'Cochran + deff + FPC'], ['N AJUSTADO', '2,500', 'redondeo operativo'], ['N OPERATIVO', '3,750', 'sobremuestra × 1.5'], ['CURSOS-HORARIO', '186', 'P25 × tasa de efectividad']] as const;
      pasos.forEach(([l, v, d], i) => {
        const y = 62 + i * 34, k = 0.2 + i * 0.15, ultimo = i === 3;
        if (i) s += `<rect x="31" y="${y - 12}" width="2" height="12"${A('trazaV', k - 0.05, { c: 's-hair-d' })}/>`;
        s += `<g${A('cae', k)}>${R(16, y, 288, 24, 8, C(ultimo ? 's-tone' : 's-card'))}<circle cx="32" cy="${y + 12}" r="4"${C(ultimo ? 's-white' : 's-ok')}/>${T(44, y + 15.5, l, ultimo ? 's-eyebrow s-white-t' : 's-eyebrow s-mute')}${T(140, y + 15, d, ultimo ? 's-micro s-white-t' : 's-micro s-mute')}</g>`;
        s += TA(296, y + 16.5, v, 'sube', k + 0.05, ultimo ? 's-num-s s-white-t' : 's-num-s s-ink', 'end');
      });
      return s;
    } },
  { id: 'cifras', accion: 'Cifras del marco', donde: 'Datos', titulo: 'Universo, elegibles y muestra',
    svg() {
      let s = '';
      const arriba = [['UNIVERSO', '29,083', 'estudiantes'], ['UNIDADES', '5,263', 'cursos-horario'], ['ELEGIBLES', '21,362', 'estudiantes'], ['MARCO', '2,561', 'cursos-horario']] as const;
      const abajo = [['MUESTRA', '2,500'], ['OPERATIVA', '3,750'], ['DIMENSIONA', 'P25 × tasa'], ['AULAS', '186']] as const;
      arriba.forEach(([l, v, d], i) => {
        const x = 12 + i * 75, k = i * 0.06;
        s += `<g${A('cae', k)}>${R(x, 26, 71, 66, 8, C('s-card'))}${T(x + 8, 42, l, 's-eyebrow s-mute')}${T(x + 8, 62, v, i > 1 ? 's-num-s s-okt' : 's-num-s s-ink')}${T(x + 8, 76, d, 's-t s-mute')}</g>`;
        if (i > 1) s += `<g${A('pop', 0.5 + i * 0.04)}>${R(x + 8, 81, 42, 7, 3.5, C('s-ok-bg'))}${T(x + 12, 86.6, '✓ validada', 's-micro s-okt')}</g>`;
      });
      abajo.forEach(([l, v], i) => {
        const x = 12 + i * 75, k = 0.26 + i * 0.07;
        s += `<g${A('cae', k)}>${R(x, 100, 71, 74, 8, C('s-card'))}${R(x + 8, 108, 16, 16, 5, C('s-tone'))}${T(x + 8, 140, l, 's-eyebrow s-mute')}</g>`;
        s += TA(x + 8, 160, v, 'sube', k + 0.06, i === 2 ? 's-t s-tonetxt' : 's-num-s s-tonetxt');
      });
      s += T(12, 18, 'DISEÑO VIGENTE  Universo → elegibles → operación → aulas', 's-eyebrow s-tonetxt');
      return s;
    } },
  { id: 'reemplazos', accion: 'Reemplazos', donde: 'Selección › Reemplazos', titulo: 'Cadenas de reemplazo',
    svg() {
      let s = T(16, 22, 'CADENAS DE REEMPLAZO', 's-eyebrow') + T(304, 22, 'semilla 20260611', 's-mono s-mute', 'end');
      for (let i = 0; i < 5; i++) {
        const y = 36 + i * 32, k = i * 0.1;
        s += `<g${A('cae', k)}>${R(16, y, 88, 22, 6, C('s-soft'))}<circle cx="27" cy="${y + 11}" r="3.5"${C('s-tone')}/>${T(35, y + 14.5, `CH ${i + 1} titular`, 's-t s-tonetxt')}</g>`;
        [0, 1].forEach(j => {
          const x = 110 + j * 100;
          s += `<g${A('viaja', k + 0.18 + j * 0.1, { s: '--dx:-18px;--dy:0px' })}>${T(x, y + 14.5, '→', 's-t s-mute')}${R(x + 12, y, 86, 22, 6, C('s-ok-bg'))}${T(x + 20, y + 14.5, `R ${i + 1}.${j + 1}`, 's-t s-okt s-b')}${T(x + 92, y + 14.5, j ? 'celda vecina' : 'misma celda', 's-micro s-okt', 'end')}</g>`;
        });
      }
      return s;
    } },
  { id: 'perfil', accion: 'Perfil de la selección', donde: 'Selección › Perfil', titulo: 'Perfil por facultad: muestra y marco',
    svg() {
      let s = T(16, 22, 'PERFIL POR FACULTAD', 's-eyebrow');
      s += `<g${A('pop', 0.66)}>${R(196, 12, 108, 14, 7, C('s-ok-bg'))}${T(250, 21.5, 'Muestra ≈ marco', 's-micro s-okt', 'middle')}</g>`;
      const f = [['Ciencias Sociales', 0.82, 0.78], ['Ingeniería', 0.74, 0.77], ['Derecho', 0.55, 0.52], ['Gestión', 0.62, 0.66], ['Letras', 0.40, 0.38], ['Ciencias', 0.47, 0.5], ['Arte y Diseño', 0.28, 0.3]] as const;
      f.forEach(([n, m, u], i) => {
        const y = 40 + i * 22, k = 0.06 + i * 0.07, w = 170;
        s += TA(16, y + 7.5, n, 'sube', k, 's-t s-ink');
        s += R(112, y + 1, w, 8, 4, C('s-track'));
        s += `<rect x="112" y="${y + 1}" width="${(w * m).toFixed(1)}" height="8" rx="4"${A('traza', k + 0.03, { c: 's-tone' })}/>`;
        s += `<rect x="${(112 + w * u - 1).toFixed(1)}" y="${y - 2}" width="2" height="14"${A('pop', 0.58 + i * 0.02, { c: 's-inkfill' })}/>`;
        s += TA(304, y + 8, `${Math.round(m * 22)} %`, 'sube', k + 0.05, 's-mono s-ink', 'end');
      });
      s += T(112, 196, '▮ muestra   | marco', 's-micro s-mute');
      return s;
    } }
];

// ---------------------------------------------------------------- Formularios
const TIPO: Record<string, [string, string, string]> = { num: ['#', 'var(--pulso-module-sample)', 'Número entero'], txt: ['T', 'var(--pulso-module-encyclopedia)', 'Texto corto'], uno: ['◉', 'var(--pulso-module-dashboard)', 'Selección única'], var: ['☑', 'var(--pulso-module-fieldkit)', 'Selección múltiple'], nota: ['i', 'var(--pulso-text-faint)', 'Nota informativa'] };
ESCENAS.form = [
  { id: 'outline', marca: true, accion: 'Estructura del formulario', donde: 'Constructor', titulo: 'Secciones y preguntas',
    svg() {
      let s = T(16, 18, 'OUTLINE MAESTRO', 's-eyebrow') + TA(304, 18, '196 campos', 'sube', 0.84, 's-t s-ink', 'end') + `<text x="304" y="18" text-anchor="end"${A('sale', 0.84, { c: 's-t s-ink' })}>195 campos</text>`;
      s += `<g${A('cae', 0)}>${R(12, 26, 296, 22, 6, C('s-soft'))}${R(22, 32, 12, 10, 2, C('s-tone-o'))}${T(42, 40.5, 'Pag2 (p2–p7)', 's-t s-ink s-b')}${T(116, 40.5, 'Sección', 's-t s-mute')}</g>`;
      const filas = [['num', 'Edad', 'p2'], ['txt', 'Correo electrónico que más utiliza', 'p3'], ['num', 'Código de alumno', 'p4'], ['uno', 'Sexo', 'p5'], ['var', 'Marque todos sus estudios', 'p6']] as const;
      filas.forEach(([t, l, c], i) => {
        const y = 52 + i * 24, k = 0.1 + i * 0.1, [g, col, nombre] = TIPO[t];
        s += `<g${A('cae', k)}>${T(20, y + 15, '⋮⋮', 's-t s-faint')}<text x="40" y="${y + 15.5}" text-anchor="middle" class="s-glyph" fill="${col}">${g}</text>${T(52, y + 11, l, 's-t s-ink')}${T(52, y + 20, nombre, 's-micro s-mute')}</g>`;
        s += `<g${A('pop', k + 0.05)}>${R(270, y + 6, 22, 11, 3, C('s-mono-chip'))}${T(281, y + 14, c, 's-micro s-mono s-ink', 'middle')}</g>`;
      });
      s += `<rect x="24" y="174" width="2" height="0.01"/>`;
      s += `<g${A('cae', 0.66)}>${R(12, 172, 296, 22, 6, C('s-card'))}${R(22, 178, 12, 10, 2, C('s-tone-o'))}${T(42, 186.5, 'Cierre de sección', 's-t s-ink')}${T(140, 186.5, 'Termina Pag2 (p2–p7)', 's-t s-mute')}</g>`;
      s += `<rect x="13" y="48" width="2.5" height="124" rx="1.2"${A('trazaV', 0.72, { c: 's-tone' })}/>`;
      return s;
    } },
  { id: 'hojas', accion: 'Hoja survey', donde: 'Editor XLSForm', titulo: 'Hoja survey del XLSForm',
    svg() {
      let s = '';
      ([['Preguntas', '357'], ['Opciones', '556'], ['Ajustes', '1']] as const).forEach(([a, b], i) => {
        const x = 12 + i * 104;
        s += `<g${A('pop', i * 0.04)}>${R(x, 10, 98, 18, 9, C(i ? 's-card' : 's-soft'))}${T(x + 10, 22, a, 's-t s-ink')}${T(x + 90, 22, b, 's-mono s-tonetxt', 'end')}</g>`;
      });
      const cols = [['type', 12], ['name', 104], ['label', 170], ['required', 264]] as const;
      s += R(8, 36, 304, 18, 4, C('s-head'));
      cols.forEach(([c, x]) => { s += T(x, 48.5, c, 's-mono s-mute'); });
      const filas = [['begin_group', 'pag2', 'Datos generales', ''], ['integer', 'p2', 'Edad', 'yes'], ['text', 'p3', 'Correo electrónico', 'yes'], ['select_one sexo', 'p5', 'Sexo', 'yes'], ['select_multiple est', 'p6', 'Estudios', ''], ['end_group', '', '', '']] as const;
      filas.forEach(([ty, n, l, r], i) => {
        const y = 58 + i * 22, k = 0.12 + i * 0.09;
        s += `<g${A('cae', k)}><line x1="8" x2="312" y1="${y + 20}" y2="${y + 20}"${C('s-hair')}/>${R(12, y + 4, Math.min(86, 8 + ty.length * 4.6), 13, 4, C(ty.includes('group') ? 's-soft' : 's-chip'))}${T(17, y + 13.5, ty, 's-micro s-mono s-ink')}</g>`;
        if (n) s += TA(104, y + 14, n, 'sube', k + 0.03, 's-mono s-tonetxt');
        if (l) s += `<rect x="170" y="${y + 7}" width="${l.length * 4.2}" height="6" rx="3"${A('traza', k + 0.05, { c: 's-bar-ink' })}/>`;
        if (r) s += TA(264, y + 14, r, 'pop', k + 0.07, 's-mono s-okt');
      });
      return s;
    } },
  { id: 'probar', accion: 'Prueba del formulario', donde: 'Probar formulario', titulo: 'Vista del encuestado',
    svg() {
      let s = `<g${A('cae', 0)}>${R(40, 10, 240, 26, 6, C('s-soft'))}${R(40, 10, 3, 26, 1.5, C('s-tone'))}${T(52, 27, 'Pag2', 's-t s-ink s-b')}${T(268, 27, '6 preguntas, ~3 min', 's-t s-mute', 'end')}</g>`;
      const preg = [['1.', '¿Recomendaría el servicio?', ['Sí', 'No', 'No sabe']], ['2.', '¿Cómo calificaría la atención?', ['Buena', 'Regular', 'Mala']]] as const;
      preg.forEach(([nn, q, ops], i) => {
        const y = 48 + i * 64, k = 0.1 + i * 0.32;
        s += `<g${A('cae', k)}>${T(40, y + 10, nn, 's-t s-tonetxt s-b')}${T(54, y + 10, q, 's-t s-ink s-b')}</g>`;
        ops.forEach((o, j) => {
          const yy = y + 22 + j * 13;
          s += `<g${A('sube', k + 0.05 + j * 0.03)}><circle cx="58" cy="${yy}" r="4.2"${C('s-radio')}/>${T(68, yy + 3.2, o, 's-t s-ink')}</g>`;
        });
        s += `<circle cx="58" cy="${y + 22 + (i ? 13 : 0)}" r="2.4"${A('pop', k + 0.2, { c: 's-tone' })}/>`;
      });
      s += `<g${A('pop', 0.78)}>${R(212, 172, 68, 20, 10, C('s-tone'))}${T(246, 185.5, 'Siguiente ›', 's-t s-white-t', 'middle')}</g>`;
      return s;
    } },
  { id: 'logica', accion: 'Condiciones de apertura', donde: 'Mapa de lógica', titulo: 'Condiciones de apertura',
    svg() {
      // p9 (selección única) abre p9_other sólo si se marca «Otro»: la condición va escrita sobre el conector.
      let s = T(12, 18, 'CONDICIONES DE APERTURA', 's-eyebrow');
      s += `<g${A('cae', 0)}>${R(12, 28, 132, 150, 10, C('s-card'))}<circle cx="27" cy="44" r="7" class="s-soft"/><text x="27" y="47.5" text-anchor="middle" class="s-glyph-s" fill="var(--pulso-module-dashboard)">◉</text>${T(40, 42, '¿En qué institución?', 's-t s-ink s-b')}${T(40, 52, 'p9, selección única', 's-micro s-mono s-mute')}</g>`;
      const ops = ['Universidad pública', 'Universidad privada', 'Instituto', 'Otro'];
      ops.forEach((o, j) => { const y = 72 + j * 24;
        s += `<g${A('sube', 0.06 + j * 0.04)}><circle cx="28" cy="${y}" r="4.6" class="s-radio"/>${T(40, y + 3, o, 's-t s-ink')}</g>`; });
      s += `<rect x="18" y="135" width="120" height="18" rx="6"${A('pop', 0.3, { c: 's-soft-st' })}/><circle cx="28" cy="144" r="2.6"${A('pop', 0.32, { c: 's-tone' })}/>`;
      // Destino: oculta (punteada) hasta que se cumple la condición; luego visible.
      s += `${R(214, 120, 96, 48, 10, C('s-ghost'))}<g${A('atenua0', 0.54)}>${T(224, 138, 'p9_other', 's-micro s-mono s-faint')}${T(224, 152, 'oculta', 's-micro s-faint')}</g>`;
      s += `<rect x="144" y="143" width="70" height="2"${A('traza', 0.4, { c: 's-tone' })}/><circle cx="214" cy="144" r="3.2"${A('pop', 0.5, { c: 's-tone' })}/>`;
      s += `<g${A('pop', 0.44)}>${R(148, 122, 64, 14, 4, C('s-mono-chip'))}${T(180, 132, "p9 = 'otro'", 's-micro s-mono s-tonetxt', 'middle')}</g>`;
      s += `<g${A('pop', 0.56)}>${R(214, 120, 96, 48, 10, C('s-card-sel'))}<text x="228" y="140" class="s-glyph-s" fill="var(--pulso-module-encyclopedia)">T</text>${T(240, 139, 'Otra institución', 's-micro s-ink s-b')}${T(228, 158, 'p9_other: visible', 's-micro s-mono s-tonetxt')}</g>`;
      s += `<g${A('sube', 0.7)}>${R(12, 184, 296, 0.8, 0, C('s-hair-d'))}</g>`;
      s += `<g${A('cae', 0.12)}>${R(214, 40, 96, 48, 10, C('s-card'))}<text x="228" y="60" class="s-glyph-s" fill="var(--pulso-module-sample)">#</text>${T(240, 59, 'Años de estudio', 's-micro s-ink s-b')}${T(228, 78, 'p10: siempre', 's-micro s-mono s-mute')}</g>`;
      s += `<rect x="144" y="63" width="70" height="1.4"${A('traza', 0.16, { c: 's-hair-d' })}/>`;
      return s;
    } },
  { id: 'revisar', accion: 'Avisos de consistencia', donde: 'Resumen', titulo: 'Avisos de consistencia',
    svg() {
      let s = T(16, 20, 'DIAGNÓSTICO EN VIVO', 's-eyebrow');
      s += `<g${A('atenua0', 0.74)}>${R(220, 8, 84, 18, 9, C('s-warn-bg'))}${T(262, 20.5, '▲ 6 avisos', 's-t s-warnt', 'middle')}</g>`;
      s += `<g${A('pop', 0.76)}>${R(220, 8, 84, 18, 9, C('s-ok-bg'))}${T(262, 20.5, '✓ Sin avisos', 's-t s-okt', 'middle')}</g>`;
      const avisos = [1, 3, 4];
      for (let i = 0; i < 6; i++) {
        const y = 34 + i * 26;
        s += `<g${A('sube', i * 0.03)}>${R(12, y, 296, 22, 6, C('s-card'))}<text x="26" y="${y + 15}" text-anchor="middle" class="s-glyph-s" fill="${Object.values(TIPO)[i % 4][1]}">${Object.values(TIPO)[i % 4][0]}</text><rect x="40" y="${y + 8}" width="${90 + (i * 37) % 80}" height="6" rx="3" class="s-bar-ink"/></g>`;
        if (avisos.includes(i)) {
          const k = 0.22 + avisos.indexOf(i) * 0.08;
          s += `<g${A('pop-atenua0', k, { s: `--k2:${0.6 + avisos.indexOf(i) * 0.04}` })}>${R(222, y + 5, 80, 12, 6, C('s-warn-bg'))}${T(262, y + 13.5, i === 1 ? '▲ Sin etiqueta' : i === 3 ? '▲ Lista vacía' : '▲ Nombre repetido', 's-micro s-warnt s-b', 'middle')}</g>`;
          s += `<g${A('pop', 0.62 + avisos.indexOf(i) * 0.04)}>${R(222, y + 5, 80, 12, 6, C('s-ok-bg'))}${T(262, y + 13.5, '✓ Resuelto', 's-micro s-okt s-b', 'middle')}</g>`;
        }
      }
      s += `<rect x="12" y="32" width="40" height="160" rx="6"${A('barre', 0.12, { c: 's-sweep', s: '--dx:256px' })}/>`;
      return s;
    } }
];

// ---------------------------------------------------------------- Hojas de ruta
// Distritos ilustrativos (no son la cartografía real): siluetas irregulares con los tonos de mapa del módulo.
const DISTRITOS: { n: string; c: string; f: string; d: string; lx: number; ly: number; w: number }[] = [
  { n: 'Distrito norte', c: 'color-mix(in srgb, var(--pulso-module-processing) 55%, var(--pulso-surface))', f: 'color-mix(in srgb, var(--pulso-module-processing) 16%, var(--pulso-surface))', d: 'M150 18 L196 10 L222 30 L214 62 L232 86 L204 104 L170 96 L156 70 L138 52 Z', lx: 190, ly: 26, w: 7 },
  { n: 'Distrito oeste', c: 'color-mix(in srgb, var(--pulso-module-dashboard) 60%, var(--pulso-surface))', f: 'color-mix(in srgb, var(--pulso-module-dashboard) 16%, var(--pulso-surface))', d: 'M78 60 L118 50 L140 66 L136 98 L104 110 L80 96 Z', lx: 82, ly: 56, w: 4 },
  { n: 'Distrito centro', c: 'color-mix(in srgb, var(--pulso-module-fieldkit) 60%, var(--pulso-surface))', f: 'color-mix(in srgb, var(--pulso-module-fieldkit) 16%, var(--pulso-surface))', d: 'M140 100 L176 98 L214 108 L236 132 L210 146 L170 138 L146 124 Z', lx: 216, ly: 110, w: 5 },
  { n: 'Distrito sur', c: 'color-mix(in srgb, var(--pulso-module-sample) 60%, var(--pulso-surface))', f: 'color-mix(in srgb, var(--pulso-module-sample) 16%, var(--pulso-surface))', d: 'M118 150 L150 144 L164 168 L150 190 L120 186 L108 168 Z', lx: 112, ly: 148, w: 3 },
  { n: 'Distrito playa', c: 'color-mix(in srgb, var(--pulso-module-monitoring) 55%, var(--pulso-surface))', f: 'color-mix(in srgb, var(--pulso-module-monitoring) 14%, var(--pulso-surface))', d: 'M74 118 L102 114 L112 140 L96 158 L72 148 Z', lx: 66, ly: 114, w: 2 },
  { n: 'Distrito este', c: 'color-mix(in srgb, var(--pulso-module-encyclopedia) 55%, var(--pulso-surface))', f: 'color-mix(in srgb, var(--pulso-module-encyclopedia) 16%, var(--pulso-surface))', d: 'M238 64 L280 56 L300 84 L286 112 L252 104 Z', lx: 282, ly: 54, w: 3 }
];
const poli = (d: string): [number, number][] => { const n = (d.match(/-?[\d.]+/g) ?? []).map(Number); const p: [number, number][] = []; for (let i = 0; i < n.length; i += 2) p.push([n[i], n[i + 1]]); return p; };
const dentro = (x: number, y: number, p: [number, number][]): boolean => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
// Puntos al azar (con semilla) dentro del distrito, con un margen para que no toquen el borde.
const puntosEn = (seed: number, n: number, caja: number[], d?: string): [number, number][] => { const r = rng(seed), p: [number, number][] = [], pl = d ? poli(d) : null; let tries = 0;
  while (p.length < n && tries++ < 4000) { const x = caja[0] - 10 + r() * (caja[2] + 20), y = caja[1] - 10 + r() * (caja[3] + 20);
    if (!pl || (dentro(x, y, pl) && dentro(x - 4, y, pl) && dentro(x + 4, y, pl) && dentro(x, y - 4, pl) && dentro(x, y + 4, pl))) p.push([x, y]); }
  return p; };
const CAJAS: number[][] = [[156, 22, 56, 66], [86, 64, 44, 38], [154, 104, 64, 30], [118, 152, 36, 30], [78, 122, 26, 26], [246, 66, 40, 34]];
function mapaBase(kBase: number, conEtiquetas = true): string {
  let s = '';
  DISTRITOS.forEach((d, i) => { s += `<path d="${d.d}" fill="${d.f}" stroke="${d.c}" stroke-width="1.2"${A('pop', kBase + i * 0.025, { s: 'transform-origin:50% 50%' })}/>`; });
  // Trama de manzanas: rejilla fina dentro de cada distrito (decorativa).
  DISTRITOS.forEach((d, i) => { const [x, y, w, h] = CAJAS[i]; for (let a = 0; a < 4; a++) s += `<rect x="${x + 2}" y="${y + 4 + a * (h / 4)}" width="${w - 4}" height="0.6" fill="${d.c}" opacity="0.35"${A('sube', kBase + 0.08 + i * 0.02)}/>`; });
  if (conEtiquetas) DISTRITOS.slice(0, 4).forEach((d, i) => { s += `<g${A('cae', kBase + 0.16 + i * 0.03)}>${R(d.lx - 2, d.ly - 9, d.n.length * 3.9 + 10, 12, 3, C('s-card'))}<rect x="${d.lx + 1}" y="${d.ly - 6.5}" width="2" height="7" fill="${d.c}"/>${T(d.lx + 6, d.ly - 0.5, d.n, 's-micro s-ink s-b')}</g>`; });
  return s;
}
ESCENAS.rutas = [
  { id: 'sorteo', marca: true, accion: 'Sorteo de manzanas', donde: 'Manzanas', titulo: 'Manzanas sorteadas por distrito',
    svg() {
      let s = mapaBase(0);
      let m = 0;
      DISTRITOS.forEach((d, i) => { puntosEn(40 + i, d.w * 3, CAJAS[i], d.d).forEach(([x, y]) => { s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3"${A('pop', 0.3 + (m++) * 0.0085, { c: 's-pt' })}/>`; }); });
      s += `<circle cx="182" cy="52" r="8"${A('pop', 0.66, { c: 's-ring' })}/>`;
      [0, 1].forEach(j => { s += `<g${A('cae', 0.7 + j * 0.05)}>${R(196 + j * 26, 44, 22, 14, 3, C('s-repl'))}${T(207 + j * 26, 54, `R${j + 1}`, 's-micro s-mute', 'middle')}</g>`; });
      s += `<g${A('sube', 0.5)}>${R(8, 178, 70, 16, 8, C('s-card'))}<rect x="15" y="182" width="8" height="8" rx="2" class="s-tone"/>${T(28, 189.5, 'UMP titular', 's-micro s-ink')}</g>`;
      s += `<g${A('pop', 0.8)}>${R(228, 172, 84, 22, 6, C('s-card'))}${T(236, 186, 'Titulares', 's-micro s-mute')}${T(304, 187, '150', 's-t s-ink s-b', 'end')}</g>`;
      return s;
    } },
  { id: 'territorio', accion: 'Distritos del estudio', donde: 'Territorio', titulo: 'Distritos del estudio',
    svg() {
      let s = T(12, 18, 'TERRITORIO', 's-eyebrow') + TA(12, 32, '6 de 50 distritos', 'sube', 0.62, 's-t s-ink s-b') + R(150, 26, 162, 166, 10, C('s-well'));
      const pesos = [30, 21, 18, 14, 10, 7];
      DISTRITOS.forEach((d, i) => {
        const y = 44 + i * 25, k = 0.04 + i * 0.08;
        s += `<g${A('sube', k)}><circle cx="18" cy="${y + 8}" r="3.5" fill="${d.c}"/>${T(26, y + 11, d.n, 's-t s-ink')}</g>`;
        s += R(96, y + 2, 20, 12, 6, C('s-track'));
        s += `<rect x="96" y="${y + 2}" width="20" height="12" rx="6"${A('pop', k + 0.05, { c: 's-tone', s: 'transform-origin:50% 50%' })}/><circle cx="110" cy="${y + 8}" r="4.4"${A('viaja', k + 0.05, { c: 's-white', s: '--dx:-8px;--dy:0px' })}/>`;
        s += `<rect x="12" y="${y + 18}" width="${pesos[i] * 3.4}" height="3" rx="1.5"${A('traza', k + 0.1, { s: `fill:${d.c}` })}/>`;
        s += `<g transform="translate(122 34) scale(0.62)"><path d="${d.d}" fill="${d.f}" stroke="${d.c}" stroke-width="2"${A('pop', k + 0.08)}/></g>`;
      });
      return s;
    } },
  { id: 'poblacion', accion: 'Población objetivo', donde: 'Población', titulo: 'Población por sexo y edad',
    svg() {
      let s = T(12, 18, 'POBLACIÓN OBJETIVO', 's-eyebrow') + TA(308, 18, '76.8 %', 'sube', 0.7, 's-t s-tonetxt s-b', 'end');
      const tramos = [['18–29', 0.28, 0.32], ['30–44', 0.3, 0.55], ['45–59', 0.24, 0.78], ['60+', 0.18, 1]] as const;
      let x = 12;
      tramos.forEach(([l, w, o], i) => { const ww = 296 * w; s += `<rect x="${x}" y="28" width="${ww - 2}" height="16" rx="4"${A('traza', i * 0.06, { c: 's-tone', s: `--op:${o}` })}/>${TA(x + 6, 39.5, l, 'sube', i * 0.06 + 0.04, 's-micro s-white-t')}`; x += ww; });
      s += T(110, 62, 'Hombres', 's-micro s-mute', 'end') + T(210, 62, 'Mujeres', 's-micro s-tonetxt', 'start');
      for (let i = 0; i < 9; i++) {
        const y = 70 + i * 13.5, base = 60 - Math.abs(i - 3) * 6, h = base + ((i * 7) % 9), m = base + ((i * 5) % 11);
        s += `<rect x="${158 - h}" y="${y}" width="${h}" height="10" rx="2.5"${A('traza', 0.2 + i * 0.04, { c: 's-gray', s: 'transform-origin:100% 50%' })}/>`;
        s += `<rect x="162" y="${y}" width="${m}" height="10" rx="2.5"${A('traza', 0.22 + i * 0.04, { c: 's-tone' })}/>`;
      }
      s += `<line x1="160" x2="160" y1="66" y2="194"${C('s-hair-l')}/>`;
      return s;
    } },
  { id: 'gps', accion: 'Puntos GPS', donde: 'Manzanas', titulo: 'Puntos GPS por manzana',
    svg() {
      // Encuestas georreferenciadas alrededor de la manzana sorteada, contra los umbrales de 150 y 300 m.
      let s = T(12, 18, 'PUNTOS GPS, MZ 0140', 's-eyebrow');
      const cx = 150, cy = 108;
      for (let j = -2; j <= 2; j++) for (let i = -3; i <= 3; i++) { const x = cx + i * 40 - 16, y = cy + j * 34 - 13; s += `<rect x="${x}" y="${y}" width="32" height="26" rx="4" class="s-block"/>`; }
      s += `<rect x="${cx - 16}" y="${cy - 13}" width="32" height="26" rx="4"${A('pop', 0.02, { c: 's-tone' })}/>`;
      s += `<circle cx="${cx}" cy="${cy}" r="46"${A('pop', 0.1, { c: 's-umbral' })}/><circle cx="${cx}" cy="${cy}" r="86"${A('pop', 0.14, { c: 's-umbral' })}/>`;
      s += TA(cx + 34, cy - 36, '150 m', 'sube', 0.12, 's-micro s-mute') + TA(cx + 62, cy - 66, '300 m', 'sube', 0.16, 's-micro s-mute');
      const pts = [[-10, 6], [8, -8], [14, 12], [-20, -14], [26, 2], [-4, 22], [40, -28], [-52, 18], [60, 30], [-30, -40], [104, -10], [-98, 46]] as const;
      pts.forEach(([dx, dy], i) => {
        const d = Math.hypot(dx, dy), cls = d > 86 ? 's-orange' : d > 46 ? 's-gps-mid' : 's-navy';
        s += `<circle cx="${cx + dx}" cy="${cy + dy}" r="3.4"${A('pop', 0.24 + i * 0.035, { c: cls })}/>`;
      });
      s += `<g${A('cae', 0.72)}>${R(258, 88, 52, 16, 8, C('s-card'))}${T(284, 99, 'a 340 m', 's-micro s-orange-t s-b', 'middle')}</g>`;
      s += `<g${A('sube', 0.6)}>${R(12, 180, 296, 16, 8, C('s-card'))}<circle cx="22" cy="188" r="3" class="s-navy"/>${T(28, 190.5, 'hasta 150 m', 's-micro s-ink')}<circle cx="92" cy="188" r="3" class="s-gps-mid"/>${T(98, 190.5, 'entre 150 y 300 m', 's-micro s-ink')}<circle cx="182" cy="188" r="3" class="s-orange"/>${T(188, 190.5, 'a más de 300 m', 's-micro s-ink')}</g>`;
      return s;
    } },
  { id: 'manzana', accion: 'Recorrido de la manzana', donde: 'Selección › Titulares', titulo: 'Recorrido de la UMP',
    svg() {
      // Esquema de la ficha de campo: manzana al centro, 8 aledañas en orden, esquinas 1–4, recorrido antihorario desde
      // la esquina 2 y, por el borde, un hogar visitado de cada dos (constante de salto 2).
      let s = T(12, 16, 'ESQUEMA DEL RECORRIDO', 's-eyebrow');
      const al = [['1', 58, 24, 84, 22], ['2', 150, 24, 28, 22], ['3', 150, 54, 28, 84], ['4', 150, 146, 28, 22], ['5', 58, 146, 84, 22], ['6', 22, 146, 28, 22], ['7', 22, 54, 28, 84], ['8', 22, 24, 28, 22]] as const;
      al.forEach(([n, x, y, w, h], i) => { s += `<g${A('pop', 0.02 + i * 0.025)}>${R(x, y, w, h, 3, C('s-block'))}${T(x + w / 2, y + h / 2 + 3, n, 's-micro s-mute', 'middle')}</g>`; });
      s += `<g${A('pop', 0.22)}>${R(62, 60, 76, 74, 3, C('s-manzana'))}${T(96, 112, 'MANZANA', 's-micro s-mute', 'middle')}</g>`;
      // Calles: flechas en sentido antihorario desde la esquina 2 (abajo a la derecha).
      s += `<rect x="145" y="62" width="2" height="72"${A('trazaV', 0.3, { c: 's-tone', s: 'transform-origin:50% 100%' })}/>`;
      s += `<rect x="64" y="51" width="72" height="2"${A('traza', 0.38, { c: 's-tone', s: 'transform-origin:100% 50%' })}/>`;
      s += `<rect x="53" y="62" width="2" height="72"${A('trazaV', 0.46, { c: 's-tone' })}/>`;
      s += `<rect x="64" y="141" width="72" height="2"${A('traza', 0.54, { c: 's-tone' })}/>`;
      ([['M146 64 l-4 7 h8 Z', 0.36], ['M66 52 l7 -4 v8 Z', 0.44], ['M54 132 l-4 -7 h8 Z', 0.52], ['M134 142 l-7 -4 v8 Z', 0.6]] as const).forEach(([d, k]) => { s += `<path d="${d}"${A('pop', k, { c: 's-tone' })}/>`; });
      ([[146, 52, '1'], [146, 142, '2'], [54, 142, '3'], [54, 52, '4']] as const).forEach(([x, y, n], i) => {
        const inicio = n === '2';
        s += `<g${A('pop', inicio ? 0.26 : 0.36 + i * 0.06)}><circle cx="${x}" cy="${y}" r="${inicio ? 7 : 6}" class="${inicio ? 's-tone' : 's-esquina'}"/>${T(x, y + 2.6, n, inicio ? 's-micro s-white-t s-b' : 's-micro s-tonetxt s-b', 'middle')}</g>`;
      });
      // Hogares por el borde interior: lado derecho de abajo arriba, arriba de derecha a izquierda, izquierda hacia abajo, abajo.
      const pts = [];
      for (let i = 0; i < 5; i++) pts.push([132, 126 - i * 15]);
      for (let i = 0; i < 5; i++) pts.push([122 - i * 13, 66]);
      for (let i = 0; i < 4; i++) pts.push([68, 78 + i * 15]);
      for (let i = 0; i < 4; i++) pts.push([80 + i * 13, 128]);
      let n = 1;
      pts.forEach(([x, y], i) => { const visita = i % 2 === 0;
        s += `<circle cx="${x}" cy="${y}" r="2.8"${A('pop', 0.32 + i * 0.022, { c: visita ? 's-inkfill' : 's-dot-hollow' })}/>`;
        if (visita && i < 6) { s += TA(x - 6, y + 2.5, String(n), 'sube', 0.34 + i * 0.022, 's-micro s-mute', 'end'); } if (visita) n += 2; });
      s += `<g${A('sube', 0.7)}><circle cx="16" cy="188" r="3.4" class="s-tone"/>${T(22, 190.5, 'inicio', 's-micro s-mute')}<circle cx="54" cy="188" r="2.8" class="s-inkfill"/>${T(60, 190.5, 'visita', 's-micro s-mute')}<circle cx="92" cy="188" r="2.8" class="s-dot-hollow"/>${T(98, 190.5, 'salto', 's-micro s-mute')}<rect x="124" y="184" width="8" height="8" rx="1.5" class="s-block"/>${T(136, 190.5, 'aledañas, en orden', 's-micro s-mute')}</g>`;
      // Datos del recorrido, como en la ficha.
      ([['ESQUINA DE INICIO', '2', 'sureste'], ['SENTIDO', 'Antihorario', ''], ['CONSTANTE DE SALTO', '2', 'uno de cada 2 hogares']] as const).forEach(([l, v, d], i) => {
        const y = 24 + i * 52;
        s += `<g${A('cae', 0.12 + i * 0.08)}>${R(196, y, 114, 44, 6, C('s-well'))}${T(204, y + 13, l, 's-eyebrow s-mute')}${T(204, y + 32, v, v.length > 2 ? 's-t s-ink s-b' : 's-num-s s-ink')}${d ? T(v.length > 2 ? 260 : 220, y + 31, d, 's-micro s-mute') : ''}</g>`;
      });
      return s;
    } },
];

// ---------------------------------------------------------------- Material de campo
function qr(x: number, y: number, size: number, k0: number, seed: number, step = 0.006): string {
  const r = rng(seed), n = 11, c = size / n; let s = '';
  ([[0, 0], [n - 3, 0], [0, n - 3]] as const).forEach(([i, j], q) => { s += `<g${A('pop', k0 + q * 0.03)}><rect x="${x + i * c + c * 0.3}" y="${y + j * c + c * 0.3}" width="${c * 2.4}" height="${c * 2.4}" rx="${c * 0.4}" fill="none" stroke="var(--pulso-text)" stroke-width="${c * 0.6}"/><rect x="${x + i * c + c}" y="${y + j * c + c}" width="${c}" height="${c}" fill="var(--pulso-text)"/></g>`; });
  let m = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const fin = (i < 3 && j < 3) || (i > n - 4 && j < 3) || (i < 3 && j > n - 4);
    if (!fin && r() < 0.5) s += `<rect x="${(x + i * c).toFixed(1)}" y="${(y + j * c).toFixed(1)}" width="${(c * 0.92).toFixed(1)}" height="${(c * 0.92).toFixed(1)}" fill="var(--pulso-text)"${A('pop', k0 + 0.1 + ((i + j) / (2 * n)) * 0.25 + (m++ % 3) * step)}/>`;
  }
  return s;
}
function hojaA4(x: number, y: number, w: number, k0: number, seed: number, titulo: string): string {
  const h = w * 1.414; let s = R(x, y, w, h, 2, C('s-paper'));
  s += `<rect x="${x + w * 0.1}" y="${y + h * 0.04}" width="${w * 0.04}" height="${h * 0.05}" class="s-hair-d"/><rect x="${x + w * 0.17}" y="${y + h * 0.05}" width="${w * 0.3}" height="${h * 0.022}" rx="1" class="s-navy"/>`;
  s += qr(x + w * 0.28, y + h * 0.12, w * 0.44, k0, seed, 0);
  s += `<rect x="${x + w * 0.1}" y="${y + h * 0.5}" width="${w * 0.5}" height="${h * 0.03}" rx="1" class="s-navy"/>`;
  for (let i = 0; i < 4; i++) s += `<rect x="${x + w * 0.1}" y="${y + h * (0.58 + i * 0.07)}" width="${w * (0.3 + (i % 2) * 0.35)}" height="${h * 0.012}" rx="0.6" class="s-hair-d"/>`;
  if (titulo) s += T(x + w * 0.9, y + h * 0.075, titulo, 's-micro s-navy-t s-b', 'end');
  return s;
}
ESCENAS.material = [
  { id: 'fichas', marca: true, accion: 'Fichas con QR', donde: 'Paquetes', titulo: 'Fichas con QR por unidad',
    svg() {
      let s = T(12, 18, 'UNIDADES', 's-eyebrow');
      for (let i = 0; i < 5; i++) { const y = 28 + i * 26; s += `<g${A('cae', i * 0.04)}>${R(12, y, 104, 20, 6, C('s-card'))}<circle cx="23" cy="${y + 10}" r="3" class="s-tone"/>${T(31, y + 13.5, `CH ${i + 1}`, 's-t s-ink s-b')}${T(108, y + 13.5, 'con enlace', 's-micro s-okt', 'end')}</g>`; }
      ([[-4, 0], [0, 1], [3, 2]] as const).forEach(([rot, i]) => {
        const k = 0.22 + i * 0.13;
        s += `<g transform="rotate(${rot} 210 100)"><g${A('viaja', k, { s: `--dx:${-120}px;--dy:${-60 + i * 26}px` })}>${hojaA4(172, 22, 80, k + 0.06, 9 + i, i === 2 ? `CH ${i + 1}` : '')}</g></g>`;
      });
      s += `<g${A('pop', 0.82)}>${R(232, 150, 56, 24, 7, C('s-tone'))}${T(260, 166, 'ZIP ✓', 's-t s-white-t s-b', 'middle')}</g>`;
      return s;
    } },
  { id: 'editor', accion: 'Bloques de la ficha', donde: 'Catálogo › Editor', titulo: 'Ficha de aula: ocho bloques',
    svg() {
      let s = T(12, 18, 'FICHA DE AULA: 8 BLOQUES', 's-eyebrow');
      const b = ['Cabecera de marca', 'Título', 'Texto', 'QR de acceso', 'Campos de la unidad', 'Registro de aplicación', 'Pie de página'];
      b.forEach((l, i) => {
        const y = 26 + i * 24, k = 0.05 + i * 0.1;
        s += `<g${A('sube', i * 0.02)}><circle cx="20" cy="${y + 10}" r="3.2" class="${i % 3 === 0 ? 's-dot-hollow' : 's-tone'}"/>${T(30, y + 13.5, l, 's-t s-ink')}</g>`;
        s += `<rect x="10" y="${y}" width="118" height="20" rx="6"${A('destella', k, { c: 's-soft-st' })}/>`;
      });
      const x = 166, y = 12, w = 124, h = 176;
      s += R(150, 6, 162, 188, 8, C('s-well')) + R(x, y, w, h, 2, C('s-paper'));
      s += `<rect x="${x + 10}" y="${y + 8}" width="3" height="12"${A('pop', 0.05, { c: 's-hair-d' })}/><rect x="${x + 16}" y="${y + 10}" width="30" height="5" rx="1"${A('traza', 0.16, { c: 's-navy' })}/>`;
      s += `<rect x="${x + 10}" y="${y + 26}" width="104" height="1"${A('traza', 0.26, { c: 's-hair-d' })}/>`;
      s += qr(x + 34, y + 34, 56, 0.34, 21, 0);
      s += `<rect x="${x + 10}" y="${y + 100}" width="60" height="6" rx="1"${A('traza', 0.5, { c: 's-navy' })}/>`;
      for (let i = 0; i < 3; i++) s += `<rect x="${x + 10}" y="${y + 112 + i * 9}" width="${40 + (i % 2) * 30}" height="2.4" rx="1"${A('traza', 0.56 + i * 0.03, { c: 's-hair-d' })}/>`;
      for (let i = 0; i < 3; i++) s += `<rect x="${x + 10}" y="${y + 144 + i * 8}" width="104" height="0.8"${A('traza', 0.68 + i * 0.03, { c: 's-hair-d' })}/>`;
      s += `<g${A('pop', 0.8)}><circle cx="${x + 18}" cy="${y + 168}" r="5" class="s-navy"/>${T(x + 26, y + 170, 'PULSO PUCP', 's-micro s-navy-t s-b')}</g>`;
      return s;
    } },
  { id: 'catalogo', accion: 'Tipos de material', donde: 'Catálogo › Tipos', titulo: 'Fichas, croquis y hojas de ruteo',
    svg() {
      let s = T(12, 18, 'CATÁLOGO', 's-eyebrow');
      const tipos = [['Ficha de aula con QR', 'qr'], ['Ficha de campo con croquis', 'croquis'], ['Hoja de ruteo', 'tabla']] as const;
      tipos.forEach(([n, t], i) => {
        const x = 12 + i * 102, k = i * 0.12;
        s += `<g${A('cae', k)}>${R(x, 28, 94, 164, 10, C(i === 1 ? 's-card-sel' : 's-card'))}${R(x + 8, 36, 78, 104, 6, C('s-well'))}</g>`;
        if (t === 'qr') s += `<g${A('sube', k + 0.06)}>${hojaA4(x + 22, 40, 50, k + 0.1, 33, '')}</g>`;
        if (t === 'croquis') s += `<g transform="rotate(-5 ${x + 47} 88)"><g${A('sube', k + 0.06)}>${R(x + 20, 44, 52, 74, 2, C('s-paper'))}</g></g><g transform="rotate(4 ${x + 47} 88)"><g${A('sube', k + 0.1)}>${R(x + 22, 48, 52, 74, 2, C('s-paper'))}${R(x + 28, 56, 40, 34, 2, C('s-block'))}<path d="M${x + 32} 84 L${x + 44} 70 L${x + 54} 78 L${x + 64} 62" fill="none" stroke="var(--pulso-module-routes)" stroke-width="1.6"/></g></g>`;
        if (t === 'tabla') { s += `<g${A('sube', k + 0.06)}>${R(x + 20, 42, 54, 92, 2, C('s-paper'))}</g>`; for (let r = 0; r < 9; r++) s += `<rect x="${x + 24}" y="${50 + r * 9}" width="46" height="0.8"${A('traza', k + 0.12 + r * 0.02, { c: 's-hair-d' })}/>`; }
        s += `${TA(x + 8, 156, n.split(' ').slice(0, 3).join(' '), 'sube', k + 0.1, 's-t s-ink s-b')}${TA(x + 8, 168, n.split(' ').slice(3).join(' ') || 'A4, por unidad', 'sube', k + 0.12, 's-micro s-mute')}`;
      });
      s += `<g${A('pop', 0.62)}>${R(122, 176, 70, 12, 6, C('s-tone'))}${T(157, 184.5, 'En uso', 's-micro s-white-t s-b', 'middle')}</g>`;
      return s;
    } },
  { id: 'paquetes', accion: 'Paquetes', donde: 'Paquetes', titulo: 'Paquetes de la campaña',
    svg() {
      let s = T(12, 18, 'PAQUETES DE LA CAMPAÑA', 's-eyebrow');
      const p = [['Fichas de aula', 'ZIP', '30 PDF'], ['Hoja de ruteo', 'PDF', '60 filas'], ['Consolidado', 'XLSX', '30 unidades'], ['Accesos', 'XLSX', '30 enlaces'], ['Hoja del día', 'PDF', 'por jornada']] as const;
      p.forEach(([n, f, d], i) => {
        const y = 28 + i * 33, k = i * 0.07, kk = 0.36 + i * 0.09;
        s += `<g${A('cae', k)}>${R(12, y, 296, 27, 7, C('s-card'))}${R(20, y + 7, 30, 13, 4, C('s-soft'))}${T(35, y + 16.5, f, 's-micro s-tonetxt s-b', 'middle')}${T(58, y + 12, n, 's-t s-ink s-b')}${T(58, y + 22, d, 's-micro s-mute')}</g>`;
        s += `<g${A('pop-atenua0', k + 0.06, { s: `--k2:${kk}` })}>${R(246, y + 6, 54, 15, 7.5, C('s-card-b'))}${T(273, y + 16.5, 'Generar', 's-micro s-ink s-b', 'middle')}</g>`;
        s += `<rect x="150" y="${y + 12}" width="88" height="3" rx="1.5"${A('traza', kk - 0.08, { c: 's-tone' })}/>`;
        s += `<g${A('pop', kk)}>${R(246, y + 6, 54, 15, 7.5, C('s-ok-bg'))}${T(273, y + 16.5, '✓ Listo', 's-micro s-okt s-b', 'middle')}</g>`;
      });
      return s;
    } },
  { id: 'campanas', accion: 'Materiales por campaña', donde: 'Campañas', titulo: 'Materiales por campaña',
    svg() {
      let s = T(12, 18, 'CAMPAÑAS', 's-eyebrow');
      const G = {
        mochila: '<path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 10h8"/><path d="M8 18h8"/><path d="M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
        pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
        fono: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
        sobre: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'
      };
      const c = [['Campo en aulas', 'mochila', '30 cursos-horario', 1], ['Territorial', 'pin', '150 manzanas', 0.72], ['Telefónica', 'fono', '412 casos', 0.48], ['Correo', 'sobre', '2,373 contactos', 0.86]] as const;
      c.forEach(([n, g, d, v], i) => {
        const x = 12 + (i % 2) * 150, y = 28 + Math.floor(i / 2) * 84, k = i * 0.1;
        s += `<g${A('cae', k)}>${R(x, y, 144, 76, 10, C('s-card'))}${R(x + 10, y + 10, 24, 24, 7, C('s-soft'))}<svg x="${x + 15}" y="${y + 15}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${G[g]}</svg>${T(x + 42, y + 21, n, 's-t s-ink s-b')}${T(x + 42, y + 31, d, 's-micro s-mute')}</g>`;
        s += R(x + 10, y + 50, 124, 5, 2.5, C('s-track')) + `<rect x="${x + 10}" y="${y + 50}" width="${124 * v}" height="5" rx="2.5"${A('traza', k + 0.2, { c: 's-tone' })}/>`;
        s += TA(x + 10, y + 68, `${Math.round(v * 100)} % con material`, 'sube', k + 0.3, 's-micro s-mute');
      });
      return s;
    } }
];

// ---------------------------------------------------------------- Monitoreo
function anillo(cx: number, cy: number, r: number, frac: number, k: number, cls = 's-tone-st', ancho = 6): string {
  const L = 2 * Math.PI * r;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke-width="${ancho}" class="s-track-st"/><g transform="rotate(-90 ${cx} ${cy})"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke-width="${ancho}" stroke-linecap="round" stroke-dasharray="${(L * Math.min(frac, 1)).toFixed(1)} ${L.toFixed(1)}"${A('gira', k, { c: cls })}/></g>`;
}
ESCENAS.monitoreo = [
  { id: 'meta', marca: true, accion: 'Avance contra la meta', donde: 'Avance › Resumen', titulo: 'Avance contra la meta',
    svg() {
      const cid = uid('cl');
      let s = anillo(36, 36, 22, 1, 0.66) + TA(36, 40, '104 %', 'pop', 0.7, 's-t s-ink s-b', 'middle');
      s += TA(70, 30, '1,248', 'sube', 0.66, 's-num-s s-ink') + TA(114, 30, '/ 1,200', 'sube', 0.66, 's-t s-mute');
      s += T(70, 42, 'Cuentan para la meta', 's-micro s-mute');
      s += `<g${A('pop', 0.8)}>${R(70, 47, 82, 13, 6.5, C('s-ok-bg'))}${T(111, 56.5, '✓ Meta alcanzada', 's-micro s-okt s-b', 'middle')}</g>`;
      s += `<g${A('traza', 0.02)}><line x1="16" x2="306" y1="86" y2="86" class="s-meta-st"/></g>${TA(18, 97, 'Meta (1,200)', 'sube', 0.04, 's-micro s-tonetxt')}`;
      const alturas = [38, 42, 70, 46, 55, 50, 34, 22, 8, 30, 44, 16, 9, 6, 9, 5, 3, 4];
      alturas.forEach((h, i) => { const x = 18 + i * 16; s += `<rect x="${x}" y="${186 - h}" width="10" height="${h}" rx="1.5"${A('crece', 0.08 + i * 0.022, { c: 's-gray' })}/>`; if (i % 3 === 1) s += `<rect x="${x}" y="${183}" width="10" height="3"${A('crece', 0.1 + i * 0.022, { c: 's-orange' })}/>`; });
      s += `<defs><clipPath id="${cid}"><rect x="12" y="60" width="300" height="130"${A('traza', 0.24, { s: '--dur-a:1.6s' })}/></clipPath></defs>`;
      s += `<path d="M22 176 C60 160 90 130 130 110 S200 90 230 84 S280 80 300 79" fill="none" stroke-width="2.4" class="s-navy-st" clip-path="url(#${cid})"/>`;
      s += `<circle cx="214" cy="86" r="4"${A('pop', 0.6, { c: 's-navy' })}/>`;
      return s;
    } },
  { id: 'consistencia', accion: 'Plataforma y campo', donde: 'Control', titulo: 'Plataforma frente a lo reportado en campo',
    svg() {
      // Por encuestador: encuestas en la plataforma y encuestas que reportó en campo; la diferencia queda marcada.
      let s = T(12, 18, 'PLATAFORMA Y REPORTE DE CAMPO', 's-eyebrow');
      s += `<g${A('sube', 0)}><rect x="186" y="10" width="8" height="8" rx="2" class="s-navy"/>${T(198, 17, 'Plataforma', 's-micro s-ink')}<rect x="246" y="10" width="8" height="8" rx="2" class="s-tone"/>${T(258, 17, 'Campo', 's-micro s-ink')}</g>`;
      const f = [[42, 42], [38, 41], [45, 45], [33, 30], [40, 40], [36, 39]] as const;
      f.forEach(([p, c], i) => {
        const y = 30 + i * 25, k = 0.06 + i * 0.08, d = c - p;
        s += TA(12, y + 12, `Encuestador ${String(i + 1).padStart(2, '0')}`, 'sube', k, 's-t s-ink');
        s += `<rect x="100" y="${y + 3}" width="${p * 3.4}" height="6" rx="3"${A('traza', k + 0.03, { c: 's-navy' })}/>`;
        s += `<rect x="100" y="${y + 11}" width="${c * 3.4}" height="6" rx="3"${A('traza', k + 0.06, { c: 's-tone' })}/>`;
        s += d === 0 ? `<g${A('pop', k + 0.12)}>${R(270, y + 3, 38, 14, 7, C('s-ok-bg'))}${T(289, y + 12.5, '✓ igual', 's-micro s-okt s-b', 'middle')}</g>`
                     : `<g${A('pop', k + 0.12)}>${R(270, y + 3, 38, 14, 7, C('s-warn-bg'))}${T(289, y + 12.5, (d > 0 ? '+' : '−') + Math.abs(d), 's-micro s-warnt s-b', 'middle')}</g>`;
      });
      s += `<g${A('sube', 0.7)}>${R(12, 182, 296, 0.8, 0, C('s-hair-d'))}${T(12, 194, 'Total', 's-t s-ink s-b')}${T(100, 194, '234 en plataforma, 237 en campo', 's-micro s-mute')}${T(308, 194, '3 por cuadrar', 's-micro s-warnt s-b', 'end')}</g>`;
      return s;
    } },
  { id: 'cuotas', accion: 'Avance por cuota', donde: 'Avance › Por cuota', titulo: 'Avance por cuota',
    svg() {
      let s = '';
      ([[0.59, 'Docentes'], [0.58, 'Estudiantes'], [0.71, 'Egresados'], [0.44, 'Empleadores']] as const).forEach(([v, n], i) => { const cx = 40 + i * 80; s += anillo(cx, 36, 18, v, i * 0.06, 's-tone-st', 5) + TA(cx, 40, `${Math.round(v * 100)} %`, 'pop', i * 0.06 + 0.08, 's-micro s-ink s-b', 'middle') + T(cx, 68, n, 's-micro s-mute', 'middle'); });
      const filas = [['Ciencias Sociales', 0.9, 1], ['Ingeniería', 0.62, 0], ['Derecho', 1, 1], ['Gestión', 0.48, 0], ['Letras', 0.74, 0]] as const;
      filas.forEach(([n, v, ok], i) => {
        const y = 80 + i * 23, k = 0.3 + i * 0.07;
        s += TA(12, y + 10, n, 'sube', k, 's-t s-ink');
        s += R(110, y + 3, 130, 8, 4, C('s-track')) + `<rect x="110" y="${y + 3}" width="${130 * Math.min(v, 1)}" height="8" rx="4"${A('traza', k + 0.03, { c: 's-navy' })}/><rect x="${110 + 130 * 0.84}" y="${y}" width="2" height="14" class="s-inkfill"/>`;
        s += ok ? `<g${A('pop', k + 0.12)}>${R(248, y + 1, 60, 12, 6, C('s-ok-bg'))}${T(278, y + 9.5, 'Completa', 's-micro s-okt s-b', 'middle')}</g>` : `<g${A('pop', k + 0.12)}>${R(248, y + 1, 60, 12, 6, C('s-warn-bg'))}${T(278, y + 9.5, `faltan ${Math.round((0.84 - v) * 100 + 20)}`, 's-micro s-warnt s-b', 'middle')}</g>`;
      });
      return s;
    } },
  { id: 'correo', accion: 'Envíos por correo', donde: 'Avance › Correo', titulo: 'Envíos, aperturas y respuestas',
    svg() {
      const hid = uid('ht');
      let s = `<defs><pattern id="${hid}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="5" fill="var(--pulso-module-monitoring)" opacity="0.18"/></pattern></defs>`;
      s += T(12, 18, 'EMBUDO DEL CORREO', 's-eyebrow');
      const e = [['Enviados', 240], ['Entregados', 236], ['Abrieron', 172], ['Clic', 61], ['Respondieron', 48]] as const;
      e.forEach(([n, v], i) => {
        const x = 18 + i * 60, h = v / 240 * 130, k = i * 0.12;
        s += `<rect x="${x}" y="${176 - 130}" width="44" height="130" rx="4" fill="url(#${hid})"${A('sube', k)}/>`;
        s += `<rect x="${x}" y="${176 - h}" width="44" height="${h}" rx="4"${A('crece', k + 0.04, { c: 's-tone' })}/>`;
        s += TA(x + 22, 170 - h, String(v), 'sube', k + 0.1, 's-t s-ink s-b', 'middle');
        s += T(x + 22, 190, n, 's-micro s-mute', 'middle');
        if (i) s += `<rect x="${x - 12}" y="104" width="8" height="2"${A('traza', k, { c: 's-hair-d' })}/>`;
      });
      return s;
    } },
  { id: 'distritos', accion: 'Pendientes por distrito', donde: 'Avance › Mapa (territorial)', titulo: 'Pendientes por distrito',
    svg() {
      // Avance › Mapa: distritos sobre el territorio, UMP por estado y, a la derecha, cifras, avance por distrito y celdas pendientes.
      let s = `<rect x="6" y="6" width="166" height="188" rx="8"${A('sube', 0, { c: 's-tierra' })}/>`;
      const esc = 0.68, tx = -35.4, ty = 32;
      DISTRITOS.forEach((d, i) => { s += `<g transform="translate(${tx} ${ty}) scale(${esc})"><path d="${d.d}" class="s-dist-blanco"${A('pop', 0.02 + i * 0.03)}/></g>`; });
      let m = 0;
      DISTRITOS.forEach((d, i) => { puntosEn(80 + i, d.w * 3, CAJAS[i], d.d).forEach(([x, y], j) => {
        const cls = j % 7 === 3 ? 's-navy' : j % 11 === 5 ? 's-dot-hollow' : 's-completa';
        s += `<circle cx="${(tx + x * esc).toFixed(1)}" cy="${(ty + y * esc).toFixed(1)}" r="1.9"${A('pop', 0.16 + (m++) * 0.006, { c: cls })}/>`; }); });
      ([[88, 67, 'UMP 96'], [33, 93, 'UMP 143']] as const).forEach(([x, y, n], i) => {
        s += `<circle cx="${x}" cy="${y}" r="7"${A('pop', 0.6 + i * 0.06, { c: 's-halo' })}/><circle cx="${x}" cy="${y}" r="3"${A('pop', 0.6 + i * 0.06, { c: 's-orange' })}/>${TA(x + 9, y + 3, n, 'sube', 0.62 + i * 0.06, 's-micro s-orange-t s-b')}`; });
      ([['Completas', '128', 's-completa', ''], ['Subsanadas', '20', 's-navy', ''], ['Pendientes', '2', 's-orange', 'w']] as const).forEach(([l, v, c, w], i) => {
        const x = 178 + i * 46;
        s += `<g${A('cae', 0.04 + i * 0.04)}>${R(x, 6, 44, 34, 6, C(w ? 's-warn-card' : 's-card'))}${T(x + 4, 16.5, l, 's-micro s-mute')}<circle cx="${x + 8}" cy="29" r="2.6" class="${c}"/>${T(x + 14, 34, v, 's-num-s s-ink')}</g>`; });
      s += T(180, 54, 'UMP POR DISTRITO', 's-eyebrow s-mute');
      ([[24, 1], [24, 1], [25, 0], [25, 0], [25, 0], [25, 0]] as const).forEach(([v, p], i) => {
        const y = 62 + i * 15, k = 0.2 + i * 0.05;
        s += TA(180, y + 7, DISTRITOS[i].n.replace('Distrito ', ''), 'sube', k, 's-micro s-ink');
        s += `<rect x="222" y="${y + 2}" width="${v / 25 * 64 * 0.8}" height="6" rx="1"${A('traza', k + 0.02, { c: 's-completa' })}/><rect x="${222 + v / 25 * 64 * 0.8}" y="${y + 2}" width="${v / 25 * 64 * 0.2}" height="6"${A('traza', k + 0.05, { c: 's-navy' })}/>`;
        if (p) s += `<rect x="${222 + v / 25 * 64}" y="${y + 2}" width="2.6" height="6" rx="1"${A('pop', k + 0.08, { c: 's-orange' })}/>`;
        s += TA(312, y + 8, `${v}/25`, 'sube', k + 0.06, 's-micro s-mute', 'end'); });
      s += T(180, 160, 'CELDA DE CUOTA PENDIENTE', 's-eyebrow s-mute');
      ([['UMP 96', 'norte'], ['UMP 143', 'oeste']] as const).forEach(([u, d], i) => {
        const y = 166 + i * 16;
        s += `<g${A('cae', 0.66 + i * 0.05)}>${R(180, y, 132, 13, 4, C('s-card'))}${T(185, y + 9, u, 's-micro s-ink s-b')}${T(226, y + 9, d, 's-micro s-mute')}${T(308, y + 9, 'Falta 1', 's-micro s-orange-t s-b', 'end')}</g>`; });
      return s;
    } },
];

// ---------------------------------------------------------------- Procesamiento
const RAMPA: string[] = ['color-mix(in srgb, var(--pulso-module-processing) 18%, var(--pulso-surface))', 'color-mix(in srgb, var(--pulso-module-processing) 38%, var(--pulso-surface))', 'color-mix(in srgb, var(--pulso-module-processing) 64%, var(--pulso-surface))', 'var(--pulso-module-processing)', 'color-mix(in srgb, var(--pulso-module-processing) 78%, var(--pulso-text))'];
ESCENAS.proc = [
  { id: 'codificar', marca: true, accion: 'Codificación de abiertas', donde: 'Codificación › Codificar', titulo: 'Respuestas abiertas y sus códigos',
    svg() {
      let s = '';
      ([['Respuestas', '3', 's-ink'], ['Codificadas', '3', 's-tonetxt'], ['Sin codificar', '0', 's-mute'], ['Grupos', '2', 's-tonetxt']] as const).forEach(([l, v, c], i) => { s += `<g${A('sube', i * 0.03)}>${T(14 + i * 76, 18, v, `s-num-s ${c}`)}${T(14 + i * 76, 28, l, 's-micro s-mute')}</g>`; });
      ([[0, '101', 'Seguimiento'], [1, '102', 'Positiva o neutra']] as const).forEach(([i, c, n]) => {
        const y = 38 + i * 56;
        s += `<g${A('pop', 0.12 + i * 0.05, { s: 'transform-origin:50% 50%' })}>${R(166, y, 142, 48, 9, C('s-group'))}${R(174, y + 6, 26, 14, 4, C('s-card'))}${T(187, y + 16, c, 's-micro s-mono s-ink s-b', 'middle')}${T(206, y + 16, n, 's-micro s-ink')}</g>`;
      });
      // Cada respuesta viaja a su grupo: seguimiento → 101; positiva y sin comentario → 102.
      const resp = [['La experiencia fue positiva', '20 veces', 120], ['Necesita más seguimiento', '14 veces', 64], ['Sin comentario adicional', '38 veces', 132]] as const;
      resp.forEach(([t, v, yd], i) => {
        const y = 40 + i * 30, k = 0.06 + i * 0.05, kv = 0.32 + i * 0.1;
        s += `<g${A('cae', k)}>${R(12, y, 140, 24, 6, C('s-card'))}<rect x="18" y="${y + 7}" width="9" height="9" rx="2" class="s-check-box"/>${T(32, y + 11, t, 's-micro s-ink')}${T(32, y + 20, v, 's-micro s-mute')}</g>`;
        s += `<rect x="19.5" y="${y + 8.5}" width="6" height="6" rx="1.2"${A('pop', kv - 0.02, { c: 's-tone' })}/>`;
        s += `<g${A('viaja', kv, { s: `--dx:${-(174 - 18)}px;--dy:${y - yd}px` })}>${R(174, yd, 126, 10, 5, C('s-chip-teal'))}${T(180, yd + 7.2, t, 's-micro s-tonetxt')}</g>`;
      });
      s += `<g${A('late', 0.42)}><rect x="166" y="38" width="142" height="48" rx="9" class="s-group-ring"/></g><g${A('late', 0.52)}><rect x="166" y="94" width="142" height="48" rx="9" class="s-group-ring"/></g>`;
      ([[0, '101', 14], [1, '102', 58]] as const).forEach(([i, c, v]) => {
        const y = 158 + i * 18;
        s += TA(14, y + 8, c, 'sube', 0.66 + i * 0.04, 's-micro s-mono s-ink s-b');
        s += `<rect x="40" y="${y + 1}" width="${v * 3.9}" height="10" rx="3"${A('traza', 0.68 + i * 0.04, { c: 's-tone' })}/>` + TA(46 + v * 3.9, y + 9, String(v), 'sube', 0.76 + i * 0.04, 's-micro s-ink s-b');
      });
      return s;
    } },
  { id: 'laminas', accion: 'Láminas del informe', donde: 'Gráficos › Láminas', titulo: 'Láminas del informe',
    svg() {
      let s = R(14, 6, 292, 150, 4, C('s-paper-sh'));
      s += TA(30, 22, 'ANTETÍTULO', 'sube', 0.02, 's-micro s-faint');
      s += TA(30, 38, 'COMPETENCIAS DE SALIDA', 'sube', 0.06, 's-lam-tit');
      s += `<g${A('cae', 0.12)}>${R(30, 46, 260, 92, 6, C('s-well'))}${R(38, 56, 10, 10, 3, C('s-soft'))}<path d="M40.5 63.5 L43 59 L45.5 63.5 Z" class="s-tone"/>${T(52, 64, 'Radar', 's-t s-tonetxt s-b')}${T(38, 78, 'Comunicación visual', 's-t s-ink s-b')}</g>`;
      ['Docentes', 'Estudiantes'].forEach((n, i) => { s += `<g${A('pop', 0.2 + i * 0.04)}>${R(38 + i * 48, 86, 44, 12, 6, C('s-chip-teal'))}${T(60 + i * 48, 94.5, n, 's-micro s-tonetxt s-b', 'middle')}</g>`; });
      ([[0.4, 0.95], [0.5, 0.82], [0.32, 0.74], [0.62, 0.9]] as const).forEach(([a, b], i) => {
        const y = 62 + i * 18, x0 = 196, w = 84, k = 0.3 + i * 0.07;
        s += `<rect x="${x0 - 26}" y="${y - 1.5}" width="20" height="3" rx="1.5" class="s-gray"/>`;
        s += `<rect x="${x0 + w * a}" y="${y - 1.2}" width="${w * (b - a)}" height="2.4" rx="1.2"${A('traza', k + 0.04, { c: 's-teal-l' })}/>`;
        s += `<circle cx="${x0 + w * a}" cy="${y}" r="4"${A('pop', k, { c: 's-teal-l2' })}/><circle cx="${x0 + w * b}" cy="${y}" r="4.6"${A('pop', k + 0.1, { c: 's-tone' })}/>`;
      });
      s += TA(30, 150, 'Base: 115 docentes y 279 estudiantes', 'sube', 0.56, 's-micro s-faint');
      for (let i = 0; i < 6; i++) {
        const x = 14 + i * 50, nuevo = i === 5, k = nuevo ? 0.78 : 0.04 + i * 0.02;
        s += `<g${A(nuevo ? 'pop' : 'sube', k)}>${R(x, 164, 42, 28, 3, C(nuevo ? 's-thumb-sel' : 's-paper'))}<rect x="${x + 4}" y="168" width="18" height="2" fill="var(--pulso-module-monitoring)"/><rect x="${x + 4}" y="174" width="30" height="1.6" class="s-hair-d"/><rect x="${x + 4}" y="178" width="22" height="1.6" class="s-teal-l"/>${R(x + 30, 184, 11, 7, 2, C('s-num-chip'))}${T(x + 35.5, 189.5, String(28 + i), 's-micro s-white-t', 'middle')}</g>`;
      }
      return s;
    } },
  { id: 'validar', accion: 'Reglas de validación', donde: 'Validación › Reglas', titulo: 'Reglas del formulario: 94',
    svg() {
      // Un barrido revisa caso por caso; las celdas que incumplen una regla quedan en ámbar y la regla suma sus casos.
      let s = T(12, 18, 'REGLAS DEL FORMULARIO: 94', 's-eyebrow');
      const cols = [['caso', 12, 34], ['p2 edad', 48, 34], ['p5 sexo', 84, 34], ['p7 horas', 120, 40], ['p9 inst.', 162, 38]] as const;
      s += R(8, 26, 196, 16, 4, C('s-head'));
      cols.forEach(([c, x]) => { s += T(x, 37, c, 's-micro s-mono s-mute'); });
      const filas = [['c001', '23', 'M', '20', '1'], ['c002', '19', 'H', '35', '2'], ['c003', '12', 'M', '15', '1'], ['c004', '31', 'H', '90', '3'], ['c005', '44', 'M', '25', '2'], ['c006', '8', 'H', '10', '1'], ['c007', '27', 'M', '30', '4']] as const;
      const malas: Record<string, number> = { '2,1': 0, '5,1': 0, '3,3': 1 };
      filas.forEach((f, r) => {
        const y = 44 + r * 19, k = 0.04 + r * 0.02;
        s += `<g${A('sube', k)}><line x1="8" x2="204" y1="${y + 18}" y2="${y + 18}" class="s-hair"/>${f.map((v, c) => malas[r + ',' + c] !== undefined ? '' : T(cols[c][1], y + 12.5, v, c ? 's-micro s-mono s-ink' : 's-micro s-mono s-mute')).join('')}</g>`;
        f.forEach((v, c) => { const regla = malas[r + ',' + c]; if (regla !== undefined) {
          const kk = 0.16 + r * 0.075;
          s += `<rect x="${cols[c][1] - 4}" y="${y + 2}" width="${cols[c][2] - 4}" height="15" rx="3"${A('pop', kk, { c: 's-warn-cell', s: '--op:0.75' })}/>${TA(cols[c][1], y + 12.5, v, 'pop', kk, 's-micro s-mono s-warnt s-b')}`; } });
      });
      s += `<rect x="8" y="44" width="196" height="19" rx="3"${A('barre-v', 0.1, { c: 's-sweep-teal', s: '--dy:114px' })}/>`;
      const reglas = [['R07', 'Edad entre 15 y 99', '2 casos', 0.36], ['R12', 'Horas semanales ≤ 60', '1 caso', 0.42], ['R19', 'Sexo con respuesta', '0 casos', null]] as const;
      reglas.forEach(([id, n, c, kk], i) => {
        const y = 28 + i * 54;
        s += `<g${A('cae', 0.02 + i * 0.04)}>${R(214, y, 96, 46, 8, C('s-card'))}${T(222, y + 13, id, 's-micro s-mono s-tonetxt s-b')}${T(222, y + 25, n, 's-micro s-ink')}</g>`;
        s += kk === null ? `<g${A('pop', 0.62)}>${R(222, y + 30, 50, 11, 5.5, C('s-ok-bg'))}${T(247, y + 38, '✓ 0 casos', 's-micro s-okt s-b', 'middle')}</g>`
                         : `<g${A('pop', kk + 0.1)}>${R(222, y + 30, 50, 11, 5.5, C('s-warn-bg'))}${T(247, y + 38, c, 's-micro s-warnt s-b', 'middle')}</g>`;
      });
      s += `<g${A('sube', 0.66)}>${T(214, 194, '3 de 94 reglas con casos', 's-micro s-mute')}</g>`;
      return s;
    } },
  { id: 'frecuencias', accion: 'Frecuencias', donde: 'Analítica › Frecuencias', titulo: 'Frecuencias en escala de acuerdo',
    svg() {
      let s = T(12, 18, 'FRECUENCIAS, ESCALA DE ACUERDO', 's-eyebrow');
      const filas = [[8, 14, 22, 38, 18], [4, 10, 30, 36, 20], [12, 18, 26, 30, 14], [6, 8, 20, 40, 26], [10, 16, 28, 32, 14]] as const;
      filas.forEach((f, i) => {
        const y = 30 + i * 28, k = i * 0.1;
        s += `<rect x="12" y="${y + 3}" width="${60 + (i * 23) % 40}" height="6" rx="3"${A('traza', k, { c: 's-bar-ink' })}/>`;
        let x = 120;
        f.forEach((v, j) => { const w = v * 1.86; s += `<rect x="${x}" y="${y}" width="${w - 1}" height="16" rx="${j === 0 || j === 4 ? 3 : 0}" fill="${RAMPA[j]}"${A('traza', k + 0.04 + j * 0.025)}/>`; if (v >= 20) s += TA(x + w / 2, y + 11.5, `${v}%`, 'sube', k + 0.16, j > 2 ? 's-micro s-white-t s-b' : 's-micro s-ink s-b', 'middle'); x += w; });
      });
      // Leyenda repartida por el ancho de cada rótulo (≈3.5 px por carácter a 6.8 px) con 12 px entre entradas.
      let lx = 12;
      ['Tot. desacuerdo', 'Desacuerdo', 'Neutral', 'De acuerdo', 'Tot. acuerdo'].forEach((l, j) => { s += `<g${A('sube', 0.6 + j * 0.02)}><rect x="${lx}" y="178" width="7" height="7" rx="2" fill="${RAMPA[j]}"/>${T(lx + 10, 184.5, l, 's-micro s-mute')}</g>`; lx += 10 + l.length * 3.5 + 12; });
      return s;
    } },
  { id: 'variables', accion: 'Carga de bases', donde: 'Carga › Estructura', titulo: 'Variables del formulario y la base',
    svg() {
      let s = '';
      ([['Formulario', 1], ['Respuestas', 1], ['2 bases', 0]] as const).forEach(([n, ok], i) => { s += `<g${A('pop', i * 0.05)}>${R(12 + i * 78, 8, 72, 16, 8, C(ok ? 's-ok-bg' : 's-card'))}${ok ? '<circle cx="' + (22 + i * 78) + '" cy="16" r="2.6" class="s-ok"/>' : ''}${T(28 + i * 78, 19.5, n, 's-micro s-ink s-b')}</g>`; });
      const v = [['p1_sexo', 'SO', 'Sexo'], ['p2_edad', 'NUM', 'Edad en años'], ['p3_facultad', 'SO', 'Facultad'], ['p4_satisf', 'SO', 'Satisfacción general'], ['p5_comentario', 'TXT', 'Comentario abierto'], ['p6_recomienda', 'SO', '¿Recomendaría?']] as const;
      v.forEach(([n, t, l], i) => {
        const y = 32 + i * 26, k = 0.08 + i * 0.07;
        s += `<g${A('cae', k)}>${R(12, y, 296, 22, 6, C('s-card'))}${T(22, y + 14.5, n, 's-micro s-mono s-ink s-b')}${R(108, y + 5, 26, 12, 4, C(t === 'TXT' ? 's-warn-bg' : t === 'NUM' ? 's-chip' : 's-chip-teal'))}${T(121, y + 13.5, t, 's-micro s-mono s-ink', 'middle')}${T(144, y + 14.5, l, 's-micro s-mute')}</g>`;
        s += `<rect x="12" y="${y}" width="296" height="22" rx="6"${A('destella', 0.2 + i * 0.09, { c: 's-soft-st' })}/>`;
        s += `<g${A('pop', 0.24 + i * 0.09)}><circle cx="296" cy="${y + 11}" r="5" class="s-tone"/>${T(296, y + 13.6, '✓', 's-micro s-white-t s-b', 'middle')}</g>`;
      });
      return s;
    } }
];

// ---------------------------------------------------------------- Dashboard
const AZULES: string[] = ['color-mix(in srgb, var(--pulso-module-dashboard) 20%, var(--pulso-surface))', 'color-mix(in srgb, var(--pulso-module-dashboard) 42%, var(--pulso-surface))', 'color-mix(in srgb, var(--pulso-module-dashboard) 72%, var(--pulso-surface))', 'var(--pulso-module-dashboard)', 'color-mix(in srgb, var(--pulso-module-dashboard) 78%, var(--pulso-text))'];
function dona(cx: number, cy: number, r: number, partes: readonly number[], k: number): string {
  const L = 2 * Math.PI * r; let acc = 0, s = '';
  partes.forEach((p, i) => { const len = L * p; s += `<g transform="rotate(${-90 + acc * 360} ${cx} ${cy})"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${AZULES[4 - i]}" stroke-width="${r * 0.55}" stroke-dasharray="${(len - 1.2).toFixed(1)} ${L.toFixed(1)}"${A('gira', k + i * 0.04)}/></g>`; acc += p; });
  return s;
}
ESCENAS.dash = [
  { id: 'edicion', marca: true, accion: 'Edición del tablero', donde: 'Personalizar › Vista previa', titulo: 'Edición y publicación del tablero',
    svg() {
      // Modo edición: los paneles se acomodan en la grilla, se agrega un cruce desde la paleta y se publica.
      const pid = uid('pt');
      let s = `<defs><pattern id="${pid}" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.7" fill="var(--pulso-border-strong)"/></pattern></defs>`;
      s += `${R(8, 8, 304, 184, 10, C('s-card'))}${R(8, 8, 304, 24, 10, C('s-head'))}`;
      s += `<g${A('pop', 0)}>${R(16, 13, 44, 14, 7, C('s-tone'))}${T(38, 22.5, 'Editar', 's-micro s-white-t s-b', 'middle')}</g>${T(70, 23, 'Vista previa', 's-micro s-mute')}`;
      s += `<g${A('atenua0', 0.8)}>${R(250, 13, 54, 14, 7, C('s-card-b'))}${T(277, 22.5, 'Publicar', 's-micro s-ink s-b', 'middle')}</g>`;
      s += `<g${A('pop', 0.82)}>${R(244, 13, 60, 14, 7, C('s-ok-bg'))}${T(274, 22.5, '✓ Publicado', 's-micro s-okt s-b', 'middle')}</g>`;
      s += `<rect x="14" y="38" width="220" height="148" rx="6" fill="url(#${pid})"/>`;
      s += `<g${A('cae', 0.08)}>${R(18, 42, 104, 66, 8, C('s-card-b'))}${T(26, 54, 'Sexo', 's-micro s-ink s-b')}</g>` + dona(70, 82, 16, [0.52, 0.48], 0.14);
      s += `<g${A('cae', 0.16)}>${R(126, 42, 104, 66, 8, C('s-card-b'))}${T(134, 54, 'Satisfacción', 's-micro s-ink s-b')}</g>`;
      ([[0.5, 0.3, 0.2], [0.4, 0.4, 0.2], [0.62, 0.24, 0.14]] as const).forEach((p, r) => { let x = 134; p.forEach((v, j) => { s += `<rect x="${x}" y="${62 + r * 13}" width="${v * 88 - 1}" height="9" fill="${AZULES[4 - j]}"${A('traza', 0.22 + r * 0.04 + j * 0.02)}/>`; x += v * 88; }); });
      s += `${R(18, 112, 212, 70, 8, C('s-ghost'))}${T(124, 150, 'Soltar aquí', 's-micro s-faint', 'middle')}`;
      ['Gráfico', 'Tabla', 'Cruce'].forEach((n, i) => { s += `<g${A('sube', 0.04 + i * 0.03)}>${R(242, 40 + i * 26, 62, 20, 6, C(n === 'Cruce' ? 's-soft-b' : 's-card'))}${T(250, 53 + i * 26, '+ ' + n, 's-micro s-ink s-b')}</g>`; });
      s += `<g${A('viaja', 0.4, { s: '--dx:224px;--dy:-60px' })}>${R(18, 112, 212, 70, 8, C('s-card-sel'))}${T(26, 124, 'Cruce Facultad × Satisfacción', 's-micro s-ink s-b')}</g>`;
      ([[0.3, 0.5, 0.2], [0.2, 0.6, 0.2], [0.42, 0.38, 0.2]] as const).forEach((p, r) => { let x = 26; p.forEach((v, j) => { s += `<rect x="${x}" y="${132 + r * 15}" width="${v * 190 - 1}" height="10" fill="${AZULES[4 - j]}"${A('traza', 0.56 + r * 0.04 + j * 0.02)}/>`; x += v * 190; }); });
      ([[18, 112], [230, 112], [18, 182], [230, 182]] as const).forEach(([x, y]) => { s += `<rect x="${x - 3}" y="${y - 3}" width="6" height="6" rx="1.5"${A('pop', 0.66, { c: 's-handle' })}/>`; });
      return s;
    } },
  { id: 'preguntas', accion: 'Preguntas por fila', donde: 'Resumen', titulo: 'Resumen por pregunta',
    svg() {
      let s = T(12, 18, 'RESUMEN POR PREGUNTA', 's-eyebrow');
      const f = [[50, 25, 25], [42, 30, 28], [61, 22, 17], [35, 41, 24], [55, 30, 15]] as const;
      f.forEach((p, i) => {
        const y = 28 + i * 32, k = i * 0.1; let x = 12;
        s += `<rect x="12" y="${y}" width="${90 + (i * 31) % 100}" height="5" rx="2.5"${A('traza', k, { c: 's-bar-ink' })}/>`;
        p.forEach((v, j) => { const w = v * 2.96; s += `<rect x="${x}" y="${y + 9}" width="${w - 1.5}" height="15" rx="${j === 0 ? 3 : 0}" fill="${AZULES[4 - j]}"${A('traza', k + 0.04 + j * 0.03)}/>`; s += TA(x + w / 2, y + 20, `${v}%`, 'sube', k + 0.14, j < 2 ? 's-micro s-white-t s-b' : 's-micro s-ink s-b', 'middle'); x += w; });
      });
      ([['Sí', 4], ['No', 3], ['No sabe', 2]] as const).forEach(([l, c], j) => { s += `<g${A('sube', 0.6)}><circle cx="${16 + j * 44}" cy="190" r="3.2" fill="${AZULES[c]}"/>${T(22 + j * 44, 193, l, 's-micro s-mute')}</g>`; });
      return s;
    } },
  { id: 'perfil', accion: 'Perfil de la muestra', donde: 'Resumen › Perfil', titulo: 'Perfil de la muestra',
    svg() {
      let s = T(12, 18, 'PERFIL DE LA MUESTRA', 's-eyebrow') + TA(308, 18, 'N: 1,200', 'sube', 0.5, 's-t s-ink s-b', 'end');
      ([['Sexo', [0.52, 0.48]], ['Edad', [0.3, 0.34, 0.22, 0.14]], ['Facultad', [0.26, 0.24, 0.2, 0.18, 0.12]]] as const).forEach(([n, p], i) => {
        const cx = 56 + i * 104;
        s += dona(cx, 96, 36, p, i * 0.12) + TA(cx, 160, n, 'sube', i * 0.12 + 0.1, 's-t s-ink s-b', 'middle');
      });
      s += `<g${A('sube', 0.6)}>${[0, 1, 2, 3, 4].map(j => `<rect x="${80 + j * 34}" y="178" width="26" height="6" rx="3" fill="${AZULES[4 - j]}"/>`).join('')}</g>`;
      return s;
    } },
  { id: 'cruces', accion: 'Cruces interactivos', donde: 'Relaciones', titulo: 'Cruce con selector de variables',
    svg() {
      // Al cambiar la variable de columnas, las barras se rehacen con el nuevo cruce.
      let s = '';
      s += `<g${A('pop', 0)}>${R(12, 8, 140, 22, 11, C('s-card-b'))}${T(22, 22.5, 'Filas', 's-micro s-mute')}${T(48, 22.5, 'Facultad ▾', 's-t s-ink s-b')}</g>`;
      s += `<g${A('pop', 0.04)}>${R(160, 8, 148, 22, 11, C('s-soft-b'))}${T(170, 22.5, 'Columnas', 's-micro s-mute')}</g>`;
      s += `<text x="214" y="22.5"${A('pop-atenua0', 0.04, { c: 's-t s-tonetxt s-b', s: '--k2:0.44' })}>Satisfacción ▾</text>`;
      s += `<text x="214" y="22.5"${A('pop', 0.46, { c: 's-t s-tonetxt s-b' })}>Recomendaría ▾</text>`;
      const filas = ['Ciencias Sociales', 'Ingeniería', 'Derecho', 'Gestión', 'Letras'];
      const a = [[0.5, 0.3, 0.2], [0.36, 0.44, 0.2], [0.58, 0.28, 0.14], [0.44, 0.34, 0.22], [0.3, 0.46, 0.24]] as const;
      const b = [[0.7, 0.2, 0.1], [0.62, 0.26, 0.12], [0.74, 0.18, 0.08], [0.54, 0.3, 0.16], [0.66, 0.22, 0.12]] as const;
      filas.forEach((n, i) => {
        const y = 44 + i * 26;
        s += TA(12, y + 11, n, 'sube', 0.08 + i * 0.03, 's-micro s-ink');
        let x = 96; a[i].forEach((v, j) => { s += `<rect x="${x}" y="${y}" width="${v * 210 - 1}" height="16" fill="${AZULES[4 - j]}"${A('traza', 0.12 + i * 0.04 + j * 0.02, { c: 'sale2', s: '--k2:0.44' })}/>`; x += v * 210; });
        x = 96; b[i].forEach((v, j) => { s += `<rect x="${x}" y="${y}" width="${v * 210 - 1}" height="16" fill="${AZULES[4 - j]}"${A('traza', 0.5 + i * 0.04 + j * 0.02)}/>`; if (j === 0) s += TA(x + 8, y + 11.5, `${Math.round(v * 100)}%`, 'sube', 0.6 + i * 0.04, 's-micro s-white-t s-b'); x += v * 210; });
      });
      s += `<g${A('sube', 0.62)}>${['Sí', 'No', 'No sabe'].map((l, j) => `<circle cx="${100 + j * 54}" cy="186" r="3.2" fill="${AZULES[4 - j]}"/><text x="${106 + j * 54}" y="189" class="s-micro s-mute">${l}</text>`).join('')}</g>`;
      return s;
    } },
  { id: 'cruce2', accion: 'Cruce de cruces', donde: 'Relaciones', titulo: 'Cruce de cruces: sexo y satisfacción por edad',
    svg() {
      // Un cruce (sexo × satisfacción) abierto por una tercera variable (edad): un panel por tramo.
      let s = '';
      ([['Sexo', 0], ['×', 1], ['Satisfacción', 2], ['por', 3], ['Edad', 4]] as const).forEach(([n, i]) => {
        const chip = i % 2 === 0, x = [12, 58, 72, 152, 172][i];
        s += chip ? `<g${A('pop', i * 0.03)}>${R(x, 8, n.length * 5 + 18, 18, 9, C(i === 4 ? 's-soft-b' : 's-card-b'))}${T(x + 9, 20.5, n, 's-micro s-ink s-b')}</g>` : TA(x, 20.5, n, 'sube', i * 0.03, 's-micro s-mute');
      });
      s += `<g${A('sube', 0.6)}>${['Satisfecho', 'Neutral', 'Insatisfecho'].map((l, j) => `<rect x="${12 + j * 80}" y="186" width="7" height="7" rx="2" fill="${AZULES[4 - j]}"/><text x="${23 + j * 80}" y="192" class="s-micro s-mute">${l}</text>`).join('')}</g>`;
      ['18–29', '30–44', '45 y más'].forEach((t, p) => {
        const x = 12 + p * 100, k = 0.14 + p * 0.12;
        s += `<g${A('cae', k)}>${R(x, 34, 92, 142, 9, C('s-card'))}${T(x + 10, 52, t, 's-t s-tonetxt s-b')}</g>`;
        ([['H', [0.4, 0.4, 0.2]], ['M', [0.52, 0.32, 0.16]]] as const).forEach(([g, v], r) => {
          const y = 66 + r * 52; s += TA(x + 10, y + 8, g, 'sube', k + 0.04, 's-micro s-mute');
          let yy = y + 14; v.forEach((w, j) => { const h = w * 30 + 2 * (p - 1) * (j === 0 ? 1 : -0.5); s += `<rect x="${x + 10}" y="${yy}" width="${72 * (w + (j === 0 ? 0.04 * p : 0))}" height="9" rx="2" fill="${AZULES[4 - j]}"${A('traza', k + 0.08 + j * 0.03 + r * 0.05)}/>`; yy += 11; });
        });
      });
      return s;
    } },
];

export { ESCENAS as ESCENAS_CARGA };
