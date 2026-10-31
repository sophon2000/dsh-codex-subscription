# Video host artifacts / Video 宿主归档

This fork prepares an exact host-specific package for Video. Reviewed runtime
adaptations are built and committed before packaging; the packer does not rewrite
runtime code. The same Node commands run on macOS, Linux and Windows.
The ordinary upstream package and compatibility declarations remain unchanged.

本 fork 可为 Video 生成匹配固定 DSH 宿主的插件包。必要的运行时适配先在源码中测试、构建并提交，
打包器不改写运行代码或官方兼容声明。适配结果是新的精确版本归档，不修改已安装包或创建跨仓软链接。

## Prepare / 生成

Install this repository's locked dependencies with its declared pnpm version,
run `pnpm run check`, and commit source and generated `lib/` changes. Prepare the
consumer's locked DSH installation and its artifact packer. Use that actual consumer installation for the peer snapshot; an all-package rehearsal install may hoist a different compatible third-party version than the product lock. Change plugin/host
versions through a reviewed `host-artifact.json` commit. Then run:

```text
node scripts/host-package.mjs prepare --host "<installed-dsh>/package.json" --pnpm-cli "<pnpm>/bin/pnpm.cjs" --output ".artifacts/video-host"
```

The frozen vh.13 producer input is commit
`472f4395ceffea69f1372862be2c6c083a443901`, retained in a clean artifact worktree.
Development-input successors do not replace that producer input; do not generate
different bytes under the existing vh.13 version from a later source commit.

先按本仓锁文件安装、测试和构建并提交，再指定消费端已安装的 **DSH CLI package.json**（不是 Profile 或工作区 manifest）与固定 pnpm 脚本执行上述命令。
宿主快照必须来自实际消费端的冻结安装；全包冷安装可能将兼容的第三方包提升到不同版本，不能据此替代产品锁中的单实例基线。
路径含空格时加引号；Windows 也用 `node` 和 `.cjs` 参数，不依赖 Bash、`ln`、管理员软链接或安装钩子。

The producer requires a clean Git tree and exact host/packer versions. It pins
host peers (including home-paths) to the installation, rejects mixed DSH families
or missing required peers, and keeps optional peers optional. The archive contains
regular allowlisted release files only: no node_modules, absolute paths, OAuth
data, install scripts or source-checkout links.

输出 `.tgz` 与同名 `.tgz.json` 收据，包含源码 commit、精确宿主版本、逐文件 SHA-256、归档 SHA-256/SRI。
同一源码与输入应在两个空输出目录重复生成并比较摘要；脚本拒绝覆盖已有的同版本归档。
归档包含跨平台 JS；平台原生依赖继续由目标机 DSH 安装负责。

## Consume and verify / 消费与校验

Publish the reviewed archive and receipt under a fixed prerelease tag in this
fork. Consumers pin its URL and integrity in their dependency lockfile. Install
with the normal package manager, without the old local `bind-host.mjs`.
Do not use a floating branch, latest URL or source `link:` as a product dependency.

```text
node "<installed-plugin>/scripts/host-package.mjs" verify --host "<installed-dsh>/package.json" --plugin "<installed-plugin>"
```

校验比较插件与宿主的真实模块路径；版本相同但有第二份 DSH、Cordis 或 pi-ai 实例也会失败。
消费者还应按收据校验全部发布文件，升级时用新版本与新 URL，保留旧包供回退。
Video 开发 Profile 可以链接到它已安装的固定归档包目录，不应链接到源码 checkout。

## Acceptance / 验收边界

Run the host-package tests, complete repository check, two-pack digest check,
then the consumer's frozen install, singleton guard and real DSH Profile lifecycle.
Open settings in the target installation. Linux/Windows require their own native
installation and lifecycle validation; a Mac pass or path fixture is not native
acceptance. Packaging tests do not publish personal profiles or make subscription calls.

DSH core fixes remain in the DSH fork; Video preset and branding configuration stay
in video-harness. This flow changes package wiring, not those ownerships.

## Sidebar account entry / 侧栏账号入口

The client contributes `codex` to DSH's `settings.launcher.account` slot. Deployments opt in with `ui-settings-account.config.accountMenuProviders: [codex]`; ordinary DSH retains its DeepSeek default. The row observes the existing account controller and opens `codex-subscription`, whose initial tab is Start. It does not start authentication or switch models. Browser login, device login and multiple accounts remain on the existing settings page. Unloading the plugin removes its contribution.

## 3.2.1 integration / 上游 3.2.1

