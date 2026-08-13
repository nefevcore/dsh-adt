# 调研原始材料（.research/）

本目录保存 ADT 协议深度调研的原始产物，供后续开发与审计使用：

- `repos/vscode_abap_remote_fs-master/` — 社区 VS Code 扩展（MIT，marcellourbani）完整源码克隆，含 ADT 通信层、调试器、ATC/传输视图实现，是协议细节的一手参考
- `fr0ster_*.md` — [mcp-abap-adt](https://github.com/fr0ster/mcp-abap-adt)（MIT）的 README / 使用指南 / 会话指南
- `sap_atc*.md`、`sap_unit_tests.md` — SAP 官方 BTP REST 文档（ATC / ABAP Unit）摘录
- `deepwiki_*.md` — DeepWiki 抓取（原始 HTML，含 Next.js 脚本，仅作追溯）
- `steampunk_deepdive.md` — ABAP Cloud (Steampunk) 深度报告
- `debugger_deepdive.md` — ADT Debugger REST API 调研
- `abapify_*.md` — abapify/adt-cli 契约与架构文档

> 注意：这些材料仅用于协议研究参考。`repos/` 下的第三方仓库版权归其各自作者（均为 MIT 许可）；本仓库正式代码（packages/）为独立实现，不含第三方代码。
