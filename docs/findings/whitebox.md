# White-box findings (Phase 2) — preliminary

Status: **preliminary, 2026-11-10.** Everything here comes from our own copy of the Play Store build (Android 10.9.8, build 10980; hashes in `data/raw/apk/hashes.txt`), analysed with `unzip`, `apksigner`, `nm`, `strings`, a byte-level carver, and jadx. Nothing has been decrypted. No key is involved. Items marked **[confirmed]** were read directly from the binary; **[inferred]** is our reading of names and structure; **[open]** is not yet established.

## 1. Summary

The piece generator is not in the JavaScript. It is a **native C++ library, `libtask.so`, shipped with full symbol names and embedded configuration**, loaded by the game's JavaScript as a Node-API module. Its exported functions name more than a hundred dealing strategies, among them `selectBlockDealDeathState`, `selectBlockSimpleDeath`, `selectBlockVeryDifficultProblem`, `func_death_blcok`, `selectRandomNoDie`, `selectBlockReviveReplace`, `selectBlockStopRefreshScore`, and `trap_high_near_danger`. Its embedded configuration describes a layered pipeline whose layers are titled, in Chinese, *preprocessing*, *block pool*, *block selection*, *fallback*, *position*, and *print*, and whose components carry titles such as 死亡难题 ("death problem"), 简单死亡 ("simple death"), 极端难题 ("extreme problem"), 帮扶清盘 ("assisted board clear"), and 随机无死亡 ("random, no death").

This independently confirms the central structural claim of the October 2026 teardown (an explicit lethal-deal algorithm exists, named `func_death_blcok`) and the second source's claim that the algorithms live in `libtask.so`, while showing that the second source's behavioural narrative was not read from code it had. The later sections now settle most of what the summary left open: the library runs standalone and reproduces live hands bit-exactly (4b, 4e); a live per-deal logger captured two full games and their strategy sequences (4c); the Ghidra decompilation is read (4d); counterfactuals quantify how much safer than fair the default dealer is and how the lethal strategy behaves (4e); and the server side — the plaintext per-install assignment of 335 parameterised features, the weight table, the ability and ad-value models, and the now-decoded obfuscated endpoints — is mapped (4f, 4g). What remains open is cross-install variation (how the `bucketId`/`plan` assignment changes behaviour) and the ad-value-coupled timing (H8), which needs an install with real ad fills.

## 2. Packaging and engine [confirmed]

- Play Store build: APK Signature Scheme v2 + v3 verify; signer SHA-256 `9158f5ec…a5d1`, DN `CN=Android, O=Google Inc.` (Google Play App Signing). Same signer on base and ABI split.
- `com.block.juggle` 10.9.8 (10980), minSdk 25, targetSdk 36. Main activity `org.cocos2dx.javascript.AppActivity`.
- Engine: **Cocos Creator 2.x / cocos2d-x JS** (`libcocos2djs.so`, 35.1 MB; build path strings `…/blockblast_cocos_unify/cocos2d-x/…`, i.e. a custom engine build). Custom binding sources are visible by name: `jsb_hspkg_manager.cpp`, `jsb_se_enhance.cpp`, `jsb_script_native_bridge.cpp`, `jsb_sensor_data.cpp`.
- Also bundled: React Native + Hermes + JSI (`libreactnative.so`, `libhermes.so`, `libjsi.so`; Java loads `rninstance`, `reactnativejni`, …), MMKV, Bugsnag (incl. a root-detection plugin), AppLovin crash reporter, Pangle/ByteDance (`libpglarmor.so`, `libsdk_bc_lib.so`, `libtt_ugen_layout.so`), a NetEase-style protection library (`libnesec.so`), Glide-WebP, Fresco image libs.

## 3. Script encryption [confirmed]

505 `.js`/`.jsc` assets. The large `.js` files (`assets/assets/main/index.5951d.js` 2.37 MB, `mainTraits/index.1ce07.js`, `class/…`, `chapter/…`, `modelFeature/index.912e3.js`, `src/cocos2d-jsb.caa45.js`) begin with the magic `HEK:` followed by `01 00 01 02`; the mini-game `.jsc` files (sandcrush, gl_onet, gl_fruit, gl_mahjong, gl_oneline) have no header (standard Cocos XXTEA). The Cocos library contains the loader strings `Can't decrypt code for %s, trying others method`, `ScriptEngine::evalString script %s, failed!`, `ScriptEngine::runScript script %s, buffer is empty!`. **No script-engine symbol is exported** (11,466 dynamic symbols, none for `ScriptEngine`/`evalString`), so a Frida hook on the eval path needs an address found from those strings, not a symbol. Plan for the JS side: hook by address, or scan the V8 heap for retained source text; both key-free.

Bundled trait directories exist under `assets/assets/` (e.g. `$28510_f_TravelPassTipsTrait/`), consistent with the "trait" bundle naming both prior sources described.

## 4. `libtask.so`: the generator [confirmed unless marked]

