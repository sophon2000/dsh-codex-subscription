import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { adaptedManifest, inspectHost, verifyHostPackage } from '../scripts/host-package.mjs'

const version = '0.2.1-rc.2.vh.7.local.20261024.1'
const tools = '@deepseek-ai/dsh-tools'
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'codex host 空格 $()-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const hostRoot = join(directory, 'installation', 'node_modules')
  const write = (file, value) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(value)) }
  const pkg = (name, v = version, base = hostRoot) => {
    const location = join(base, name)
    write(join(location, 'package.json'), { name, version: v })
    return location
  }
  const host = join(pkg('@deepseek-ai/dsh'), 'package.json')
  for (const name of ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', tools,
    '@deepseek-ai/dsh-home-paths', '@deepseek-ai/dsh-sdk-protocol']) pkg(name)
  const template = { name: 'dsh-codex-subscription', version: '3.1.6-dev.0', scripts: { build: 'never-run' },
    files: ['lib/*.js'], exports: { '.': './lib/index.js' }, devDependencies: { ignored: '1' },
    dependencies: { '@deepseek-ai/dsh-home-paths': 'official', ws: '8.21.3' },
    peerDependencies: { [tools]: 'official', '@deepseek-ai/dsh-subagent-codex': 'official' },
    peerDependenciesMeta: { '@deepseek-ai/dsh-subagent-codex': { optional: true } } }
  const config = { version: '3.1.6-vh.1', repository: 'https://github.com/sophon2000/dsh-codex-subscription' }
  const plugin = join(directory, 'consumer', 'node_modules', template.name)
  const stage = () => {
    const inspected = inspectHost(host, template, version)
    const manifest = adaptedManifest(template, config, inspected)
    write(join(plugin, 'package.json'), manifest)
    write(join(plugin, 'host-package.json'), { schemaVersion: 1, version: config.version,
      hostVersion: version, packages: inspected.packages })
    for (const [name, target] of Object.entries(inspected.roots)) {
      const link = join(plugin, 'node_modules', name)
      mkdirSync(dirname(link), { recursive: true })
      symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir')
    }
    return inspected
  }
  return { directory, host, pkg, write, plugin, template, config, stage }
}

test('normal installation reuses exact host modules through paths with spaces and non-ASCII characters', t => {
  const f = fixture(t)
  f.stage()
  assert.equal(verifyHostPackage(f.plugin, f.host).version, '3.1.6-vh.1')
  const manifest = JSON.parse(readFileSync(join(f.plugin, 'package.json')))
  assert.equal(manifest.peerDependencies['@deepseek-ai/dsh-subagent-codex'], version)
  assert.equal(manifest.dependencies['@deepseek-ai/dsh-home-paths'], undefined)
  assert.equal(manifest.dependencies.ws, '8.21.3')
  assert.equal(manifest.scripts, undefined)
  assert.equal(manifest.devDependencies, undefined)
  assert.equal(f.template.dependencies['@deepseek-ai/dsh-home-paths'], 'official')
  assert.ok(!JSON.stringify(manifest).includes(f.directory))
})

test('a second copy with the same version fails the singleton guard', t => {
  const f = fixture(t)
  f.stage()
  rmSync(join(f.plugin, 'node_modules', tools))
  f.pkg(tools, version, join(f.plugin, 'node_modules'))
  assert.throws(() => verifyHostPackage(f.plugin, f.host), /Duplicate host runtime/)
})

test('mixed official and fork runtimes fail before packing', t => {
  const f = fixture(t)
  f.pkg(tools, '0.2.1-rc.3')
  assert.throws(() => inspectHost(f.host, f.template, version), /Mixed DSH family/)
})

test('a missing required peer fails instead of downloading or binding a fallback', t => {
  const f = fixture(t)
  rmSync(join(dirname(f.host), '..', 'dsh-tools'), { recursive: true })
  assert.throws(() => inspectHost(f.host, f.template, version), /Missing host peer/)
})

test('the explicit host must be DSH at the fixed target version', t => {
  const f = fixture(t)
  assert.throws(() => inspectHost(f.host, f.template, '0.2.1-rc.3'), /host version differs/)
  f.write(f.host, { name: 'unrelated', version })
  assert.throws(() => inspectHost(f.host, f.template, version), /installed DSH/)
})
