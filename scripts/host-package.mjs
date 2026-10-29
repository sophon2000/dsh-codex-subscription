/** Host-specific package metadata; runtime code remains the upstream build.
 * Uses Node paths and argument arrays on macOS/Linux/Windows, never shell links.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const json = file => JSON.parse(readFileSync(file, 'utf8'))
const isDsh = name => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-')
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

/** Resolve package metadata even for packages that do not export package.json. */
export function packageRoot(name, refs) {
  for (const ref of refs) {
    for (const search of createRequire(ref).resolve.paths(name) ?? []) {
      const candidate = join(search, name)
      if (!existsSync(join(candidate, 'package.json'))) continue
      const found = realpathSync(candidate)
      assert.equal(json(join(found, 'package.json')).name, name, `Unexpected package at ${candidate}`)
      return found
    }
  }
  return undefined
}

export function inspectHost(hostManifest, template, expectedVersion) {
  const host = realpathSync(hostManifest)
  assert.equal(json(host).name, '@deepseek-ai/dsh', '--host must identify the installed DSH CLI package.json')
  assert.equal(json(host).version, expectedVersion, 'DSH host version differs from the fixed artifact target')
  const refs = [host]
  for (const name of ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app']) {
    const found = packageRoot(name, refs)
    assert.ok(found, `Missing host package ${name}`)
    assert.equal(json(join(found, 'package.json')).version, expectedVersion, `Mixed DSH family: ${name}`)
    refs.push(join(found, 'package.json'))
  }
  const names = new Set([...Object.keys(template.peerDependencies), '@deepseek-ai/dsh-home-paths', '@deepseek-ai/dsh-sdk-protocol',
    '@deepseek-ai/dsh-session', '@deepseek-ai/dsh-session-format-catalog'])
  const packages = {}, roots = {}
  for (const name of names) {
    const found = packageRoot(name, refs)
    if (!found) {
      assert.ok(template.peerDependenciesMeta?.[name]?.optional, `Missing host peer ${name}`)
      // DSH audits optional peers too; absent ones still declare the target family.
      if (isDsh(name)) packages[name] = expectedVersion
      continue
    }
    const version = json(join(found, 'package.json')).version
    if (isDsh(name)) assert.equal(version, expectedVersion, `Mixed DSH family: ${name}`)
    packages[name] = version
    roots[name] = found
    refs.push(join(found, 'package.json'))
  }
  return { version: expectedVersion, packages, roots }
}

export function adaptedManifest(template, config, host) {
  assert.match(config.version, /^\d+\.\d+\.\d+-vh\.\d+$/u, 'An exact fork artifact version is required')
  const manifest = structuredClone(template)
  manifest.version = config.version
  manifest.peerDependencies = { ...manifest.peerDependencies, ...host.packages }
  // The DSH installation owns home-paths too, rather than a second official runtime.
  delete manifest.dependencies['@deepseek-ai/dsh-home-paths']
  manifest.exports['./host-package'] = './scripts/host-package.mjs'
  manifest.files = [...manifest.files, 'host-package.json', 'scripts/host-package.mjs']
  manifest.repository = { type: 'git', url: `${config.repository}.git` }
  delete manifest.scripts
  delete manifest.devDependencies
  delete manifest.packageManager
  return manifest
}

/** Read-only guard used after a normal package-manager install. */
export function verifyHostPackage(pluginDirectory, hostManifest) {
  const plugin = realpathSync(pluginDirectory)
  const manifest = json(join(plugin, 'package.json'))
  const binding = json(join(plugin, 'host-package.json'))
  assert.equal(binding.schemaVersion, 1)
  assert.equal(manifest.version, binding.version)
  const host = inspectHost(hostManifest, manifest, binding.hostVersion)
  for (const [name, version] of Object.entries(binding.packages)) {
    assert.equal(manifest.peerDependencies[name], version, `Unpinned host peer: ${name}`)
    assert.equal(host.packages[name], version, `Host peer version drift: ${name}`)
    if (!host.roots[name]) continue
    assert.equal(packageRoot(name, [join(plugin, 'package.json')]), host.roots[name], `Duplicate host runtime: ${name}`)
  }
  return { version: manifest.version, hostVersion: host.version, peers: Object.keys(binding.packages).length }
}

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', shell: false })
  if (result.error) throw result.error
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

export function payloadFiles() {
  // Explicit allowlist: no credentials, node_modules, symlinks, maps or machine state.
  return ['README.md', 'README.en.md', 'DIRECTORY.md', 'compatibility.json', 'LICENSE',
    'SECURITY.md', 'THIRD_PARTY_NOTICES.md', 'icon-subscription.webp', 'cordis.patch.yml',
    'scripts/host-package.mjs', 'native/linux-voice-helper.py', 'native/README.md',
    ...readdirSync(join(root, 'lib')).filter(x => x.endsWith('.js')).map(x => `lib/${x}`),
    ...readdirSync(join(root, 'locale')).filter(x => x.endsWith('.json')).map(x => `locale/${x}`),
  ].sort()
}