**Form.** 6.82 MB arm64 ELF, **unstripped dynamic symbol table (5,184 entries, 1,414 exported functions)**, C++ with libc++ and nlohmann::json statically linked (which is why other libraries appear to "import" its `std::` symbols). It links `libcocos2djs.so`. It exports `napi_register_module_v1` and `node_api_module_get_api_version_v1` and imports 29 `napi_*` functions (`napi_define_class`, `napi_create_object`, `napi_call_function`, `napi_get_cb_info`, …): **it is a Node-API addon**, so the game's JavaScript calls it through an N-API shim in the engine rather than through Java. No JNI entry points, no `JNI_OnLoad`.

**Host.** The engine's custom `jsb_se_enhance.cpp` is a Node-API loader (`[NAPI] Failed to load module '%s' from '%s'`, `[NAPI] Cleanup: Unloading %zu dynamic modules`, `node_napi_env__`), so JavaScript loads `libtask.so` by module name from the application's library directory. The N-API class it defines is **`BlockAlgorithm`** (`Failed to create BlockAlgorithm instance`), with per-call JSON in and out (`ratioJson`, `diffRange`, `noPut`, `ids`, `mode`, `names`, `isClear`, `variance`).

**JS-facing names** (strings in the registration area; exact property binding to be confirmed in Ghidra) [inferred]: `initBoard`, `initData`, `initEdge`, `setConfig`, `offerBlock`, `offerTopic`, `selectDiff`, `selectComExtra`, `AlgoExecute`, `algoList`, `getAlgoData`, `getBoardJsonData`, `algoSDK_modifyAlgoLogic`, `algoSDK_modifyMinEdgeAlgo`, and a family `algoSDK_executeCPlusPlus_<id>` with ids 12008, 12039, 14031, 14139, 14140, 16051, 21010, 22003, 291056.

**Classes** (by exported method count): `BaseBoard` (69), `ClearBoardAlgorithm` (55), `AlgorithmCore` (54), `AlgoUtil` (22), `Puzzle` (20), `ClearBoardUtilsLogic` (20), `WrapperBusynessLogger` (13), `FixedRandomUtil` (13), `AlgorithmBase` (13), `ClipBoard` (12), `BlocksUtil` (10), `BinaryBoard` (8), `AlgoComponentConfig` (8), `AlgoBin` (7, incl. `GetDeathRate`), `RandomLogicComponent`, `FeatureGroupLogicComponent`, `SelectGroupLogicComponent`, `LinearGroupLogicComponent`, `AllConditionComponent`, `BasicFeatureComponent`, `AlgoExecuteAdapterComponent`, `NoBittInstinctHard`, `NantijiangjicelueState` (难题降级策略 = "hard-problem downgrade strategy"), `ShapeInfo` (data: `blockInfos`, `defaultCfg`, `virtualID`), `AlgoPuzzleCfg::algoArr`.

Telling method names in `AlgorithmCore` / `AlgorithmBase`: `CanPlacePerThreeShapes`, `CanPlacePerTwoShapes`, `FindAllPlacements`, `GetThreeShapePermutation`, `CalculateOneShapeCanElimPlacePosWeight`, `GetFillBoxThreeShape…`, `CountContinuousEntropy`, `CountStickBlockEntropy`, `CountGravityCenter`; in `AlgoUtil`: `hasLiveWay`, `visitPermutations`, `generateCombinationsShuffer`, `produceRandomId`, `getWeightValue`, `getEmptyArea`, `getEdgeNumBinary`; in `AlgoBin`: `GetDeathRate`, `getMinGameEdgeNumWithClear`.

**Strategy catalogue** (exported free functions; 148 total, full list in `data/raw/triage/bundle-10.9.8-base/libtask-free-functions.txt`). Grouped by what the names say [inferred glosses]:

| Family | Functions |
|---|---|
| Death / lethal | `func_death_blcok`, `selectBlockDealDeathState`, `selectBlockSimpleDeath`, `selectBlockSimpleDeathNoBit`, `selectBlockVeryDifficultProblem`, `selectConvenientDifficultProblem`, `trap_high_near_danger` |
| Hard | `selectBlockHard`, `…HardBinary`, `…HardExtend`, `…HardExtend2`, `…HardHard`, `…HardHardIOS`, `…HardHighEffect`, `…HardLevel4`, `…HardOptimize`, `…HardSuper`, `…HardTwice`, `…OneHard`, `…EdgeHard`, `…CrossHard`, `…CrossClearHard`, `…InstinctHard`, `…InstinctHardBit`, `…InstinctHardModify`, `…InstinctHardNotBit`, `…SimpleInstinctHard`, `noBitInstinctHard`, `selectBlockHoleMaxDiff(Ios)`, `selectBlockDiffMatrixAlgorithm` |
| Easing / rescue | `selectBlockEasyChoose`, `selectBlockCanPut(IOS)`, `selectComCanPut`, `selectComCanPutAll/Loop/One`, `selectRandomNoDie`, `safety_random_block_by_efficient`, `selectBlockReviveReplace(IOS)`, `selectBlockNantijiangjicelue` (hard-problem downgrade), `selectBlockTryClearBoard(IOS)`, `selectBlockClearBoard`, `selectBlockClearBoardNebula`, `selectBlockNewClearBoard`, `selectBlockColdStartClearBoard`, `selectBlockFillPrefect`, `selectBlockFillMoreArea(Travel)`, `selectBlockFillEdge`, `selectBlockFillSort`, `selectBlockOrderFillElim`, `select3C3BlockFill`, `selectEdgeFillReplaceAdd3`, `tkxc_clear_board`, `tkxc_quick`, `tkxc_more_clean`, `tkxc_combine2`, `func_sz_clear` |
| Shaping the feel | `selectBlockEntropy3IOS`, `selectBlockEntropy3Medium(IOS)`, `selectBlockEntropy4(IOS)`, `selectBlockEntropyIncrease1`, `selectBlockIncreaseVarianceAdd3`, `selectBlockIncreaseVarianceRandom`, `selectBlockLessEdge…` (6 variants), `selectBlockLessEqualEdge…`, `selectBlockMaxDiamondAndLessEdge`, `selectBlockGather`, `selectBlockClearCool` ("消除爽", satisfying clears), `selectBlockManyClearTkxc`, `selectBlockHistoryBoard`, `selectBlockHistoryMoreClear`, `selectBlockLimitArea`, `selectBlockLimitHighCombo`, `selectBlockStopRefreshScore(IOS)` (终止刷分, stop score-farming), `selectBlockFirstRoundSpiceOffer`, `selectBlockScore`, `selectBlockAvoidClearBoard`, `selectBlockClear` |
| Plain random | `selectBlockRandom`, `selectBlockRandomByWeight`, `algo_random_put`, `algo_solid_color` |
| Infrastructure | `register_AlgoSelect`, `register_AlgoSelectCom`, `register_AlgoSelectComName`, `register_AlgoSelectFill`, `register_AlgoSelectFillPos`, `registerStateless`, `registerComp`, `registeCoreComp`, `registeGlobalFeature`, `create*Component` ×6, `makeComs`, `matchCondition(IOS)`, `calculEntropy(IOS)`, `coverRate`, `idPriority`, `getClearNum(IOS)`, `minEdgesAfterPut`, `getNearThickness`, `canCrossClear`, `offerBlock`, `getRatio` |

Note the systematic `…IOS` twins: the same strategy exists in Android and iOS variants, which supports the "platform difference" folklore as at least a design possibility [inferred].

**Embedded pipeline configuration.** 201 JSON-like strings carved from the binary (`libtask-json-strings.txt`), several ~3.2 KB pipeline definitions of the form `{"main": 900400001, "compTvoMap": {...}}` with keys `logicCompId`, `conditionCompId`, `featureLayerDefine`, `featureCompIdArr`, `statelessId`, `blockGroup`, `needFilter`, `needAdd`, `startBlockId`, `endBlockId`, `blocks`, `highScore`, `score`, `chapterNum`, `clearState`, `refreshWeight`, `removeBlockArr`, `checkLimitSmall`, `replaceCount`, `algoType`, `useRatio`, `noDie`, `isThreeBlock`, `statelessIdDowngrade`, `blockGroupDowngrade`, `statelessIdDowngradeType`, `putWay`, `ratios`, `isNear`, `isClear`, `remainNum`, `empty`. One concrete entry: `"statelessId": 123, "statelessIdDowngrade": 37, "blockGroupDowngrade": 1, "statelessIdDowngradeType": 2` — the exact triple the second source quoted, so that part of its report was read from these strings.

Layer titles (ids 5000xx): 预处理层 preprocessing · 块池层 block pool · 选块层 block selection · 兜底层 fallback ("bottom-line" safety net) · 位置层 position · 打印层 print/log. Execution features (6000xx) are all titled 执行特性.

Component titles by id prefix (11-digit ids; full table `libtask-component-titles.tsv`):

| Prefix | Title(s) | Gloss |
|---|---|---|
| 200004 | 块池排序 | block-pool sorting |
| 200006 | 连续块池 | continuous block pool |
| 200051 | 将块池放入块池组 | put pool into pool group |
| 210001/210002/210003, 250001, 300001 | 填空消除 · 旅行填空消除 · 滞留清除填空 · 全组合填空消除 | gap-filling elimination (classic / adventure "travel" / stale-clear / all-combinations) |
| 210001 (some) | 复活 | revive |
| 220001 | 位置 | position |
| 230004, 260002, 260004 | 随机无死亡 | random, no death |
| 260001, 260003 | 固定块池随机 · 随机 | fixed-pool random · random |
| 270001, 270002 | 熵增3 · 子母熵增3 | entropy-increase 3 · parent-child entropy-increase 3 |
| 280001 | 直觉难题 · 十字消除难题 · 单消难题 · **死亡难题** · **简单死亡** · 简单直觉题 · 简单难题 · 连续边数少难题 · 高回报难题 · 困难难题 · **极端难题** · 消两次难题 | intuition problem · cross-clear problem · single-clear problem · **death problem** · **simple death** · simple intuition problem · simple problem · few-continuous-edges problem · high-payoff problem · difficult problem · **extreme problem** · clear-twice problem |
| 290001 | 复活算法 | revive algorithm |
| 300001, 300002 | 清盘算法-星云 · 清盘算法plus · 聚拢算法 | board-clear algorithm "Nebula" · board-clear plus · gather algorithm |
| 310000 | 增加权重 · **帮扶清盘** · 随机填空 · 快速填空 · 消除爽 · 熵增3 | increase weight · **assisted board-clear** · random fill · quick fill · satisfying clears · entropy-increase 3 |
| 230006 | 未知 | unknown |

