# AssetList 코드 흐름 문서

이 문서는 AssetList 컴포넌트의 코드 흐름을 설명합니다.
트리 렌더링 상세 내용은 [TREE_RENDERING.md](/RNBT_architecture/Projects/ECO/page/components/AssetList/docs/TREE_RENDERING.md)를 참조하세요.

---

## 1. 초기화 흐름 (initComponent)

```
initComponent()
    │
    ├─→ subscriptions 정의 (hierarchy, hierarchyAssets, hierarchyChildren, locale)
    ├─→ state 초기화 (_treeData, _expandedNodes, _loadedNodes, _locale 등)
    ├─→ tableConfig 정의
    ├─→ 메서드 바인딩 (renderTree, renderTable, appendChildren, setLocale 등)
    ├─→ GlobalDataPublisher subscribe
    ├─→ customEvents 정의 + bindEvents (refresh 버튼)
    ├─→ setupInternalHandlers() → 내부 이벤트 핸들러 등록
    ├─→ initTable() → Tabulator 초기화
    ├─→ setupResizer() → 패널 리사이저 설정
    │
    └─→ loadUITexts() → UI i18n 텍스트 로드
            └─→ applyUITexts() → UI에 텍스트 적용
```

---

## 2. 데이터 구조

### 핵심 원칙: 모든 것은 자산(Asset)

```javascript
{
    id: "building-001",
    name: "본관",
    type: "building",
    typeLabel: "건물",           // locale에 따라 번역됨
    status: "warning",
    statusLabel: "경고",         // locale에 따라 번역됨
    canHaveChildren: true,       // true = 컨테이너 (하위 가질 수 있음)
    hasChildren: true,           // Lazy Loading 판단용
    parentId: null,
    children: [...]              // 하위 자산들
}
```

### 자산 유형 분류

| 분류 | 유형 | canHaveChildren |
|------|------|-----------------|
| 공간 계층 | building, floor, room | true |
| 장비 컨테이너 | rack, cabinet, pdu(Main) | true |
| 말단 자산 | server, storage, switch, router, ups, crac, sensor, circuit, pdu | false |

---

## 3. 구독 (Subscriptions)

```javascript
this.subscriptions = {
    'hierarchy': ['renderTree'],         // 트리 데이터 렌더링
    'hierarchyAssets': ['renderTable'],  // 테이블 데이터 렌더링
    'hierarchyChildren': ['appendChildren'], // Lazy Loading 데이터 추가
    'locale': ['setLocale']              // locale 변경 처리
};
```

---

## 4. API 응답 구조

### hierarchy 응답 (트리용)

```javascript
{
    response: {
        data: {
            items: [...],
            summary: { depth: 1 }
        },
        meta: { locale: "ko" }
    }
}
```

### hierarchyChildren 응답 (Lazy Loading용)

```javascript
{
    response: {
        data: {
            parentId: "building-001",
            children: [...]
        },
        meta: { locale: "ko" }
    }
}
```

### hierarchyAssets 응답 (테이블용)

```javascript
{
    response: {
        data: {
            assetId: "room-001-01-01",
            assetName: "서버실 A",
            assetPath: "본관 > 1층 > 서버실 A",
            assetType: "room",
            assetTypeLabel: "방",
            assets: [...],
            summary: { total: 10, byStatus: {...} }
        },
        meta: { locale: "ko" }
    }
}
```

### 자산 상세 API 응답 (UPS/PDU/CRAC/Sensor)

```javascript
{
    response: {
        data: {
            id: "ups-001",
            name: "UPS 0001",
            type: "ups",
            typeLabel: "UPS",
            status: "normal",
            statusLabel: "정상",
            fields: [
                { key: "load", label: "부하율", value: 75, unit: "%", order: 1 },
                { key: "batteryLevel", label: "배터리 잔량", value: 90, unit: "%", order: 2 },
                ...
            ]
        },
        meta: { locale: "ko" }
    }
}
```

