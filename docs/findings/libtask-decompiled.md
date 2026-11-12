# `libtask.so` — what the Ghidra decompilation says (Android 10.9.8)

Status: **first full pass, 2026-11-10.** Source: 1,595 Ghidra-decompiled functions in `data/raw/triage/bundle-10.9.8-base/ghidra-decomp/` (index `_index.tsv`; file addresses are symbol address + 0x100000, so `Adapter::offerTopic` at symbol 0x5e0830 is `Adapter_offerTopic_006e0830.c`), plus the symbol, string and embedded-JSON dumps in the same directory. Decompiled C is approximate: Ghidra drops many string constants into `DAT_*` references, loses `std::function` targets, and mislabels static-method parameters. Every statement below is tagged **[read]** (follows directly from the code), **[inferred]** (our interpretation) or **[not found]** (looked for, not present in what we have). Nothing here concerns encryption or keys.

One structural caveat first: **the N-API callback bodies are not in the decompiled set.** `napi_register_module_v1` is exported and decompiled, but the per-method callbacks it points to (constructor `LAB_006e90c4` and the four method thunks in the `0x5e6340–0x5e93c8` gap) are static, unexported, and were not among the 1,595 functions [read: index has nothing in that range]. What we *do* have is the C++ layer directly beneath them (`Adapter::*`), whose argument structures tell us almost everything the JavaScript passes down.

---

## 1. N-API surface

### 1.1 Module init and class registration

`napi_register_module_v1(env, exports)` (`napi_register_module_v1_006e6228.c`) builds a 4-entry `napi_property_descriptor` array from the string pointers `initData`, `offerTopic`, `setConfig`, `loggerListener`, then calls `napi_define_class(env, "BlockAlgorithm", -1, <constructor LAB_006e90c4>, 0, 4, props, &ctor)`, stores a persistent reference to the constructor in `DAT_00791180`, and sets `exports.BlockAlgorithm = ctor`. Error strings: "Failed to define BlockAlgorithm class", "Failed to create constructor reference", "Failed to set BlockAlgorithm property" [read].

So **exactly four JS-visible methods exist**: `initData`, `offerTopic`, `setConfig`, `loggerListener` [read]. The other names listed as "JS-facing" in `whitebox.md` (`initBoard`, `offerBlock`, `algoList`, `getAlgoData`, `getBoardJsonData`, `AlgoExecute`, `algoSDK_*`) are **not N-API methods**: `AlgoExecute` is the internal puzzle name (`StringToAlgoPuzzleTypeConst_0037c198.c` maps the string "AlgoExecute" to enum 0), `getAlgoData` is a C++ singleton accessor (`getAlgoData_0037cd8c.c`), `getBoardJsonData` is a string used inside `selectBlockHistoryBoard`, and `algoSDK_*` are *feature-flag names* passed in as data (section 1.4) [read]. `initBoard`/`initEdge` appear only as strings inside `FillLogicComponent::execute` / `FillPosLogicComponent::execute` (log labels) [read]. The JS-facing name `initBoard` sits in the string table next to `isClear`, `ratioJson`, `variance`, `offerTopic`, so it is probably a *property key inside the JSON that `offerTopic` receives*, not a method [inferred].

Each method's C++ target is unambiguous from the surviving `Adapter` class [read]:

| JS method | C++ entry (file) | Argument object |
|---|---|---|
| `initData` | `Adapter::initData(InitArgsDef const&)` → `AlgoPuzzleUtil::init(args, BlastCFG{0x100,…,3}, InitStatus&)` (`Adapter_initData_006df098.c`, `AlgoPuzzleUtil_init_00392340.c`) | `InitArgsDef` (seed at +0x18, see §7) |
| `setConfig` | `Adapter::setConfig(std::string const&)` (`Adapter_setConfig_006df2e0.c`) | one JSON string |
| `offerTopic` | `Adapter::offerTopic(AdapterInputData const&, AdapterOutputData&)` (`Adapter_offerTopic_006e0830.c`) | struct built by the callback from the JS object, plus a nested JSON string |
| `loggerListener` | `Adapter::setLoggerCallback(std::function<void(int level, std::string const& msg)> const&)` (`Adapter_setLoggerCallback_006e2c3c.c`) → stored in `WrapperLogger::loggerCallback_` (exported static, `_ZN13WrapperLogger15loggerCallback_E`) | a JS function |

### 1.2 `setConfig` schema [read]

`Adapter::setConfig` parses the string with `nlohmann::json::parse` and looks up, in order: `logLevel` (→ `WrapperLogger::setLevel`), `isDebug`, `enableLog` (→ `WrapperLogger::setEnabled`), `seed` (→ `FixedRandomUtil::initSeed(algoRandom, seed)`), `ratioJson` (an array of objects `{score, id, weight, color}` converted to `std::vector<WeightData>`) together with `isNewTable` (→ `AlgoPuzzleUtil::setRationJson(vec, isNewTable)`; log "Adapter::setConfig: ratioJson isNewTable={}, content={}"), and `historyMoreClearJson` (array → `AlgoData::setHistoryMoreClearData`; log "…historyMoreClearJson size={}").

```json
{ "logLevel": int, "isDebug": bool, "enableLog": bool, "seed": int64,
  "ratioJson": [ {"score": int, "id": int, "weight": int, "color": string}, ... ],
  "isNewTable": bool,
  "historyMoreClearJson": [ ... ] }
```

`ratioJson` is the per-score-tier weight table that `BlocksWeightLogicComponent` consumes (§5): the host supplies the weights, the library supplies the tier boundaries [read + inferred].

### 1.3 `offerTopic` input [read, layout from `AdapterInputData::~AdapterInputData_006e958c.c` and the copy in `Adapter::offerTopic`]

The callback fills an `AdapterInputData` (0x180 bytes). Offsets and types follow from the destructor and from how `Adapter::offerTopic` copies each member into `AlgoExecuteAdapterInputData` and `AlgoExecuteAdapterComponent::inputData` copies them into the puzzle context (`AlgoExecuteAdapterComponent_inputData_00371474.c`):

| Offset | Type | Meaning | Evidence |
|---|---|---|---|
| +0x00 | int | `algoType` | copied to context+0x138, logged as "algoType={}" |
| +0x08 | 8 bytes | second numeric field (probably `highScore`) [inferred] | copied to context+0x140 |
| +0x10 | double | `score` | copied to context+0x148, which `BlocksWeightLogicComponent::execute` compares against 300…7600 |
| +0x18 | std::string | `mode` string [inferred] | copied to context+0x150; `CommonAlgoLogicComponent::execute` compares it with `ModeTypeConstToString(0)` and passes the boolean into `AlgoSelectInputArgs+0x48` |
| +0x30 | int | unknown int (copied to context+0x168) | |
| +0x38 | vector<vector<int>> | **board** (8×8, −1 = empty; see `AlgoUtil::getWeightValue`) | copied to context+0x170, used by every strategy |
| +0x50 | vector<vector<int>> | second board (history/previous board) [inferred] | context+0x188; `SafetyCheckLogicComponent` converts it with `convertToBinaryBoard` |
| +0x68, +0x80, +0x98, +0xb0 | vector<int> ×4 | id lists (candidate ids, `noPut` ids, current blocks …) [inferred] | +0x68 → context+0x1b8 group list |
| +0xc8 | vector<string> | names (feature/trait names) [inferred] | |
| +0xe0 | vector<Pos> | positions (8-byte `Pos`) | |
| +0xf8 | 8 bytes | unknown | |
| +0x100 | vector<int> | **algoTypes to run** | passed as 2nd argument of `AlgoPuzzleUtil::offerTopic` |
| +0x118 | unordered_map<int, vector<int>> | id → list map (block groups?) [inferred] | copied to +0x100 of `AlgoExecuteAdapterInputData` |
| +0x140 | std::string | **extra JSON** (parsed in `Adapter::offerTopic`) | see 1.4 |
| +0x158 | vector<int> | unknown list → `AlgoExecuteAdapterInputData+0x328` | |
| +0x170 | 8 bytes | → +0x320 | |
| +0x178 | int | **safety level** → +0x340 (values 1 or 2 enable the final `hasLiveWay` net, §3.4) | |
| +0x17c | bool | **force safety** → +0x344 | |

