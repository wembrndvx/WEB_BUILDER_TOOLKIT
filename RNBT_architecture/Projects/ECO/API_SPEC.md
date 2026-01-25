# ECO API 명세 (Asset API v1)

**Base URL**: `http://10.23.128.125:4004`

**프로젝트 설명**: 데이터센터 전력/냉방 장비 모니터링 대시보드

---

## API 개요

ECO 프로젝트는 Asset API v1만 사용합니다. 모든 API는 POST 메서드를 사용하며, JSON 형식으로 요청/응답합니다.

### 사용 가능한 API

| API | 메서드 | 설명 |
|-----|--------|------|
| `/api/v1/ast/l` | POST | 자산 전체 목록 조회 |
| `/api/v1/ast/la` | POST | 자산 목록 조회 (페이징) |
| `/api/v1/ast/g` | POST | 자산 단건 조회 |
| `/api/v1/rel/l` | POST | 관계 전체 목록 조회 |
| `/api/v1/rel/la` | POST | 관계 목록 조회 (페이징) |
| `/api/v1/rel/g` | POST | 관계 단건 조회 |

---

## 1. 자산 전체 목록 조회

### Request

```
POST /api/v1/ast/l
Content-Type: application/json
```

```json
{
  "filter": {},
  "sort": [{ "field": "createdAt", "direction": "DESC" }]
}
```

### Filter Options

| 필드 | 타입 | 설명 |
|------|------|------|
| assetType | string | 자산 타입 필터 (예: "UPS", "PDU", "CRAC") |
| assetKey | string | 자산 키 검색 (부분 매칭) |
| statusType | string | 상태 필터 ("ACTIVE", "WARNING", "CRITICAL") |

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "assetKey": "ups-0001",
      "assetModelId": null,
      "assetModelKey": null,
      "ownerUserId": null,
      "serviceType": "DCM",
      "domainType": "FACILITY",
      "assetCategoryType": "EQUIPMENT",
      "assetType": "UPS",
      "usageCode": null,
      "serialNumber": "SN-ups-0001",
      "name": "UPS 0001",
      "locationCode": "room-001-01-01",
      "locationLabel": "서버실 A",
      "description": "UPS 0001 (ups)",
      "statusType": "ACTIVE",
      "installDate": "2024-01-15",
      "decommissionDate": null,
      "property": "{\"canHaveChildren\": false}",
      "createdAt": "2024-01-15T09:00:00Z",
      "updatedAt": "2026-01-26T12:00:00Z"
    }
  ],
  "error": null,
  "timestamp": "2026-01-26T12:00:00Z",
  "path": "/api/v1/ast/l"
}
```

### Response Fields

| 필드 | 타입 | 설명 |
|------|------|------|
| assetKey | string | 자산 고유 키 |
| assetType | string | 자산 타입 (BUILDING, FLOOR, ROOM, RACK, UPS, PDU, CRAC, SENSOR 등) |
| assetCategoryType | string | 자산 카테고리 (LOCATION: 컨테이너, EQUIPMENT: 장비) |
| name | string | 자산 이름 |
| locationCode | string | 부모 자산 키 |
| locationLabel | string | 부모 자산 이름 |
| statusType | string | 상태 (ACTIVE, WARNING, CRITICAL, INACTIVE, MAINTENANCE) |
| installDate | string | 설치일 (ISO 날짜) |
| serialNumber | string | 시리얼 번호 |

---

## 2. 자산 목록 조회 (페이징)

### Request

```
POST /api/v1/ast/la
Content-Type: application/json
```

```json
{
  "page": 0,
  "size": 20,
  "filter": {},
  "sort": [{ "field": "createdAt", "direction": "DESC" }]
}
```

### Response

```json
{
  "success": true,
  "data": {
    "content": [...],
    "page": 0,
    "size": 20,
    "totalElements": 1500,
    "totalPages": 75,
    "first": true,
    "last": false,
    "empty": false
  },
  "error": null,
  "timestamp": "2026-01-26T12:00:00Z",
  "path": "/api/v1/ast/la"
}
```

---

## 3. 자산 단건 조회

### Request

```
POST /api/v1/ast/g
Content-Type: application/json
```

```json
{
  "assetKey": "ups-0001"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "assetKey": "ups-0001",
    "assetType": "UPS",
    "assetCategoryType": "EQUIPMENT",
    "name": "UPS 0001",
    "locationCode": "room-001-01-01",
    "locationLabel": "서버실 A",
    "statusType": "ACTIVE",
    "serialNumber": "SN-ups-0001",
    "installDate": "2024-01-15",
    "description": "UPS 0001 (ups)",
    ...
  },
  "error": null,
  "timestamp": "2026-01-26T12:00:00Z",
  "path": "/api/v1/ast/g"
}
```

### Error Response (404)

```json
{
  "success": false,
  "data": null,
  "error": {
    "key": "ASSET_NOT_FOUND",
    "message": "Asset not found: invalid-key",
    "data": null
  },
  "timestamp": "2026-01-26T12:00:00Z",
  "path": "/api/v1/ast/g"
}
```

---

## 4. 관계 전체 목록 조회

### Request

```
POST /api/v1/rel/l
Content-Type: application/json
```

```json
{
  "filter": {},
  "sort": [{ "field": "createdAt", "direction": "DESC" }]
}
```

### Filter Options

| 필드 | 타입 | 설명 |
|------|------|------|
| fromAssetKey | string | 자식 자산 키 |
| toAssetKey | string | 부모 자산 키 |
| relationType | string | 관계 타입 (예: "LOCATED_IN") |

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "fromAssetKey": "floor-001-01",
      "toAssetKey": "building-001",
      "relationType": "LOCATED_IN",
      "attr": null,
      "createdAt": "2024-01-15T09:00:00Z",
      "updatedAt": "2026-01-26T12:00:00Z"
    }
  ],
  "error": null,
  "timestamp": "2026-01-26T12:00:00Z",
  "path": "/api/v1/rel/l"
}
```

