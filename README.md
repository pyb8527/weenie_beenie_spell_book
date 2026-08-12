# wb-spell

**품질 게이트가 달린 구현 파이프라인** — Claude Code 플러그인.

파이프라인의 각 단계를 **독립 스킬**로 분해했습니다. **`/WBspell`로 한 번에** 돌리거나,
**필요한 단계만 골라서** 실행할 수 있습니다.

```
/WBspell <작업>
   │  이슈 작성(.wb/issue.md) → 아래를 순서대로 구동 → .wb/run.md에 진행 기록
   ▼
[/WBresearch] → [/WBplan] → [/WBcritique] → [/WBimplement] → [/WBreview] → (tests+score ≥ gate?) → [/WBship]
  (렌즈별 병렬 조사               ▲   │            (unit별 병렬 구현)      ▲              │ no
   → 근거 검증 → 채택)            └───┘ 재계획                            └─ rewrite (max N회) ┘
                                  ⏸ 체크포인트(plan)                        ⏸ 체크포인트(ship)
```

| 스킬 | 하는 일 | 읽는 것 → 남기는 것 |
|------|---------|------------------|
| **`/WBspell <작업>`** | **메인 오케스트레이터** — 요청을 이슈로 정리하고 전 단계를 구동, 체크포인트에서 사람에게 확인, 중단된 실행 재개 | (요청 / `#123`) → `.wb/issue.md` + `.wb/run.md` |
| `/WBresearch <작업>` | **다관점 병렬 자료조사** — 렌즈별 `WBscout` 동시 실행 → `WBresearchjudge`가 근거를 원본에서 **검증**해 통과한 사실만 채택 | (작업 설명) → `.wb/research.md` |
| `/WBplan <작업>` | 계획/스펙 작성 — 접근법·**작업 단위(unit)별 파일 소유권**·**병렬 처리 판단**·인수기준. 앞에 `/WBresearch`, 뒤에 `/WBcritique`를 자동 실행 | `.wb/research.md` → `.wb/plan.md` |
| `/WBcritique` | **계획 레드팀** — 보안·파급범위(되돌릴 수 있나)·전제 오류·병렬 안전성·검증가능성으로 계획을 공격 → blocker가 있으면 **계획 재수립** 반복 | `.wb/plan.md` → `.wb/plan-review.md` + 개정된 `.wb/plan.md` |
| `/WBimplement <작업>` | 계획의 unit을 wave 단위로 구현. 병렬이면 unit당 에이전트 1개를 **한 메시지에 동시 실행**하고, 진행상태는 **보드 하나**로 관리 | `.wb/plan.md` → `.wb/implement.md` |
| `/WBreview` | 리뷰 → **테스트 먼저 실행**(실패 시 점수 무관 자동 미달) → 0~100 점수 → 미달 시 재작성 반복(게이트) | `plan.md`+`implement.md` → `.wb/review.md`(보고서) + `.wb/review.json`(게이트 값) |
| `/WBtest` | 테스트 실행 후 pass/fail 보고 | `implement.md` → `.wb/test.md` |
| `/WBship` | **배송** — `ship.mode`에 따라 커밋 / 브랜치+커밋 / **브랜치+커밋+푸시+PR**. PR 본문을 `.wb/` 산출물로 작성, below-gate면 draft. **머지는 안 함** | `issue/plan/review/test` → `.wb/ship.md` |
| `/WBharvest <github-url>` | 외부 스킬 저장소를 클론 → 각 스킬을 0~100점 채점(`WBharvester`) → 게이트(기본 80점) 통과분만 `WB*` 형식 내 스킬로 가져오기 |

> `/WBimplement`도 **독립 스킬**입니다 — 코드를 평소처럼 직접 쓰고 `/WBreview`만
> 씌워도 되고, `/WBplan → /WBimplement`로 계획부터 구현까지 이어가도 됩니다.

---

## 구조

