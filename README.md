# wb-spell

**품질 게이트가 달린 구현 파이프라인** — Claude Code 플러그인.

파이프라인의 각 단계를 **독립 스킬**로 분해했습니다. 전체를 강제로 다 돌리지 않고,
**필요한 단계만 골라서** 실행할 수 있습니다.

```
[/WBplan] → [/WBimplement] → [/WBreview] ──score──► (score ≥ threshold?) → [/WBtest] → [/WBcommit]
                                 ▲                     │ no
                                 └──── rewrite (max N회) ┘
```

| 스킬 | 하는 일 |
|------|---------|
| `/WBplan <작업>` | 작업의 계획/스펙 작성 (파일·접근법·인수기준). `.wb/plan.md`에 저장 |
| `/WBimplement <작업>` | 계획(또는 작업 설명)을 실제 코드로 구현. `.wb/plan.md`가 있으면 그 스펙을 사용 |
| `/WBreview` | 현재 변경분을 리뷰 → 0~100 점수 → 미달 시 재작성 반복(게이트). 결과를 `.wb/review.json`에 저장 |
| `/WBtest` | 테스트 실행 후 pass/fail 보고 |
| `/WBcommit` | 변경분 커밋 (`.wb/review.json`의 below-gate 표시 반영) |

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
│   ├── WBplan/SKILL.md
│   ├── WBimplement/SKILL.md
│   ├── WBreview/SKILL.md
│   ├── WBtest/SKILL.md
│   └── WBcommit/SKILL.md
├── agents/                  # 각 스킬이 위임하는 전담 워커 (메인 컨텍스트 보호)
│   ├── WBplanner.md
│   ├── WBimplementer.md
│   ├── WBreviewer.md
│   ├── WBtester.md
│   └── WBcommitter.md
├── hooks/
│   └── scripts/session-start.mjs   # 세션 시작 시 게이트 설정 주입
├── wb-spell.config.json       # 게이트 설정
└── README.md
```

**스킬끼리의 연결**: 강제 체인이 아니라 `.wb/` 파일로 느슨하게 이어집니다.
`WBplan`이 `.wb/plan.md`를 남기면 `WBimplement`가 그것을 구현 스펙으로, `WBreview`가
인수기준으로 읽고, `WBreview`가 `.wb/review.json`을 남기면 `WBcommit`이 below-gate
여부를 반영합니다. 각 스킬은 그 파일이 없어도 **단독으로** 동작합니다.

---

## 게이트 설정 (`wb-spell.config.json`)

```json
{
  "scoreThreshold": 80,         // 이 점수 미만이면 재작성 (WBreview)
  "maxRewrites": 3,             // 최대 재작성 횟수
  "onExhaustion": "commit-warn" // 3회 소진 후에도 미달이면?
}
```

`onExhaustion` — 3회 재작성해도 임계값 미달일 때:

| 값 | 동작 |
|----|------|
| `"commit-warn"` (기본) | **마지막 구현 코드로 진행.** 커밋에 `[below-gate: score=n/t]` 표시만 남김 |
| `"escalate"` | 멈추고 리뷰 결과를 사람에게 보고 |
| `"draft-branch"` | `wb-spell/draft/<slug>` 브랜치에 커밋 |

`test.command`를 지정하면 그 명령으로, 비워두면(`null`) 프로젝트 종류로 자동 감지.

---

## 설치 & 로드 테스트 (로컬)

이 저장소는 **플러그인이자 로컬 마켓플레이스**입니다 (`.claude-plugin/marketplace.json`).

```
/plugin marketplace add D:\weenie_beenie_spell
/plugin install wb-spell@weenie-beenie-spell-book
```

설치 후 세션을 다시 열면 `/WBplan`, `/WBimplement`, `/WBreview`, `/WBtest`, `/WBcommit`이 뜹니다.

사용 예:

```
/WBplan 로그인 폼에 이메일 형식 검증 추가
/WBimplement     # 계획을 코드로 구현 (또는 직접 코드 작성)
/WBreview        # 리뷰 + 점수 미달 시 재작성
/WBtest          # 테스트
/WBcommit        # 커밋
```

---

## 다음에 채울 것 (TODO)

- [x] 단계별 독립 스킬로 분해 (WBplan / WBimplement / WBreview / WBtest / WBcommit)
- [x] `onExhaustion` = `commit-warn` (마지막 구현 코드로 진행)
- [x] `WBimplement` 스킬 추가 (계획 → 자동 구현)
- [ ] reviewer 루브릭을 팀 규칙(보안 체크리스트 등)에 맞게 확장
- [ ] tester 러너 추가 (Gradle, Maven 등)
- [ ] 실제 로드 테스트로 `/WB*` 명령 노출 확인
