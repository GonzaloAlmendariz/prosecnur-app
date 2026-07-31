import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import ts from '../../frontend/node_modules/typescript/lib/typescript.js'
import { auditDebt, formatDebtAudit } from '../debt-audit.mjs'

function write(root, relative, content) {
  const target = path.join(root, relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'debt-audit-'))
  write(root, 'agentic/manifest.json', `${JSON.stringify({
    policy: {
      frozen_growth_files: ['api/R/engine.R', 'frontend/src/features/Huge.tsx'],
      frozen_growth_baseline: {
        'api/R/engine.R': 5,
        'frontend/src/features/Huge.tsx': 1005
      }
    }
  }, null, 2)}\n`)
  write(root, 'api/R/engine.R', [
    '`%||%` <- function(a, b) if (is.null(a)) b else a',
    '.demo_scalar <- function(x) x',
    'run <- function() stop("boom")',
    'safe <- function() try(run(), silent = TRUE)',
    ''
  ].join('\n'))
  write(root, 'api/R/orphan_big.R', `${'value <- 1\n'.repeat(12)}`)
  write(root, 'api/R/entregables_repeats.R', 'value <- 1\n')
  write(root, 'api/tests/testthat/test-engine.R', 'testthat::test_that("engine", { testthat::expect_true(TRUE) })\n')
  write(
    root,
    'api/tests/testthat/test-entregables-repeat-service-labels.R',
    'testthat::test_that("otro contrato", { testthat::expect_true(TRUE) })\n'
  )
  write(root, 'frontend/src/api/core.ts', 'export const parse = (value: any): any => value\n')
  write(root, 'frontend/src/features/Huge.tsx', `${'// line\n'.repeat(1001)}export const Huge = () => <div />\n`)
  write(root, 'frontend/src/features/theme.css', ':root { --tone: #AABBCC; color: #abc; }\n')
  write(root, 'frontend/src/features/Selector.tsx', [
    'export const Selector = () => (',
    '  <div role="radiogroup"><button role="radio" aria-checked />',
    '  <div role="tabpanel" aria-controls="x" aria-current="page" /></div>',
    ')',
    ''
  ].join('\n'))
  write(root, 'README.md', '# fixture\n')

  git(root, ['init', '-q'])
  git(root, ['config', 'user.email', 'fixture@example.test'])
  git(root, ['config', 'user.name', 'Fixture'])
  git(root, ['add', '.'])
  git(root, ['commit', '-qm', 'fixture'])
  return root
}

test('mide los ocho ejes con universos explícitos', () => {
  const root = fixture()
  const result = auditDebt(root, { typescript: ts })

  assert.equal(result.frozen.files.length, 2)
  assert.equal(result.frozen.violations.length, 0)
  assert.deepEqual(result.rHistorical, {
    orDefinitions: 1,
    microHelpers: 1,
    rawStops: 1,
    looseTry: 1
  })
  assert.deepEqual(result.rSemantic, {
    orDefinitions: 1,
    microHelpers: 1,
    stopCalls: 1,
    stopApiCalls: 0,
    tryCalls: 1
  })
  assert.equal(result.css.files, 1)
  assert.equal(result.css.sixDigitMatches, 1)
  assert.equal(result.css.expandedMatches, 2)
  assert.equal(result.typescript.anyKeywords, 2)
  assert.equal(result.typescript.suppressions, 0)
  assert.equal(result.rNominalTests.productionFiles, 3)
  assert.equal(result.rNominalTests.withoutNominalTest, 2)
  assert.ok(
    result.rNominalTests.topMissing.some((entry) =>
      entry.path.endsWith('entregables_repeats.R')
    )
  )
  assert.equal(result.largeTsx.over1000, 1)
  assert.equal(result.worktree.productLines, 0)
  assert.deepEqual(result.aria, {
    roleTab: 0,
    roleTabpanel: 1,
    ariaControls: 1,
    ariaCurrent: 1,
    roleRadiogroup: 1,
    roleRadio: 1,
    ariaChecked: 1,
    glidingNav: 0
  })
  assert.match(formatDebtAudit(result), /Eje 8: volumen de producto sin commit=0 líneas/)
})

test('separa cambios de producto, tests, docs, gobernanza y excluidos', () => {
  const root = fixture()
  fs.appendFileSync(path.join(root, 'frontend/src/api/core.ts'), 'export const dirty = true\n')
  write(root, 'api/tests/testthat/test-new.R', 'testthat::test_that("new", {})\n')
  write(root, 'docs/note.md', 'uno\ndos\n')
  write(root, 'scripts/new.mjs', 'export {}\n')
  write(root, 'output/ignored.txt', 'no\ncuenta\n')

  const result = auditDebt(root, { typescript: ts })
  assert.equal(result.worktree.unstaged.product.added, 1)
  assert.equal(result.worktree.untracked.tests.added, 1)
  assert.equal(result.worktree.untracked.docs.added, 2)
  assert.equal(result.worktree.untracked.governance.added, 1)
  assert.equal(result.worktree.untracked.excluded.files, 1)
  assert.equal(result.worktree.untracked.excluded.added, 0)
  assert.equal(result.worktree.productLines, 1)
})

test('el check identifica crecimiento de un archivo congelado', () => {
  const root = fixture()
  fs.appendFileSync(path.join(root, 'api/R/engine.R'), 'extra <- TRUE\nextra2 <- TRUE\n')
  const result = auditDebt(root, { typescript: ts })

  assert.equal(result.frozen.violations.length, 1)
  assert.equal(result.frozen.violations[0].path, 'api/R/engine.R')
  assert.equal(result.frozen.violations[0].delta, 1)
})