```
.
├── .claude-plugin/
│   ├── plugin.json          # 매니페스트 (skills 자동 탐색 + agents + hook 등록)
│   └── marketplace.json     # 로컬 설치용 마켓플레이스 정의
├── skills/                  # 사용자가 부르는 명령 (각 단계 = 독립 스킬)
│   ├── WBspell/SKILL.md      # 메인 오케스트레이터 (이슈 생성 → 전 단계 구동 → 체크포인트/재개)
│   ├── WBresearch/SKILL.md   # 렌즈별 병렬 조사 + 근거 검증 게이트 (WBplan이 자동 호출)
│   ├── WBplan/SKILL.md
│   ├── WBcritique/SKILL.md   # 계획 레드팀 + 재계획 루프 (WBplan이 자동 호출)
│   ├── WBimplement/SKILL.md
│   ├── WBreview/SKILL.md
│   ├── WBtest/SKILL.md
│   ├── WBship/SKILL.md
│   └── WBharvest/SKILL.md    # 외부 저장소에서 스킬을 채점·필터해 WB* 형식으로 가져오기
├── agents/                  # 각 스킬이 위임하는 전담 워커 (메인 컨텍스트 보호)
│   ├── WBscout.md            # 렌즈 1개를 맡아 근거(file:line)와 함께 조사 — 병렬 실행
│   ├── WBresearchjudge.md    # 조사 결과를 원본에서 검증·병합·충돌판정해 채택/기각
│   ├── WBplanner.md
│   ├── WBplancritic.md       # 계획을 보안·파급범위·병렬안전성으로 공격 (blocker 판정)
│   ├── WBimplementer.md
│   ├── WBreviewer.md
│   ├── WBtester.md
│   ├── WBshipper.md
│   └── WBharvester.md        # 후보 스킬 하나를 0~100점 + safety로 채점
├── hooks/
│   └── scripts/session-start.mjs   # 세션 시작 시 게이트 설정 주입
├── wb-spell.config.json       # 게이트 설정
└── README.md
```

**스킬끼리의 연결**: 강제 체인이 아니라 `.wb/` 안의 **마크다운 산출물**로 느슨하게
이어집니다. 각 단계는 **앞 단계의 파일을 읽고 → 자기 형식의 파일을 남깁니다.**
각 스킬은 그 파일이 없어도 **단독으로** 동작합니다.

---

## 단계별 산출물 (`.wb/`)

```
.wb/
├── issue.md        # WBspell  — 사이클의 뿌리 문서 (문제 · 범위/제외 · Done when · 제약 · 내가 채운 가정)
├── run.md          # WBspell  — 실행 로그 (단계별 상태·판정·산출물 · 체크포인트 · 어디서 멈췄나)
├── research.md     # WBresearch — 채택된 사실(근거 file:line 포함) · 기각된 주장과 사유 · 렌즈 간 충돌 · 미해결 질문
├── plan.md         # WBplan   — 접근법 · 작업 단위(unit) · 파일 소유권 · 병렬 wave · 인수기준 (개정되면 revision 증가)
├── plan-review.md  # WBcritique — 계획 비판 보고서 (판정 · 라운드 로그 · P1..Pn의 OPEN/RESOLVED · 보안 점검표 · 수용한 위험)
├── implement.md    # WBimplement — 진행상태 보드 (unit별 pending/running/done/failed) · 변경 파일 · 계획과의 차이
├── review.md       # WBreview — 리뷰 보고서 (판정 · 라운드 로그 · 지적 F1..Fn의 OPEN/FIXED · 인수기준 대조)
├── review.json     # WBreview — 게이트 기계값 (belowGate 등, WBship이 읽음)
├── test.md         # WBtest   — 테스트 보고서 (결과 · 실패 상세 · 변경 파일 커버리지)
├── pr-body.md      # WBship   — 산출물로 조립한 PR 본문 (gh pr create --body-file로 들어감)
├── ship.md         # WBship   — 배송 기록 (sha · 브랜치 · PR URL · 배송 시점의 게이트 상태)
└── history/        # 이전 사이클 (다음 /WBplan 실행 시 자동 보관)
```

```
/WBplan ──► /WBcritique ─plan.md(개정)─► /WBimplement ─implement.md─► /WBreview ──► /WBship
                 │  ▲                         │                         ▲    │
                 └──┘ 재계획 루프         (unit별 병렬 실행)          재작성 루프 ┘
              (blocker 있으면)                                    (테스트 실패/미달이면)
```

### 0) 메인 오케스트레이터 — 이슈에서 PR까지

