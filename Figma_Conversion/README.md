# Figma → Code 변환 프로젝트

Figma 디자인을 HTML/CSS 코드로 변환하는 프로젝트입니다.

## 핵심 도구

- **Figma MCP**: Figma Desktop 앱과 Claude Code 연동
- **Playwright**: 구현 결과 스크린샷 캡처 및 비교

## 폴더 구조

```
Static_Components/
├── [Figma-Project-Name]/   # Figma 프로젝트별
│   └── [component]/        # 컴포넌트별
│       ├── assets/
│       ├── screenshots/
│       └── *.html, *.css
└── sample_test/            # 테스트용
```

## 시작하기

```bash
# 의존성 설치
npm install

# Figma MCP 서버 등록
claude mcp add figma-desktop --transport http --url http://127.0.0.1:3845/mcp

# 로컬 서버 실행
npm run serve
```

## 문서

- **작업 지침**: [CLAUDE.md](./CLAUDE.md) - 워크플로우와 규칙
- **컴포넌트 구조**: [PUBLISHING_COMPONENT_STRUCTURE.md](./PUBLISHING_COMPONENT_STRUCTURE.md) - 퍼블리싱용 컴포넌트 구조