/** pnpm normalizes package.json while packing. Hash the actual archive bytes. */
export async function packedFileDigests(bytes, expectedFiles) {
  const { Parser } = await import('tar')
  const expected = new Set(expectedFiles), hashes = new Map()
  let failure
  await new Promise((done, reject) => {
    const parser = new Parser({ strict: true, onReadEntry(entry) {
      if (entry.type === 'Directory') { entry.resume(); return }
      const file = entry.path.startsWith('package/') ? entry.path.slice(8) : ''
      if (entry.type !== 'File' || !expected.has(file) || hashes.has(file)) {
        failure = new Error(`Unexpected packed payload entry: ${entry.path}`)
        entry.resume()
        return
      }
      const hash = createHash('sha256')
      hashes.set(file, hash)
      entry.on('data', bytes => hash.update(bytes))
    } })
    parser.on('error', reject)
    parser.on('end', () => failure ? reject(failure) : done())
    parser.end(bytes)
  })
  assert.deepEqual([...hashes.keys()].sort(), [...expected].sort(), 'Archive file set differs from payload')
  return Object.fromEntries([...hashes].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([file, hash]) => [file, hash.digest('hex')]))
}

export async function prepareHostPackage({ hostManifest, pnpmCli, output }) {
  const config = json(join(root, 'host-artifact.json'))
  const template = json(join(root, 'package.json'))
  assert.equal(git(['status', '--porcelain', '--untracked-files=normal']), '', 'Commit source and rebuilt lib before creating a fixed artifact')
  assert.equal(json(resolve(pnpmCli, '../../package.json')).version, config.pnpmVersion, 'Use the pinned artifact packer')
  const host = inspectHost(hostManifest, template, config.hostVersion)
  const binding = { schemaVersion: 1, version: config.version, hostVersion: host.version,
    repository: config.repository, sourceCommit: git(['rev-parse', 'HEAD']), packages: host.packages }
  const archiveName = `${template.name}-${config.version}.tgz`
  const destination = resolve(output)
  mkdirSync(destination, { recursive: true })
  assert.ok(!existsSync(join(destination, archiveName)), 'Refusing to overwrite a versioned artifact')
  const stage = mkdtempSync(join(tmpdir(), 'dsh-codex-host-'))
  try {
    for (const file of payloadFiles()) {
      assert.ok(lstatSync(join(root, file)).isFile(), `Payload must be a regular file: ${file}`)
      mkdirSync(dirname(join(stage, file)), { recursive: true })
      writeFileSync(join(stage, file), readFileSync(join(root, file)))
    }
    writeFileSync(join(stage, 'package.json'), JSON.stringify(adaptedManifest(template, config, host), null, 2) + '\n')
    writeFileSync(join(stage, 'host-package.json'), JSON.stringify(binding, null, 2) + '\n')
    const packed = spawnSync(process.execPath, [resolve(pnpmCli), 'pack', '--pack-destination', destination], {
      cwd: stage, shell: false, encoding: 'utf8', env: { ...process.env, COREPACK_ENABLE_PROJECT_SPEC: '0' },
    })
    if (packed.error) throw packed.error
    assert.equal(packed.status, 0, packed.stderr)
    const bytes = readFileSync(join(destination, archiveName))
    const files = await packedFileDigests(bytes, [...payloadFiles(), 'package.json', 'host-package.json'])
    const receipt = { ...binding, archive: archiveName, sha256: digest(bytes),
      integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`, bytes: bytes.length, files }
    writeFileSync(join(destination, `${archiveName}.json`), JSON.stringify(receipt, null, 2) + '\n')
    return receipt
  } finally { rmSync(stage, { recursive: true, force: true }) }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [command, ...args] = process.argv.slice(2)
  const options = {}
  for (let i = 0; i < args.length; i += 2) {
    assert.ok(['--host', '--pnpm-cli', '--output', '--plugin'].includes(args[i]) && args[i + 1] && !options[args[i]], 'Invalid or repeated option')
    options[args[i]] = args[i + 1]
  }
  assert.ok(options['--host'], 'An explicit --host package.json is required')
  if (command === 'prepare') {
    assert.ok(options['--pnpm-cli'] && options['--output'], 'prepare requires --pnpm-cli and --output')
    console.log(JSON.stringify(await prepareHostPackage({ hostManifest: resolve(options['--host']), pnpmCli: resolve(options['--pnpm-cli']), output: options['--output'] }), null, 2))
  } else {
    assert.equal(command, 'verify', 'Use prepare or verify')
    assert.ok(options['--plugin'], 'verify requires --plugin')
    console.log(JSON.stringify(verifyHostPackage(options['--plugin'], resolve(options['--host']))))
  }
}