```
/WBspell 로그인 폼에 이메일 형식 검증 추가
/WBspell #123          # 기존 GitHub 이슈에서 시작
/WBspell               # 중단된 실행 재개 (.wb/run.md의 다음 단계부터)
```

`/WBspell`은 먼저 요청을 **이슈로 정리합니다** — 문제, 범위와 **제외 범위**, **Done when**,
제약, 그리고 **자기가 채워 넣은 가정**. 애매해서 해석에 따라 결과물이 달라지는 지점은
**여기서 한 번 묻습니다.** 잘못된 전제를 이슈 단계에서 잡으면 문장 하나지만, 리뷰
단계에서 잡으면 파이프라인 전체를 날립니다. 그 다음 `/WBplan → /WBimplement → /WBreview
→ /WBship`을 구동하고, 각 단계의 산출물을 다음 단계로 넘기며 `.wb/run.md`에 기록합니다.

**멈추는 것이 이 파이프라인의 값어치입니다.**

| 규칙 | 동작 |
|---|---|
| 체크포인트 | 기본 `["plan", "ship"]` — 계획 승인(사람 판단이 가장 싼 지점)과 배송(되돌리기 어려운 지점)에서 정지. `[]`로 전 구간 자동은 **명시적 opt-in** |
| 게이트 정지 | 계획 비판이 blocker로 에스컬레이션하거나 리뷰가 BELOW-GATE면 **거기서 멈춤**. 동의할 때까지 단계를 다시 돌리는 우회 금지 |
| 외부 영향 | GitHub 이슈 생성·브랜치·푸시·PR은 **먼저 확인**. 파이프라인 부수효과로 공개 이슈/PR을 만들지 않음. **머지는 절대 안 함** |
| 규모 | 한 줄 수정이면 그렇게 말하고 짧은 경로(`/WBimplement` + `/WBreview`)를 제안. 오타에 6단계를 쓰는 건 비용이지 철저함이 아님 |
| 재개 | 중단·차단된 실행은 `.wb/run.md`의 다음 단계부터. 앞 단계 산출물은 유효하므로 처음부터 다시 돌지 않음 |

> 오케스트레이터는 **일을 하지 않고 배분만 합니다.** 단계의 로직을 인라인하거나 판정을
> 다시 매기지 않습니다. 단계가 틀렸다면 그건 재시도가 아니라 사람에게 보고할 사안입니다.
> 소유하는 파일도 `.wb/issue.md`와 `.wb/run.md` 둘뿐입니다.

### 1) 조사 — 다관점 병렬 + 근거 검증

`/WBplan`은 계획을 쓰기 전에 `/WBresearch`를 돌립니다. 하나의 에이전트가 훑는 대신,
**렌즈별로 서로 다른 질문을 가진 `WBscout`을 한 메시지에 동시 실행**합니다:

| 렌즈 | 무엇을 캐는가 |
|---|---|
| `prior-art` | 이미 구현돼 있지 않나? 흉내낼 가장 가까운 기존 기능, 이미 있는 헬퍼 |
| `integration` | 무엇에 꽂히나 — 호출자, 진입점, 데이터 흐름, 스키마/계약, 깨질 하위 영향 |
| `conventions` | **이 저장소**의 방식 — 계층·명명·에러 처리·설정/시크릿 접근·로깅·빌드/의존성 |
| `risk` | 위험 표면 — 인증/인가, 신뢰불가 입력, 시크릿, 파괴적 작업, 마이그레이션, 동시성 |
| `verification` | 어떻게 증명하나 — 테스트 하네스, 픽스처, 유사 기능의 테스트 방식, 커버리지 공백 |
| `history` | 왜 이렇게 돼 있나 — `git log`/`blame`, 과거 되돌림·수정, 문서, TODO |

그리고 **`WBresearchjudge`가 평가합니다.** 병렬 조사는 커버리지와 함께 **환각도 같이
증폭**시키기 때문에, 이 단계가 핵심입니다. 판정자는 각 주장의 `file:line`을 **직접 열어
확인**하고 → 근거가 없거나 인용 위치가 실제로 그 말을 하지 않으면 **기각**, 두 렌즈가
같은 말을 하면 **병합(교차 검증되어 신뢰도 상승)**, 두 렌즈가 **충돌하면 코드로 판정**
(못 정하면 `open conflict`로 남김 — 평균내지 않음), 추론은 사실로 승격 금지, 사실이지만
작업과 무관하면 기각. 살아남은 것만 `.wb/research.md`의 **채택된 사실**이 되고,
`WBplanner`는 **그 위에서만** 계획을 세웁니다.

