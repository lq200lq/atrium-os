# Changesets

本目录由 [changesets](https://github.com/changesets/changesets) 管理版本与 CHANGELOG。

新增一条变更记录：`npm run changeset`（选择 patch/minor/major 并写摘要），提交生成的 `.changeset/*.md`。
发版：`npm run version`（消费 changeset、更新 `package.json` 版本与 `CHANGELOG.md`）。