---

## 5. 트리 렌더링 흐름

```
renderTree({ response })
    │
    ├─→ this._treeData = data.items (상태 저장)
    │
    └─→ renderTreeNodes(items, searchTerm)
            │
            └─→ items.forEach → createTreeNode(item)
                    │
                    ├─→ li.tree-node 생성
                    │       ├─→ div.node-content
                    │       │       ├─→ span.node-toggle
                    │       │       ├─→ span.node-icon
                    │       │       ├─→ span.node-label
                    │       │       └─→ span.node-status
                    │       └─→ ul.node-children (재귀)
                    │
                    └─→ hasChildren && !hasLoadedChildren
                            → "Loading..." placeholder 표시
```

### 트리 노드 DOM 구조

```html
<li class="tree-node" data-node-id="building-001" data-node-type="building">
    <div class="node-content">
        <span class="node-toggle expanded">▶</span>
        <span class="node-icon" data-type="building"></span>
        <span class="node-label">본관</span>
        <span class="node-status warning"></span>
    </div>
    <ul class="node-children expanded">
        <!-- 자식 노드들 -->
    </ul>
</li>
```

---

## 6. 사용자 인터랙션 흐름

### A. 트리 노드 클릭 (토글)

```
.tree-container click (이벤트 위임)
    │
    ├─→ .node-toggle 클릭?
    │       │
    │       └─→ toggleNode(nodeId, nodeEl)
    │               │
    │               ├─→ _expandedNodes.add(nodeId)
    │               │
    │               ├─→ needsLazyLoad?
    │               │       │
    │               │       └─→ Weventbus.emit('@hierarchyChildrenRequested')
    │               │               │
    │               │               └─→ (Page) fetchAndPublish('hierarchyChildren')
    │               │                       │
    │               │                       └─→ appendChildren({ response })
    │               │                               ├─→ addChildrenToNode() (데이터 갱신)
    │               │                               ├─→ _loadedNodes.add(parentId)
    │               │                               └─→ renderTreeNodes() (재렌더링)
    │               │
    │               └─→ updateNodeVisuals() (CSS 토글)
    │
    └─→ 그 외 클릭?
            │
            └─→ selectNode(nodeId)
                    │
                    ├─→ _selectedNodeId = nodeId
                    ├─→ CSS .selected 클래스 토글
                    │
                    └─→ Weventbus.emit('@hierarchyNodeSelected')
                            │
                            └─→ (Page) fetchAndPublish('hierarchyAssets')
                                    │
                                    └─→ renderTable({ response })
```

### B. 노드 선택 → 테이블 렌더링

```
selectNode(nodeId)
    │
    └─→ Weventbus.emit('@hierarchyNodeSelected')
            │
            └─→ (Page) fetchAndPublish('hierarchyAssets')
                    │
                    └─→ renderTable({ response })
                            │
                            ├─→ assetPath 표시 ("본관 > 1층 > 서버실 A")
                            ├─→ _allAssets = assets (상태 저장)
                            │
                            └─→ applyFilters()
                                    │
                                    ├─→ searchTerm 필터
                                    ├─→ typeFilter 필터
                                    ├─→ statusFilter 필터
                                    │
                                    └─→ _tableInstance.setData(filtered)
```

### C. 테이블 행 클릭 → Modal 표시

```
테이블 행 클릭 (rowClick 이벤트)
    │
    └─→ onRowClick(asset)
            │
            ├─→ Weventbus.emit('@assetSelected')
            │
            ├─→ showModal({ loading: true })
            │
            ├─→ 타입 확인 (ASSET_TYPE_API_MAP)
            │       └─→ 지원 타입: ups, pdu, crac, sensor
            │       └─→ 미지원 타입: showModal({ noApi: true }) + return
            │
            ├─→ fetchData(datasetName, { assetId, locale })
            │       │
            │       └─→ API 응답: { response: { data: { fields: [...] } } }
            │
            └─→ showModal({ detail: data })
                    │
                    └─→ renderModalContent()
                            │
                            └─→ fields 배열을 order 순으로 정렬 후 렌더링
                                    (label, value, unit, valueLabel 사용)
```