`plan.md`에는 `## Grounding` 절이 생겨서 **어떤 사실 id에 기대고 있는지, 무엇이 가정인지,
어떤 질문이 미해결인 채 넘어왔는지**를 명시합니다. `/WBcritique`는 이걸 검사해서 —
가정을 확정 사실처럼 다루거나, 기각된 주장을 되살리거나, 미해결 질문을 리스크로 옮기지
않고 삼켜버린 계획을 잡아냅니다.

> **기각 목록을 일부러 남깁니다.** 같은 틀린 주장이 다음 라운드에 다시 "발견"되는 걸 막고,
> 조사가 무엇을 확인했는지를 사람이 검토할 수 있게 하려는 것입니다.

> **작은 작업엔 조사하지 않습니다.** `mode: "auto"`(기본)에서는 한 줄 수정·이름 변경·이미
> 읽은 파일이면 팬아웃을 건너뜁니다. 사소한 작업에 4개 에이전트를 붙이는 건 실제 비용이지
> 신중함이 아닙니다. `"always"` / `"off"`로 강제할 수 있습니다.

### 2) 계획 비판 — 코드보다 먼저 때립니다

**계획을 코드보다 먼저 때립니다.** `/WBplan`이 계획을 쓰면 `/WBcritique`가 `WBplancritic`
에이전트로 그 계획을 공격합니다 — ① 보안(신뢰불가 입력→싱크, 인증/인가 누락, 시크릿,
데이터 노출, 새 의존성), ② 파급범위·되돌릴 수 있는가(파괴적 마이그레이션·삭제에 롤백이
있나), ③ 계획 자체의 전제 오류(코드를 실제로 grep해서 확인), ④ **병렬 안전성**(같은
wave의 두 unit이 같은 파일을 소유하면 blocker), ⑤ 인수기준이 검증 가능한가, ⑥ 과설계.
**blocker가 1개라도 있으면 `REVISE`** → `WBplanner`가 그 지적만 반영해 계획을 **개정**
(재작성이 아니라 개정)하고 다시 비판받습니다. `maxReplans`를 소진해도 blocker가 남으면
**조용히 넘기지 않고 사람에게 에스컬레이션**합니다.

> 점수가 아니라 **blocker 유무가 게이트**입니다. 그리고 비판을 부풀리는 것 자체가 실패
> 모드라서(재계획 라운드를 태우고 사용자가 경고를 무시하게 만듦), 작고 되돌릴 수 있는
> 변경은 `findings: []`로 그냥 통과시키도록 에이전트에 명시했습니다.

계획 비판의 결과는 뒤 단계로 이어집니다 — `/WBimplement`는 각 unit 에이전트에 해당 보안
제약을 같이 넘기고, `/WBreview`는 **RESOLVED로 적힌 지적이 실제 코드에 반영됐는지 검증**해
빠졌으면 high-severity로 잡습니다.

**병렬 처리는 계획 단계에서 결정됩니다.** `WBplan`이 작업량을 보고 unit을 나눈 뒤,
서로 **파일이 겹치지 않고 순서 의존이 없는** unit이 2개 이상이면 `mode: parallel`과
wave 구성을 `plan.md`에 적습니다. `WBimplement`는 그걸 읽고 wave마다 unit당
`WBimplementer` 에이전트를 **한 메시지에 동시 실행**하며, 진행상태는 `implement.md`
보드 **한 파일로만** 관리합니다.

> **보드는 단일 작성자(single-writer)입니다.** `.wb/*.md`는 항상 스킬(오케스트레이터)만
> 쓰고, 병렬 서브에이전트는 절대 쓰지 않습니다. 동시에 같은 파일을 쓰면 서로의 내용을
> 덮어쓰기 때문입니다. 소스 파일도 마찬가지로 unit별 소유권으로 분할합니다.

`.wb/`는 `.gitignore`에 있어 커밋되지 않는 **로컬 작업 기록**입니다. 새 `/WBplan`을
돌리면 이전 사이클 파일이 `.wb/history/<타임스탬프>-<슬러그>/`로 보관되므로, 다음 단계가
**옛 계획을 잘못 읽는 일이 없습니다.**

