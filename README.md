# WEB_BUILDER_TOOLKIT

Figma 디자인을 RENOBIT 웹 빌더 런타임 컴포넌트로 변환하는 파이프라인입니다.

---

## 프로젝트 구조

이 저장소는 두 개의 핵심 디렉토리로 구성됩니다.

```
WEB_BUILDER_TOOLKIT/
├── CLAUDE.md                   # Claude Code 지침서 (자동 로드)
├── README.md                   # 이 문서
├── index.html                  # 프로젝트 포탈 페이지
├── discussions/                # 설계 논의 문서
│
├── Figma_Conversion/           # Figma → 정적 HTML/CSS
│   ├── CLAUDE.md               # Figma 변환 상세 지침
│   ├── PUBLISHING_COMPONENT_STRUCTURE.md
│   ├── Static_Components/      # 변환 결과물
│   └── package.json            # 의존성 (playwright)
│
└── RNBT_architecture/          # 정적 → 동적 컴포넌트 + 런타임
    ├── CLAUDE.md               # RNBT 작업 지침
    ├── README.md               # 아키텍처 가이드 (상세)
    ├── Utils/                  # 공용 유틸리티
    ├── Components/             # 재사용 컴포넌트
    ├── Examples/               # 예제 프로젝트
    └── Projects/               # 실제 프로젝트
```