**Modal 필드 렌더링 구조**:
```html
<div class="modal-info-grid">
    <!-- fields 배열을 order 기준 정렬 후 렌더링 -->
    <div class="modal-info-item">
        <div class="modal-info-label">부하율</div>
        <div class="modal-info-value">75%</div>
    </div>
    ...
</div>
```

---

## 7. 상태 관리

```javascript
// register.js initComponent()
this._treeData = null;           // 현재 트리 데이터
this._expandedNodes = new Set(); // 펼쳐진 노드 ID 집합
this._loadedNodes = new Set();   // Lazy Loading 완료된 노드 ID
this._selectedNodeId = null;     // 현재 선택된 노드
this._allAssets = [];            // 테이블에 표시할 자산 목록
this._searchTerm = '';           // 테이블 검색어
this._treeSearchTerm = '';       // 트리 검색어
this._typeFilter = 'all';        // 유형 필터
this._statusFilter = 'all';      // 상태 필터
this._tableInstance = null;      // Tabulator 인스턴스
this._internalHandlers = {};     // 내부 이벤트 핸들러
this._locale = 'ko';             // 현재 locale
this._uiTexts = null;            // UI i18n 텍스트
this._uiTextsCache = {};         // locale별 캐시
```

---

## 8. Lazy Loading 동작 원리

```
초기 로드: depth=1
─────────────────────────────────────────────────────

this._treeData = [
    {
        id: "building-001",
        name: "본관",
        hasChildren: true,
        children: []           ← 아직 안 불러옴
    }
]

        │
        ▼  사용자가 ▶ 클릭

toggleNode() → needsLazyLoad 판단
─────────────────────────────────────────────────────

Weventbus.emit('@hierarchyChildrenRequested', { assetId: nodeId, locale })
        │
        ▼  Page 이벤트 핸들러

GlobalDataPublisher.fetchAndPublish('hierarchyChildren', { assetId, locale })
        │
        ▼  API 응답

appendChildren({ response })
─────────────────────────────────────────────────────

response.data = {
    parentId: "building-001",    ← 부모 위치 정보
    children: [
        { id: "floor-001", name: "1층", ... },
        { id: "floor-002", name: "2층", ... }
    ]
}

        │
        ▼  addChildrenToNode()

this._treeData 갱신
─────────────────────────────────────────────────────

this._treeData = [
    {
        id: "building-001",
        name: "본관",
        hasChildren: true,
        children: [                 ← children 채워짐
            { id: "floor-001", ... },
            { id: "floor-002", ... }
        ]
    }
]

        │
        ▼  renderTreeNodes()

DOM 전체 재렌더링
```

### Lazy Loading 판단 조건

```javascript
const needsLazyLoad = hasChildren && !hasLoadedChildren && !this._loadedNodes.has(id);
```

- `hasChildren`: API에서 true로 제공 (하위 자산 존재)
- `hasLoadedChildren`: children 배열에 데이터가 있는지
- `_loadedNodes`: 이미 로드한 노드 추적

---

## 9. Expand All 흐름 (비동기)

```
expandAll()
    │
    ├─→ 버튼 비활성화 + 로딩 표시
    │
    └─→ expandAllRecursive(items)
            │
            └─→ items.forEach(item => {
                    │
                    ├─→ _expandedNodes.add(id)
                    │
                    └─→ needsChildren?
                            │
                            ├─→ loadChildrenForNode(item) (API 호출)
                            │       │
                            │       └─→ fetchData('hierarchyChildren', { assetId, locale })
                            │               │
                            │               └─→ item.children = response.data.children
                            │
                            └─→ expandAllRecursive(item.children) (재귀)
                    })
            │
            └─→ Promise.all(loadPromises)
                    │
                    └─→ renderTreeNodes() (전체 재렌더링)
                            │
                            └─→ 버튼 복구
```