### 3) 배송 — 브랜치 · 커밋 · 푸시 · PR (머지는 사람이)

`/WBship`(구 `/WBcommit`)은 `ship.mode`로 어디까지 갈지 정합니다:

| mode | 동작 |
|---|---|
| `"commit"` | 현재 브랜치에 커밋. **기계 밖으로 아무것도 안 나감** |
| `"branch"` | 작업 브랜치 생성 후 커밋 |
| `"pr"` (기본) | 브랜치 → 커밋 → 푸시 → **PR 생성** |

**PR 본문을 `.wb/` 산출물로 조립합니다** — 이슈의 문제와 Done when, 계획의 접근법, 변경
파일, **테스트 상태·리뷰 점수·미해결 지적**, 계획 비판에서 수용한 위험. 이 재료가 이미
다 쌓여 있으니 리뷰어가 실제로 필요로 하는 PR이 나옵니다.

| 안전 규칙 | 동작 |
|---|---|
| **머지 금지** | `gh pr merge`·`--admin`·auto-merge 전부 금지. 머지는 **항상** 사람이 |
| below-gate | 게이트 미달이면 **draft PR**로 열고 본문 최상단에 판정 배너. 미달을 통과처럼 위장하지 않음 |
| 확인 | 푸시·PR 생성 전에 diff stat·브랜치·base·게이트 판정을 보여주고 **대기**. 한 번의 승인이 다음 번 승인이 되지 않음 |
| 브랜치 | 이미 피처 브랜치 위면 그 위에 커밋 (브랜치를 또 파지 않음). base 브랜치 직접 푸시·force-push 금지 |
| 강등 | 원격 없음 / GitHub 아님 / `gh` 없음 → `branch`나 `commit`으로 **강등하고 그 사실을 보고**. 절반만 된 걸 완료로 말하지 않음 |

---

## 게이트 설정 (`wb-spell.config.json`)

```json
{
  "scoreThreshold": 80,         // 이 점수 미만이면 재작성 (WBreview)
  "maxRewrites": 3,             // 최대 재작성 횟수
  "onExhaustion": "escalate",   // 3회 소진 후에도 미달이면? (기본: 사람에게 보고)
  "failOnTestFailure": true,    // 테스트 실패 시 점수 무관 자동 미달
  "run": {
    "issue": { "github": false },    // true면 GitHub 이슈도 생성 (생성 전 확인함)
    "checkpoints": ["plan", "ship"], // 이 단계 뒤에 멈추고 사람에게 확인 ([] = 전구간 자동)
    "maxCycles": 1                   // 뒤 단계가 앞으로 되돌릴 수 있는 최대 횟수
  },
  "ship": {
    "mode": "pr",                 // commit | branch | pr (원격/gh 없으면 자동 강등)
    "branchPrefix": "wb/",        // 작업 브랜치 접두사
    "base": null,                 // PR base (null = 원격 기본 브랜치 자동 감지)
    "draft": false,               // below-gate면 이 값과 무관하게 draft로 열림
    "bumpPluginVersion": "patch"  // 플러그인 표면이 바뀌면 plugin.json 버전 범프 (false로 끔)
  },
  "plan": {
    "research": {
      "mode": "auto",           // auto: 사소한 작업이면 조사 생략 | always | off
      "maxScouts": 4            // 병렬로 돌릴 렌즈(스카우트) 최대 개수
    },
    "critique": true,           // WBplan 후 계획 레드팀 자동 실행 (false면 건너뜀)
    "maxReplans": 1             // blocker 해소를 위한 최대 재계획 횟수 (소진 시 에스컬레이션)
  }
}
```

> **점수는 측정값이 아니라 휴리스틱입니다.** LLM이 매기는 0~100 점수는 실행 간 재현되지
> 않고, 서로 다른 변경끼리 비교할 수 없습니다. 실제로 게이트를 통과시키는 조건은
> **① 테스트 통과**와 **② 미해결 high-severity 지적 없음**이며, 점수는 그 위의 보조 지표일 뿐입니다.

`onExhaustion` — 3회 재작성해도 게이트 미달일 때:

