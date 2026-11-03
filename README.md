# Work Growth · 职场成长闭环-职场成长闭环

**用可靠交付积累职业成长。** 面向偏好结构化、书面沟通的职场人的 AI Agent Skill：把零散交办转为行动，合理安排时间，主动沟通风险，自检交付，把经验沉淀为可复用知识。

适用于运营、分析、产品、项目协调、财务等知识工作。内向不是能力缺陷；这套方法也不要求擅长揣摩人心。

## 工作流程

| 环节 | 产出 |
|---|---|
| 邮件、聊天、会议或笔记中的信息提取 | 目标、交付物、责任人、期限、待确认点 |
| 计划与跟踪 | 合理容量、依赖、执行时段、检查日期 |
| 向上管理 | 进度、影响、建议、需要的决策 |
| 交付前自检 | 正确性、完整性、可用性及检查证据 |
| 复盘与知识沉淀 | 更新的方法、检查点和下一轮行动 |
| 成长记录 | 可验证的成果与独立承担责任的进步 |

## 核心规则

- 检查日期不等于交付期限：等待别人也有下一步。
- 制作、复核、交付分别记录：发出索取邮件不代表收到资料。
- 事实与推测分开：主管索取进度不自动意味着不信任。
- 总额对上不代表全部正确：按风险检查分类、重复、遗漏和口径。
- 复盘要改变下一轮动作：错误转成检查点，成功转成方法，变化的数据独立管理。
- 工作量超出容量就明确取舍，不默认加班。

## 日历跟进监控：可运行的第一步

新增 [完整运行流程](calendar-monitoring.md)、[虚构任务输入](examples/tasks.json)、[只读辅助脚本](scripts/monitor.mjs)和[自动化测试](tests/monitor.test.mjs)。

- 早报承接上次收工反馈：今天先做什么、追谁、哪些交付有风险。
- 收工提醒核实最后一步：已完成、未完成、未确认、下一检查与明日入口。
- 文件变化与业务完成分开；用户新反馈覆盖旧状态，打开的工作簿使用待同步机制。
- 每轮对比文件基线；首轮不乱报新增、扫描失败不乱报删除、重复运行不重复提醒。
- 外部日历同步规则包含稳定事件键、续排、人工改动、部分失败和非工作日处理。

工具需要 Node.js 18+，只使用标准库。将示例复制到仓库外的私人目录，再让助手维护真实任务：
```sh
node scripts/monitor.mjs brief examples/tasks.json 2026-11-03 morning
node scripts/monitor.mjs brief examples/tasks.json 2026-11-03 close
node --test tests/monitor.test.mjs
```
输出是机器可读的日期级检查队列，交给助手结合文件内容与最新反馈生成早报/收工提醒。它不自动读 Excel、改日历或运行定时任务；这些由具备相应权限的宿主实现。时分级提醒不能塞进日期级字段。文件扫描用法见模块文档。

> 用 $work-growth 参考我的任务台账和昨晚反馈，执行早报检查，只突出今天需要推进或确认的事。

> 用 $work-growth 做收工检查，核实最后一步，收到我的反馈后更新状态和下一次检查日期。

## 安装

[SKILL.md](SKILL.md) 是入口，包含成长规则与模板；[calendar-monitoring.md](calendar-monitoring.md) 提供日历跟进、早报与收工流程。请下载完整仓库并保留目录结构，放入宿主支持的 Skill 目录，文件夹命名为 `work-growth`。

例如，支持用户级 `~/.codex/skills` 的 Codex 环境：

```sh
git clone https://github.com/linxuanzhenlxz/work-growth-skill.git ~/.codex/skills/work-growth
```

发现与刷新方式依宿主而定。未测试的宿主不保证自动识别。也可以让支持读取文件的助手读取 SKILL.md，再提供工作笔记。

## 使用示例

> 用 $work-growth 整理这些工作记录，区分截止日期和下次检查时间，告诉我今天先做什么。

> 用 $work-growth 检查这个报表能否交付，列出实际检查和未检查的内容。

> 用 $work-growth 做本周复盘，把一个教训变成下周能执行的检查点。

> 用 $work-growth 写给主管的简短更新，包含风险、建议和需要的决定，先给草稿。

## 连接与边界

日历、任务和邮件连接可选；没有连接也可使用粘贴笔记。此包不包含邮箱凭证、日历集成或后台服务。自动提醒需要宿主实际配置调度；发送消息需要明确指示。工作自检不等于独立审计，不保证晋升结果。

仓库仅包含通用方法和虚构示例，不含公司原始报表、人员画像或个人工作记录。请勿将个人运行数据提交到此公开仓库。验收场景不代表已经完成的跨模型行为测评。

## English overview

Work Growth is a language-adaptive agent skill for reliable execution and evidence-based career growth. It connects request capture, capacity-aware planning, managing up, delivery self-review and reusable learning. Meeting notes are optional. Pasted notes suffice; integrations and scheduling depend on the host.

Doing, checking, delivering and closing the loop are separate. Review dates differ from deadlines. Manager observations differ from speculation. Useful reflection becomes a concrete change to the next cycle.

## Contributing

提供虚构或脱敏输入、观察到的失败和期望行为。优先修复具体问题，不把单次案例升级为普遍规则。不提交雇主私人数据。

## License

MIT. Generalized from the author's workflow; no third-party skill text is bundled.