The 3.2.1-vh.7 artifact retains the fixed vh11 host and sidebar account entry.
The upstream 3.2.1 source is `3afece2715009b8adcb4ae3cecdc4b456a75e9d0`.
Upstream history was rewritten: our former `22ab570` and upstream `4ff2124`
have identical tree `725b7088b4ef35a6426e848ba4771d917bd864c8`. Integration
uses that explicit content base and retains both real heads as merge parents.

The portable archive includes the deferred client chunks and Linux voice helper
with its README. Session SDK and message-projection catalog peers now join the
exact host version and singleton checks, because the new upstream dynamically
loads them. Linux voice capture still requires separate native acceptance;
packaging its helper does not establish that acceptance. Existing OAuth data
and optional feature defaults remain owned by the upstream settings lifecycle.

## 3.2.1-vh.8 master host candidate / master 宿主候选

The new `3.2.1-vh.8` artifact targets DSH `0.2.2-alpha.2.vh.1.local.20261031.1`. Its source remains based on the retained upstream 3.2.1 runtime. Codex subtask model inheritance now reads the live parent model selection when the Host exposes that API; older supported Hosts keep their existing request-header fallback. An unavailable live selection cannot fall back to a stale historical route. Host peers are derived from the actual frozen consumer installation, including its Cordis and pi-ai instances. The previous vh.7 archive remains unchanged. Build, host-package tests, repeat packing and consumer Profile checks must be recorded against this new candidate; no prior qualification is inherited.

## 3.2.1-vh.9 consumer host snapshot / 消费端宿主快照

The `3.2.1-vh.9` artifact keeps the same runtime adaptation and DSH target, and records the actual Video consumer's pi-ai `1.3.0` instance. The preliminary vh.8 rehearsal used pi-ai `1.4.0`; its archive is preserved and is not the final consumer input. Produce vh.9 twice from the actual consumer Host and compare the receipts before installing it. Consumer singleton and Profile lifecycle checks remain required.

`3.2.1-vh.9` 保留相同运行时适配和 DSH 目标，按实际 Video 消费端记录 pi-ai `1.3.0` 实例。vh.8 预演使用了 pi-ai `1.4.0`；原归档保留，不作为最终消费输入。vh.9 必须从实际消费端宿主重复打包并比较收据，再安装校验；单实例与 Profile 生命周期仍需单独验证。

## 3.2.1-vh.10 Cordis configuration lifecycle / 配置生命周期

The `3.2.1-vh.10` artifact adapts the subagent backend's global configuration hook to Cordis `4.0.6-alpha.1`, which supplies its Fiber as the first argument. Earlier Hosts bind the Fiber as the listener receiver and remain supported. This preserves lazy subagent selection and restoration while allowing unrelated Profile plugins to resolve their configuration. The vh.9 archive remains unchanged; the new candidate requires its own build, repeat packing and real Profile lifecycle checks.

`3.2.1-vh.10` 适配 Cordis `4.0.6-alpha.1` 将 Fiber 放在首个参数的新配置事件签名，同时保留旧宿主以监听器 `this` 传入 Fiber 的接口。延迟挂载的子代理仍沿用已选后端并可恢复，其它 Profile 插件可正常解析配置。vh.9 归档保留；新候选需重新构建、重复打包并验证真实 Profile 生命周期。

## 3.2.1-vh.11 raw and effective configuration / 原始与生效配置

Cordis `4.0.6-alpha.1` retains raw input separately from the configuration passed to an active plugin. The vh.11 switcher applies its backend through the configuration hook without writing Codex-owned fields into that raw input. Switching back or unloading re-resolves the latest raw input for a still-owned Fiber, preserving user edits. A user-selected provider, replaced entry or disposed Fiber is left alone. Disposal closes new selection requests before awaiting existing work. Earlier Hosts retain their existing configuration restoration path. Previous archives remain unchanged; actual Host lifecycle tests and a new artifact receipt are required.

Cordis `4.0.6-alpha.1` 分别保存原始输入和插件当前生效配置。vh.11 只在配置钩子中应用后端，不把 Codex 字段写进原始输入；切回或卸载时，对仍归该 entry 所有的 Fiber 重新解析最新原始输入，保留用户修改。用户另选的 provider、已替换的 entry 和已卸载的 Fiber 不被回写。清理先停止接收新选择，再等待已有工作。旧宿主保留原有恢复路径；此前归档均保留，新版本需独立真实生命周期验证和归档收据。