| 값 | 동작 |
|----|------|
| `"escalate"` (기본) | **멈추고 리뷰 결과·테스트 실패를 사람에게 보고.** 미달 코드를 몰래 내보내지 않음 |
| `"commit-warn"` | 마지막 구현 코드로 진행하고 커밋에 `[below-gate: score=n/t]` 표시 + **draft PR** (명시적 opt-in) |
| `"draft-branch"` | `wb-spell/draft/<slug>` 브랜치에 커밋 |

`test.command`를 지정하면 그 명령으로, 비워두면(`null`) 프로젝트 종류로 자동 감지.

---

## 설치 & 로드 테스트 (로컬)

이 저장소는 **플러그인이자 로컬 마켓플레이스**입니다 (`.claude-plugin/marketplace.json`).

```
/plugin marketplace add C:\weenie_beenie_spell_book
/plugin install wb-spell@weenie-beenie-spell-book
```

> 경로는 이 저장소를 클론한 실제 위치로 바꾸세요.

설치 후 세션을 다시 열면 `/WBspell`, `/WBresearch`, `/WBplan`, `/WBcritique`,
`/WBimplement`, `/WBreview`, `/WBtest`, `/WBship`이 뜹니다.

사용 예:

```
/WBspell 로그인 폼에 이메일 형식 검증 추가
                 # → 이슈 작성 → 조사·계획·비판 → (확인) → 구현 → 리뷰/테스트 → (확인) → 브랜치·커밋·푸시·PR

# 또는 단계별로:
/WBplan 로그인 폼에 이메일 형식 검증 추가
                 # → /WBresearch(렌즈별 병렬 조사 + 근거 검증) → 계획 → /WBcritique(blocker면 재계획)
/WBresearch      # 조사만 따로 돌려 근거를 먼저 보고 싶을 때 (단독 실행)
/WBcritique      # 계획을 손으로 고쳤을 때 다시 비판시키기 (단독 실행)
/WBimplement     # 계획을 코드로 구현 (또는 직접 코드 작성)
/WBreview        # 리뷰 + 점수 미달 시 재작성
/WBtest          # 테스트
/WBship          # 브랜치 → 커밋 → 푸시 → PR (머지는 직접)
```

---

## 다음에 채울 것 (TODO)

- [x] 단계별 독립 스킬로 분해 (WBplan / WBimplement / WBreview / WBtest / WBship)
- [x] 게이트를 **실행 위에** 재설계 — 채점 전 테스트 먼저, 실패 시 자동 미달
- [x] 기본값 정직화 — `onExhaustion` 기본 = `escalate` (미달 코드 자동 커밋 안 함)
- [x] 점수를 절대 지표가 아닌 휴리스틱으로 명시 (README·훅·리뷰어)
- [x] `WBharvest`에 결정적 정적 안전 스캐너 + 사람 승인 단계 추가
- [x] `WBimplement` 스킬 추가 (계획 → 자동 구현)
- [x] 단계별 md 산출물 체인 (`plan → implement → review → test → commit`) + `.wb/history/` 자동 보관
- [x] 병렬 처리 판단을 계획 단계로 이동, 진행상태를 `implement.md` 보드 하나로 관리
- [x] **계획 레드팀 단계 추가** (`/WBcritique` + `WBplancritic`) — 보안·파급범위·병렬안전성으로
      계획을 공격하고 blocker가 있으면 재계획, 소진 시 에스컬레이션
- [x] **다관점 병렬 조사 단계 추가** (`/WBresearch` + `WBscout` × 렌즈 + `WBresearchjudge`) —
      근거를 원본에서 검증해 통과한 사실만 계획의 입력으로 사용
- [x] **메인 오케스트레이터 추가** (`/WBspell`) — 이슈 생성 → 전 단계 구동 → 체크포인트 정지 →
      중단 지점에서 재개, 게이트 우회 금지
- [x] **`/WBcommit` → `/WBship`으로 확장** — `mode: commit|branch|pr`, PR 본문을 `.wb/` 산출물로
      조립, below-gate면 draft PR, 머지는 사람 몫
- [ ] reviewer 루브릭을 팀 규칙(보안 체크리스트 등)에 맞게 확장
- [ ] tester 러너 추가 (Gradle, Maven 등)
- [ ] 실제 로드 테스트로 `/WB*` 명령 노출 확인
