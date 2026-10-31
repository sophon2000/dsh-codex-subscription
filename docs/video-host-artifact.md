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
