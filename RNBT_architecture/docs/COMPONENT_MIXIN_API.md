# ComponentMixin API Reference

컴포넌트 기능 확장을 위한 Mixin 모음.

---

## 뷰어 전용 라이프사이클 훅

WScript register/beforeDestroy에서 뷰어 전용 로직을 분리하기 위한 훅.

### _onViewerReady()

뷰어 모드에서만 실행 (WScript register 직전).

```javascript
class MyComponent {
    _onViewerReady() {
        // 에디터에서는 실행 안 됨
        this.chart = echarts.init(
            this.appendElement.querySelector('#echarts')
        );
    }
}
```

---

### _onViewerDestroy()

뷰어 모드에서만 실행 (WScript BEFORE_DESTROY 직후).

```javascript
class MyComponent {
    _onViewerDestroy() {
        this.chart.dispose();
        this.chart = null;
    }
}
```

---

## ModelLoaderMixin

3D ModelLoader 컴포넌트를 위한 Mixin.

### applyModelLoaderMixin(instance)

`WV3DResourceComponent` 기반 컴포넌트에 ModelLoader 기능 추가.

```javascript
class My3DComponent extends WV3DResourceComponent {
    constructor() {
        super();
        ComponentMixin.applyModelLoaderMixin(this);
    }
}
```

---

### 추가되는 메서드

#### _validateResource()

리소스 검증 및 로드.

```javascript
/**
 * selectItem 기반으로 OBJ/GLTF/GLB 파일 로드
 * - instance.selectItem이 null이면 기본 상태로 초기화
 * - OBJ, GLTF, GLB 파일 형식 지원
 */
await this._validateResource();
```

**내부 동작:**
1. 이전 리소스 제거 (`removePrevResource`)
2. selectItem 검증
3. 파일 형식에 따라 로더 선택:
   - `.obj` → `NLoaderManager.composeResource`
   - `.gltf`, `.glb` → `NLoaderManager.loadGLTF`
4. `composeResource(loadedObj)` 호출
5. Three.js 속성 적용

---

#### startLoadResource()

리소스 로드 시작점.

```javascript
await this.startLoadResource();
// 로드 완료 시 LOADED_RESOURCE 이벤트 발생
```

---

#### applyDepthRelatedToTransparent(obj)

투명 재질에 depth 관련 속성 적용.

```javascript
/**
 * @param {THREE.Object3D} obj - 대상 3D 객체
 */
this.applyDepthRelatedToTransparent(loadedObj);
```

**적용 속성:**
```javascript
{
    depthWrite: false,
    depthTest: true,
    needsUpdate: true
}
```

---

## 사용 예시

### 3D ModelLoader 컴포넌트

```javascript
class PDUModel extends WV3DResourceComponent {
    constructor() {
        super();
        ComponentMixin.applyModelLoaderMixin(this);
    }

    // selectItem 변경 시 자동 호출
    async _onCommitProperties() {
        await this.startLoadResource();
    }

    // 리소스 로드 완료 후 호출
    _onValidateResource() {
        console.log('모델 로드 완료');
        this.setupInteractions();
    }
}
```

### selectItem 구조

```javascript
this.selectItem = {
    path: '/custom/packs/ECO/components/Asset/UPSComponent/modeling/UPS.gltf',
    mapPath: '/custom/packs/ECO/components/Asset/UPSComponent/modeling/maps/',
    name: 'UPS'
};
```

---

## 관련 문서

- [POPUP_MIXIN_API.md](/RNBT_architecture/docs/POPUP_MIXIN_API.md) - 팝업 Mixin
- [APPEND_ELEMENT.md](/RNBT_architecture/docs/APPEND_ELEMENT.md) - 3D appendElement
