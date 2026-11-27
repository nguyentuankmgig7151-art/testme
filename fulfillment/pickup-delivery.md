# FJ-57 门店履约日报：S02 自提已核销订单显示与指标修复

来源：GitHub Issue #10（nguyentuankmgig7151-art/testme），门店 S02，样本 O-401（已核销）、O-402（未核销）。演练数据均为虚构。

## 一、根因定位

**结论：日报取数口径遗漏核销标记——日报投影层本身不存在，而非既有分支写错。**

核对工作区实际代码（HEAD `fdd8051`）后确认：

- `fulfillment/shipment.mjs` 只做「出库回执 → 已发货/待发货」判定，输入字段为 `{ storeId, id, at, cancelled }`，不含配送方式与核销状态，无法表达自提核销事实。
- `fulfillment/csv.mjs` 只按 `status === '已发货'` 过滤导出，自提单不会被计入。
- 全仓没有任何按「门店 + 日期」组织的日报投影，也没有 `deliveryMethod`、核销状态字段与「已提货」指标的计算逻辑。

因此 O-401 这类「到店自提 + 已核销」订单在日报侧没有任何映射规则，既不会展示「已提货」，也不会进入「已提货」指标；O-402 同理只是缺省落在「待提货」。这是能力未实现导致的取数口径缺失，不是线上某行分支判断写反。**未核对线上服务，不声称线上根因。**

## 二、修复位置

| 文件 | 变更 |
| --- | --- |
| `fulfillment/daily-report.mjs` | 新增。`buildStoreDailyReport({ storeId, orders, shipmentEvents, observedAt })` 投影日报行与指标 |
| `fulfillment/shipment.test.mjs` | 追加 6 个回归用例（保留原有 5 个） |
| `fulfillment/shipment.mjs`、`csv.mjs`、`target.test.mjs`、`csv.test.mjs`、workflow、README | 未改动 |

映射规则：

- `deliveryMethod === 'pickup'` 且 `status === '已核销'` → 行状态「已提货」，计入 `metrics.pickedUp`。
- `deliveryMethod === 'pickup'` 且未核销 → 「待提货」，不计入 `pickedUp`。
- 非自提（`delivery`）→ 行状态与 `metrics.shipped` 直接取既有 `shipmentStatus(...)` 的 `status` / `count`，口径与修复前一致。
- 仅保留 `storeId` 匹配的订单与回执；同一订单多条记录按 `id` 合并，已核销优先，保证一单一计。

## 三、修复后实际取值（S02，`observedAt = 301000`，回执 `{ S02, E-401, at: 1000 }`）

实际运行 `buildStoreDailyReport` 的输出：

| 订单 | 配送方式 | 原始 status | 日报 reportStatus | 是否计入已提货 |
| --- | --- | --- | --- | --- |
| O-401 | pickup（到店自提） | 已核销 | **已提货** | 是（1 次） |
| O-402 | pickup（到店自提） | 未核销 | **待提货** | 否 |
| O-404 | delivery（配送） | 已发货 | 已发货 | 否（计入已发货） |

指标：`metrics = { pickedUp: 1, shipped: 1 }`。

对照样本单独查询（仅 O-402、无回执）：`reportStatus = 待提货`，`metrics = { pickedUp: 0, shipped: 0 }`。

## 四、测试与结果

执行命令（流程配置动作 `pickup-local-tests`，前台实际执行）：

```
node --test fulfillment/*.test.mjs
```

实际结果：

```
tests 15   pass 15   fail 0   cancelled 0   skipped 0   todo 0   duration_ms 149.34
```

其中 FJ-57 新增 6 个用例全部通过：

1. 已核销自提单 O-401 在 S02 日报显示已提货并只计一次
2. 对照样本 O-402 未核销时仍显示待提货
3. 只有未核销自提单时已提货计数为 0
4. 同一订单的重复核销记录只占一行且不重复计数
5. 其他门店的已核销自提单不进入 S02 日报
6. 非自提单展示与已发货计数沿用出库回执口径

原有用例（CSV 导出 2 个、出库回执去重/窗口/取消 5 个、五分钟边界 2 个）同样通过，未见回归。

CI 入口 `fulfillment/shipment.test.mjs` 已包含全部新增用例，workflow 中的 `node --test fulfillment/shipment.test.mjs` 会自动执行；该单文件命令受流程命令限制未单独运行，结果由上述全量执行覆盖（同一文件、同一断言）。

## 五、验收边界

- 验收对象为本地日报数据层函数的输出（行状态 + 指标计数），不是线上门店界面或线上服务。
- 仅覆盖门店 S02 与当日查询；其他门店、历史日期的表现未做业务结论，仅以「其他门店不进入本店日报」的用例约束范围。
- Issue 原文拉取超时（github.com 请求超时），样本字段以项目上下文所载 Issue #10 正文为准。
- 未代发 Issue 评论、未推送、未合并；仓库动作为林然核对后的原生操作。