### 1.4 The extra JSON (`AdapterInputData+0x140`) [read]

`Adapter::offerTopic` parses this string and reads the following keys (all optional; `find` then `operator[]`). Types are inferred from the `from_json` target and the constructor defaults in `AlgoExecuteAdapterInputData::AlgoExecuteAdapterInputData_006e2a38.c`:

```json
{
  "feature": {
    "lianGuan": bool, "randomToRandomNoDie": bool, "limitSmall": bool, "pos": bool,
    "moreAreaFill": bool, "dfRate": int (default -1), "randomNoDie": int, "edge": int,
    "repeatRandomNoDie": int, "fixFea": [int], "override": [int],
    "limitSmallRandomWeight": int, "isUseCopyBlock": bool, "isLimitCopyBlockIdArr": bool,
    "isLimitBlockIdArr": bool, "copyFilterBlocks": [int], "diffMatrixAlgorithm": {...},
    "notSingleBlockClean": bool, "finalPut": int, "timeout": int, "diffnumState": bool,
    "hardHardIOS": {HardHardIOSConfig}, "extropy": [...], "isRepeat": bool,
    "diffRange": [int], "selectDiff": int, "isExistClear": bool, "extroRates": [...],
    "isInitClear": bool, "putFilter": [...], "noPutFilter": [...]
  },
  "randomPutParam": { "isRandom": bool (default true), "isOne": bool (default true),
                      "isClear": bool (default false), "blockNum": int (default 1) },
  "TkxcMoreClean": { "isMoreClean": bool },
  "centerRow": int, "centerCol": int, "support3": bool, "variance": bool, "mustLess": bool,
  "efficient": bool, "hardLimitNum": int, "passThroughAlgoName": [string],
  "NotUseSeed": int, "blockIds": [int], "hardLimitTime": bool,
  "travelFillBlankAvoidSmallBlock": bool, "FeatRandomBlockByefficientIOS": bool,
  "nebulaDifficulty": number (default 0.5), "nebulaIsAdd": bool, "idx": int (default -1),
  "isSortFillBlock": bool, "isSortByBlockArea": bool, "sortedBlocks": [int]
}
```

Where they land: the `feature.*` booleans fill `AlgoExecuteAdapterInputDataExtra` starting at `AlgoExecuteAdapterInputData+0x128` (`lianGuan`+0x128, `randomToRandomNoDie`+0x129, `limitSmall`+0x12a, `pos`+0x12b, `moreAreaFill`+0x12c, `randomNoDie`+0x130, `dfRate`+0x134, `edge`+0x138, `repeatRandomNoDie`+0x13c, `fixFea` vector +0x140), `notSingleBlockClean`+0x180, `finalPut`+0x184, `timeout`+0x188, `diffnumState`+0x18c, `HardHardIOSConfig` at +0x190, `hardHardIOS`+0x220, `limitSmallRandomWeight`+0x228, `isUseCopyBlock`+0x229 …, `isRandom/isOne/isClear`+0x248/9/a, `blockNum`+0x24c, `centerRow/Col`+0x250/4, `isMoreClean`+0x258, `passThroughAlgoName` vector<string> +0x260, `NotUseSeed`+0x278, `blockIds` +0x280, `idx`+0x2c8, `support3/variance/mustLess/efficient`+0x2cc…0x2cf, `hardLimitNum`+0x2d0, `hardLimitTime`+0x2f4, `FeatRandomBlockByefficientIOS`+0x2f6, `nebulaDifficulty`+0x2f8 (float), `nebulaIsAdd`+0x2fc, `isSortFillBlock/isSortByBlockArea`+0x2fd/e, `sortedBlocks` +0x300 [read from the stack-offset arithmetic; individual offsets are approximate where Ghidra reused temporaries].

One more field matters: **`AlgoExecuteAdapterInputData+0x158` is an `unordered_set<std::string>` of feature names.** `executeCPlusPlusAlgo` and `AlgoPuzzleUtil::offerTopic` look up `"algoSDK_executeCPlusPlus_<id>"` in it; `AlgoExecuteAdapterComponent::inputData` looks up `algoSDK_useRandomAlgo` (→ `FixedRandomUtil::setNotUseSeed(1)`) and `algoSDK_useMicroTime` (→ `SplitFrameUtil::setOverTime`); `BlocksSeqLogicComponent::featureRemoveBlock41` and `PosLogicComponent::execute` look up `algoSDK_notUse41Block` / `algoSDK_modifyBlockPos`; and strategies reach it through `AlgoSelectInputArgs+0x50 → Extra+0x30` (the same set, since `Extra` begins at +0x128): `selectBlockNewClearBoard` looks up `"RemoveAll23Trait"`, `func_death_blcok` and `selectBlockStopRefreshScore` look up strings we cannot resolve (`DAT_0078eb20`, `DAT_0078e640`) [read]. The full set of such names in the string table is: `algoSDK_executeCPlusPlus_{12008,12039,14031,14139,14140,16051,21010,22003,291056}`, `algoSDK_modifyAlgoLogic`, `algoSDK_modifyBlockPos`, `algoSDK_modifyMinEdgeAlgo`, `algoSDK_notUse41Block`, `algoSDK_useMicroTime`, `algoSDK_useRandomAlgo`, plus the trait names `FixIosNewAlgorithmStrategyTrait`, `ShangZendMediumFixTrait`, `RemoveAll23Trait` [read]. **The JavaScript therefore tells the native library which server-side traits are active, by name** [inferred]. Which input field populates the set is not visible (the callback is missing); the `vector<string>` at `AdapterInputData+0xc8` ("names" in the string cluster) is the obvious candidate [inferred].

### 1.5 `offerTopic` output [read, `AdapterOutputData::~AdapterOutputData_006e93c8.c` + tail of `Adapter::offerTopic`]

