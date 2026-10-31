import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { createSubagentBackendSwitcher, installSubagentBackendConfiguration, SUBAGENT_PROVIDER } from '../src/subagent-backend.js'

// The default is the source repository's locked Cordis. Candidate qualification
// supplies the actual installed DSH CLI manifest to exercise its own lifecycle.
const require = createRequire(realpathSync(process.env.DSH_CODEX_TEST_HOST_MANIFEST
  ?? new URL('../package.json', import.meta.url)))
const { Context } = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')).href)
const { version } = require('@deepseek-ai/cordis/package.json')

function harness(t, options = {}) {
  const root = new Context()
  const rows = [{ options: { name: '@deepseek-ai/dsh-tool-subagent', disabled: true, config: { provider: 'spawn' } } }]
  const observations = []
  function plugin(_ctx, config) { observations.push(config) }
  root.on('internal/plugin', fiber => {
    if (!fiber.uid || fiber.runtime?.callback !== plugin) return
    const entry = { options: { name: '@deepseek-ai/dsh-tool-subagent' }, fiber }
    fiber.entry = entry
    rows.push(entry)
  })
  const switcher = createSubagentBackendSwitcher({ entries: () => rows, prepare: async () => {}, ...options })
  const unconfigure = installSubagentBackendConfiguration(root, switcher)
  t.after(async () => {
    unconfigure()
    await switcher.dispose()
    await root.fiber.dispose()
  })
  return { root, rows, observations, switcher, unconfigure,
    async mount(config = { provider: 'spawn', toolName: 'late', maxDepth: 2 }) {
      const fiber = root.plugin(plugin, config)
      await fiber.await()
      return fiber
    } }
}

const active = fiber => 'effectiveConfig' in fiber ? fiber.effectiveConfig : fiber.config

test(`Cordis ${version}: late subagent restores its effective backend on disposal`, async t => {
  const h = harness(t)
  await h.switcher.select('codex')
  const raw = { provider: 'spawn', toolName: 'late', maxDepth: 2 }
  const fiber = await h.mount(raw)
  assert.equal(active(fiber).provider, SUBAGENT_PROVIDER)
  if ('effectiveConfig' in fiber) assert.equal(fiber.config, raw)
  h.unconfigure()
  await h.switcher.dispose()
  assert.deepEqual(fiber.config, raw)
  assert.deepEqual(active(fiber), raw)
  assert.equal(h.observations.at(-1).provider, 'spawn')
})

test(`Cordis ${version}: selection preserves raw ownership and restores the latest user fields`, async t => {
  const h = harness(t)
  const raw = { provider: 'spawn', toolName: 'before', maxDepth: 2 }
  const fiber = await h.mount(raw)
  await h.switcher.select('codex')
  assert.equal(active(fiber).provider, SUBAGENT_PROVIDER)
  if ('effectiveConfig' in fiber) assert.equal(fiber.config, raw)
  await fiber.update({ ...fiber.config, toolName: 'after', maxDepth: 7 }, true)
  await h.switcher.select('dsh')
  assert.equal(active(fiber).provider, 'spawn')
  assert.equal(active(fiber).toolName, 'after')
  assert.equal(active(fiber).maxDepth, 7)
  await h.switcher.select('codex')
  // Editing the retained object is allowed too; cleanup must not overwrite it
  // with a stale original or a clone of the effective Codex-only configuration.
  fiber.config.toolName = 'latest'
  fiber.config.maxDepth = 9
  h.unconfigure()
  await h.switcher.dispose()
  assert.equal(active(fiber).provider, 'spawn')
  assert.equal(active(fiber).toolName, 'latest')
  assert.equal(active(fiber).maxDepth, 9)
})

test(`Cordis ${version}: user provider changes and same-valued raw fields are preserved`, async t => {
  const h = harness(t)
  if (!('effectiveConfig' in h.root.fiber)) { t.skip('requires separate raw and effective configuration'); return }
  await h.switcher.select('codex')
  const fiber = await h.mount()
  const edited = { ...fiber.config, maxDepth: 'provider-managed', backgroundMode: 'one-shot' }
  await fiber.update(edited, true)
  h.unconfigure()
  await h.switcher.dispose()
  assert.equal(fiber.config, edited)
  assert.deepEqual(active(fiber), edited)
})

test(`Cordis ${version}: an explicit provider ABA is not mistaken for the switcher's raw configuration`, async t => {
  const h = harness(t)
  if (!('effectiveConfig' in h.root.fiber)) { t.skip('requires separate raw and effective configuration'); return }
  await h.switcher.select('codex')
  const fiber = await h.mount()
  await fiber.update({ ...fiber.config, provider: 'fork' }, true)
  const chosen = { ...fiber.config, provider: SUBAGENT_PROVIDER, persona: 'user-selected' }
  await fiber.update(chosen, true)
  const count = h.observations.length
  h.unconfigure()
  await h.switcher.dispose()
  assert.equal(fiber.config, chosen)
  assert.equal(active(fiber).provider, SUBAGENT_PROVIDER)
  assert.equal(active(fiber).persona, 'user-selected')
  assert.equal(h.observations.length, count)
})

test(`Cordis ${version}: replaced entries and disposed Fibers are not written during cleanup`, async t => {
  const h = harness(t)
  await h.switcher.select('codex')
  const replaced = await h.mount({ provider: 'spawn', toolName: 'replaced' })
  const disposed = await h.mount({ provider: 'spawn', toolName: 'disposed' })
  replaced.entry.fiber = { config: { provider: 'fork' } }
  await disposed.dispose()
  assert.equal(disposed.uid, null)
  const count = h.observations.length
  h.unconfigure()
  await h.switcher.dispose()
  assert.equal(active(replaced).provider, SUBAGENT_PROVIDER)
  assert.equal(replaced.entry.fiber.config.provider, 'fork')
  assert.equal(h.observations.length, count)
})

test(`Cordis ${version}: cleanup rechecks entry ownership after each awaited restore`, async t => {
  const h = harness(t)
  await h.switcher.select('codex')
  const first = await h.mount({ provider: 'spawn', toolName: 'first' })
  const second = await h.mount({ provider: 'spawn', toolName: 'second' })
  const update = first.update.bind(first)
  first.update = async (...args) => {
    await update(...args)
    second.entry.fiber = { config: { provider: 'fork' } }
  }
  h.unconfigure()
  await h.switcher.dispose()
  assert.equal(active(first).provider, 'spawn')
  assert.equal(active(second).provider, SUBAGENT_PROVIDER)
  assert.equal(second.entry.fiber.config.provider, 'fork')
})

test(`Cordis ${version}: disposal closes selection before awaiting an in-flight preparation`, async t => {
  let begin, finish
  const started = new Promise(resolve => { begin = resolve })
  const prepared = new Promise(resolve => { finish = resolve })
  const h = harness(t, { prepare: () => { begin(); return prepared } })
  const fiber = await h.mount()
  const selection = h.switcher.select('codex')
  await started
  h.unconfigure()
  const disposal = h.switcher.dispose()
  const rejected = assert.rejects(h.switcher.select('codex'), /unavailable/)
  finish()
  await Promise.all([selection, disposal, rejected])
  assert.equal(active(fiber).provider, 'spawn')
})