The strategy names and the component titles line up: a "death problem" component (28xxx) with `selectBlockDealDeathState` / `func_death_blcok`; "assisted board-clear" (31xxx) with `selectBlockClearBoard*` / `tkxc_*`; "random, no death" (23xxx) with `selectRandomNoDie` / `safety_random_block_by_efficient`; "revive algorithm" (29xxx) with `selectBlockReviveReplace`.

## 4b. The generator runs standalone, and it deals [confirmed]

Because `libtask.so` imports only libc, one logging function and 29 `napi_*` symbols, a copy with its `libcocos2djs.so` dependency removed loads under an ordinary Node.js (Termux build) on the emulator. The production generator can be driven outside the game, with no UI, no ads and no protector (`packages/capture/napi-harness/`). Deals are deterministic under `setConfig({seed})`: the RNG is a Park–Miller linear congruential generator (seed × 16807 mod 2³¹−1) [read, `libtask-decompiled.md` §7].

| Call | Argument | Returns |
|---|---|---|
| `new BlockAlgorithm()` | none | instance |
| `setConfig(json string)` | `seed`, `enableLog`, `logLevel`, `isDebug`, `ratioJson: [{score, id, weight, color}]`, `isNewTable`, `historyMoreClearJson` | undefined |
| `initData(object)` | init arguments | `{errorCode, errorMsg, algoList: [108 ids], kvs}` |
| `offerTopic(object)` | the request below | `{algoType, errorCode, errorMsg, blockIds, blockNames, blockPoses, blockGroup, algoList, blockRecords, extra, timeout, startTimeMS}` |

