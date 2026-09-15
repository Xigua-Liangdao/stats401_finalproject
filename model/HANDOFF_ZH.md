# Demo 后端交接说明

## 给前端朋友：先用 `data/test/`

当前清洗和指标定义仍可以调整。先用 **`data/test/`** 接前端，确认后把路径换成 **`data/processed/`**。

两边均提供 8 个同名 CSV + `dashboard.json` + `schema.json`。CSV 字段及顺序、声明的数据类型和空值规则一致；JSON 的键和数据类型一致。数据内容与行数不同，不需要为 test 单独写另一套加载逻辑。

```js
const dataset = 'test'; // 确认后改为 'processed'
const root = `../data/${dataset}`; // 从 view/index.html 出发
const response = await fetch(`${root}/dashboard.json`);
if (!response.ok) throw new Error(`Data load failed: ${response.status}`);
const data = await response.json();
```

测试集是保留双方完整阵容的真实比赛子集，包含有模型预测的记录，也包含 warmup 的空预测值。所有汇总只使用该子集中的记录重新计算；没有伪造指标，也没有在小样本上重新训练模型。`metadata.dataset` 是当前加载数据的计数，`metadata.coverage`、`metadata.source` 和 `metadata.evaluation` 是完整后端数据的审计与模型说明。

运行 `python model/run.py` 会同步生成两边；只重建 test 用 `python model/build_test_data.py`。格式检查命令：

```bash
python -m unittest discover -s model/tests -p 'test_data_contract.py' -v
```

## 现在完成了什么

- **真实数据**：2025 LPL，805 场比赛、8,050 条选手记录、99 位选手、16 支队伍、46 套阵容。原始文件还保留 1,610 条队伍记录，共 165 个源字段。
- **可复现流程**：原始数据 → 完整比赛校验 → 特征计算 → 按时间验证模型 → 8 张 CSV 表 + 前端 JSON → 3 张静态图。
- **模型**：Ridge 回归预测 DPM（每分钟对英雄伤害），按角色、英雄、对线英雄、版本、红蓝方、队伍及对手队伍调整。没有把本场胜负、金币或伤害占比作为预测输入。
- **验证**：1,480 条初始记录只做 warmup，随后 6,570 条记录做时间外预测。同一天、同一场的记录不会分散到训练与验证两侧。
- **结果**：模型 MAE 129.868 DPM；仅按位置取历史均值的基线 MAE 142.205 DPM。误差降低约 8.7%，但这不能证明已经识别出队友协同效应。
- **三张实际图**：金币占比–调整后伤害散点图、369 的实际/预期伤害时间序列、BLG 队友共同表现热力图。

## 发给前端同学的入口

1. 先用 [`../data/test/dashboard.json`](../data/test/dashboard.json)，再切到 [`../data/processed/dashboard.json`](../data/processed/dashboard.json)：直接 `fetch`，包含 `players`、`pairs`、`lineups`、`teams`、`timeline` 和元数据。
2. [`../data/README.md`](../data/README.md)：字段含义、路径、单位、null、筛选及聚合注意事项。
3. [`figures/`](figures/)：3 张 PNG + 3 张 SVG，可以直接嵌入网页。
4. [`../README.md`](../README.md)：英文 demo 内容，已包括 dataset、静态图、每张图的交互计划、evaluation plan。

`view/index.html` 读取数据时，路径用 `../data/processed/dashboard.json`；图片路径用 `../model/figures/01_resource_impact.png` 等。浏览器预览使用 HTTP 服务，不要双击 HTML 后依赖 `file://` 加载数据。

```js
const response = await fetch('../data/processed/dashboard.json');
if (!response.ok) throw new Error(`Failed to load project data: ${response.status}`);
const data = await response.json();
const players = data.players.filter(d => d.eligible);
// x: d.mean_gold_share; y: d.mean_impact; color: d.role; size: d.n_games
const pairs = data.pairs.filter(d => d.eligible);
// heatmap: d.player_a_id / d.player_b_id; color: d.shrunk_impact
```

## 老师问模型时，可以这样解释

> 我们先根据位置、英雄、版本和队伍等上下文建立每分钟伤害的期望值，然后计算实际伤害相对期望值的偏差，并用训练数据中该位置的标准差进行标准化。所有用于展示的偏差都来自时间外预测。对于队友组合，我们只汇总实际共同上场比赛中的平均偏差，并展示样本量、收缩后的分数和按比赛日重采样的区间。目前它是共同表现的探索性指标，还不能解释为因果协同效应。

## 必须统一的口径

- `adjusted_impact` 的字段名沿用项目设计，但图中写 **adjusted damage**。它衡量伤害输出，不能代表选手全部价值，尤其不能单凭此判断辅助表现。
- `gold_share` 是**队内总金币占比**，不是源文件的 earned-gold share。
- `mean_impact` 是未收缩均值，用于散点图；`shrunk_impact` = 均值 × n/(n+10)，用于热力图。导出的区间属于收缩值，不能直接画到未收缩均值上。
- `n_games` 只数有时间外预测的比赛；`n_games_total` 还包括 warmup。所有展示用的平均金币占比和分数使用相同的验证比赛集合。
- 灰格不是 0，null 也不是 0。无共同比赛、样本不足、自配对均应明确显示为不可用。
- `patch` 必须保留字符串。`15.10` 不能转成 `15.1`。
- 按 team / role / 最少场数可以直接筛汇总行；按 split / patch / 日期筛选时，必须从逐场数据重新聚合，不能继续展示全年区间。
- 15 分钟经济、经验、补刀差全部缺失，没有填成 0，也没有纳入模型。当前没有可靠的选手级目标参与数据。
- 目前没有换人预测，没有已验证的因果 synergy，也没有已经收集的用户反馈。README 中的交互和用户评估均为计划。

## 课堂展示前还需完成的前端工作

把三张静态图和 README 中的数据／交互／评估内容嵌入项目网页，确认链接可公开打开，再提交老师要求的页面链接。GitHub 仓库地址与 GitHub Pages 网站地址不同。当前后端改动不配置或部署 Pages，也不覆盖队友的 `view/` 入口。

## 重新运行

在仓库根目录执行：

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r model/requirements.txt
python model/run.py
python -m unittest discover -s model/tests -v
```

正常运行无需联网，使用仓库中已固定的原始快照。`python model/acquire.py` 才会重新下载同一版本数据。详细模型报告见 [`reports/evaluation.json`](reports/evaluation.json)，清洗报告见 [`reports/data_quality.json`](reports/data_quality.json)。