| Offset | Type | Meaning |
|---|---|---|
| +0x00 | int | result code (copied from `AlgoExecuteAdapterOutputData+0`) |
| +0x08 | vector<vector<int>> | board after the algorithm (or its working board) [inferred] |
| +0x20 | vector<int> | **the three dealt block ids** (the final net reads `[0x20..0x28)` and requires size 3) |
| +0x38 | vector<string> | per-slot algorithm/strategy names (the safety net overwrites a slot's string with a 12-byte marker ending in "…兜底"-like UTF-8 bytes `9d e6 b4 bb`) |
| +0x50 | vector<Pos> | suggested positions |
| +0x68 | vector<int> | algoTypes **not** executed natively (passed back for JS to run; flag +0x98/+0xb0 set to 1) [inferred] |
| +0x80 | vector<vector<AlgoBlockRecord>> | per-block records |
| +0x98 | int | flag |
| +0xb8 | std::string | **extra JSON**: `{"betterBlockCount": int, "betterSpaceCount": int, "tkxcMoreCleanBoard": [...], "board": [[int]], "selectComExtra": {...}}` (dumped with `json::dump`) |
| +0xd0 | bool | `isTimeout` (`SplitFrameUtil::get_over_timeout()` or `m_bIsTimeout`) |

---

## 2. The argument structures

### 2.1 `AlgoSelectInputArgs` (0x110 bytes) [read from the three constructors `AlgoSelectInputArgs_AlgoSelectInputArgs_003a6f24.c`, `…_003ac800.c`, `…_003aac50.c`]

The 8-argument constructor is `(board, ids, bool, shared_ptr<AlgoExecuteAdapterInputDataExtra>, string, function<AlgoSelectComOutputArgs(board)>, vector<int>, vector<Pos>)`:

| Offset | Type | Meaning | How strategies use it |
|---|---|---|---|
| +0x00 | vector<vector<int>> | board (−1 empty) | every strategy does `BinaryBoard b; convertToBinaryBoard(b, args)` |
| +0x18 | vector<int> | **candidate block ids** (the block pool after the pool layer) | `selectBlockRandom` picks uniformly from it; `func_death_blcok` partitions it |
| +0x30 | vector<int> | (zero-initialised in ctors) | |
| +0x48 | bool | `mode == ModeType(0)` (classic mode?) [inferred] | |
| +0x50 | shared_ptr<Extra> | the parsed feature flags + names set | `args+0x50 → +0x30` name lookups; `+0x188` blockIds, `+0x170` names in `selectBlockDealDeathState` |
| +0x60 | std::function | callback returning `AlgoSelectComOutputArgs` from a board (the "Com" sub-selector) | |
| +0x90 | bool | second flag | |
| +0x98 | std::string | algorithm name / key | |
| +0xb0 | vector<vector<int>> | (zero-init) history board [inferred] | |
| +0xc8 | vector<int> | extra ids (e.g. blocks already on hand / `noPut`) [inferred] | |
| +0xe0 | vector<Pos> | positions | |
| +0xf8 | vector<int> | (zero-init) | |

`CommonAlgoLogicComponent::execute` (`CommonAlgoLogicComponent_execute_003b4ee8.c`) constructs it from the puzzle context (board at ctx+0x170, Extra copied from ctx+0x228), wraps it in `std::any`, and calls `Puzzle::runStatelessFunc<string>(puzzle, StatelessType(this+0x6c), statelessId(this+0x74), any)`; the result is cast back to an output struct whose first int is the chosen id [read].

### 2.2 Siblings [read]

- `FillAlgoSelectInputArgs` (0x50): `(board +0, ids +0x18, int +0x30, bool +0x34, shared_ptr<Extra> +0x38, bool +0x48)` (`FillAlgoSelectInputArgs_FillAlgoSelectInputArgs_003a877c.c`).
- `AlgoSelectSafety3InputArgs` (0x80): `(board +0, ids +0x18, vector<string> names +0x30, vector<Pos> +0x48, vector<int> +0x60, Extra* +0x78)` (`AlgoSelectSafety3InputArgs_AlgoSelectSafety3InputArgs_003bc36c.c`). `safety_random_block_by_efficient` requires exactly 3 names, 3 board rows in some sub-structure and 3 ids and reads `Extra+0x1ce`, `+0x1a7` flags.
- `RandomByWeightAlgoSelectInputArgs`: a single `vector<WeightData>`, `WeightData` = 0x28 bytes with a string at +0 (color), `id` at +0x18, `weight` at +0x1c (`selectBlockRandomByWeight_0060c57c.c`). The `score` field position is not visible [not found].
- `AlgoExecuteAdapterInputData` (0x348): mirrors `AdapterInputData` for the first 0x100 bytes, then `unordered_map` +0x100, `Extra` +0x128…0x318, two 8-byte fields +0x318/+0x320, `vector<int>` +0x328, `int` +0x340, `bool` +0x344, `bool` +0x345 (default 1), as laid out by `createEmpty_00375778.c` and the default constructor.
- `OrderFillElimState`: only used by `offerBlock(int mode, OrderFillElimState&)` (`offerBlock_00567dcc.c`); the function reads `state+0x48/0x50/0x58` and a `BaseBoard*` at `state+0x68` (for `getClearCount`), and branches on `mode ∈ {0,1,2}`. No constructor is in the set, so the full layout is [not found].
- `AlgoSelectComOutputArgs` (0x80): four vectors — ids, two int vectors, and a `vector<string>` of names — constructed empty at the top of every "Com" strategy (`func_death_blcok`, `selectBlockStopRefreshScore`) [read].

---

## 3. Strategy registry and the pipeline

### 3.1 Registration [read]

`registerStateless(Puzzle&)` (`registerStateless_003c5660.c`) calls, in order, `register_AlgoSelect` (ids 1,3,2,4,6,5), `register_AlgoSelectFill` (1,4,3,9,2,5), `register_AlgoSelectFillPos` (1,2), `register_AlgoSelectCom` (73 ids: 2,15,115,116,3,117,118,10,11,24,12,26,13,14,6,19,20,28,7,1,4,5,21,138,9,8,18,22,23,25,27,29,30,119,34,35,36,37,39,40,41,42,43,44,45,46,47,49,57,56,52,120,121,113,123,124,125,126,127,58,128,129,130,131,132,133,137,284,141,282,311), `register_AlgoSelectComName` (1,3,4,5), and then seven more single registrations with ids 1, 399, 1, 1, 1, 122, 1 under other group names. Each call is `Puzzle::registerStateless(groupName, id, std::function<any(any const&)>)`; `Puzzle::getStatelessKey` builds the key as `groupName + "_" + id` and `registerStateless` throws `runtime_error` on duplicates (`Puzzle_registerStateless_003c48c0.c`, `Puzzle_getStatelessKey_003528ac.c`). The functions live in an `unordered_map<string, function>` at `Puzzle+0xc8` and are invoked by `Puzzle::runStatelessFunc<StatelessType>` (`Puzzle_runStatelessFunc_StatelessType__003bec60.c`), which logs the key with `WrapperLogger::info` and throws if missing.

**The lambda bodies that bind each id to a `select*` function are not in the decompiled set** (they are the `std::__function::__func<$_N>` thunks referenced as `PTR_LAB_00777440`… in `.data.rel.ro`) [not found]. The id→function table therefore has to be reconstructed indirectly. Two sources agree: (a) the embedded pipeline configs give `statelessId → Chinese title` per component type (`libtask-json-strings.txt`), and (b) the source-file names embedded in the binary give function → file (`AlgoSelectBlockDealDeathState.cpp`, `DeathBlock.cpp`, `TrapHighNearDanger.cpp`, `AlgoSelectStopRefreshScore.cpp`, …). Matching titles to names:

| Group (component type) | statelessId | Title | Function [inferred unless noted] |
|---|---|---|---|
| 280001 "hard problem" (AlgoSelectCom) | 2, 15, 115, 116 | 死亡难题 death problem | `selectBlockDealDeathState` |
| | 18 | 致死题 lethal problem | `func_death_blcok` (DeathBlock.cpp) — matches Ayoships' `ZHI_SI_TI` label |
| | 129 | 简单死亡 simple death | `selectBlockSimpleDeath` / `…NoBit` |
| | 20 | 极端难题 extreme problem | `selectBlockVeryDifficultProblem` |
| | 47 | 极其困难难题 | `selectBlockHardSuper` or `…HardHard` |
| | 11–14, 132 | 困难难题 | `selectBlockHard*` family |
| | 3, 117–119 | 直觉难题 intuition problem | `selectBlockInstinctHard*` |
| | 6 | 简单直觉题 | `selectBlockSimpleInstinctHard` |
| | 7 | 简单难题 | `selectConvenientDifficultProblem` |
| | 10 | 高回报难题 | `selectBlockHardHighEffect` |
| | 19 | 消两次难题 | `selectBlockHardTwice` |
| | 24 | 单消难题 | `selectBlockOneHard` |
| | 25 | 陷阱题-高贴边 trap, high near edge | `trap_high_near_danger` |
| | 26 | 十字消除难题 | `selectBlockCrossClearHard` |
| | 28 | 连续边数少难题 | `selectBlockLessEdge*` |
| | 35 | 难题降级策略 | `selectBlockNantijiangjicelue` |
| | 62 | 无不可放入块难题 | `selectBlockEasyChoose` (?) |
| 230004/260002/260004 | 37, 43, 110, 113 | 随机无死亡 / 随机无死 | `selectRandomNoDie`, `safety_random_block_by_efficient`, `getRandomNoDie` |
| 310000 fallback | 9 | 帮扶清盘 assisted board clear | `selectBlockClearBoard*`, `tkxc_clear_board` |
| | 8 | 终止刷分 / 随机填空 | `selectBlockStopRefreshScore` (file name confirms) |
| | 2 | 消除爽 | `selectBlockClearCool` |
| | 4 | 快速填空 | `tkxc_quick` |
| | 10 | 增加权重 | weight component |
| 270001/270002 | 44, 3 | 熵增3 / 子母熵增3 | `selectBlockEntropy3Medium`, `selectComZiMu` |
| | 22, 39 | 熵增4, 熵增1 | `selectBlockEntropy4`, `selectBlockEntropyIncrease1` |
| 300002 | 42 | 聚拢算法 | `selectBlockGather` |
| | 57 | 限制高combo算法 | `selectBlockLimitHighCombo` |
| | 52 | 不清屏 | `selectBlockAvoidClearBoard` |
| | 34 | 分数算法 | `selectBlockScore` |
| | 41 | 切割块 | `selectCutNormal` |
| 290001 | 2, 58 | 复活算法 / 复活 | `selectBlockReviveReplace` |
| 210001/210002/210003/250001 (Fill) | 1–5, 9 | 填空消除 variants | `selectBlockFill*`, `selectBlockOrderFillElim`, `select3C3BlockFill` |

Note that the `statelessId` namespace is **per group**: id 2 is "death problem" in group 280001 but "satisfying clears" in group 310000 [read from configs]. The second source quoted "`statelessId: 123, statelessIdDowngrade: 37, blockGroupDowngrade: 1, statelessIdDowngradeType: 2`"; 123 and 37 are both registered in `register_AlgoSelectCom`, and `CommonComAlgoLogicComponent::unmarshal` reads exactly the keys `statelessIdDowngrade`, `blockGroupDowngrade`, `statelessIdDowngradeType` [read]. In the default configs 37 is titled 随机无死亡 ("random, no death"), i.e. **the downgrade target of a hard strategy is a no-death strategy** [read + inferred].

`AlgoConst::getAlgoCategory(int algoType)` (`AlgoConst_getAlgoCategory_00362060.c`) bands the *JS-level* `algoType` by thousands: 11001–11999 → 1, 12001–12999 → 2, 13001… → 3, 14… → 4, 15… → 5, 16… → 6, 17… → 7, 18… → 8, 19… → 9 (the decompiled text stops there; 10000 is a special case). So Ayoships' `algo_must_death = 24001` would be category 14 [inferred]. `AlgoConst::getAlgoTypeNameMap` is a 12-byte accessor returning a static map whose contents are data [not found]; `getCoreComponentTypeNameMap` is not in the set [not found].

### 3.2 The pipeline from `offerTopic` down [read]

1. `Adapter::offerTopic` copies the input, parses the extra JSON (§1.4), calls `AlgoPuzzleUtil::offerTopic(input, algoTypes)`, then packs the output (§1.5).
2. `AlgoPuzzleUtil::offerTopic` (`AlgoPuzzleUtil_offerTopic_003939c8.c`) resets the frame timer (`SplitFrameUtil::set_over_timeout(false)`, `m_bIsTimeout = 0`), calls `doFeature(input, algoTypes)` (feature pre-processing, `AlgoPuzzleUtil_doFeature_00392f60.c`), then **for each algoType**: if it is one of {12008, 12039, 14031, 14139, 14140, 16051, 21010, 22003, 291056} *and* `"algoSDK_executeCPlusPlus_<id>"` is in the names set, it runs `getAlgoPuzzle()->runPuzzlePiece("AlgoExecute", to_string(algoType), input)`; otherwise the algoType is appended to `output+0x68` and `output+0xb0 = 1` ("not handled here"; `WrapperLogger::info<int>`). `executeCPlusPlusAlgo` (`executeCPlusPlusAlgo_00393870.c`) is the same test as a standalone predicate. **So native execution of a given algorithm is opt-in per algoType, switched by a name the host passes in** [read]. The nine algoTypes are presumably the ones whose JS implementation has been ported to C++; everything else still runs in JavaScript [inferred].
3. `Puzzle::runPuzzlePiece` (`Puzzle_runPuzzlePiece_00350d84.c`): `resetPuzzlePieceMap`, fetch the `main` component (900400001) as `ITypedAdapterComponent<AlgoExecuteAdapterInputData, AlgoExecuteAdapterOutputData>`, then `inputData / execute / outputData`. `AlgoExecuteAdapterComponent::inputData` copies the input into the puzzle context (§1.3 offsets), sets the timeout (100 ms default, 100 "over-time units"; overridden by `algoSDK_useMicroTime`), applies `NotUseSeed`/`algoSDK_useRandomAlgo` to the RNG, and sets `BinaryBoard::setEdgeCalType(edge)`.
4. The component tree is data (`libtask-json-strings.txt`, `libtask-component-titles.tsv`): `900400001 → 300002` (`LinearGroupLogicComponent`, keys `itemTvoArr`, `logicCompId`, `conditionCompId`) → six `FeatureGroupLogicComponent`s 500003–500008 titled 预处理层 preprocessing, 块池层 block pool, 选块层 selection, 兜底层 fallback, 位置层 position, 打印层 print, each with `featureCompIdArr` → `BasicFeatureComponent` 6000xx `{logicCompId, conditionCompId, abilityConditionCompId}` → the logic components. Component ids are 11 digits `TTTTTTxxxxx` (type prefix + instance). Condition components (10005xxxxx) carry `{"highScore": 3000, "score": 2000, "chapterNum": 12}` in the embedded defaults — the only place these numbers occur [read].
5. Block-pool layer components: `20000600010` 连续块池 `{startBlockId: 2, endBlockId: 42}`; `20000300012` fixed pool `{blocks: [6, 27, 28, 15, 3, 2, 5, 4, 37, 38, 39, 40, 41]}`; `20000700010` `BlocksWeightLogicComponent` `{checkLimitSmall: true, removeBlockArr: [1, 6, 27, 28, 15, 3, 2, 5, 4, 37, 38, 39, 40, 41], refreshWeight: true}`; `200004xxxxx` 块池排序 `{sort: 2}`; `200051xxxxx` `{needFilter, needAdd}` [read].
6. Selection layer: `280001xxxxx {statelessId}` via `CommonAlgoLogicComponent`/`CommonComAlgoLogicComponent`/`HardLogicComponent::execute`, which call the registry; `RandomAlgoLogicComponent::execute` calls `selectBlockRandom`/`selectBlockRandomByWeight` directly; `RandomLogicComponent` chooses among `randomLogicArr` by `randomWeight` [read].
7. Fallback layer (兜底层): `SafetyCheckLogicComponent`, `SafetyRandomNoDeathComponent`, `SafetyReplaceRandomComponent`, `SafetyLastLogicComponent`, `RandomNoDieLogicComponent`, `RandomNoDieFixLogicComponent`, `ClearBoardGatherLogicComponent` (`noDie`, `statelessId2`, `statelessId3`), and the 310000 components `{index, blockGroup, clearState, statelessId, isRemoveBlockIds}` [read].
8. After the component tree returns, `AlgoPuzzleUtil::offerTopic` has two more steps: if `input+0x324 == 1` it logs "offerTopic degrade enabled, algoType={}, blockIdsSize={}" and calls `GrowUpClear::offerBlock(board, ids, positions, names)` (a complete replacement deal, see §4); and then the **global safety net** of §3.4.

### 3.3 Where `hasLiveWay` is enforced [read]

- `SafetyCheckLogicComponent::execute` (`…_003b790c.c`): if `ctx+0x41c == 1` it first calls `GrowUpClear::offerBlock`. Then, depending on `this+0x70` (0–4) and a count at `this+0x6c`, it keeps block 0 of the deal and **redraws blocks 1 and 2 uniformly (`originRandom`) from a candidate list until `hasLiveWay(board, [b1, b2])` is true or the frame timer expires** (`SplitFrameUtil::checkOverTime`; on expiry it logs a warning and sets `m_bIsTimeout = 1`). There is **no fixed retry count**; the loop is time-bounded. The second source's "8 retries then safe pool" is not what this code does [read].
- `AlgoPuzzleUtil::offerTopic` final net (§3.4).
- Inside strategies: `selectBlockStopRefreshScore`, `selectBlockDealDeathState`, `selectBlockReviveReplace`, `selectBlockHardSuper`, the `RandomNoDie*` components, `ClearBoardGatherLogicComponent::hasLiveWay`.

### 3.4 The global safety net [read, `AlgoPuzzleUtil_offerTopic_003939c8.c` lines ~1050–1260]

Condition: `(input+0x344 bool) || (input+0x340 ∈ {1, 2})`, **and** the result has exactly 3 ids, **and** `AlgoUtil::hasLiveWay(board, ids, true)` is false. Then for slot i = 2, 1, 0: build the list 1…42, shuffle (`FixedRandomUtil::shuffle<int>`), and try each id ≠ current in that slot; the first that makes `hasLiveWay` true is kept and the slot's name string is replaced by a marker. If no single replacement works it calls `AlgoUtil::splitBlocks` + `visitPermutations(…, 3, true, callback)` to search triples. Finally it logs elapsed time. **The net is conditional on input flags**: with `+0x340 == 0` and `+0x344 == false` a dead deal passes through untouched [read]. This is the switch a "lethal" trait would leave off [inferred].

---

## 4. What the headline strategies do

All strategies receive the board as `vector<vector<int>>` (−1 = empty), convert it to a `BinaryBoard` (64-bit masks; `BaseBoard::record/revert` save and restore), and use `BaseBoard::canPut(id)`, `getCanPutPoss(id)`, `putBlock(id, pos)`, `canClearBlockArr(flag)` (apply line clears). Randomness is always the shared `FixedRandomUtil` instance `algoRandom` (`PTR_algoRandom_00780b40`) unless noted.

**`func_death_blcok(AlgoSelectInputArgs const&)`** (`func_death_blcok_00628638.c`, source `DeathBlock.cpp`) [read]. Partition the candidate ids (`args+0x18`, after a shuffle and a look-up of one feature name in the names set) into *placeable* (`canPut` true) and *unplaceable* lists. For every ordered pair (a, b) of distinct placeable ids and every unplaceable id u, call `canPutBlocksWay2(board, x, y, z, out)` for the four orders (a,b,u), (a,u,b), (b,a,u), (b,u,a) — the two orders starting with u are unnecessary because u cannot be placed first — and if `out` stays empty (no order, no positions, clears included, places all three) return `[a, b, u]` shuffled. The search is bounded by `SplitFrameUtil::checkOverTime` at `DeathBlock.cpp` lines 0x2f/0x34/0x39/0x41; on timeout it returns an empty result. **This confirms the Ayoships description exactly: two pieces that fit now, one that does not, and no completing order.** `canPutBlocksWay2` (`canPutBlocksWay2_00628ff8.c`) places the first at each position, applies clears, places the second at each position, applies clears, and records a way if the third fits; it is a complete 3-piece order-aware search [read].

**`selectBlockDealDeathState`** (`selectBlockDealDeathState_003d6ad0.c`, `AlgoSelectBlockDealDeathState.cpp`) [read, partially]. Requires ≥3 ids in `Extra+0x188` (`blockIds`, the deal to "process"). Builds the list of placeable candidates, picks three uniformly at random (three `originRandom` draws, so repeats are allowed), shuffles, then overwrites one slot (index from a small state vector) with a random candidate and tests `AlgoUtil::hasLiveWay(board, ids, true)`. If the result **has** a live way it keeps searching (time-bounded at `…DealDeathState.cpp:0x73`) — the loop exits on `hasLiveWay == 0`, i.e. it is looking for a *dead* triple [read: `if ((uVar17 & 1) == 0) goto <accept>`]. If the candidates are exhausted it falls back to a fixed list of ten small ids (constants in `.rodata`, last two are 27 and 28) and three copies of id 1 [read]. Decisive difference from `func_death_blcok`: it does not require two placeable pieces; it randomises until the whole triple has no completing order [inferred].

**`selectBlockSimpleDeath` / `selectBlockSimpleDeathNoBit`** (`…_0061154c.c`, `…_00612990.c`) [read, skeleton]. Exhaustive `canPut`/`putBlock`/`canClearBlockArr` search with `AlgoUtil::sortPos` (positions sorted) and `ShapeInfo::getConfig`; the NoBit variant uses `NoBitUtils::canPut` (28 call sites) on the non-bitboard representation. Both are time-bounded. The decisive constants are not visible in the skeleton; what is visible is that they do not call `hasLiveWay` — they build the dead state constructively [inferred].

**`selectBlockVeryDifficultProblem`** (极端难题, `…_0057cf78.c`) [read, skeleton]. 1,605 lines of placement simulation: for each candidate it enumerates positions, applies clears, measures `getClearCount` and `emptyAt`, and sorts the hard pool with `BlocksUtil::sortHardBlockPoolByPriority` when `BlocksUtil::isSortByBlockAreaEnabled(extra)` (the `isSortByBlockArea` flag). No RNG call: it is deterministic given the board and pool [read].

**`selectConvenientDifficultProblem`** (简单难题, `…_0058f96c.c`) [read, skeleton]. Shuffles three times, simulates placements with `canClearRowCols` and `getClearCount`, logs empty tiles, uses a `BlockPools` helper; time-bounded. Picks a "convenient" hard set: pieces that fit but do not clear [inferred].

**`trap_high_near_danger`** (陷阱题-高贴边, `TrapHighNearDanger.cpp`, `…_006b06e0.c`) [read, skeleton]. Needs >1 candidate; builds three `BinaryBoard`s, shuffles, and logs three times via `WrapperLogger::info`; it reads `SplitFrameUtil::getOverTimeNum` twice (time budget). The "near danger" criterion is computed on bitboards without `ShapeInfo`; the constants are not visible [not found].

**`selectRandomNoDie`** (`AlgoSelectRandomNoDie.cpp`, `…_0060c6b4.c`) [read]. Removes from the candidates any id present in a second list (`wmemchr` over `args+…`), shuffles, then simulates placements with clears looking for a survivable triple (time-bounded at line 0x4b). If it fails it falls back to `selectBlockLessEdge(FillAlgoSelectInputArgs)` with a fixed 10-id list (ending 9, 1) and returns `[x, 1, 1]`-style fillers (the 1×1 piece) [read]. In other words: random, but never a dead deal, and in extremis it deals 1×1s.

**`safety_random_block_by_efficient`** (`…_006a1edc.c`) [read, skeleton]. Requires exactly 3 names and 3 ids; reads `BlocksUtil::getDieBlockArray()` (the hard-piece list) and `AlgoData::getResult()` (the previous result); replaces blocks and checks clears; logs errors if the inputs are malformed. It is the "FeatRandomBlockByefficientIOS" path [inferred from the flag name].

**`selectBlockRandom`** (`…_0060c4f0.c`) [read]: `ids[floor(originRandom() × n)]`; returns id and −1. **`selectBlockRandomByWeight`** (`…_0060c57c.c`) [read]: sums `WeightData.weight`, draws `originRandom() × total`, walks the cumulative sum.

**`selectBlockHard`** (`…_005c5c0c.c`) [read, skeleton]: `BaseBoard::splitBlocks`, `putBlock`, `canClearBlockArr`, a `/100.0` ratio, time-bounded. **`selectBlockHardBinary`** (`…_005c6b10.c`, 2,682 lines): pure bitboard enumeration with `canPut`/`putBlock`/`canClearBlockArr`, no RNG [read].

**`selectBlockEasyChoose`** (`…_0059ba44.c`) [read, skeleton]: scores each candidate by `BaseBoard::calculateOccupiedCells` after placement, averages over positions, compares (`dVar52 <= dVar50`), then picks with two `originRandom` draws among the best; logs via `do_info`.

**`selectBlockStopRefreshScore`** (终止刷分, `AlgoSelectStopRefreshScore.cpp`, `…_00614d20.c`) [read, complete]. For each candidate, keep it only if it is placeable **and no placement clears a line** (`canClearBlockArr` false for every position). If at least 5 such ids remain: shuffle, enumerate all 3-combinations (`allCombinations`), return the first with `hasLiveWay(board, triple, args, true)`. Otherwise shuffle all candidates and return the first combination with `hasLiveWay(…, false)`. Plain English: **deal three pieces that cannot score immediately but can still all be placed** — an anti-farming brake on a hot streak.

**`selectBlockReviveReplace`** (复活, `…_0056d980.c`) [read]. Switch on the id of a block: 13 (3×3), 21, 11 (H-bar-5), 12, 22 (V-bar-5), 23, 24, 35 (3×2), 36 (2×3) are each mapped to a fixed list of replacement triples (for 13: `[?,?,2]`, `[?,9]`, `[4,4,4]`, `[5,5,5]`, `[?,24]`, `[?,37]` — the same area in smaller pieces), then `AlgoUtil::hasLiveWay(board, candidate, true)` must hold. This is the library's **explicit list of "big/hard" shapes** [read].

**`selectBlockFirstRoundSpiceOffer`** (`…_003f0034.c`) [read, complete]. From the candidates, exclude id 17 (horizontal bar 4) and every shape with ≤3 cells; pick one uniformly; return it **three times**. The first-round "spice" deal is three identical ≥4-cell pieces.

**`selectBlockLimitHighCombo`** (`…_00514bf8.c`) [read, partial]. Examines the current deal's rows/columns for −1 cells, computes a per-shape height sum (`ShapeInfo` field +0x24 for each of the 3 ids), rejects triples whose summed height exceeds a bound when a combo counter is < 5 / ≥ 5, and caps the candidate list at 99 triples. It limits how "tall" the deal can be while a combo is running [inferred].

**`selectBlockEntropy3Medium`** (`AlgoSelectBlockEntropy3Medium.cpp`, `…_003e1844.c`) [read, skeleton]. Uses `BinaryBoard::getEdgeGameNum` (three times), `shuffle<int>`, `shuffle<Vec>`, one `originRandom`, and placement simulation; chooses pieces that keep the board's "edge count" in a medium band [inferred].

**`getBlockPool(BinaryBoard&, ids)`** (`getBlockPool_005ab384.c`) [read]: for each id with >3 cells, if **no** placement clears a line, add it (with its cell count) — at probability 0.5 (`originRandomOld`) sorted-insert, else append. Produces the pool of "big pieces that cannot score now" used by `selectBlockEntropy4`.

**`coverRate(BinaryBoard&, int id)`** (`coverRate_005ea3b4.c`) [read]: **not** the board fill fraction. It counts the distinct board cells covered by all legal placements of shape `id` (as a `set<string>` of "r,c" keys) and divides by the shape's cell count. **`idPriority`** (`idPriority_005ea770.c`) buckets a shape into 1/2/3 from `coverRate` (<1, ==1, <3, ≥3) and whether it has >3 placements (used by `selectBlockHardSuper`).

**`hasLiveWay(board, array<int,3>, args, bool clears)`** (`hasLiveWay_00615c9c.c`) [read]: for each of the 6 permutations, for each position of the first piece (place, clear), for each position of the second (place, clear), does the third fit anywhere? Returns 1 on the first success. **`AlgoUtil::hasLiveWay(board, vector<int>, bool)`** (`AlgoUtil_hasLiveWay_006bc2c0.c`): same for 3 ids (6 permutations via a helper), for 2 ids (both orders, clears forced true), 1 id (`canPut`), else false. **`SafetyCheckLogicComponent::hasLiveWay(BinaryBoard&, ids)`** (`…_003b9254.c`): the 2-piece version used by the fallback loop. The overload `hasLiveWay(BinaryBoard&, ids, vector<pair<int,Vec>>*, bool)` (`hasLiveWay_005ab870.c`) also returns the placements [read].

**`AlgoBin::GetDeathRate(ids, board)`** (`AlgoBin_GetDeathRate_006b7eec.c`) [read]: over all 6 permutations of the three ids, for every position of the first (place, clear) and every position of the second (place, clear), count whether the third can be placed; returns `dead / (alive + dead)`. A continuous "how lethal is this deal" score in [0, 1].

**`AlgoUtil::produceRandomId(excludeId, board)`** (`…_006bbc10.c`) [read]: for ids 2…42 except `excludeId`, push the id once per legal placement, pick uniformly — i.e. a placeable id weighted by its number of placements; returns 1 if nothing fits. **`AlgoUtil::getWeightValue(board)`** (`…_006b9b78.c`) [read]: counts empty cells, how many positions accept the 3×3 (13), the 5-bars (11, 22), and neighbouring-filled cells; a board "openness" heuristic.

---

## 5. Constants hunt

| Claim (second source) | Finding |
|---|---|
| Cover-rate thresholds **0.58 / 0.28** (also as `0x3FE28F5C28F5C28F` / `0x3FD1EB851EB851EC`) | **[not found]** in any of the 1,595 files, decimal or hex. `coverRate` is a per-shape coverage ratio (§4), not a board fill rate, so the claim is mis-described even if a fill threshold exists in the JavaScript. |
| 17 score tiers 0, 300, 500, 700, 1000, 1400, 1800, 2200, 2500, 3000, 3800, 4500, 5200, 6000, 6800, 7600, **8400** | **[read] Found verbatim** in `BlocksWeightLogicComponent::execute` (`BlocksWeightLogicComponent_execute_003a0bb8.c`): an array of 17 ints (last = 0x20d0 = 8400) and a chain `if (score < 300.0) tier=1; if (score < 500.0) tier=2; … if (score < 7600.0) tier=15` (16 → ≥7600, 0 → score<0). The tier is turned into a string key ("<tier>+" or "-") used to select entries of the `ratioJson` `WeightData` list (`ctx+0x118`). So the **boundaries are hard-coded, the weights per tier come from the host via `setConfig.ratioJson`**. The constant 25001 (0x61a9) also appears in that function. `BlocksUtil::weightBlockArray` (`…_006bfde8.c`) applies the weights with six `originRandomOld` draws and the same 8400 ceiling. |
| Hard-piece odds **5% → 40%** (0.05, 0.4) | **[not found]** as literals anywhere. If real they are in `ratioJson` data, not code [inferred]. |
| Retry count **8** then safe pool | **[not found]** as a loop bound; `SafetyCheckLogicComponent` loops until the frame timer expires (§3.3). |
| SAFE pool `[6, 27, 28, 15, 3, 2, 5, 4, 37, 38, 39, 40, 41]` | **[read] Found as data**, twice: as the fixed block pool of component `20000300012` (`"blocks": [6, 27, 28, 15, 3, 2, 5, 4, 37, 38, 39, 40, 41]`) and, with id 1 prepended, as `removeBlockArr` of `BlocksWeightLogicComponent` `20000700010` (`"checkLimitSmall": true, "removeBlockArr": [1, 6, 27, 28, 15, 3, 2, 5, 4, 37, 38, 39, 40, 41]`). These are the 1–3-cell pieces (singles, dominoes, 3-bars, small Ls, diagonals). In the "death problem" pipeline the component **removes** them from the pool; in rescue pipelines the same list **is** the pool. |
| HARD pool `[11, 13, 22, 12, 24, 21, 23, 14, 16, 18, 19]` | **[not found] as a literal list**; the closest objects are `BlocksUtil::getDefaultDieBlockArray` (`…_006bfb80.c`), a 34-int constant table in `.rodata` whose only visible pair is (11, 13), and the `selectBlockReviveReplace` switch over {11, 12, 13, 21, 22, 23, 24, 35, 36}. The library clearly has a "die block" list; its exact contents need a data dump [inferred]. |
| `highScore 3000 / score 2000 / chapterNum 12` | **[read]** present only as default parameters of condition components `1000500013`/`1000500022` in the embedded configs. |
| Probability 0.5 | **[read]** `getBlockPool` (`originRandomOld() >= 0.5`), `nebulaDifficulty` default 0.5. |
| Id range 1…42 / 2…42 | **[read]** `AlgoPuzzleUtil::offerTopic` safety net (1…42), `produceRandomId` (2…42), continuous pool `{startBlockId: 2, endBlockId: 42}`, `GetShapesById` bound 43. |

---

## 6. Shape table

- **Two shape systems coexist.** The legacy `AlgorithmCore` uses `g_arrShape`, a table of 43 fixed 40-byte entries indexed 0…42 (`AlgorithmCore_GetShapesById_00668128.c`: `if (id < 43) push(&g_arrShape[id])`) — exactly the "43 × 40-byte" table the second source dumped [read]. The current engine uses `ShapeInfo`: `blockInfos` is an `unordered_map<int, ShapeConfig*>` (`ShapeInfo_getConfig_0034e098.c` hashes the id into the bucket array at `PTR_blockInfos_00780920` and falls back to `defaultCfg`), `createConfig(vector<vector<int>> grid)` (`ShapeInfo_createConfig_0034e248.c`) builds a config from a 0/1 grid — per-row bitmasks via `exp2`, cell count, bounding box — and **increments the global `virtualID`**, and `getIdByShape(points)` searches the map for a matching cell set [read]. So shapes can be registered dynamically ("virtual" ids above the fixed range) [inferred]. The code that populates `blockInfos` at start-up is not in the decompiled set [not found]; the `blocks` key seen in the string table suggests the host can supply them via `initData` [inferred].
- **Config layout** (from usage): `+0x08` pointer to row-mask array, `+0x20` width, `+0x24` height, `+0x40` cell count (`coverRate` shifts bits of `cfg+8[row]` by `width`, `getBlockPool` tests `cfg+0x40 > 3`, `LimitHighCombo` sums `cfg+0x24`) [inferred].
- **Id space.** The working pool is 1…42 (see §5). Id 41 is special: `algoSDK_notUse41Block` and `BlocksSeqLogicComponent::featureRemoveBlock41` remove it, matching the duplicate diagonal (id 41 ≡ 40) in the 51-shape table of `03-prior-art.md` §1.3 and the JS generator's `if (41 != d)` [read + inferred]. The 51-shape JS table's ids 43–51 (U and big-T pentominoes, plus) are **outside** this library's pools; whether they are dealt at all in Classic therefore depends on the JavaScript, not on `libtask` [inferred]. Ids that recur as constants agree with the §1.3 decoding: 1 = single, 2/3 = dominoes, 4/5 = 3-bars, 9 = 2×2, 11/22 = 5-bars, 13 = 3×3, 17 = 4-bar, 35/36 = 3×2/2×3, 37–41 = diagonals [read, consistent].
- **Hard shapes.** The library's own notion is explicit in three places: the `selectBlockReviveReplace` switch {11, 12, 13, 21, 22, 23, 24, 35, 36}; `getWeightValue`'s probes of 13, 11, 22; and `BlocksUtil::getDefaultDieBlockArray` / `getDieBlockArray` / `filterDieBlockArray` (a configurable "die block" list, reset by `BlocksUtil::reset`) consumed by `BlocksWeightLogicComponent` and `safety_random_block_by_efficient` [read]. `BlocksUtil::sortHardBlockPoolByPriority` and the four `sortObjectListByHardBlockPriority<…>` instantiations order a pool by hard-block priority using `ShapeInfo` cell counts (constants 0x3e = 62 and 0x28 = 40 recur, probably weights) [read, partial].

---

## 7. Randomness

`FixedRandomUtil` (`FixedRandomUtil_*_00367e50…003681bc.c`) [read]:

- State: `int64 seed` at +0, `int notUseSeed` at +8.
- `originRandom()` (and the identical `originRandomOld()`): if `notUseSeed == 0`: `seed = (seed * 16807) mod (2^31 − 1)`; return `floor(((seed − 1) / 2147483646) × 1e6) / 1e6`. That is the **Park–Miller "minimal standard" Lehmer LCG** with 6-decimal truncation. If `notUseSeed != 0`: return libc `rand() / 2^31`.
- `random(a, b)`, `randomInt(a, b)`, `hitRate(p)` (`return draw < p`, with `p ≤ 0 → false`, `p ≥ 1 → true`), `roundTo6`, and the `shuffle<T>` family (Fisher–Yates driven by `randomInt`, with a forward/backward variant selected by the bool) all derive from the same draw.
- Seeding: the default constructor seeds with `(steady_clock ns / 1000) mod 1,000,000` (microseconds mod 1e6; clamped to ≥1). `initSeed(s)` clamps `s < 2 → 1`. Callers: `Adapter::setConfig` (`"seed"` key) and `AlgoPuzzle::initStaticData` (seed = `InitArgsDef+0x18`, i.e. a seed passed in `initData`) [read]. `setNotUseSeed` is called from `AlgoExecuteAdapterComponent::inputData` with the `NotUseSeed` JSON value and forced to 1 when `algoSDK_useRandomAlgo` is in the names set [read].
- **Consequence for us**: with a known seed the whole native pipeline is reproducible; the period is 2^31 − 2 and the output is quantised to 10^6 values [inferred]. The legacy `AlgorithmCore::SortShapes`, `SupplementShapeGenerateResult` and `AlgorithmUtils::Randomize` use libc `rand()` directly [read]; no `mt19937`, `random_device` or `std::uniform_*` appears anywhere [not found].

---

## 8. Logging

`WrapperBusynessLogger` (13 functions, `WrapperBusynessLogger_*_0036c5d0…0036e5ac.c`) formats business events — `logAlgorithmStart(name, ids)`, `logAlgorithmEnd(name, ok)`, `logBlockPool(ids, label)`, `logBlockSelection(a, b, c, label)`, `logBlockSplit`, `logPositionTest(r, c, id, ok, label)`, `logBestUpdate`, `logCombination`, `logBlocks(label, ids, label2)`, `logBoard`, `logBoardData`, `printBoard` — into strings and hands every one of them to `WrapperLogger::info` (`WrapperLogger::getInstance()`) [read]. `WrapperLogger` itself is not exported and not decompiled, but: its static `loggerCallback_` is an exported data symbol set by `Adapter::setLoggerCallback` (the `loggerListener` N-API method), the binary imports `__android_log_write` from `liblog.so`, and the string "logging to Android failed" exists [read]. So the sink is **both logcat and a JS callback `(level, message)`**, gated by `setConfig.enableLog` / `logLevel` [inferred]. Strategy code also logs directly: "offerTopic degrade enabled, algoType={}, blockIdsSize={}", "RandomNoDieLogicComponent, title:{}, statelessId_:{}, statelessId2_:{}", "offerNewBlockIdRandomNoDieCanPut result: [{}, {}, {}]", "inputData, UseMicroTime:{}, overTime:{}ms, …", `Puzzle::runStatelessFunc` logs every stateless key it runs [read]. **A complete, host-side log of which strategy ran, with what pool and result, already exists; it only needs `enableLog = true`, a low `logLevel`, and a `loggerListener` callback.**

---

## 9. Other things a statistician or journalist would want

- **Build provenance** [read]: `/Users/jycocos/.jenkins/workspace/algo-cpp-sdk-all_prod/src/...` (Jenkins job `algo-cpp-sdk-all_prod`), banner "Block Blast CPlusPlus SDK {} ({})", "Android-arm64". Source tree: `stateless/algoSelect/*.cpp`, `utils/ClearBoardUtils.cpp`, `DeathBlock.cpp`, `TrapHighNearDanger.cpp`, `TkxcClearBoard.cpp`, `TkxcQuick.cpp`, `TkxcMoreClean.cpp`, `NoBittInstinctHard.cpp`, `AlgoBin.cpp` and ~55 `AlgoSelect*.cpp` files (full list in the string dump).
- **Score and high score** enter the native library as numbers (`AdapterInputData+0x10` = score, `+0x08` probably high score), and the only native consumer found is the score-tier weight table (§5). The condition components' `highScore/score/chapterNum` keys show the pipeline can gate components on them [read].
- **Combo**: `selectBlockLimitHighCombo` ("限制高combo算法", statelessId 57) and the strings `combo`, `LimitComboScoreToTenTrait`-style names in the JS bundle list; **chapter/travel**: `chapterNum`, `selectBlockFillMoreAreaTravel`, `travelFillBlankAvoidSmallBlock`, title 旅行填空消除 [read].
- **Revive**: components titled 复活 / 复活算法 (210001, 290001) and `selectBlockReviveReplace(IOS)` — the deal immediately after a revive is a dedicated strategy that swaps big pieces for equal-area small ones [read].
- **Ads**: no ad, eCPM or revenue logic is in `libtask.so` (the only matches are unrelated fragments) [read]. That logic, if it exists, is in the JavaScript traits.
- **Time**: everything is frame-budgeted (`SplitFrameUtil`, default 100 ms / 100 units, `algoSDK_useMicroTime`, `hardLimitTime`), and timeouts are reported back (`isTimeout`). Device speed therefore changes outcomes: a slow phone can make the death search give up [inferred].
- **iOS vs Android**: 15 `…IOS` twins exist as separate code paths selected by flags (`hardHardIOS`, `FeatRandomBlockByefficientIOS`, `FixIosNewAlgorithmStrategyTrait`), not by compile-time platform; the Android build contains both [read].
- **"Cold start" / "history board"**: `selectBlockColdStartClearBoard`, `selectBlockHistoryBoard` (reads `getBoardJsonData`), `selectBlockHistoryMoreClear` (fed by `setConfig.historyMoreClearJson` via `AlgoData::setHistoryMoreClearData`) — the host passes previous boards/clears down [read].
- **Trait names reach native code** (`RemoveAll23Trait`, `FixIosNewAlgorithmStrategyTrait`, `ShangZendMediumFixTrait`) [read]; together with `algoSDK_executeCPlusPlus_<id>` this is direct evidence that server-side trait assignment switches native strategy behaviour.
- **Only nine algoTypes run natively** (12008, 12039, 14031, 14139, 14140, 16051, 21010, 22003, 291056). Everything else the JS asks for is bounced back (`output+0x68`). Ayoships' `algo_must_death = 24001` is *not* in that list, so in 10.9.8 the lethal path he describes may still be executed in JavaScript, with `func_death_blcok` as a native port that is enabled per build [inferred].

---

## Open questions

1. **Which `select*` function sits behind each `statelessId`?** The binding lambdas are not decompiled. Resolve by dumping the `std::function` targets at `PTR_LAB_00777440…00777a50` (and the 73 in `register_AlgoSelectCom`) from a Ghidra data listing, or by hooking `Puzzle::registerStateless` at load and logging (key, function address).
2. **The N-API property keys.** Recover the callback bodies (`0x5e6340–0x5e93c8`) to confirm which JSON keys map to `AdapterInputData+0x08/+0x30/+0x68…+0xb0/+0xc8/+0x100/+0x118/+0x158/+0x170/+0x178/+0x17c`. Our labels for those are inferences.
3. **Contents of `getDefaultDieBlockArray`** (34 ints at `DAT_002aaa24`), the ten-id fallback list in `selectBlockDealDeathState` (`DAT_002a4590`), `selectRandomNoDie`'s ten-id list (`DAT_002a7700`), and the feature-name strings `DAT_0078eb20` / `DAT_0078e640` checked by `func_death_blcok` and `selectBlockStopRefreshScore`.
4. **What `AdapterInputData+0x178/+0x17c` (safety level / force) are called in JS**, since they decide whether the final `hasLiveWay` net runs.
5. **The `ratioJson` the live game actually sends** (per-tier weights) — this is where "5% → 40%" would live if it exists.
6. **Whether `blockInfos` is populated from a constant table or from `initData`**, and therefore whether ids 43–51 ever reach the native pool.
7. `getAlgoTypeNameMap` contents (algoType → human name).

## Implications for instrumentation

- **Hook points with the best signal/cost ratio** (all exported, so Frida can resolve them by name): `Adapter::offerTopic` (full input and output structs), `AlgoPuzzleUtil::offerTopic` (which algoTypes ran natively, degrade flag, whether the safety net fired), `Puzzle::runStatelessFunc<StatelessType>` (the exact strategy key per deal), `AlgoUtil::hasLiveWay` and `AlgoBin::GetDeathRate` (survivability of every candidate deal), `func_death_blcok` / `selectBlockDealDeathState` / `selectBlockStopRefreshScore` (entry = the event we care about), `FixedRandomUtil::originRandom` (seed state → reproducibility), `BlocksUtil::getDieBlockArray` (the hard list at run time).
- **The library's own logger is the cheapest first step**: call `BlockAlgorithm.setConfig('{"enableLog":true,"logLevel":0}')` and `loggerListener(fn)` from the JS side (or set `WrapperLogger::loggerCallback_` natively) and every `logAlgorithmStart/End`, `logBlockPool`, `logBlockSelection`, and `runStatelessFunc` key is delivered as text, no hooking needed.
- **Driving the native library standalone is feasible.** `setConfig` takes a JSON string; `offerTopic` takes an `AdapterInputData` whose first 0x100 bytes are plain `std::vector`/`std::string` members plus a JSON string at +0x140 with the schema in §1.4. A small C++ harness linked against `libtask.so` (or a Frida script that fabricates the struct) can call `Adapter::offerTopic` directly with a board, a candidate pool, an `algoTypes` list, the names set populated with `algoSDK_executeCPlusPlus_<id>`, and `+0x178/+0x17c` toggled, to measure each strategy's death rate across boards. The individual strategies are simpler still: `func_death_blcok(AlgoSelectInputArgs const&)` needs only the board (+0), the candidate ids (+0x18) and a valid `shared_ptr<Extra>` (+0x50, may hold an empty names set); `hasLiveWay(board, array<int,3>, args, true)` and `AlgoBin::GetDeathRate(ids, board)` need only a board and three ids.
- **Seed control**: `setConfig({"seed": N})` or `initData` with a seed makes every native draw reproducible; `NotUseSeed`/`algoSDK_useRandomAlgo` switch to libc `rand()`.
- **What to log per deal** for the statistics: board (64 cells), candidate pool, algoTypes requested, strategy key(s) run, three ids dealt, `GetDeathRate` of the dealt triple, whether `hasLiveWay` is true, whether the safety net or `GrowUpClear` fired, `isTimeout`, score/high-score tier, and the active names set (trait names). That is enough to estimate how often each lethal/hard/rescue strategy fires conditional on score, board state and traits — the Phase 3 question.


## Corrections from direct reads of the binary (2026-11-10, after this report)

- Ghidra's image base for this shared object is 0x100000; file offsets in the first segment are Ghidra address − 0x100000. The N-API callback addresses resolve from the relocated descriptor table at 0x6789e8… (vaddr), i.e. `initData` 0x5e6360, `offerTopic` 0x5e6b24, `setConfig` 0x5e89e8, fourth slot 0x5e8d88.
- `getDefaultDieBlockArray` (Ghidra 0x2aaa24) is 18 ids, not 34: [29,24,23,17,9,21,36,42,35,8,16,10,7,14,22,12,11,13]; the 16 values that follow are the score-tier table [0,300,500,700,1000,1400,1800,2200,2500,3000,3800,4500,5200,6000,6800,7600] (8400 after).
- `selectBlockDealDeathState` fallback list (0x2a4590): [1,9,5,4,2,3,6,15,27,28]; `selectRandomNoDie` list (0x2a7700): [28,27,15,6,3,2,4,5,9,1].
- The live request keys (open question 2) were recovered by logging the N-API boundary: see `phase2-log.md` ("Exact live input schema") and `whitebox.md` §4b. Board cells are colour ids with −1 for empty; `algoList` carries the requested algorithm; `filterBlocks`/`filterWeightBlocks` carry the pool filter; `currRecordGrade`/`highRecordGrade` carry score and personal best.