---

## 10. 검색/필터 흐름

### 트리 검색

```
.tree-search-input input
    │
    └─→ _treeSearchTerm = value
            │
            └─→ renderTreeNodes(_treeData, _treeSearchTerm)
                    │
                    └─→ createTreeNode에서 matchesSearch 판단
                            → 매칭 안되면 null 반환 (렌더링 안함)
                            → 하위에 매칭 있으면 부모도 표시
```

### 테이블 검색/필터

```
.search-input input / .type-filter change / .status-filter change
    │
    └─→ _searchTerm/_typeFilter/_statusFilter 업데이트
            │
            └─→ applyFilters()
                    │
                    └─→ _allAssets.filter(...) → _tableInstance.setData()
```

---

## 11. UI i18n 흐름

```
setLocale({ response })
    │
    ├─→ this._locale = data.locale
    │
    ├─→ loadUITexts(locale)
    │       │
    │       └─→ fetch(`i18n/${locale}.json`)
    │               │
    │               └─→ applyUITexts(texts)
    │                       │
    │                       ├─→ data-i18n 속성으로 텍스트 적용
    │                       ├─→ data-i18n-placeholder 적용
    │                       ├─→ data-i18n-title 적용
    │                       └─→ updateTableColumns()
    │
    ├─→ _expandedNodes.clear()
    ├─→ _loadedNodes.clear()
    │
    └─→ Weventbus.emit('@localeChanged')
            │
            └─→ (Page) fetchAndPublish('hierarchy') → 트리 재로드
```

---

## 12. 이벤트 핸들러 목록

### Internal Handlers (setupInternalHandlers)

| 요소 | 이벤트 | 핸들러 |
|------|--------|--------|
| `.search-input` | input | 테이블 검색 → applyFilters |
| `.type-filter` | change | 유형 필터 → applyFilters |
| `.status-filter` | change | 상태 필터 → applyFilters |
| `.tree-search-input` | input | 트리 검색 → renderTreeNodes |
| `.btn-expand-all` | click | expandAll() |
| `.btn-collapse-all` | click | collapseAll() |
| `.tree-container` | click | 이벤트 위임 → toggleNode / selectNode |
| `.pane-resizer` | mousedown/move/up | 패널 리사이즈 |

### Custom Events (bindEvents)

| 요소 | 이벤트 | 발행 이벤트 |
|------|--------|------------|
| `.refresh-btn` | click | `@refreshClicked` |

### 발행 이벤트

| Event | Payload | 설명 |
|-------|---------|------|
| `@hierarchyNodeSelected` | `{ assetId, node, locale }` | 트리 노드 선택 |
| `@hierarchyChildrenRequested` | `{ assetId, locale }` | Lazy Loading 요청 |
| `@assetSelected` | `{ asset }` | 테이블 행 선택 |
| `@localeChanged` | `{ locale }` | locale 변경 알림 |
| `@refreshClicked` | - | 새로고침 버튼 클릭 |

---

## 13. 파일 구조

```
AssetList/
├── docs/
│   ├── codeflow.md        # 이 문서
│   └── TREE_RENDERING.md  # 트리 렌더링 상세 문서
├── i18n/
│   ├── ko.json            # 한국어 UI 텍스트
│   ├── en.json            # 영어 UI 텍스트
│   └── ja.json            # 일본어 UI 텍스트
├── scripts/
│   ├── register.js        # 런타임 컴포넌트 로직
│   └── beforeDestroy.js   # 정리 (구독 해제, 테이블 파괴)
├── styles/
│   └── component.css      # 스타일 (CSS Nesting)
├── views/
│   └── component.html     # HTML 템플릿
├── preview.html           # 독립 실행 테스트 파일
└── README.md
```

---

*최종 업데이트: 2026-01-15*
