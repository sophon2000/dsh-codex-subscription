import assert from 'node:assert/strict'
import test from 'node:test'
import { accountEntryLabel, openAccountEntry } from '../src/account-entry.js'
import { createAccountStatusController } from '../src/account-status-controller.js'
import { zh, en } from '../src/client-locales.js'

test('sidebar labels track the existing account controller through login, logout and failed refresh', async () => {
  const controller = createAccountStatusController({ call: async () => { throw new Error('offline') } })
  const label = () => zh[accountEntryLabel(controller.getSnapshot())]
  assert.equal(label(), 'Codex 账号')
  controller.acceptAccount({ authenticated: false })
  assert.equal(label(), '登录 Codex')
  controller.acceptAccount({ authenticated: true })
  assert.equal(label(), 'Codex 账号')
  controller.acceptAccount({ authenticated: false })
  assert.equal(label(), '登录 Codex')
  await controller.reload()
  assert.equal(label(), 'Codex 账号')
  assert.equal(en[accountEntryLabel(controller.getSnapshot())], 'Codex account')
  controller.dispose()
})

test('opening the entry dismisses the menu before navigating and performs no authentication action', () => {
  const calls = []
  openAccountEntry({ onDismiss: () => calls.push('dismiss'), openSection: id => calls.push(id) })
  assert.deepEqual(calls, ['dismiss', 'codex-subscription'])
})