| 디렉토리 | 역할 | Figma MCP |
|----------|------|-----------|
| **Figma_Conversion/** | Figma → 정적 HTML/CSS 추출 | 필요 |
| **RNBT_architecture/** | 정적 → 동적 컴포넌트 변환 + 런타임 | 불필요 |

---

## End-to-End Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. Figma_Conversion                                                 │
│                                                                      │
│     Figma MCP로 디자인 정보 추출 → HTML/CSS 생성 → 스크린샷 검증        │
│                                                                      │
│     (순수 퍼블리싱, 스크립트 작업 없음)                                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼  정적 HTML/CSS 전달
┌─────────────────────────────────────────────────────────────────────┐
│  2. RNBT_architecture                                                │
│                                                                      │
│     정적 HTML/CSS → 동적 컴포넌트 변환 + 런타임 구성                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Claude Code와 함께 사용하기

이 프로젝트는 **Claude Code**와 함께 사용하도록 설계되었습니다.

```
사용 흐름:
1. 프로젝트 clone
2. Claude Code 실행
3. Claude가 CLAUDE.md 자동 로드 → 컨텍스트 파악 완료
4. "Figma 링크 줄게" → 변환 작업 수행
5. 결과 도출
```

### CLAUDE.md 방식 vs Agent Skill 방식

| 항목 | CLAUDE.md  | Agent Skill |
|------|------------------|-------------|
| **로드 시점** | 항상 (세션 시작 시) | 필요할 때만 |
| **발견 방식** | 파일 경로 (프로젝트 내) | description 매칭 |
| **사용 범위** | 이 프로젝트 안에서만 | 어디서든 (설치 시) |
| **콘텍스트 비용** | 높음 (항상 포함) | 낮음 (선택적) |

---

## 사전 준비 (필수)

이 프로젝트를 사용하기 전에 다음을 준비해야 합니다.

### 1. Figma Desktop 앱 설치

> **중요**: 웹 버전(figma.com)이 아닌 **데스크톱 앱**이 필요합니다.

1. [Figma Desktop 다운로드](https://www.figma.com/downloads/)
2. 설치 후 Figma 계정으로 로그인
3. 변환할 Figma 파일 열기

```
✅ Figma Desktop 앱 실행 → MCP 작동
❌ Figma 웹 버전 → MCP 작동 안 함
```

### 2. Figma Dev Mode 활성화

Figma Desktop에서 변환할 파일을 열고:

1. 우측 상단 `</>` 버튼 클릭 (또는 Shift + D)
2. Dev Mode 활성화 확인

### 3. Claude Code 설치

Claude Code가 설치되어 있어야 합니다.

```bash
# Claude Code 설치 확인
claude --version
```

설치가 안 되어 있다면: [Claude Code 설치 가이드](https://claude.ai/code)

### 4. 프로젝트 Clone 및 의존성 설치

```bash
# 1. 프로젝트 클론
git clone <repository-url>
cd WEB_BUILDER_TOOLKIT

# 2. Figma_Conversion 의존성 설치
cd Figma_Conversion
npm install

# 3. Playwright 브라우저 설치 (스크린샷용)
npx playwright install chromium

# 4. 루트로 돌아가기
cd ..
```

### 5. Figma MCP 서버 등록

Figma Desktop이 실행 중인 상태에서:

```bash
# Figma MCP 서버 등록
claude mcp add figma-desktop --transport http --url http://127.0.0.1:3845/mcp

# 등록 확인
claude mcp list

# 예상 결과:
# figma-desktop: ✓ Connected
```

> **참고**: Figma Desktop이 실행 중이어야 MCP 서버에 연결됩니다.

---

## 사전 준비 체크리스트

```
[ ] Figma Desktop 앱 설치 및 실행
[ ] Figma Dev Mode 활성화
[ ] Claude Code 설치
[ ] 프로젝트 clone 완료
[ ] npm install 완료 (Figma_Conversion/)
[ ] Playwright 브라우저 설치 완료
[ ] Figma MCP 서버 등록 완료 (claude mcp add)
```

---

## 사용 방법

### Step 1: Figma → 정적 HTML/CSS

1. Figma Desktop에서 변환할 요소 선택
2. Claude Code 실행
3. Figma 링크 제공

```
사용자: "이 Figma 링크를 HTML/CSS로 변환해줘"
https://www.figma.com/design/VNqtXrH6ydqcDgYBsVFLbg/...?node-id=25-1393

Claude: (MCP로 데이터 추출 → HTML/CSS 생성 → 스크린샷 검증)
```

결과물 위치:
```
Figma_Conversion/Static_Components/[프로젝트명]/[컴포넌트명]/
├── assets/                 # SVG, 이미지 에셋
├── screenshots/            # 구현 스크린샷
├── [컴포넌트명].html
└── [컴포넌트명].css
```

### Step 2: 정적 → 동적 컴포넌트

1. 정적 HTML/CSS를 RNBT_architecture로 이동
2. 스크립트 추가 (register.js, beforeDestroy.js)
3. 런타임 구성

> **참고**: 동적 컴포넌트는 페이지가 오케스트레이션합니다. 컴포넌트 외에 **페이지 스크립트**(before_load, loaded, before_unload)와 **Mock Server** 작업이 필요할 수 있습니다. 자세한 내용은 `RNBT_architecture/README.md`를 참조하세요.

```
사용자: "이 정적 컴포넌트를 동적 컴포넌트로 변환해줘"

Claude: (라이프사이클 구성 → 데이터 바인딩 → 이벤트 처리)
```

결과물 위치:
```
RNBT_architecture/Projects/[프로젝트명]/page/components/[컴포넌트명]/
├── [컴포넌트명].html
├── [컴포넌트명].css
├── register.js             # 컴포넌트 등록 스크립트
├── beforeDestroy.js        # 컴포넌트 정리 스크립트
└── preview.html            # 미리보기 (서버 없이 브라우저에서 직접 확인 가능)
```

---

## 디렉토리별 문서

### Figma_Conversion

- **작업 지침**: [Figma_Conversion/CLAUDE.md](Figma_Conversion/CLAUDE.md)
- **컴포넌트 구조**: [Figma_Conversion/PUBLISHING_COMPONENT_STRUCTURE.md](Figma_Conversion/PUBLISHING_COMPONENT_STRUCTURE.md)

### RNBT_architecture

- **작업 지침**: [RNBT_architecture/CLAUDE.md](RNBT_architecture/CLAUDE.md)
- **설계 문서**: [RNBT_architecture/README.md](RNBT_architecture/README.md)

---

## MCP 서버 동작 원리

```
Figma 디자인 ←→ MCP 서버 ←→ Claude Code ←→ HTML/CSS 코드
```

### MCP 제공 도구

| 도구 | 역할 | 출력 |
|------|------|------|
| `get_metadata` | 크기/위치 정보 | `{width, height, x, y}` |
| `get_code` | 코드 생성 | HTML/CSS 코드 |
| `get_image` | 스크린샷 | PNG 이미지 |
| `get_variable_defs` | 디자인 토큰 | 색상, 간격, 폰트 변수 |

### 왜 MCP가 필요한가?

- **수동 작업 없이**: 크기, 색상, 간격을 일일이 측정할 필요 없음
- **정확한 구현**: Figma 디자인의 정확한 수치를 그대로 사용
- **빠른 개발**: 디자인 → 코드 변환 시간 단축

---

## 문제 해결

### MCP 연결 안 됨

```bash
# 1. Figma Desktop이 실행 중인지 확인
# 2. MCP 서버 상태 확인
claude mcp list

# 3. 연결 안 되면 재등록
claude mcp remove figma-desktop
claude mcp add figma-desktop --transport http --url http://127.0.0.1:3845/mcp
```

### Playwright 스크린샷 실패

```bash
# 브라우저 재설치
npx playwright install chromium
```

---

## 대상 사용자

이 프로젝트는 다음 환경에서 사용하도록 설계되었습니다:

- **RENOBIT 웹 빌더** 사용자
- **Figma** 디자인 사용자
- **Claude Code** 사용자

> 다른 웹 빌더를 사용하는 경우, RNBT_architecture 부분을 해당 웹 빌더에 맞게 수정해야 합니다.

---

## 라이선스

[라이선스 정보]

---

*최종 업데이트: 2026-01-11*