Run `tests/subagent-backend-lifecycle.test.mjs` with `DSH_CODEX_TEST_HOST_MANIFEST` set to the actual installed DSH CLI `package.json`. Without that explicit input it tests the source development cohort recorded below; the source pass does not qualify a consumer installation. The lifecycle scenarios include late activation, disposal, user raw edits, provider and entry replacement, disposed Fibers, and selection already in progress during cleanup.

真实消费端验证须给 `DSH_CODEX_TEST_HOST_MANIFEST` 指定已安装 DSH CLI 的 `package.json` 后运行上述生命周期测试；未指定时仅检查本源码仓锁定的开发版 Cordis，不能据此认定新宿主通过。

## Source development cohort / 源码开发宿主

`dev-host.json` records the default development input: DSH
`0.2.2-alpha.2.vh.2.local.20261031.1` from source
`17eeb2094fea6e08067fdfd3ab34c3b44c4fdead`, manifest SHA-256
`a67b211db222696ec2811a024b8c0abb88984e5c9eb327477ed29e6a93ae6c77`,
the nine exact vendor versions including Cordis `4.0.6-alpha.1` and Schemastery
`3.18.6-alpha.1`, and pi-ai/pi-telemetry `1.3.0`. These unpublished SDK inputs
require the matching reviewed candidate registry when installing; they cannot be
fetched from public npm. Keep this project's `pnpm@11.26.0` and install the lock
normally, without source links or disabling supply-chain checks:

```sh
pnpm install --frozen-lockfile --ignore-scripts --registry "<reviewed-candidate-registry>"
pnpm test
pnpm run build
```

The development cohort also applies the exact DSH shared
[pi-ai 1.3.0 patch](../patches/README.md) through pnpm `patchedDependencies`.
The patch defers streamed argument JSON parsing until completion and retains
Gemini tool-call thought signatures; its canonical source and digest are recorded
in `dev-host.json`. This changes the local Host-owned dependency used by source
tests, while the plugin keeps pi-ai external in its shipped build. The frozen
vh.13 producer commit and 21-file artifact remain unchanged.

The default full source suite now runs this installed cohort. The development
delivery test checks exact direct and transitive SDK identities and requires their
physical paths inside this checkout's pnpm installation. The old unused
`dsh-invariants@0.2.0-rc.2` dev dependency is removed because the master manifest
does not contain it. Public peer ranges, stable compatibility metadata and the
older Cordis lifecycle path remain unchanged. Official compatibility probes
continue to select their own installed Host; the development identity test belongs
to delivery checks rather than that runtime probe.

本源码默认完整测试使用上述精确开发 cohort，不再默认绑定 Cordis `4.0.4`。
`DSH_CODEX_TEST_HOST_MANIFEST` 只为生命周期测试显式选择另一份已安装宿主；其它源码测试仍使用本仓锁定依赖。
旧宿主兼容分支保留，但新开发环境的通过不代替旧宿主或真实消费端的独立验收。

The public `compatibility.latestTested` value and `SUBAGENT_RUNTIME_VERSION`
continue to describe the reviewed public stable lane, not this private development
target. The target is selected separately by the exact development and artifact
bindings; an arbitrary newer version or a similar fork suffix is not accepted.

## 3.2.1-vh.12 effective settings and component binding / 生效配置与组件绑定

Running the complete source suite against the new cohort exposed stale settings
reads: Cordis now keeps raw input in `fiber.config` and live volatile references
in `fiber.effectiveConfig`. vh.12 prefers the effective configuration for settings,
search/fetch selection and native Ultra delegation, with the old Host fallback
retained. The settings regression uses a real Cordis Fiber and verifies the later
status read, reference identity and update notification, rather than trusting the
write receipt.

The optional subtask runtime also needs an explicit fork binding; the public
official-version list alone cannot recognize this private Host. `host-artifact.json`
records the exact component version, its reviewed manifest SRI and the tarball's
19 file hashes. That input is compiled into the runtime and copied into the
host-package binding. The producer and explicit runtime load verify the full
component file closure. Status polling checks identities and core singleton paths
without repeatedly hashing the payload. An equal-version duplicate, changed
payload, nested dependency shadow, unknown fork version or altered owner/binding
is rejected. A separately installed Profile component can share the Host's core
peers without requiring the Host core to depend on the optional component.

If the component is absent, the existing Manager can still select this one exact
approved version and request its normal installation approval. The component
remains optional and disabled by default. Local loading checks its own fixed
Codex CLI `0.153.4` with `--version`; this does not make a model request or establish
authenticated Codex end-to-end acceptance.

