import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { leerLock, problemasDelLock, verificar, sha256DeArchivo } from '../fetch-preview-renderer.mjs'

test('el lock de LibreOffice está sano: versión, tres plataformas y url fija en downloadarchive', () => {
  assert.deepEqual(problemasDelLock(leerLock()), [])
})

test('una url fuera de downloadarchive o de otra versión se rechaza', () => {
  const lock = structuredClone(leerLock())
  lock.plataformas['win-x64'].url = 'https://download.documentfoundation.org/libreoffice/stable/26.2.6/win/x86_64/x.msi'
  lock.plataformas['mac-x64'].url = lock.plataformas['mac-x64'].url.replace('/26.2.6.', '/26.8.1.')
  const p = problemasDelLock(lock)
  assert.ok(p.some((m) => m.startsWith('win-x64: la url debe estar')))
  assert.ok(p.some((m) => m.startsWith('mac-x64: la url no es de la versión')))
})

test('sin sha256 fijado la descarga no se acepta, y un sha distinto tampoco', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lo-lock-')), 'x.dmg')
  fs.writeFileSync(f, 'contenido')
  assert.equal(verificar({ sha256: null }, f).ok, false)
  assert.equal(verificar({ sha256: '0'.repeat(64) }, f).ok, false)
  assert.equal(verificar({ sha256: sha256DeArchivo(f) }, f).ok, true)
  assert.deepEqual(problemasDelLock(leerLock(), { exigirSha: true }), [])   // fijados tras verificar la firma de TDF
})
