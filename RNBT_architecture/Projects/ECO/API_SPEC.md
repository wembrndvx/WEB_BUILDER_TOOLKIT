# ECO API 명세 (Asset API v1)

**Base URL**: `http://10.23.128.125:4004`

**프로젝트 설명**: 데이터센터 전력/냉방 장비 모니터링 대시보드

---

## API 개요

ECO 프로젝트는 Asset API v1만 사용합니다. 모든 API는 POST 메서드를 사용하며, JSON 형식으로 요청/응답합니다.

### 사용 가능한 API

**Asset API**

| API | 메서드 | 설명 |
|-----|--------|------|
| `/api/v1/ast/l` | POST | 자산 전체 목록 조회 |
| `/api/v1/ast/la` | POST | 자산 목록 조회 (페이징) |
| `/api/v1/ast/g` | POST | 자산 단건 조회 |
| `/api/v1/ast/gx` | POST | 자산 상세 조회 (통합 API) |
| `/api/v1/rel/l` | POST | 관계 전체 목록 조회 |
| `/api/v1/rel/la` | POST | 관계 목록 조회 (페이징) |
| `/api/v1/rel/g` | POST | 관계 단건 조회 |

**Metric API**

| API | 메서드 | 설명 |
|-----|--------|------|
| `/api/v1/mh/gl` | POST | 자산별 최신 메트릭 데이터 조회 |

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

## 7. 자산 상세 조회 (통합 API)

Asset 기본 정보와 카테고리별 속성을 한 번에 조회합니다.

### Request

```
POST /api/v1/ast/gx
Content-Type: application/json
```

```json
{
  "assetKey": "ups-0001",
  "locale": "ko"
}
```

### Request Parameters

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| assetKey | string | O | 자산 고유 키 |
| locale | string | X | 언어 코드 (기본값: "ko") |

### Response

```json
{
  "success": true,
  "data": {
    "asset": {
      "assetKey": "ups-0001",
      "name": "UPS 0001",
      "assetType": "UPS",
      "assetCategoryType": "UPS",
      "statusType": "ACTIVE",
      "locationLabel": "서버실 A",
      "serialNumber": "SN-ups-0001",
      "assetModelKey": null,
      "installDate": "2024-01-15",
      "ownerUserId": null,
      "description": "UPS 0001 (ups)"
    },
    "properties": [
      {
        "fieldKey": "rated_power_kw",
        "value": 75,
        "label": "정격 전력",
        "helpText": "UPS 명판 기준 정격 전력 (kW)",
        "displayOrder": 1
      },
      {
        "fieldKey": "battery_capacity_ah",
        "value": 150,
        "label": "배터리 용량",
        "helpText": "배터리 총 용량 (Ah)",
        "displayOrder": 2
      },
      {
        "fieldKey": "efficiency_percent",
        "value": 94.5,
        "label": "효율",
        "helpText": "정격 부하 시 효율 (%)",
        "displayOrder": 3
      }
    ]
  },
  "error": null,
  "timestamp": "2026-01-27T12:00:00Z",
  "path": "/api/v1/ast/gx"
}
```

### Response Fields

**asset 객체**

| 필드 | 타입 | 설명 |
|------|------|------|
| assetKey | string | 자산 고유 키 |
| name | string | 자산 이름 |
| assetType | string | 자산 타입 |
| assetCategoryType | string | 자산 카테고리 |
| statusType | string | 상태 |
| locationLabel | string | 위치 이름 |
| serialNumber | string | 시리얼 번호 |
| installDate | string | 설치일 |

**properties 배열**

| 필드 | 타입 | 설명 |
|------|------|------|
| fieldKey | string | 속성 키 |
| value | any | 속성 값 |
| label | string | 표시 라벨 (locale 기반) |
| helpText | string | 도움말 텍스트 |
| displayOrder | number | 표시 순서 |

### UPS 속성 (PropertyMeta)

| fieldKey | 설명 (ko) | 설명 (en) |
|----------|-----------|-----------|
| rated_power_kw | 정격 전력 (kW) | Rated Power |
| battery_capacity_ah | 배터리 용량 (Ah) | Battery Capacity |
| efficiency_percent | 효율 (%) | Efficiency |
| input_voltage_v | 입력 전압 (V) | Input Voltage |
| output_voltage_v | 출력 전압 (V) | Output Voltage |
| backup_time_min | 백업 시간 (분) | Backup Time |