完整源码测试切到新宿主后，发现了设置写入成功但后续读取仍返回旧值的问题，因而本次必须生成新 vh.12。
旧 `46482a0b080ed77246889bcedb18fde1b17d1c12` / vh.11 源码与归档保留，不能覆写或继承其资格。
vh.12 仍需新的精确归档、实际消费端单实例及 Profile 生命周期检查；Windows/Linux 原生资格需分别实测。

## 3.2.1-vh.13 Profile ownership and Desktop projection / Profile 依赖与桌面投影

Independent review found two valid installation layouts that vh.12 rejected, so
vh.12 remains an unaccepted rehearsal and its bytes are retained. vh.13 keeps the
same frozen DSH input and binds all ten DeepSeek component dependency identities
and exact versions from the reviewed component manifest. Cordis, LLM and
Schemastery must always resolve to the Host's physical core instances, including
from the plugin and the component's actual entry. Other SDK dependencies visible
to the Host must also share its physical instance. Only when the Host genuinely
has no such non-core package may the component's Profile own that exact reviewed
name/version; this permits the Manager to supply `dsh-subprocess` without
inventing a core Host dependency. Unknown versions and duplicate Host-visible
dependencies remain rejected.

The frozen Desktop SDK artifact with SHA-256
`f20d4900a6a81622069d8885eb4643896dbb376bb84eddd76db9164488e20ba8`
projects this component from 19 files to 16 by omitting exactly
`lib/types/index.d.ts`, `lib/types/run.d.ts` and `lib/types/wire.d.ts`.
Its package manifest, executable code, configuration and all remaining bytes are
unchanged. The vh.13 build input and package binding contain two complete exact
hash maps: the original SRI-bound 19-file artifact and this reviewed 16-file
projection. The runtime accepts either whole layout. Partial declaration removal,
mixed layouts, modified JavaScript or metadata, missing runtime files, unknown
files and nested dependency shadows still fail closed; there is no general file
exclusion rule.

vh.13 修复的是合法安装布局的接纳边界，不改变 DSH/SDK 字节、公共稳定兼容范围、可选组件默认值或 Manager 审批流程。
新版本仍需自身归档收据、最终消费端固定安装及真实 Profile 生命周期验收；vh.12 的测试记录不能替代这些步骤。


## 3.2.1-vh.14 security-fixed Host cohort / 安全修复后的宿主绑定

vh.14 targets DSH `0.2.2-alpha.2.vh.2.local.20261031.1` from the exact source
and manifest above. That DSH cohort fixes the native filesystem execution binding
in core. The former vh.1 cohort and its immutable plugin/SDK archives remain
available as historical evidence; they do not qualify this security-fixed input.
The upstream plugin version and public compatibility declarations stay unchanged.

The optional component is the new cohort's exact
`@deepseek-ai/dsh-subagent-codex` package: tarball SHA-256
`65ebaef9a1cdcdb1dd1b019de4eaf6043bd86d5850fe653ce8b5d0db424109f7`.
Its SRI and full 19-file map come from that reviewed tarball. The separately fixed
Desktop SDK SHA-256
`c269e767d3c30457750a1ad318129b1830298532072296d18bfbe65cde96376c`
supplies the exact 16-file projection; only the same three declaration files are
omitted. The new component package metadata differs from the vh.13 input, so the
old Desktop hash map is not reused. All ten framework dependencies are bound to
their exact versions with the existing Host/Profile physical ownership checks.
SDK API 1, Host protocol 4, owned Codex CLI `0.153.4` and optional installation
approval remain unchanged. A local CLI version check makes no model request.

Source development keeps pnpm `11.26.0`, the canonical shared pi-ai `1.3.0` patch,
and existing public dependency pins. Exact private overrides and release-age
exclusions are derived from the reviewed 387-package manifest; native packages
use their fixed candidate tarball URLs. Normal package-manager resolution and a
frozen install must confirm the resulting lock and package integrity. Do not
relax the release-age policy or accept a similar fork suffix.

Freeze the rebuilt source before packing. Repeat packing against the actual
new consumer Host must produce identical archive bytes and receipts before the
vh.14 artifact is published. Source tests, packaging, Desktop projection and
consumer Profile/native qualification are separate observations; no earlier pass
is inherited and no existing vh.13 archive is overwritten.

vh.14 为新的安全修复宿主生成独立绑定。完整 19 文件、SDK 精确 16 文件投影、组件 SRI
及十项框架依赖均取自新固定输入；旧 vh.13 / 旧 SDK 的摘要和字节保留。源码测试与实际消费端
复打、单实例和 Profile 生命周期仍须分别记录，不以本次元数据升级代替运行资格。