**The request the live game sends** (captured by hooking the four N-API callbacks and serialising through the host's own `napi_*` functions): `{highRecordGrade, currRecordGrade, mode: "class", chapterNum, board: 8x8 of colour ids with −1 = empty, lastBlockIds, blocksGroup, addBlocks, filterBlocks, filterWeightBlocks, blockIds, blockNames, blockPoses, overTime: 100, idToRemove, extra: "{feature: {…}, centerRow, centerCol, passThroughAlgoName, travelFillBlankAvoidSmallBlock, isDieLimit, jsonData}", device, platform, blockGroup, algoList: [id]}`. The request includes the current score and the personal best on every deal.

## 4c. What the live game did, deal by deal [confirmed, one install, one session]

Fresh install, emulator, classic mode, 10.9.8, automated greedy play, 48 deals. Every point scored was a new personal best, so "past the record" held throughout.

| Score | Script requests | Native executes | Dealt | Notes |
|---|---|---|---|---|
| tutorial | (none) | `selectBlockRandom` ×3 | random | scripted board engineered to clear fully |
| 280–330 | 14007 | 14011 旅行填空消除 (gap-fill) | gap-filling pieces | hard shapes (5-bars, 3x3, big Ls, diagonals) filtered from the pool |
| 389–601 | 12001 | 12001 熵增3 (entropy-increase 3) | small pieces | same filter; one extra 14001→14005 填空消除 call |
| 609, 752, 1147, 1978, 2062 | 16009 (+12039) | nothing | triples of one piece, dealt by the script | native-only id 12039 is not enabled in this build |
| 635 | **24001** | no lethal hand found (39 empty cells) | 14020 多消算法 (multi-clear), **filter removed**: big L + two 3x2 | first lethal request, about the 13th deal after the opening |
| 814 onward | **24001 on every deal** | found hands at 1163, 1207, 1293, 1354 (31–34 empty cells); nothing on more open boards | **never the lethal hand**: the script dealt a later algorithm's output instead: 16016 极其困难难题 ("extremely difficult problem"), 16010 消两次难题 ("clear-twice problem"), 16014 连续边数少难题 ("few-continuous-edges problem"), 14011 gap-fill; or 14020 multi-clear with the filter removed when no lethal hand existed | the lethal capability is exercised every deal and gated before use |

Totals for the whole first game (62 captured deals, 280→6551): the lethal search was requested in 37 deals (60%), found a hand in 5, and none of those 5 was dealt; all 57 non-lethal candidates were fully placeable (verified with our engine), all 5 lethal candidates were not. The second game (0 → 7572, 38 captured deals, personal best 6579 at the start) opened with a harder pool (1x1 and dominoes removed, 5-bars allowed) and a "random, no death" strategy, ran a board-clear-plus and gap-fill pair on every deal, and **never requested the lethal search below 5395 (82% of the record)**; it requested it at 5395 and 5795, then on most deals once new records were being set, finding genuinely unsolvable hands at 7040 and 7572 that were again not dealt. Both games ended on a "difficult problem" hand that was solvable in some order and that the greedy player placed in the wrong order.

Observed tray vs native candidate (33 deals joined by time): 19 exact matches; the script altered one piece in several early deals (e.g. native [5,5,5] dealt as [7,5,5], verified by screenshot); the script dealt on its own whenever the native side returned nothing. The lethal candidates were never dealt in this session.

## 4d. What the decompilation adds [read; see `libtask-decompiled.md`]

- `func_death_blcok` does what the teardown described: shuffle the pool, split placeable from unplaceable, and for each (placeable a, placeable b, unplaceable u) test the feasible orders with clears; return [a, b, u] only if no order places all three. Time-bounded.
- `selectBlockDealDeathState` randomises triples until `hasLiveWay` is false (an alternative dead-deal search). `selectBlockStopRefreshScore` (终止刷分, "stop score-farming") deals three placeable pieces none of which can clear a line. `selectBlockFirstRoundSpiceOffer` deals one random piece of 4+ cells three times. `selectBlockReviveReplace` swaps the hard ids {11,12,13,21,22,23,24,35,36} for equal-area small pieces and requires a live way.
- `hasLiveWay` is a full six-permutation, all-positions, clears-included search; `AlgoBin::GetDeathRate` returns dead/(dead+alive) over two-piece placement sequences, a continuous lethality score.
- The no-death safety net in `AlgoPuzzleUtil::offerTopic` is conditional on input flags and the fallback loop is time-budgeted (100 ms default), not retry-counted: device speed, not a count, decides when the game stops looking for a survivable deal.
- The 17 score tiers 300 … 8,400 are hard-coded in `BlocksWeightLogicComponent::execute`; they select which host-supplied `ratioJson` weight entries apply. The second source's "hard-piece odds 5→40%" and cover-rate thresholds 0.58/0.28 are not in the code; `coverRate` is a per-shape measure.
- The "SAFE pool" [6,27,28,15,3,2,5,4,37,38,39,40,41] exists as data, used as a fixed pool and, with id 1, as the removal list in hard pipelines. Read directly from the binary: the library's **hard-piece list is 18 ids, [29,24,23,17,9,21,36,42,35,8,16,10,7,14,22,12,11,13]** (big Ls, both 5-bars, the 3x3, the 3x2/2x3 rectangles, the 2x2, the 4-bar, and some tetrominoes), stored immediately before the tier table [0,300,500,…,7600,8400]; the two ten-id fallback pools in `selectBlockDealDeathState` and `selectRandomNoDie` are the same small pieces [1,2,3,4,5,6,9,15,27,28].
- Native execution is opt-in per algorithm id (`algoSDK_executeCPlusPlus_<id>` names passed from the script: 12008, 12039, 14031, 14139, 14140, 16051, 21010, 22003, 291056), and server trait names (`RemoveAll23Trait`, `FixIosNewAlgorithmStrategyTrait`, `ShangZendMediumFixTrait`) are branched on by name inside native code.
- Shapes: legacy table of 43 entries (ids 0–42); the working id space is 1–42 with 41 removed; consistent with the 51-entry script table for ids 1–51, ids 43–51 being outside native pools.
- `WrapperBusynessLogger` emits per-deal strategy events to Android's log and to a script-side `loggerListener` when enabled.

## 4e. Counterfactuals on the real generator [confirmed, standalone harness + our engine as oracle]

Random boards at fixed fill levels, the live request template (early-game filter on), fixed seeds. Two experiments (`packages/capture/napi-harness/lethal-sweep.js`, `dealer-compare.mjs`; outputs under `data/raw/harness/`).

**How often a lethal hand exists.** Algorithm 24001's hit rate by empty cells (60 boards each): 58→0%, 51→0%, 45→8%, 38→40%, 35→68%, 32→73%, 29→85%, 26→93%, 22→100%, 19→95%, 16→83%, 13→50%. The search costs 0.1–0.4 ms. On the boards a mid-game player actually sees, a hand that cannot be fully placed in any order is available to the dealer most of the time.

**Fair dealer vs the strategies the game uses** (60 boards per fill; our engine's exact/Monte-Carlo solvability oracle judges every hand; the strategies seeded with the live weight table from `initData` so they draw realistic pieces, `dealer-compare-v3.jsonl`):

| Empty cells | Fair dealer: P(hand fully placeable), uniform over the live pool | 熵增3, 旅行填空消除, 随机 (23001), 多消算法, 极其困难难题, 消两次难题, 连续边数少难题 | 24001 致死题 |
|---|---|---|---|
| 51 | 1.00 | 1.00 | no hand |
| 45 | 1.00 | 1.00 | 0.00 placeable; 100% two-fit-one-not (2/60 boards) |
| 38 | 0.96 | 1.00 | 0.00; 100% (31/60) |
| 32 | 0.82 | 1.00 | 0.00; 100% (53/60) |
| 26 | 0.67 | 1.00 | 0.00; 100% (56/60) |
| 19 | 0.55 | 0.98–1.00 | 0.00; 100% (57/60) |

An earlier run used a broken piece-size lookup and no weight table, which collapsed 熵增3 to all-1×1 hands (trivially placeable). With the live `ratioJson` the non-lethal strategies deal realistic pieces (mean size 2.6–4.6 depending on fill) and are still fully placeable on every board; only at 19 empty cells does the plain-random strategy miss once in sixty. The conclusion is unchanged and now rests on realistic hands.

**The harness is a faithful copy.** Replaying the 27 live boards on which the game requested the lethal search, the standalone module agreed with the live outcome on all 27 (4 hands found, 23 not), as it must if existence depends on the board rather than the seed. Stronger still, a **full-session bit-exact replay** (`replay-session.mjs` over a 64-deal session: seed 894080, the live `ratioJson`, every `offerTopic` request in order) reproduced the live `blockIds` and `algoType` on 62 of 64 calls; the two misses were both requests for native id 12039, which is not registered in this build (the live app returns `errorCode 1` and an empty hand, which the harness matches in effect). Every registered deal is reproduced exactly.

**Board shape, not just fill, decides whether a lethal hand exists.** On the automated player's compact boards the lethal search succeeded on 15% of requests; on random boards with the same number of empty cells it succeeded on 49%. The search draws from the unfiltered 41-piece pool and needs a piece that cannot be placed anywhere: the live boards had on average 1.0 such pieces, random boards 3.5, and the four live hits all had 2–4. Keeping one large open region is a defence.

Every non-lethal strategy, including the ones the code names "extremely difficult problem" and "clear-twice problem", returned a fully placeable hand on every board, including boards where a fair dealer would have dealt an unplayable hand 42% of the time. The lethal strategy's hands were unplaceable every time and always carried the two-placeable-one-not signature the teardown described. In short: the dealer is far *safer* than fair, until a different algorithm is requested.

## 4f. The server side: experiment assignment, weight table, ability models [confirmed, one install]

With TLS intercepted (system-CA overlay on the rooted emulator plus Conscrypt unpinning), the game's own backend (`*.afafb.com`) is readable. Two layers exist: most endpoints are plaintext JSON; a few (`middle-abtester/business/init`, `meta.rtb/rtb/meta`, `ecpm/infer/v1/ecpm`, `puz/open/date`, `amb/client_block_check`) carry a second, application-level encoding, now decoded (see 4g).

**`unigate-prod.afafb.com/game_init` is the per-install experiment assignment, in plaintext.** The request sends the install's **maturity scores** (`maturityTotalScore 27.32` = habit 3.23 + skill 12.09 + ad-tolerance 12; `maturity_game_score 34.54`), country, install time, memory, attribution. The response returns `bucketId 30095`, `plan 19801`, `userType new95`, `isChurn false`, four A/B experiment memberships, and **335 feature flags with parameters**. The names are the teardown's trait names with the suffix dropped, and the parameters are the numbers we had only inferred:

| Feature (as sent) | Parameters | What we observed |
|---|---|---|
| `DeadlyToHard` | `eliminateSteps [1,0,0]` | lethal candidates computed, hard-but-solvable hands dealt instead, both games |
| `FastNearTkxcClass` | `gameNum 5, highScorePercent 0.8, mem 6, rate 0.4` | lethal requests began at 82% of the record in game 2 |
| `MultiClearBoostThenKill` | `advancedAvgGameCount 5, advancedKillDelaySeconds 20, advancedMinRoundsAfterBoost 3, advancedTriggerIntervalGames 4, …` | (not yet isolated) |
| `RewardHighValueAdHarvest` | `minGameDurationSeconds 420, scoreDeltaStep 1000` | no rewarded fill on the emulator, so not triggered |
| `MABXiBai` | `arm 6, plan 1, cfg mab_25727` | the bandit arm for lethal-puzzle timing |
| `HighScoreBreakthroughBoost` | `highScoreProgressPercent 90, minHistoryHighScore 3000, scoreDiffThreshold 2000, shieldDeathScore…` | |
| `ConsecutiveLossRecovery` | `earlyFailGameCount 2, earlyFailRoundThreshold 6, protectRounds 3, sessionTriggerLimit 2` | the "god mode after losses" folklore, as a parameterised feature |
| `LowFeedbackPleasurableOffer` | `lowFeedbackRounds 6, enableReviveSupport true` | |
| `NewUserLevel`, `NewbieScoreRegulation`, `firstGameScore 1440`, `exceedAimScore 1440` | `difficultStartScore 5000, firstGameHighThreshold 12000, highUserSuppressScore 6000, highScoreRatios [40,30,16,8,4]` | the engineered first games (full-board clear, generous opening) |
| `reviveLimit {per 0.8, score 3000}`, `reviveCount 3`, `freeReviveGameLevel 10`, `decreaseReviveUIShowByLimitHighScore` | | revive economics |
| `ad_interval_ingame 180`, `ad_interval_settle_with_ingame 90`, `ad_close_first_install_n_seconds 300`, `NoBannerAdNewUserByDays [2,4]`, `interstitialAdWatchTime 60` | | ad schedule |
| `SequencePredictDynamicDifficulty {plan 6}`, `highScoreLimitByUserAbility`, `BlockPoolStrategyExperiment {plan 8}`, `PlaceHabitAdaptPath {plan 4}`, `MaturityDevelopmentV2`, `PostGameToServer → block-hard-recom…/infer/v1/online_service_pred`, `ServerControl_board_init_v2 {bid_weight_opt}` | | model-driven difficulty and server-side board/piece control |

**The per-tier weight table** arrives through `initData` (`ratioJson`, 17 tiers × ids 1–31) together with the session **seed** (894080 this session). The piece vocabulary widens with score: 13 shapes below 300 points, 31 shapes above 7,600; the script's `filterBlocks` removes the largest shapes on top of this in the early game. With the seed and this table, the standalone harness reproduces the session's native deals exactly.

**Player-ability models.** `ucw.afafb.com/…/UA.json` files are item-response-theory fits (2PL and 4PL; label `solved_cnt_middle`; 2.2–2.5 million users) giving a difficulty parameter per strategy category (other, random, normal fill, satisfaction boost, weight control, hard problems), the hard-problem category being the hardest. During play the client also calls `ecpm.afafb.com/infer/v1/ecpm`, an ad-value inference service (see 4g for its decoded inputs).

## 4g. The application-layer obfuscation, decoded [confirmed]

The second encoding above TLS is a monoalphabetic substitution of the standard base64 alphabet: each of the 64 base64 symbols is remapped to another, with a fixed `IAF…` prefix, and the result base64-decodes to plaintext JSON. No key or native routine was needed. Recovering it was a known-plaintext (crib-dragging) attack: the install id, package name and the JSON envelope `{"status":"1","message":"success","data":…` appear in many bodies, which pins most of the alphabet; the last seven symbols were fixed by maximising the count of bodies that parse as JSON. The full map is in `data/raw/network/obfuscation-alphabet-map.json`; all 74 captured obfuscated bodies decode to valid JSON (`data/raw/network/decoded/`). This is obfuscation, not encryption — the same substitution for every install — so the map is reusable. (We publish the method and the decoded field meanings, not the map or the bodies, which carry install identifiers.)

What the decoded bodies add:

- **`middle-abtester/business/init`** is the ad-mediation A/B assignment: 61 "adway" arms (e.g. `ADQH8_4102`, `OPTA10_7643`, `CENA7_pp00`), 55 enabled this install, one (`CENA7`) carrying a programmatic-bidding URL `mp-api.afafb.com/pdb/get`. This is the ad-waterfall counterpart to the gameplay traits in `game_init`.
- **`ecpm/infer/v1/ecpm`** is the ad-value model's input vector, now readable. It sends, per ad opportunity: `role "high"`, `adFormat "REWARD"`, `adUnitId`, ad-unit level, session counters (`cur_session_rewarded_num`, `cur_session_inter_rev`), lifetime impression counts (`his_total_rv_imp`, `his_total_iv_imp`), `install_day`, `active_day`, `isColdStart`, carrier, device, and an `AdHisInfo` block split into `INTER` and `REWARD` histories. The response here was empty (`is_model 0`, caches 0) on a fresh ad-less install, as expected. This is the direct evidence for H8: the game computes a predicted ad value from the player's ad history before deciding what to show.
- **`puz/open/date`** carries three difficulty dials in plaintext: `init_level 0.6`, `load_level 0.7`, `hide_level 0.8`.
- **`meta.rtb/rtb/meta`** and **`amb/client_block_check`** are ad bidding (Facebook Audience Network bid tokens and nurl/burl) and a new-user check (`is_new false`), not gameplay.

**On-device, the ad cadence is a stored experiment too.** The app's MMKV key-value store (`mmkv/J_AD`, pulled from the device) holds an ad-frequency strategy JSON with seven arms (`experiment_exp1…7`), each setting `total_frequency`, `cold_launch`, `exposure_exit`, and per-outcome counters (`classic_victory`, `classic_defeat`, `adventure_highscore`), alongside dozens of per-session eCPM floor/ceiling keys (`key_last_session_normal_min_ecpm…`, `rn_key_last_session_avg_ecpm_insert [77.56, 57.89]`). The ad schedule the player feels is itself tuned per install.

**The cached trait bundles are asset manifests, not readable logic.** The game's writable `files/gamecaches/` holds ~100 per-trait directories (`DeadlyToHardTrait/`, `ConsecutiveLossRecoveryTrait`, `MultiClearBoostThenKillTrait`, `RewardHighValueAdHarvestTrait`, …), downloaded from `bband1.afafb.com/update/block_android_online/remoteRes/`. Each `.json` in them uses a third container, `HEK:\x03`: a single XOR keystream shared across every file, recoverable by per-position frequency analysis plus the trait-name and manifest cribs. Decoded, they are Cocos asset-bundle manifests (`{"name":"DeadlyToHardTrait","importBase":"import",…,"versions":{"import":[],"native":[]}}`), i.e. the bundle index, not the behaviour. The behaviour ships as the 76 `HEK:\x01` `.js` files beside them, which are strongly encrypted (byte entropy ≈ 7.9) and are not pursued: the native generator catalogue (4, 4b) and the plaintext `game_init` parameters (4f) already give the mechanism and its numbers.

## 5. What this confirms, refutes, or leaves open

| Claim (source) | Status |
|---|---|
| Engine is Cocos with encrypted JS (teardown, second source) | **Confirmed**: Creator 2.x, custom `HEK:` container for `.js`. |
| A named lethal-deal algorithm `func_death_blcok` exists and deals two placeable + one unplaceable with no completing order (teardown) | **Confirmed** in code and by behaviour: algorithm 24001 returned such hands live at scores 1163–1354. |
| Lethal deals are requested once past the personal best, with a per-deal probability (teardown: `PersonalMarginBreakTrait`, 20%) | **Confirmed with the mechanism named**: requests begin inside a near-record window (`FastNearTkxcClass`, `highScorePercent 0.8`; observed onset at 82% of the record) and run on most deals past it. The dealt hand was never the lethal one in two games because this install carries `DeadlyToHard {eliminateSteps [1,0,0]}`, which converts the lethal candidate into a hard-but-solvable hand. Other buckets may not. |
| Piece-selection algorithms live in an unstripped `libtask.so` with `AlgorithmCore`, `BinaryBoard`, `hasLiveWay` (second source) | **Confirmed**. |
| `statelessId` / `blockGroup` / downgrade config keys (second source) | **Confirmed** as embedded strings. |
| Pools SAFE/HARD/STANDARD, cover-rate 0.58/0.28, hard-piece odds 5→40% (second source) | **Refuted as stated**: the SAFE list exists as data in a different role; the tiers exist as weight-table boundaries; the thresholds and odds are not in the code. |
| `hasLiveWay` with 8 retries (second source) | **Refuted**: time-budgeted, not count-bounded. |
| Behaviour descriptions of bundled traits (second source) | **Refuted as evidence**: its trait files are still encrypted. |
| Server-assigned traits select strategies per player (teardown) | **Confirmed**: the `game_init` response assigns this install 335 named, parameterised features (bucket 30095, plan 19801), including `DeadlyToHard`, `FastNearTkxcClass`, `MultiClearBoostThenKill`, `RewardHighValueAdHarvest`, `MABXiBai`; the script's per-deal `algoList` is the selection mechanism. |
| Ad timing is driven by a predicted ad-value model keyed on ad history (teardown: `RewardHighValueAdHarvest`; H8) | **Mechanism confirmed, trigger not yet observed**: the decoded `ecpm/infer/v1/ecpm` request carries the player's rewarded/interstitial history and session counters to an ad-value service, and the on-device `J_AD` store holds a seven-arm ad-frequency experiment with per-session eCPM floors. On the fresh ad-less emulator the model returned empty and the harvest trait (`minGameDurationSeconds 420`) never fired, so the difficulty-vs-ad-value coupling is shown to exist but not yet measured. |
| Early-game easing / generous opening (folklore, bundled trait names) | **Confirmed in behaviour**: gap-filling and entropy strategies with hard shapes filtered out for the first ~600 points; the tutorial board is built to clear fully. |

## 6. Next steps

1. Longer live runs across several fresh installs with different `bucketId`/`plan` assignments, letting games reach game-over: measure request rate, hit rate and deal rate of the lethal search as functions of score relative to best and board fill; capture the revive and ad flow with a rewarded ad actually filled, to trigger and time `RewardHighValueAdHarvest` (H8).
2. ~~Decode the application-layer obfuscation~~ **done (4g)**; correlate the decoded `game_init` / `business/init` / `ecpm` assignments with the per-deal `algoList` across installs.
3. Find the script-layer gate that decides whether a lethal candidate is dealt (`DeadlyToHard` downgrade): infer from behaviour across installs, since the script `.js` is encrypted.
4. ~~Replay logged requests exactly~~ **done (4e: 62/64, all registered deals bit-exact)**; next, sweep boards and scores at scale for the counterfactual chapter.
5. Finish the methods freeze with the new covariates (`06-methods.md` §10b, §10c).
