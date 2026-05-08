# 29｜项目实战4：Agent 小队完成真实项目需求

- 课程：企业级多智能体设计实战
- 作者：晓寒（肖汉）
- 来源：[极客时间课程页](https://time.geekbang.org/course/detail/101114301-972263)
- 获取时间：2026-05-07

本节摘要
欢迎回来！上一节课，我们建立了数字员工团队的自我进化机制——三层日志、五问复盘、三档 HITL 审批，让 Agent 做完项目后能自动发现不足、生成改进提案、分级落地。至此，模块四的四大机制全部就位。

但学完 25 到 28 课，你心里大概率有一个问题：这四个机制拉在一起，真的能协作完成一个项目吗？ 单看每个机制都说得通——角色分工清晰、邮箱能传话、人能介入、做完能复盘。可四个机制同时在线的时候，哪些地方需要补胶水代码？补多少？会不会一拼就散？

今天就来验证。我们把 25-28 课的所有机制装配成一个四人数字员工团队（Manager / PM / RD / QA），端到端跑一个真实的 toC 项目。不是示意图，不是伪代码——是一个能接飞书消息、分派任务、在沙盒里写代码跑测试、交付产品、完成自我复盘的完整系统。

这节课代码量非常大，课上主要帮你建立全局理解，课下还是要回去跑起来、看代码。我们提供了完整的 README 和大量测试用例——跑一遍 E2E 测试，比读十遍课文理解更深。

课程说明：本节完整代码位于 code/xiaopaw-team/。核心代码在 xiaopaw_team/ 目录下，角色配置和 Skill 文件在 workspace/ 目录下。

一、模块四回顾：从四个机制到一个团队
先快速回顾这四节课各自解决了什么问题：

图片

课	机制	解决的问题
25	团队角色体系	谁做什么——四层框架（soul / agent / memory / user）定义分工和行为边界
26	任务链与信息传递	怎么传话——文件邮箱三态机 + 共享工作区
27	Human as 甲方	人在哪里——三个介入点 + 单一接口原则
28	自我进化	怎么变好——三层日志 + 五问复盘 + 三档 HITL 审批
每一课解决一个维度，但单点能力不等于系统能力。你在公司里也见过：招了四个优秀的人，但协作一团糟——不是能力问题，是拼装问题。拼装过程中的"接缝"才是真正的工程挑战。

今天的任务就是：找到这些接缝、补上胶水代码、跑通全流程。

我们的 Demo 产品是小爪子日记（PawDiary）——一个宠物日记 toC 单页网站，FastAPI 后端 + SQLite + 单文件前端。产品本身不复杂，重点是验证团队协作流程。

二、架构设计：三层继承与零编排
29 课的代码不是从头写的，而是在 22 课 xiaopaw-with-memory 的骨架上叠加了一层。这是我们从第 11 课就坚持的设计原则：每次只加一层，绝不重写。

图片

L3 团队协作层（29 课新增）
  ├── 4 个 Role Crew：Manager + PM + RD + QA
  ├── 8 个 Python Tools：SendMail / ReadInbox / MarkDone /
  │                      CreateProject / AppendEvent / SendToHuman /
  │                      ReadShared / WriteShared
  ├── File Mailbox：三态机（unread → in_progress → done），FileLock 并发安全
  ├── Event Log：append-only events.jsonl，单 writer（Manager）
  ├── feishu_bridge：CheckpointStore + 5 分类 classify()
  └── tasks_store：SendMail 自动 schedule_wake + heartbeat 错峰
 
L2 记忆层（22 课继承，原样复用）
  ├── Bootstrap：读 workspace/{role}/soul.md + agent.md + memory.md + user.md
  ├── ctx.json / raw.jsonl：跨 session 持久化
  └── pgvector 语义检索（可选）
 
L1 基础设施层（17 课继承，原样复用）
  └── FeishuListener + Runner + SkillLoader + Sub-Crew + AIO-Sandbox + CronService
L1 和 L2 一行代码没改。29 课的全部工程增量都在 L3。

核心创新：零 Python 编排。传统多 Agent 系统会写一个 Python 编排器——if stage == "design": call_pm(); elif stage == "implement": call_rd()。这种方式把流程逻辑写死在代码里，每改一步流程就要改代码。

我们的方案：把流程逻辑写在 SOP Skill 里（自然语言），让 Manager LLM 读了 SOP 就知道下一步该做什么。代码只管“发邮件 = 叫人”。

自驱动循环是这样的：

SendMailTool._run()
  → mailbox.send_mail(to="pm", ...)       # 写文件到 PM 的收件箱
  → tasks_store.schedule_wake("pm")        # 注册 1 秒后唤醒 PM
    → CronService 检测到 tasks.json 变更（热加载）
      → dispatch(InboundMessage routing_key="team:pm")
        → Runner._pick_agent_fn("team:pm")
          → PM Agent kickoff → read_inbox → 处理任务 → send_mail 回 Manager
            → Manager 被唤醒 → 读 SOP → 决定下一步 → send_mail（循环）
发邮件 = 叫人。没有一行 Python 代码规定“PM 做完了该轮到 RD”——这个决策完全由 Manager 读 SOP 后自主判断。流程要改？改 SOP Skill 里的自然语言就行，代码不用动。

项目目录总览
在看具体代码之前，先整体感受一下项目的文件分布：

code/xiaopaw-team/
├── xiaopaw_team/                       # Python 代码（接缝 + 基础设施）
│   ├── main.py                         # 进程入口：build_agent_fn_map + register_heartbeats
│   ├── runner.py                       # routing_key 分派 + wake 去重
│   ├── agents/
│   │   ├── build.py                    # TeamMemoryAwareCrew + build_team_agent_fn 工厂
│   │   ├── config/
│   │   │   ├── agents.yaml             # orchestrator + skill_agent 人设配置
│   │   │   └── tasks.yaml              # main_task + skill_task 契约定义
│   │   └── models.py                   # MainTaskOutput Pydantic schema
│   ├── tools/
│   │   ├── team_tools.py               # 8 个 BaseTool（508 行，核心胶水）
│   │   ├── feishu_bridge.py            # CheckpointStore + 5 分类 classify（243 行）
│   │   ├── mailbox.py                  # 三态状态机（177 行）
│   │   ├── event_log.py                # append-only events.jsonl（158 行）
│   │   ├── workspace.py                # OWNER_BY_PREFIX 权限隔离（137 行）
│   │   ├── self_score.py               # 5 维加权自评（131 行）
│   │   ├── skill_loader.py             # RoleScopedSkillLoaderTool（47 行）
│   │   └── _skill_loader_base.py       # 基类 SkillLoaderTool（22 课继承）
│   ├── cron/
│   │   ├── service.py                  # CronService + mtime hot-reload
│   │   └── tasks_store.py              # write-then-rename + FileLock API
│   ├── memory/                         # 22 课记忆层（原样复用）
│   └── feishu/                         # Listener + Sender + Downloader
│
├── workspace/                          # 配置层（角色身份 + Skills + 协作协议）
│   ├── manager/                        # Manager 角色（soul + agent + memory + user + 13 Skills）
│   ├── pm/                             # PM 角色（soul + agent + memory + user + 5 Skills）
│   ├── rd/                             # RD 角色（soul + agent + memory + user + 7 Skills）
│   ├── qa/                             # QA 角色（soul + agent + memory + user + 8 Skills）
│   └── shared/
│       ├── team_protocol.md            # 团队协作通用约定（所有角色 Bootstrap 时注入）
│       ├── skills/                     # 2 个共享 Skill 模板
│       └── projects/                   # 运行时项目产物
│
├── tests/
│   ├── unit/                           # 快速单测（无需 LLM）
│   ├── integration/                    # 集成测试（真实 FS，无 LLM）
│   │   └── e2e_full/                   # 8 个 E2E（真实 Qwen + 沙盒）
│   └── fixtures/
│
├── config.yaml.template                # 配置模板
└── sandbox-docker-compose.yaml         # AIO-Sandbox 容器定义
两部分的职责完全分离：xiaopaw_team/ 只管"接缝"和基础设施，workspace/ 只管"角色定义"和"业务逻辑"。新增角色不需要改 Python 代码——只需要在 workspace/ 下加一个角色目录。

三、代码拆解：拼装的接缝
理解了架构，我们来看具体改了什么代码。29 课的工程增量不在业务逻辑——业务逻辑全在 35 个 Skill 里。Python 代码只解决拼装问题：路由分派、邮箱唤醒、角色隔离、事件溯源、消息分类、自评量化、Agent 工厂、角色 Bootstrap。

图片

3.1 接缝一：main.py — 四角色启动与全局锁
文件：xiaopaw_team/main.py（214 行）
22 课只有一个 agent_fn，29 课要启动四个。核心变化在 build_agent_fn_map：

ROLES = ("manager", "pm", "rd", "qa")
 
def build_agent_fn_map(*, workspace_root, ctx_dir, sandbox_url,
                       cron_tasks_path, sender, db_dsn=""):
    m = {}
    team_lock = asyncio.Lock()
    for role in ROLES:
        fn = build_team_agent_fn(
            role=role,
            workspace_root=workspace_root,
            ctx_dir=ctx_dir,
            sender=sender,
            db_dsn=db_dsn,
            sandbox_url=sandbox_url,
            cron_tasks_path=cron_tasks_path,
        )
        fn = wrap_with_lock(fn, team_lock)  # 所有角色串行
        m[role] = fn
    return m
为什么要全局锁？ CrewAI 的 @before_llm_call hook 注册在全局 event bus 上。如果 PM 和 QA 并发跑，PM 的 hook 会 fire on QA 的 LLM call——导致 PM 的 system prompt 里出现 QA 的 soul.md。全局锁代价是牺牲微并行，但保证了正确性。Demo 项目体量小，串行不构成瓶颈。

另一个细节是错峰心跳——四个角色的 heartbeat 间隔 7 秒启动，避免四个 Agent 同时醒来抢锁：

HEARTBEAT_STAGGER_MS = (0, 7_000, 14_000, 21_000)
 
def register_heartbeats(tasks_path, *, interval_ms=30_000,
                        stagger_ms=HEARTBEAT_STAGGER_MS):
    for idx, role in enumerate(ROLES):
        tasks_store.schedule_heartbeat(
            tasks_path, role=role,
            interval_ms=interval_ms,
            first_delay_ms=stagger_ms[idx % len(stagger_ms)],
        )
3.2 接缝二：runner.py — routing_key 分派与唤醒去重
文件：xiaopaw_team/runner.py（229 行）

22 课的 Runner 只有一条路：所有消息进同一个 agent_fn。29 课要按 routing_key 前缀把消息分给不同角色：

TEAM_PREFIX = "team:"
 
def _pick_agent_fn(routing_key, agent_fn_map, default_fn):
    if agent_fn_map:
        if routing_key.startswith(TEAM_PREFIX):
            role = routing_key[len(TEAM_PREFIX):]
            if role in agent_fn_map:
                return agent_fn_map[role]
            raise ValueError(f"no agent_fn for team role: {role}")
        if "manager" in agent_fn_map:
            return agent_fn_map["manager"]
    if default_fn is not None:
        return default_fn
    raise RuntimeError("no agent_fn available")
规则很简单：team:pm 走 PM，team:rd 走 RD，飞书来的 p2p:* 消息统一给 Manager（单一接口原则，27 课讲过）。
还有一个唤醒去重逻辑——如果某个角色的队列里已经有一条 pending 的 wake 消息，新来的 wake 就丢弃，避免 heartbeat + new_mail 双触发：

async def dispatch(self, inbound):
    if _is_wake_message(inbound) and self._has_pending_wake(inbound.routing_key):
        logger.debug("dedup wake: routing_key=%s", inbound.routing_key)
        return
    # ... 入队 + 启动 worker
3.3 接缝三：team_tools.py — 8 个团队协作工具
文件：xiaopaw_team/tools/team_tools.py（508 行）

这是 L3 团队协作层最大的一个文件，定义了 8 个 BaseTool 子类：

工具	name	谁能用	核心功能
SendMailTool	send_mail	全角色	写邮箱 + 自动注册唤醒
ReadInboxTool	read_inbox	全角色	读未读邮件，原子标记 in_progress
MarkDoneTool	mark_done	全角色	标记邮件处理完毕
ReadSharedTool	read_shared	全角色	读项目共享文件
WriteSharedTool	write_shared	全角色	写共享文件（受角色权限约束）
CreateProjectTool	create_project	Manager	创建项目目录树 + 初始化邮箱
AppendEventTool	append_event	Manager	事件溯源（append-only）
SendToHumanTool	send_to_human	Manager	飞书出站消息（单一接口保证）
SendMailTool 是整个自驱动循环的核心，做两件事——写邮箱 + 注册唤醒：

class SendMailTool(BaseTool):
    name: str = "send_mail"
    description: str = "向团队成员发送一条邮件。发送后自动唤醒收件角色。"
 
    def _run(self, to, type, subject, content, project_id, **_):
        msg_id = mailbox.send_mail(
            mailbox_dir, to=to, from_=self._from_role,
            type_=type, subject=subject,
            content=content, project_id=project_id,
        )
        job_id = tasks_store.schedule_wake(
            self._cron_tasks_path,
            role=to, reason="new_mail", delay_ms=1000,
            project_id=project_id,
        )
        return json.dumps({
            "errcode": 0, "msg_id": msg_id,
            "scheduled_wake": job_id, "to": to,
        })
发邮件自动叫人——Agent 不需要知道"发完邮件还要通知调度器唤醒对方"，SendMailTool 内部就做了。这消灭了所有显式的流程编排代码。

SendToHumanTool 是 Manager 的专属工具，支持六种 kind——info、checkpoint_request、proposal_review、delivery、evolution_report、error_alert，每种 kind 自动写入对应的事件记录。飞书发送在独立 daemon thread 里执行 asyncio.run()，避免阻塞主事件循环。

3.4 接缝四：mailbox.py — 三态状态机
文件：xiaopaw_team/tools/mailbox.py（177 行）

邮箱是 26 课的三态状态机，用 FileLock 保护并发读写：

unread ──ReadInbox──→ in_progress ──MarkDone──→ done
  │                      │
  └─ FileLock 保护 ──────┘
邮件类型有严格的枚举约束——14 种合法类型：

VALID_TYPES = {
    "task_assign", "task_done",
    "review_request", "review_done",
    "clarification_request", "clarification_answer",
    "error_alert", "checkpoint_response",
    "retro_trigger", "retro_report",
    "retro_approved", "retro_rejected",
    "retro_applied", "retro_apply_failed",
}
 
def send_mail(mailbox_dir, *, to, from_, type_, subject, content, project_id):
    if type_ not in VALID_TYPES:
        raise ValueError(f"invalid type: {type_!r}")
    msg = {
        "id": f"msg-{uuid.uuid4().hex[:8]}",
        "from": from_, "to": to,
        "type": type_, "subject": subject,
        "content": content, "project_id": project_id,
        "timestamp": iso_utc_now(),
        "status": "unread",
    }
    with FileLock(str(lock_path)):
        messages = json.loads(inbox.read_text() or "[]")
        messages.append(msg)
        inbox.write_text(json.dumps(messages, ensure_ascii=False, indent=2))
    return msg["id"]
三态设计防止重复消费——Agent 读取后立即标记 in_progress，即使被重复唤醒也不会重读同一封邮件。

3.5 接缝五：workspace.py — 按角色隔离写权限
文件：xiaopaw_team/tools/workspace.py（137 行）

四个角色共享一个项目目录，但不能乱写。权限在 Python 工具层用前缀白名单强制：

OWNER_BY_PREFIX: dict[str, set[str]] = {
    "needs/":   {"manager"},
    "design/":  {"pm"},
    "tech/":    {"rd"},
    "code/":    {"rd"},
    "qa/":      {"qa"},
}
FORBIDDEN_PREFIXES = ("mailboxes/", "events.jsonl")
 
def check_write(role, rel_path):
    _check_path_traversal(rel_path)
    if any(rel_path.startswith(fp) for fp in FORBIDDEN_PREFIXES):
        raise PermissionError("use dedicated tools for mailbox/events")
    if rel_path.startswith("reviews/"):
        m = REVIEWS_PATTERN.match(rel_path)
        if m and m.group(2) != role:
            raise PermissionError(f"{role} 不能以 {m.group(2)} 身份写评审")
        return
    for prefix, owners in OWNER_BY_PREFIX.items():
        if rel_path.startswith(prefix):
            if role not in owners:
                raise PermissionError(f"{role} cannot write {rel_path}")
            return
PM 只能写 design/，RD 只能写 tech/ 和 code/，QA 只能写 qa/。评审文件 reviews/ 有独立校验——只能以自己角色名义写。mailboxes/ 和 events.jsonl 必须走专用工具，不能直接写。

这不是靠"在 prompt 里告诉 Agent 不要乱写"——是在 Python 工具层硬性拦截，Agent 调了也写不进去。

3.6 接缝六：feishu_bridge.py — 消息分类与 Checkpoint 持久化
文件：xiaopaw_team/tools/feishu_bridge.py（243 行）

27 课讲了 Human as 甲方的三个介入点，但"人的回复到底怎么交给 Manager 处理"这个问题还没落地。feishu_bridge.py 就是这个落地方案，做两件事：分类和跟踪。

分类函数classify() 把人类输入分成 5 类：

分类	触发条件	处理
checkpoint_response	有 pending checkpoint + 用户回复"批准 / 拒绝"	Manager 走 handle_checkpoint_reply Skill
new_requirement	无 pending，包含"帮我做 / 开发一个"等关键词	走 SOP 阶段 1
sop_cocreate	包含"流程 / 标准 / 工作流"等关键词	走 sop_cocreate_guide Skill
clarification_answer	包含"回答 / 澄清"等关键词	补充信息给 Manager
need_discussion	兜底	Manager 自行判断
分类优先级：飞书卡片 callback > 文本匹配 checkpoint_id > 有 pending 时的决策词匹配 > 关键词分类 > 兜底。

CheckpointStore 用 JSONL 文件持久化 pending checkpoint，跨唤醒生存。Manager 发了 checkpoint_request 后，等用户回复可能是几小时甚至几天后。Agent 进程可能已经重启过多次。CheckpointStore 保证 Manager 被唤醒时还能找到之前 pending 的 checkpoint 上下文，而不是重新问用户"你要改什么"。

class CheckpointStore:
    def register(self, *, routing_key, project_id, kind, question,
                 checkpoint_id=None) -> str:
        cid = checkpoint_id or f"ckpt-{uuid.uuid4().hex[:8]}"
        entry = {"checkpoint_id": cid, "routing_key": routing_key,
                 "project_id": project_id, "kind": kind,
                 "question": question, "created_at_ms": _now_ms(),
                 "resolved_at_ms": None}
        # JSONL 追加 + FileLock 保护
        ...
        return cid
 
    def pending_for_routing_key(self, routing_key) -> list[PendingCheckpoint]:
        # 返回该用户下所有未 resolve 的 checkpoint
        ...
 
    def resolve(self, checkpoint_id) -> bool:
        # 追加 resolved marker，幂等
        ...
3.7 接缝七：event_log.py + self_score.py — 事件溯源与量化自评
文件：xiaopaw_team/tools/event_log.py（158 行）+ self_score.py（131 行）

事件流 是项目的"不可篡改日志"——append-only JSON Lines，只有 Manager 能写。每条事件包含 action 枚举校验（requirements_drafted、task_assigned、delivered 等），保证事件链可信。Manager 用 read_project_state Skill 读事件流来判断项目处于哪个阶段。

自评分 是 28 课复盘机制的量化落地——5 维加权打分：

维度	权重	含义
completeness	0.20	模板字段全填
self_review	0.30	自查清单通过率
hard_constraints	0.20	SKILL.md 硬约束合规
clarity	0.15	下游可用性
timeliness	0.15	时间 / 重试次数
自评分嵌入 task_done 邮件中，Manager 据此决定是否需要插入团队评审。

3.8 Agent 工厂：build.py — 每角色一个 Crew
文件：xiaopaw_team/agents/build.py（360 行）

这是 22 课 MemoryAwareCrew 的团队版。核心类 TeamMemoryAwareCrew 用 @CrewBase 装饰，每次 kickoff 创建新实例（防状态污染）：

@CrewBase
class TeamMemoryAwareCrew:
    def __init__(self, *, role, workspace_root, session_id,
                 user_message, routing_key, ctx_dir, db_dsn,
                 history_all, sandbox_url, cron_tasks_path,
                 sender, verbose, step_callback,
                 prune_keep_turns=10):
        self.role = role
        self._role_workspace = workspace_root / role
        self._skills_dir = self._role_workspace / "skills"
        # ... 其他初始化
关键是 orchestrator() 方法——它构造每个角色的 Agent，包含三步注入：

@agent
def orchestrator(self) -> Agent:
    cfg = dict(_load_yaml(_CONFIG_DIR / "agents.yaml")["orchestrator"])
 
    # 1. Bootstrap：读 workspace/{role}/soul.md + agent.md + memory.md + user.md
    bootstrap = build_bootstrap_prompt(self._role_workspace)
    # 2. 注入 shared/team_protocol.md
    shared_protocol = self._workspace_root / "shared" / "team_protocol.md"
    if shared_protocol.exists():
        protocol_text = shared_protocol.read_text(encoding="utf-8")
        bootstrap = f"{bootstrap}\n\n<team_protocol>\n{protocol_text}\n</team_protocol>"
    cfg["backstory"] = bootstrap
 
    # 3. 构造 role-scoped 工具集
    tools = [
        RoleScopedSkillLoaderTool(
            role=self.role,
            skills_dir=self._skills_dir,          # workspace/{role}/skills/
            ...
        ),
        IntermediateTool(),
    ]
    # 注入团队协作 Python Tools
    if self._cron_tasks_path is not None:
        tools.extend(build_role_tools(
            role=self.role,
            workspace_root=self._workspace_root,
            cron_tasks_path=self._cron_tasks_path,
            sender=self._sender,
        ))
    return Agent(**cfg, llm=AliyunLLM(model="qwen3.6-max-preview"),
                 tools=tools, verbose=self._verbose)
build_role_tools 按角色分配工具——全角色共有 5 个（SendMail / ReadInbox / MarkDone / ReadShared / WriteShared），Manager 额外 3 个（CreateProject / AppendEvent / SendToHuman）：

def build_role_tools(*, role, workspace_root, cron_tasks_path, sender=None):
    common = [
        SendMailTool(workspace_root=workspace_root,
                     cron_tasks_path=cron_tasks_path, from_role=role),
        ReadInboxTool(workspace_root=workspace_root, role=role),
        MarkDoneTool(workspace_root=workspace_root, role=role),
        ReadSharedTool(workspace_root=workspace_root, role=role),
        WriteSharedTool(workspace_root=workspace_root, role=role),
    ]
    if role == "manager":
        return common + [
            CreateProjectTool(workspace_root=workspace_root),
            AppendEventTool(workspace_root=workspace_root),
            SendToHumanTool(workspace_root=workspace_root, sender=sender),
        ]
    return common
注意 sender 只传给 Manager——其他角色的 SendToHumanTool 为 None，架构上保证了单一接口原则。

3.9 RoleScopedSkillLoaderTool：角色隔离的 Skill 加载
文件：xiaopaw_team/tools/skill_loader.py（47 行）

22 课的 SkillLoaderTool 用模块级全局变量存储 skills_dir。四角色并发时会互相覆盖——PM 加载的 Skill 可能读到 QA 的目录。RoleScopedSkillLoaderTool 解决了这个问题：

class RoleScopedSkillLoaderTool(_BaseSkillLoaderTool):
    _role: str = PrivateAttr(default="")
 
    def __init__(self, *, role, skills_dir, sandbox_skills_mount,
                 session_id="", sandbox_url="", routing_key="",
                 history_all=None):
        self._role = role
        super().__init__(
            skills_dir=skills_dir,           # workspace/{role}/skills/
            sandbox_mount=sandbox_skills_mount,
            ...
        )
关键改动只有一个：把 skills_dir 从全局变量变成实例变量，绑定到 workspace/{role}/skills/。这样 Manager 只能看到 Manager 目录下的 13 个 Skill，PM 只能看到 PM 目录下的 5 个 Skill。这是从单 Agent → 多 Agent 的关键修复。

代码接缝总结
#	接缝	文件	行数	解决的拼装问题
1	全局锁 + 错峰心跳	main.py	214	4 角色共存不串台
2	routing_key 分派	runner.py	229	消息路由到正确角色 + 唤醒去重
3	8 个团队工具	team_tools.py	508	发邮件 = 叫人，零编排
4	三态邮箱	mailbox.py	177	FileLock 并发安全 + 防重复消费
5	前缀权限隔离	workspace.py	137	共享目录不越权
6	消息分类 + Checkpoint	feishu_bridge.py	243	人类回复正确路由 + 跨唤醒生存
7	事件溯源 + 自评量化	event_log.py + self_score.py	289	项目进度可追踪 + 质量可量化
8	Agent 工厂	build.py	360	每角色一个 Crew + Bootstrap
9	角色 Skill 隔离	skill_loader.py	47	SkillLoader 实例级绑定
9 个接缝、10 个 Python 文件、约 2200 行代码。业务逻辑全在 35 个 Skill 里。接下来，我们看拼装好之后跑起来是什么样。

四、完整演示：从 SOP 到交付的六个阶段
了解了代码改动，现在看实际运行效果。我们先看 35 个 Skill 的全景分布，再跟着一个完整项目走一遍六个阶段。

4.0 Skill 全景地图
35 个 SKILL.md 按角色分布如下：

角色	专属 Skill	共享副本	合计
Manager	sop_feature_dev(主 SOP)、sop_cocreate_guide、sop_write、list_available_sops、requirements_guide、requirements_write、read_project_state、check_review_criteria、handle_checkpoint_reply、team_retrospective、review_proposal	mailbox_ops、self_score	13
PM	product_design、review_tech_design_from_pm	mailbox_ops、self_score、self_retrospective	5
RD	tech_design、code_impl、review_product_design_from_rd、review_test_design	mailbox_ops、self_score、self_retrospective	7
QA	test_design、test_run、review_product_design_from_qa、review_tech_design_from_qa、review_code	mailbox_ops、self_score、self_retrospective	8
shared	—	self_retrospective（模板）、self_score（模板）	2
Manager 有 13 个 Skill，因为它承担了全局调度 + 用户接口 + 复盘协调三重职责。PM / RD / QA 各自只需要"做自己的活 + 评审别人的活 + 复盘自己"。

Skill 类型分布：reference 31 个（LLM 读取后自行推理执行）、task 4 个（code_impl、test_run、mailbox_ops——Sub-Crew 在沙盒执行）。只有一个 Skill 标记了 kind: sop——sop_feature_dev。

4.1 阶段 0-1：SOP 共创与需求澄清
阶段 0：SOP 共创（可选，一次性）

团队开始工作之前，可以先定制工作流程。用户在飞书对 Manager 说：我想让团队按我们公司的流程来做，feishu_bridge.classify() 识别出 sop_cocreate 类别，Manager 加载 sop_cocreate_guide。

这个 Skill 引导 Manager 分 3-4 轮与用户对话，逐步覆盖六个维度：Goal（目标）→ Stages（阶段）→ Roles（角色）→ Artifacts（产物）→ Checkpoints（人类审批点）→ Retrospective（复盘触发）。每轮最多问两个维度，Goal 必须在 Stages 之前确定。

六维全覆盖后，Manager 加载 sop_write（也是 reference skill），按模板把对话结果序列化成一个新的 SKILL.md 文件保存到 workspace/manager/skills/ 目录。

问题：为什么 SOP 是 reference skill 而不是 task skill？第 16 课讲过——task skill 由 Sub-Crew 一次性执行，结束就退出。SOP 需要 Manager 在整个项目生命周期里持续参考，所以必须是 reference。kind: sop 是额外标记，让 SkillLoader 能区分"这是一个 SOP"和"这是一个普通的 reference skill"。

阶段 1：需求澄清

用户在飞书发消息：“帮我做一个宠物日记网站，能记录每天的猫猫状态。” feishu_bridge.classify() 识别出 new_requirement 类别。

Manager 被唤醒后，第一步加载 read_project_state——这是 Manager soul.md 的 NEVER 清单要求的（“绝不在不读 read_project_state 的情况下开始新 kickoff”）。这个 Skill 按 10 条信号从上到下匹配，判断项目阶段（no_project / requirements / product_design / ... / delivered）。判断逻辑基于三个来源：events.jsonl 最新事件、4 个邮箱状态、共享文件是否存在。

确认是新需求后，Manager 加载主 SOP sop_feature_dev，再加载 requirements_guide 按四个维度（goal / boundary / constraint / risk）评估需求完整度。如果有缺口，通过 SendToHuman 在飞书问用户补充细节。

需求明确后，Manager 一气呵成做三件事：

# Manager 的行为（由 SOP 指导，不是 Python 编排）：
# 1. 创建项目——初始化完整目录树 + 4 个邮箱 + events.jsonl
create_project(project_id="paw_diary", project_name="小爪子日记",
               needs_content="## 项目目标\n...")
 
# 2. 发 checkpoint 让用户确认需求
send_to_human(routing_key="p2p:{user_open_id}",
              message="需求确认：...",
              kind="checkpoint_request",
              project_id="paw_diary",
              checkpoint_id="req_v1")
 
# 3. 记录事件
append_event(project_id="paw_diary",
             action="requirements_drafted", payload={...})
create_project 调用 workspace.init_project_tree()，初始化完整的目录结构：needs/、design/、tech/、code/、qa/defects/、reviews/、mailboxes/（含 4 个空 JSON）、logs/l2_task/、events.jsonl。

用户在飞书回复"批准"，feishu_bridge.classify() 检测到有 pending checkpoint + 决策词"批准"，返回 (checkpoint_response, "req_v1")。Manager 加载 handle_checkpoint_reply，按 reply_class × checkpoint.kind 矩阵决定下一步——approve 则推进到阶段 2，revise 则更新需求文档重发 checkpoint。

4.2 阶段 2：PM 产品设计
Manager 读完 SOP，知道下一步是产品设计。它调用 send_mail：

send_mail(to="pm", type="task_assign",
          subject="产品设计 (第 1 轮)",
          content={"scope": "需求文档在 needs/requirements.md"},
          project_id="paw_diary")
SendMail 内部自动注册 schedule_wake("pm")，1 秒后 CronService 唤醒 PM。

PM 被唤醒后，执行 team_protocol.md 里定义的 kickoff 两步法：①从 wake 消息 __wake__:new_mail:paw_diary 提取 project_id；②调用 read_inbox(project_id) 读自己邮箱。

PM 读到 Manager 的 task_assign 邮件，加载 product_design（reference skill），按 6 节模板产出产品设计文档：产品概述、用户场景（至少 3 个）、数据模型、API 契约、验收标准（可机械检验的）、约束与边界。

完成后，PM 先加载 self_score 自评——5 维度加权打分，然后发 task_done 邮件回 Manager：

send_mail(to="manager", type="task_done",
          subject="产品设计完成 (第 1 轮)",
          content={
              "deliverables": ["design/product_spec.md"],
              "self_score": {"overall": 0.82, "breakdown": {...}},
          },
          project_id="paw_diary")
mark_done("paw_diary", "<task_assign_msg_id>")
Manager 被唤醒，读邮件，加载 check_review_criteria 按 5 条 OR 判据判断是否需要交叉评审（影响级别 high+ / self_score < 0.70 / hard_constraints < 0.80 / 新手期 < 3 次 / 15% 随机审计）。如果命中任一条，Manager 给 RD 和 QA 发 review_request 邮件。

4.3 阶段 3：RD 技术实现
Manager 按 SOP 先给 RD 发技术方案设计任务。RD 加载 tech_design（reference skill），按 6 节模板产出技术设计文档：技术栈选型（FastAPI + SQLAlchemy 2.0 + SQLite）、分层架构、数据库 Schema、API 实现要点、测试策略、依赖清单。

技术设计完成后，Manager 再单独发一条 task_assign 让 RD 写代码——这是 SOP 和 tasks.yaml 里都强调的硬规则：

# sop_feature_dev 中的阶段切换硬规则：
| 当前 task_done 来自 | 下一 task_assign | 必须独立发送 |
|-------------------|-----------------|-----------|
| PM（含 product_spec.md） | to=rd "技术方案设计" | ? |
| RD（含 tech_design.md）  | to=rd "代码实现"     | ? 单独再发 |
| RD（含 code/main.py）    | to=qa "测试设计"     | ? |
| QA（含 test_plan.md）    | to=qa "测试执行"     | ? 单独再发 |
为什么拆成两步？因为实测发现，一条消息让 RD 同时做"技术设计 + 代码实现"时，Agent 容易漏做后半部分。拆成两步，每步聚焦一个任务，成功率显著提高。

RD 加载 code_impl（task skill——Sub-Crew 在沙盒里执行），步骤很具体：

Step 1 — 读技术方案
  sandbox_execute_bash cmd="cat /workspace/shared/projects/{pid}/tech/tech_design.md"
 
Step 2 — 建五层目录
  mkdir -p .../code/{routers,services,models,schemas,tests}
 
Step 3 — 按 tech_design 写代码
  必需文件：main.py / database.py / models/*.py / schemas/*.py /
           routers/*.py / services/*.py / tests/test_*.py / requirements.txt
 
Step 4 — 跑测试
  cd .../code && pip install -r requirements.txt -q && \
  python -m pytest -x --cov=. --cov-report=term
 
Step 5 — 失败修复（≤ 3 轮）
  读 stderr 最后 30 行 → 定位失败原因 → 改代码（不改测试）→ 重跑
 
Step 6 — 记 metrics + 发 task_done
Critical Rules：①禁 uvicorn 长进程——测试一律 httpx.Client(app=app)；②覆盖率 < 70% 不交付；③失败最多重试 3 次。

注意 code_impl 的执行方式是混合的——代码在沙盒里跑（sandbox_execute_bash），但邮件在宿主机发（Python Tool send_mail）。因为邮箱文件在宿主机 filesystem，不在沙盒容器里。

4.4 阶段 4-5：QA 测试与交付
Manager 按同样的模式先给 QA 发测试设计任务，再发测试执行任务。QA 加载 test_design（reference skill）产出 qa/test_plan.md，再加载 test_run（task skill）在沙盒里跑 pytest。

如果发现缺陷——这是最能体现零编排价值的场景：

QA 发现 3 个测试失败
  → QA 按 test_run Skill 指引：每个失败写一份缺陷文件到 qa/defects/defect_{id}.md
  → QA 自主决定给 RD 发邮件
    → send_mail(to="rd", type="task_assign",
                subject="缺陷修复 (第 1 轮)", ...)
      → RD 被自动唤醒 → 读 QA 的缺陷描述 → 修复 → 发 task_done 回 QA
        → QA 被唤醒 → 再次验证 → 全部 pass → 发 task_done 回 Manager
没有任何 Python 代码预设了 QA 发现 bug 要通知 RD 这个逻辑。 QA Agent 读了 test_run Skill 里的指引（“如果有 fail，给 RD 发缺陷修复邮件”），自主做出了这个决策。编排逻辑在 Skill 的自然语言里，不在 Python 里。

所有测试通过后，Manager 进入阶段 5 交付——通过 send_to_human(kind="delivery") 把交付汇报发到飞书，用户 approve 后记录 delivered 事件。

4.5 阶段 6：团队复盘与进化
交付不是终点。Manager 读 SOP 知道 delivered 之后要触发复盘——给 PM、RD、QA 各发一封 retro_trigger 邮件。

每个角色被唤醒后加载 self_retrospective（reference skill），执行 28 课讲的五问分析：①我做了什么？②哪个任务效果差？③差在哪一步？④当时发生了什么？⑤怎么改？

每条改进提案必须包含 before_text（当前文本）和 after_text（替换文本）锚点，以及 target_file（要修改的文件路径）。Manager 加载 review_proposal 按 depth 分档预审：

档位	改动对象	审批方式	频率限制
自动	memory.md	Agent 自动执行 + Manager 闸门	每天 ≤ 3 条
中审	skill / agent / SOP	Manager 预审 + Human 飞书批准	批量合并一次 checkpoint
重审	soul.md / code	Human 必审 + 红旗标记	逐条确认
Human 批准后，角色收到 retro_approved 邮件，按 team_protocol.md 规则机械执行文本替换——纯 str.replace(before_text, after_text)，不需要 LLM 判断。下一次项目，Skill 就已经更新了。进化不是抽象概念，是真的改了文件。

五、如何跑起来
说实话，这节课的代码量实在太大了，课上讲代码不如你自己跑起来看效果。这一节给你完整的启动指南。

5.1 环境准备
依赖	版本	用途
Python	3.11+	主语言
Docker + docker-compose	最新	AIO-Sandbox 容器
Qwen API Key	Aliyun DashScope	LLM
（可选）pgvector	—	语义检索；不用可留 db_dsn=“”
# 1. 进入项目 + 装依赖
cd code/xiaopaw-team
python3 -m venv .venv && source .venv/bin/activate
pip install -e .
 
# 2. 配置
cp config.yaml.template config.yaml
# 编辑 config.yaml 填入飞书凭证（或留空用 --no-feishu）
export QWEN_API_KEY=sk-xxxxxxxxxxxx
 
# 3. 启动沙盒
docker-compose -f sandbox-docker-compose.yaml up -d
curl http://localhost:8029/  # 验证 200
模型选择很重要：建议使用 Qwen 3.6 max-preview（qwen3.6-max-preview）。用原来的 Qwen max 跑这个项目基本一步一坑——基础模型的指令遵循能力直接决定了多 Agent 团队能不能跑通。

5.2 两种运行模式
Mode A：不接飞书（推荐首次）

python -m xiaopaw_team.main --no-feishu
进程启动后等 heartbeat 或通过测试直接 dispatch 消息。

Mode B：完整生产模式

python -m xiaopaw_team.main
进程启动 4 个 role agent_fn + CronService + FeishuListener，等用户 @机器人。

5.3 跑测试——最推荐的学习方式
如果你不想通过飞书引导整个流程，直接跑测试就能看到项目是怎么运转的。

# 1. 快测（143 个，<20s，不用 LLM）
pytest tests/unit tests/integration -m "not e2e and not e2e_full" -v
# 预期：143 passed, 9 deselected
 
# 2. 自驱动 handshake（验证 Manager→PM 邮件唤醒，5s，不用 LLM）
pytest tests/integration/test_autonomous_handshake.py -v
 
# 3. E2E 基线：TC-F-001（真实 Qwen + 沙盒，约 13 min）
pytest tests/integration/e2e_full/test_tc_f_001_happy_path.py -v -m e2e_full -s
E2E 基线跑完后你会看到完整的 6 阶段产物：

workspace/shared/projects/todo-mvp/
├── needs/requirements.md          ← Manager 起草
├── design/product_spec.md         ← PM 写
├── tech/tech_design.md            ← RD 写
├── code/*.py                      ← RD 实现 + 单测
├── qa/test_plan.md                ← QA 设计
├── qa/test_report.md              ← QA 执行报告
├── events.jsonl                   ← 完整事件链
└── mailboxes/{manager,pm,rd,qa}.json  ← 邮件历史
注意：WorkspaceSafeguard 会在 teardown 时自动还原 workspace/ 到初始状态。如果想看产物，可以在测试过程中 cat 对应文件，或在 test 结束前加断点。

5.4 E2E 变体——6 个分支场景
除了基线 happy path，我们还写了 6 个变体测试，覆盖不同的分支路径：

变体	测试目标	实测结果
tc_f_001_happy_path	基线：6 阶段全链路	PASSED（qwen3-max, 13min）
tc_f_002_review_loop	PM 产品设计插入团队评审	部分完成：核心产出完成，QA 阶段超时
tc_f_003_qa_defect_rd_fix	QA 发现 defect → RD 修复循环	部分完成：21 文件代码 + 前端完成
tc_f_004_checkpoint_revise	用户对需求 checkpoint 回 revise	部分完成：PM 2 轮设计含迭代
tc_f_005_retrospective	交付后复盘 + 进化分档审批	部分完成：代码 + 测试完成，retro 超时
tc_f_006_code_fail_recovery	RD pytest 失败 → 读 stderr 自愈	部分完成：17 failed 成功触发
tc_f_007_sop_cocreate_first	先共创 SOP 再跑功能开发	PASSED（qwen3.6-max-preview）
说明：标记的变体在 60-90 分钟 timeout 内未走完全部阶段，但核心 6 阶段产物都已生成。失败点集中在长对话后 LLM “只说不做”（回复确认文字而不调工具）。配合更强模型（GPT-4o / Opus 4.5）可进一步提升稳定性。

六、代码学习路线
课后自学建议按这个顺序阅读代码，每一步先看文件再跑对应测试：

第一步：零编排的自驱动循环
读：xiaopaw_team/tools/team_tools.py（搜索 SendMailTool）+ xiaopaw_team/cron/tasks_store.py（搜索 schedule_wake）

理解：SendMail → schedule_wake → CronService → dispatch → Agent kickoff。没有中心化 Python orchestrator，“发邮件 = 自动唤醒对方”。

第二步：邮箱三态机
读：xiaopaw_team/tools/mailbox.py

理解：unread → in_progress → done，in_progress 状态的存在防止了重复消费。所有读 - 改 - 写操作 FileLock 保护。

第三步：事件流与共享工作空间
读：xiaopaw_team/tools/event_log.py + workspace.py

理解：事件流是单 writer（Manager only），保证事件链可信。共享工作空间用前缀 ACL 实现写权限隔离。

第四步：四个角色的身份设计
读：workspace/manager/、pm/、rd/、qa/ 下的 soul.md + agent.md

理解：soul.md 是不可变的核心价值观（含 NEVER 清单），team_protocol.md 在 Bootstrap 时注入所有角色。Manager 三个独占工具体现单一接口原则。

第五步：RoleScopedSkillLoaderTool
读：xiaopaw_team/tools/skill_loader.py + _skill_loader_base.py

理解：22 课全局变量 → 29 课实例变量。这是从单 Agent → 多 Agent 的关键修复。

第六步：Runner 路由与并发控制
读：xiaopaw_team/runner.py

理解：p2p:* 走 Manager，team:pm/rd/qa 走对应角色。全局 Lock 因为 CrewAI Hook 在全局事件总线上，并发执行会交叉污染 Session。

第七步：六阶段 SOP
读：workspace/manager/skills/sop_feature_dev/SKILL.md

理解：SOP 是 Skill（文本），不是代码。Manager 按文本指令推进，阶段间的"推进"就是 send_mail(to=下一角色, type="task_assign")。

第八步：Human as 甲方机制
读：xiaopaw_team/tools/feishu_bridge.py

理解：classify() 5 类分流 + CheckpointStore JSONL 持久化。跨唤醒生存是关键——Manager 重启后还能找到 pending checkpoint。

第九步：自我进化闭环
读：workspace/shared/skills/self_retrospective/SKILL.md + workspace/manager/skills/review_proposal/SKILL.md

理解：改进提案带 before_text / after_text 锚点，机械执行纯文本替换，不依赖 LLM 判断。可重复可审计。

学习检查清单
[ ] 零编排的"自驱动循环"是什么？（SendMail → schedule_wake → CronService → dispatch → Agent kickoff）

[ ] 邮箱三态机为什么需要 in_progress 状态？（防止重复消费）

[ ] Manager 为什么有三个独占工具？（单一接口原则）

[ ] RoleScopedSkillLoaderTool 解决了什么问题？（全局变量在多角色并发时竞争）

[ ] 为什么用全局 asyncio.Lock？（CrewAI Hook 注册在全局事件总线，并发会交叉污染）

[ ] Owner-by-prefix ACL 的规则？（needs/ → Manager, design/ → PM, tech/+code/ → RD, qa/ → QA）

[ ] 自我进化为什么用"机械执行"？（before_text/after_text 纯文本替换，可重复可审计）

七、常见问题
Q: Manager 不派活，只给用户回文字？

Manager LLM 偶现"只说不做"（回复"已分派"但不实际调 send_mail）。检查 sop_feature_dev/SKILL.md 的 critical rules 里有没有"必须调 send_mail 工具"约束，以及 team_protocol.md 的"防只说不做"约束。若仍不稳定，重跑一次或切换到更强模型。

Q: 怎么看 Manager 当前在干啥？

运行时产物都在 workspace/shared/projects/{project_id}/——events.jsonl 是事件流，mailboxes/*.json 是 4 个角色邮箱。会话记录在 data/ctx/s-*.jsonl。

Q: 沙盒为什么不用 local Python？

code_impl 和 test_run 需要运行 bash + pytest，必须隔离（防污染开发机 + 支持任意 pip install）。写文件类 skill（product_design / tech_design / review_*）用宿主机 Python Tools，不走沙盒。

Q: E2E 测试会污染我的 workspace 吗？

不会。WorkspaceSafeguard 在 setup 时 rsync 整目录到备份，teardown 时还原。即使 Agent 误改了 skill 文件也会被还原。

**Q: OpenAI API call failed: 401 一直在 log 里刷？

那是 CrewAI 的 _summarize_chunk（上下文压缩）默认调 OpenAI，我们用 Qwen 不影响主流程，是良性噪声。

八、课程总结
模块四完整走完了。回顾五节课的路径：

课	解决的问题	关键产物
25	谁做什么	四层框架 soul / agent / memory / user
26	怎么传话	文件邮箱三态机 + 共享工作区
27	人在哪里	三个介入点 + 单一接口原则
28	怎么变好	三层日志 + 五问复盘 + 三档审批
29	能不能跑	零编排装配 + 端到端验证
三个最值得记住的工程洞察：

SOP 是操作系统：不是文档而是 kind: sop 的 reference skill，Manager 每次 kickoff 都加载它来决策。要改流程？改 SOP 的自然语言，不改 Python。代码里没有一行 if stage == X。

发邮件 = 叫人：SendMailTool 内置 schedule_wake，消灭了所有显式的流程编排代码。QA 发现 bug 给 RD 发邮件——这个决策不在代码里，在 Skill 的自然语言里。

代码只管接缝：35 个 Skill 承载了全部业务逻辑，10 个 Python 文件（约 2200 行）只解决路由、唤醒、邮箱、权限、事件、分类、自评、Agent 工厂、Skill 隔离九个接缝。新增角色只需要加 workspace/{role}/ 目录 + Skill 文件，接缝代码改动极小。

从第 23 课到第 29 课，我们从零设计了一个完整的数字员工团队。不是 demo 级别的概念验证——是真的能接飞书消息、分派任务、在沙盒里写代码跑测试、交付产品、自我改进的系统。

下节课预告：团队能跑了，但能不能稳定跑？模块五"企业级加固"从可观测性开始——用 Guardrails 加护栏，用 Langfuse 做全链路追踪，让你知道数字员工团队在干什么、干得好不好。我们下节课见！

课后思考
扩展题：如果团队需要新增一个"UI 设计师"角色，你需要改哪些文件？提示：接缝代码只需要在 main.py 的 ROLES 元组加一项，workspace.py 的 OWNER_BY_PREFIX 加 "ui/" 前缀；剩下的工作全在 workspace/ui_designer/ 目录下——soul.md + agent.md + Skills。感受一下改动量的分布。

设计题：当前 4 个角色共享一把全局锁（build.py 的 wrap_with_lock），是因为 CrewAI 的 @before_llm_call 全局事件总线限制。如果未来这个问题修复了，你会怎么改 main.py 来支持 PM 和 QA 并行工作？提示：只需要把 team_lock 改成 per-role 的锁，或者直接去掉 wrap_with_lock。

反思题：回顾整个模块四（25-29 课），你觉得哪个机制对你自己的业务场景最有价值？如果只能先落地一个，你会选哪个？为什么？

欢迎在评论区分享你的真实案例，我们下一讲见！
