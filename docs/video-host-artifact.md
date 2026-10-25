# Video host artifacts / Video 宿主归档

This fork prepares an exact host-specific package for Video without changing the
upstream runtime build. The same Node commands run on macOS, Linux and Windows.
The ordinary upstream package and compatibility declarations remain unchanged.

本 fork 可为 Video 生成匹配固定 DSH 宿主的插件包。原始运行代码和官方兼容声明保持原样；
适配结果是新的精确版本归档，不是修改已安装包或创建跨仓软链接。

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