### Response Fields

| 필드 | 타입 | 설명 |
|------|------|------|
| fromAssetKey | string | 자식 자산 키 (관계의 출발점) |
| toAssetKey | string | 부모 자산 키 (관계의 도착점) |
| relationType | string | 관계 타입 |

---

## 5. 관계 목록 조회 (페이징)

### Request

```
POST /api/v1/rel/la
Content-Type: application/json
```

```json
{
  "page": 0,
  "size": 100,
  "filter": {},
  "sort": []
}
```

### Response

페이징 응답 구조는 자산 목록 조회 (페이징)과 동일합니다.

---

## 6. 관계 단건 조회

### Request

```
POST /api/v1/rel/g
Content-Type: application/json
```

```json
{
  "id": 1
}
```

---

## 컴포넌트 - API 매핑

| 컴포넌트 | 사용 데이터셋 | API |
|----------|--------------|-----|
| UPS | assetDetail | POST /api/v1/ast/g |
| PDU | assetDetail | POST /api/v1/ast/g |
| CRAC | assetDetail | POST /api/v1/ast/g |
| TempHumiditySensor | assetDetail | POST /api/v1/ast/g |

### 컴포넌트 데이터 흐름

```
3D 오브젝트 클릭
    │
    ├─→ showDetail() 호출
    │
    ├─→ fetchData('assetDetail', { assetKey: this._defaultAssetKey })
    │
    └─→ renderBaseInfo() → 팝업에 자산 정보 표시
```

---

## statusType 매핑

| API statusType | UI Label | UI Data Attribute |
|----------------|----------|-------------------|
| ACTIVE | Normal | normal |
| WARNING | Warning | warning |
| CRITICAL | Critical | critical |
| INACTIVE | Inactive | inactive |
| MAINTENANCE | Maintenance | maintenance |

---

## Mock Server 실행

```bash
cd ECO/mock_server
npm install
npm start  # http://localhost:4004
```

### 서버 시작 시 출력

```
========================================
  ECO Mock Server (Asset API v1 Only)
  Running on http://localhost:4004
========================================

Asset Summary: 15000 total assets

Available endpoints:
  POST /api/v1/ast/l   - Asset list (all)
  POST /api/v1/ast/la  - Asset list (paged)
  POST /api/v1/ast/g   - Asset single
  POST /api/v1/rel/l   - Relation list (all)
  POST /api/v1/rel/la  - Relation list (paged)
  POST /api/v1/rel/g   - Relation single
```

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-22 | 초안 작성 - 기본 API 정의 |
| 2026-01-26 | Asset API v1으로 전면 개편, 레거시 API 제거 |
