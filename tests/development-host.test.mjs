import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { hostDshVersion } from '../src/subagent-runtime.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const json = path => JSON.parse(readFileSync(path, 'utf8'))
const host = json(join(root, 'dev-host.json'))
const manifest = json(join(root, 'package.json'))
const store = realpathSync(join(root, 'node_modules/.pnpm'))
function packagePath(name, resolver = require) {
  // Read metadata through the same module search paths without requiring a
  // package.json export or a CommonJS entry (pi-ai is import-only).
  for (const directory of resolver.resolve.paths(name) ?? []) {
    const path = join(directory, name, 'package.json')
    if (existsSync(path)) return path
  }
  throw new Error(`Cannot locate installed package ${name}`)
}
const insideStore = path => {
  const location = relative(store, realpathSync(path))
  assert.ok(location && !location.startsWith(`..${sep}`) && location !== '..', path)
}

test('default source tests resolve the reviewed installed development Host', () => {
  assert.equal(host.dshVersion, '0.2.2-alpha.2.vh.1.local.20261031.1')
  assert.equal(host.source.commit, '3400c4a11043fbd0ab486561edc23d6309f41463')
  assert.equal(host.manifestSha256, '74194986c3bb60fa62e7819772512c9cfd62203da9f224b46fb9e0b5e64b7c58')
  assert.equal(Object.keys(host.vendors).length, 9)
  for (const [name, version] of Object.entries(manifest.devDependencies)) {
    if (!name.startsWith('@deepseek-ai/')) continue
    const expected = name.startsWith('@deepseek-ai/dsh-') ? host.dshVersion : host.vendors[name]
    assert.equal(version, expected, name)
    const path = packagePath(name)
    insideStore(path)
    assert.equal(json(path).version, expected, name)
  }
  assert.equal(hostDshVersion(), host.dshVersion)
  const piAi = packagePath('@earendil-works/pi-ai')
  insideStore(piAi)
  assert.equal(json(piAi).version, host.piAiVersion)
  assert.equal(host.piAiVersion, '1.3.0')
})

test('the installed transitive SDK graph contains one reviewed family', () => {
  const checked = new Set()
  const pending = [join(root, 'package.json')]
  while (pending.length) {
    const path = realpathSync(pending.pop())
    if (checked.has(path)) continue
    checked.add(path)
    const pkg = json(path)
    if (pkg.name.startsWith('@deepseek-ai/')) {
      insideStore(path)
      const expected = pkg.name.startsWith('@deepseek-ai/dsh') ? host.dshVersion
        : host.vendors[pkg.name] ?? (pkg.name.startsWith('@deepseek-ai/node-addon-system') ? '0.1.2' : undefined)
      assert.ok(expected, `unexpected SDK package ${pkg.name}`)
      assert.equal(pkg.version, expected, pkg.name)
    }
    const resolver = createRequire(path)
    for (const name of Object.keys({ ...(path === join(root, 'package.json') ? pkg.devDependencies : {}), ...pkg.dependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies })) {
      if (!name.startsWith('@deepseek-ai/')) continue
      try { pending.push(packagePath(name, resolver)) }
      catch (error) {
        if (!pkg.optionalDependencies?.[name] && !pkg.peerDependenciesMeta?.[name]?.optional) throw error
      }
    }
  }
  assert.ok(checked.size > 25, 'exercise transitive SDK dependencies beyond the direct dev pins')
})

test('the development patch is the exact shared input from the frozen DSH source', () => {
  const patch = host.patches['@earendil-works/pi-ai@1.3.0']
  assert.equal(patch.sourceCommit, host.source.commit)
  assert.equal(patch.scope, 'shared')
  assert.equal(patch.sourceBlob, '111e09dceeda04eeb09b034e551a9c495ecff495')
  assert.equal(createHash('sha256').update(readFileSync(join(root, patch.file))).digest('hex'), patch.sha256)
  assert.equal(patch.sha256, '4e1c90fd00aea42989664504668633033c1962e53c07860901edb4f72d843765')
  assert.ok(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8').includes(`'@earendil-works/pi-ai@1.3.0': ${patch.file}`))
})

test('the installed provider streams raw argument deltas and parses completed tool arguments', async () => {
  const { processResponsesStream } = await import('@earendil-works/pi-ai/api/openai-responses-shared')
  const item = { type: 'function_call', id: 'item', call_id: 'call', name: 'lookup', arguments: '' }
  const events = [
    { type: 'response.output_item.added', output_index: 0, item },
    { type: 'response.function_call_arguments.delta', output_index: 0, delta: '{"city":"Lon' },
    { type: 'response.function_call_arguments.delta', output_index: 0, delta: 'don"}' },
    { type: 'response.output_item.done', output_index: 0, item: { ...item, arguments: '{"city":"London"}' } },
    { type: 'response.completed', response: { status: 'completed', usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } },
  ]
  const output = { role: 'assistant', content: [], stopReason: 'stop' }, seen = []
  await processResponsesStream((async function* () { yield* events })(), output,
    { push: event => seen.push(structuredClone(event)) }, { id: 'fixture', provider: 'fixture', cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } })
  const deltas = seen.filter(event => event.type === 'toolcall_delta')
  assert.deepEqual(deltas.map(event => event.delta), ['{"city":"Lon', 'don"}'])
  assert.ok(deltas.every(event => Object.keys(event.partial.content[0].arguments).length === 0), 'partial JSON must not become intermediate argument objects')
  assert.deepEqual(output.content[0].arguments, { city: 'London' })
})

test('the installed OpenAI-compatible provider preserves a Gemini tool-call signature on replay', async () => {
  const { convertMessages } = await import('@earendil-works/pi-ai/api/openai-completions')
  const model = { id: 'fixture', provider: 'fixture', api: 'openai-completions', input: ['text'] }
  const call = { type: 'toolCall', id: 'call', name: 'lookup', arguments: { city: 'London' }, thoughtSignature: 'gemini-signed-fixture' }
  const messages = convertMessages(model, { messages: [{ role: 'assistant', provider: model.provider,
    api: model.api, model: model.id, content: [call], stopReason: 'toolUse', timestamp: 0 }] }, {})
  const tool = messages.find(message => message.tool_calls)?.tool_calls[0]
  assert.deepEqual(tool.extra_content, { google: { thought_signature: 'gemini-signed-fixture' } })
  assert.equal(tool.function.arguments, '{"city":"London"}')
})