---

## 8. 자산별 최신 메트릭 데이터 조회

특정 자산(asset_key)의 metric_code별 최신 데이터를 조회합니다. 최근 1분 이내 데이터만 조회됩니다.

### Request

```
POST /api/v1/mh/gl
Content-Type: application/json
```

```json
{
  "assetKey": "DC1-TEMP-01"
}
```

### Request Parameters

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| assetKey | string | O | 자산 고유 키 |

### Response

```json
{
  "data": [
    {
      "metricCode": "SENSOR.HUMIDITY",
      "eventedAt": "2026-01-28T06:31:49.039Z",
      "valueType": "NUMBER",
      "valueNumber": 52.1,
      "extra": "{\"tags\": {\"profileId\": \"SENSOR_V1\"}}"
    },
    {
      "metricCode": "SENSOR.TEMP",
      "eventedAt": "2026-01-28T06:31:49.039Z",
      "valueType": "NUMBER",
      "valueNumber": 24.5,
      "extra": "{\"tags\": {\"profileId\": \"SENSOR_V1\", \"endpointId\": 1}}"
    }
  ],
  "path": "/api/v1/mh/gl",
  "success": true,
  "timestamp": "2026-01-28T15:31:51"
}
```

### Response Fields

| 필드 | 타입 | 설명 |
|------|------|------|
| metricCode | string | 메트릭 코드 (예: SENSOR.TEMP, SENSOR.HUMIDITY) |
| eventedAt | string | 측정 시각 (ISO 8601) |
| valueType | string | 값 타입 (NUMBER, STRING 등) |
| valueNumber | number | 숫자 값 (valueType이 NUMBER인 경우) |
| valueString | string | 문자열 값 (valueType이 STRING인 경우) |
| extra | string | 추가 정보 (JSON 문자열) |

### Metric Code 참조

센서 메트릭 코드는 `metricConfig.json` 파일을 참조하세요.

| metricCode | 라벨 | 단위 | 설명 |
|------------|------|------|------|
| SENSOR.TEMP | 온도 | °C | 센서 온도 |
| SENSOR.HUMIDITY | 습도 | %RH | 상대습도 |
| SENSOR.MEASURED_AT | 측정시각 | timestamp | 측정시각(필요 시) |

---

## 컴포넌트 - API 매핑

| 컴포넌트 | 사용 데이터셋 | API |
|----------|--------------|-----|
| UPS | assetDetailUnified | POST /api/v1/ast/gx |
| PDU | assetDetailUnified | POST /api/v1/ast/gx |
| CRAC | assetDetailUnified | POST /api/v1/ast/gx |
| TempHumiditySensor | assetDetailUnified | POST /api/v1/ast/gx |
| TempHumiditySensor | metricLatest | POST /api/v1/mh/gl |

### 컴포넌트 데이터 흐름

```
3D 오브젝트 클릭
    │
    ├─→ showDetail() 호출
    │
    ├─→ fetchData('assetDetailUnified', { assetKey: this._defaultAssetKey, locale: 'ko' })
    │
    └─→ renderBaseInfo(asset) + renderProperties(properties) → 팝업에 자산 정보 표시
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
  POST /api/v1/ast/l      - Asset list (all)
  POST /api/v1/ast/la     - Asset list (paged)
  POST /api/v1/ast/g      - Asset single
  POST /api/v1/ast/gx     - Asset detail (unified API)
  POST /api/v1/rel/l      - Relation list (all)
  POST /api/v1/rel/la     - Relation list (paged)
  POST /api/v1/rel/g      - Relation single
  POST /api/v1/mh/gl      - Metric latest (by asset)
```

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-22 | 초안 작성 - 기본 API 정의 |
| 2026-01-26 | Asset API v1으로 전면 개편, 레거시 API 제거 |
| 2026-01-27 | /api/v1/ast/gx (자산 상세 조회 통합 API) 문서 추가 |
| 2026-01-28 | /api/v1/mh/gl (자산별 최신 메트릭 조회) API 추가 |
