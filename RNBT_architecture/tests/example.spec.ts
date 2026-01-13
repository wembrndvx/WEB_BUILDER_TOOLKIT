import { test, expect } from '@playwright/test';

test('로그인 후 visual.do 접속 확인', { timeout: 120000 }, async ({ page }) => {
  // 로그인 페이지 접속
  await page.goto('/renobit');

  // 아이디 입력 (class="login_input", type="text")
  await page.locator('input.login_input[type="text"]').fill('admin');

  // 비밀번호 입력 (type="password")
  await page.locator('input.login_input[type="password"]').fill('wemb@#@#');

  // 체크박스 체크
  await page.locator('input.form-check-input').check();

  // 엔터키로 로그인
  await page.locator('input.login_input[type="password"]').press('Enter');

  // visual.do 페이지로 이동 확인
  await expect(page).toHaveURL(/\/renobit\/visual\.do/);

  // 에디터 로딩 완료 대기 (SideNavbar 표시될 때까지)
  await page.locator('#side-menu-area').waitFor({ state: 'visible' });

  // CodeBox 아이콘 클릭 - 새 탭이 열림
  const [newPage] = await Promise.all([
    page.context().waitForEvent('page'),
    page.locator('.bi-code-slash').click()
  ]);

  // 새 탭 로드 대기
  await newPage.waitForLoadState();

  // 새 탭 URL 확인 (#/codeBox)
  await expect(newPage).toHaveURL(/visual\.do#\/codeBox/);

  // CodeBox 로딩 대기
  await newPage.locator('.script-edit-main').waitFor({ state: 'visible' });

  // 라이프사이클 스크립트 입력
  const lifecycleScripts = [
    { tab: 'beforeLoad', code: "console.log('[Page] Before Load - timestamp:', Date.now());" },
    { tab: 'loaded', code: "console.log('[Page] Loaded - timestamp:', Date.now());" },
    { tab: 'beforeUnLoad', code: "console.log('[Page] Before Unload - timestamp:', Date.now());" },
  ];

  for (let i = 0; i < lifecycleScripts.length; i++) {
    const { tab, code } = lifecycleScripts[i];

    // 탭 클릭 (cssJsEditArea 내의 탭 선택)
    await newPage.locator(`#cssJsEditArea .el-tabs__item:has-text("${tab}")`).click();

    // Monaco 에디터 선택자 (전체 경로)
    const editorSelector = `#cssJsEditArea #pane-${i} > div > div > div.overflow-guard > div.monaco-scrollable-element.editor-scrollable.vs-dark > div.lines-content.monaco-editor-background > div.view-lines.monaco-mouse-cursor-text`;

    // 에디터가 나타날 때까지 대기
    await newPage.locator(editorSelector).waitFor({ state: 'visible' });

    // 에디터에 포커스
    await newPage.locator(editorSelector).focus();
    await newPage.locator(editorSelector).click();

    // 기존 내용 전체 선택 후 삭제
    await newPage.keyboard.press('Control+a');
    await newPage.keyboard.press('Backspace');

    // 새 코드 입력
    await newPage.keyboard.type(code);
  }

  // Apply 버튼 클릭
  await newPage.locator('.apply-btn').click();

  // visual.do 탭으로 돌아가기
  await page.bringToFront();

  // Ctrl+S로 저장
  await page.keyboard.press('Control+s');

  // 저장 완료 대기
  await page.waitForTimeout(1000);

  // 캔버스 영역 클릭하여 포커스
  await page.locator('#app-main').click();

  // 콘솔 로그 수집 배열
  const consoleLogs: string[] = [];

  // Ctrl+Enter로 미리보기 실행 - 새 탭이 열림
  const [viewerPage] = await Promise.all([
    page.context().waitForEvent('page'),
    page.keyboard.press('Control+Enter')
  ]);

  // 새 탭에 콘솔 리스너 등록 (로드 전에)
  viewerPage.on('console', (msg) => {
    if (msg.text().includes('[Page]')) {
      consoleLogs.push(msg.text());
    }
  });

  // 뷰어 탭 로드 대기
  await viewerPage.waitForLoadState();

  // visualViewer.do URL 확인
  await expect(viewerPage).toHaveURL(/visualViewer\.do/);

  // 페이지 로드 완료 대기 (라이프사이클 실행 대기)
  await viewerPage.waitForTimeout(3000);

  // 콘솔 로그 출력
  console.log('=== 라이프사이클 콘솔 로그 ===');
  consoleLogs.forEach((log) => console.log(log));

  // 라이프사이클 순서 검증: Before Load -> Loaded
  const beforeLoadIndex = consoleLogs.findIndex((log) => log.includes('Before Load'));
  const loadedIndex = consoleLogs.findIndex((log) => log.includes('Loaded'));

  expect(beforeLoadIndex).toBeGreaterThanOrEqual(0);
  expect(loadedIndex).toBeGreaterThanOrEqual(0);
  expect(beforeLoadIndex).toBeLessThan(loadedIndex);

  console.log('✓ 라이프사이클 순서 검증 완료: Before Load -> Loaded');

  // visual.do 탭으로 돌아가기
  await page.bringToFront();

  // Components 패널 열기 (두 번째 메뉴 아이템의 아이콘 클릭)
  await page.locator('#edit-menu-bar .el-menu-item').nth(1).locator('svg').click();

  // 컴포넌트 리스트 패널이 보이는지 확인
  await page.locator('#panel-content-area').waitFor({ state: 'visible' });

  // "Components" 타이틀 확인 (#panel-content-area 내부)
  await expect(page.locator('#panel-content-area .content-title')).toHaveText('Components');

  // 컴포넌트 목록이 있는지 확인 (2D/3D 두 개의 list가 있으므로 first 사용)
  const componentList = page.locator('#panel-content-area .component-thumb-list .list').first();
  await expect(componentList).toBeVisible();

  // 컴포넌트가 하나 이상 있는지 확인 (2D 영역의 컴포넌트)
  const componentCount = await componentList.locator('.component').count();
  expect(componentCount).toBeGreaterThan(0);

  console.log(`✓ Components 패널 확인 완료: ${componentCount}개 컴포넌트 발견`);

  // Fundamental 카테고리 선택 (el-tree에서 정확히 "Fundamental" 텍스트를 가진 노드 클릭)
  await page.locator('#panel-content-area .el-tree-node__content:has-text("Fundamental")').click();

  // 컴포넌트 목록 업데이트 대기
  await page.waitForTimeout(500);

  // Fundamental 카테고리의 컴포넌트 수 확인 (5개)
  const fundamentalCount = await componentList.locator('.component').count();
  expect(fundamentalCount).toBe(5);

  console.log(`✓ Fundamental 카테고리 확인 완료: ${fundamentalCount}개 컴포넌트 발견`);

  // Badge 컴포넌트를 드래그앤드롭으로 캔버스에 추가
  const badgeComponent = componentList.locator('.component:has-text("Badge") .img-wrap');
  const editArea = page.locator('.editor .edit-area-main');

  await badgeComponent.dragTo(editArea);

  // 컴포넌트 추가 대기
  await page.waitForTimeout(500);

  // Properties 패널에서 Badge 컴포넌트가 선택되었는지 확인
  await expect(page.locator('#component-property-panel')).toContainText('Badge');

  console.log('✓ Badge 컴포넌트 드래그앤드롭 추가 완료');

  // Ctrl+S로 저장
  await page.keyboard.press('Control+s');

  // 저장 완료 대기
  await page.waitForTimeout(1000);

  console.log('✓ Badge 컴포넌트 저장 완료');

  // 페이지 새로고침
  await page.reload();

  // 에디터 로딩 완료 대기
  await page.locator('#side-menu-area').waitFor({ state: 'visible' });

  // Badge 컴포넌트가 캔버스에 여전히 존재하는지 확인 (Instance List에서 확인)
  // Instance List 패널 열기 (세 번째 메뉴 아이템)
  await page.locator('#edit-menu-bar .el-menu-item').nth(2).locator('svg').click();

  // Instance List 패널 대기
  await page.waitForTimeout(500);

  // badge_1이 Instance List에 있는지 확인
  await expect(page.locator('#outline-panel-content')).toContainText('badge_1');

  console.log('✓ 새로고침 후 Badge 컴포넌트 유지 확인 완료');

  // Instance List에서 badge_1 클릭하여 선택
  await page.locator('#outline-panel-content').getByText('badge_1').click();

  // 컴포넌트 선택 대기
  await page.waitForTimeout(300);

  // CodeBox 아이콘 클릭 - 새 탭이 열림
  const [codeBoxPage] = await Promise.all([
    page.context().waitForEvent('page'),
    page.locator('.bi-code-slash').click()
  ]);

  // 새 탭 로드 대기
  await codeBoxPage.waitForLoadState();

  // CodeBox 로딩 대기
  await codeBoxPage.locator('.script-edit-main').waitFor({ state: 'visible' });

  // header-title에 badge_1이 포함되어 있는지 확인
  await expect(codeBoxPage.locator('.header-title')).toContainText('badge_1');

  console.log('✓ badge_1 선택 후 CodeBox에서 header-title 확인 완료');

  // register (JavaScript) 탭이 선택되어 있는지 확인 (#allEditArea 내)
  const registerTab = codeBoxPage.locator('#allEditArea .el-tabs__item:has-text("register")');
  await expect(registerTab).toHaveClass(/is-active/);

  console.log('✓ register (JavaScript) 탭 선택 확인 완료');

  // register 탭의 Monaco 에디터에 코드 입력
  const registerEditorSelector = '#allEditArea #pane-0 > div > div > div.overflow-guard > div.monaco-scrollable-element.editor-scrollable.vs-dark > div.lines-content.monaco-editor-background > div.view-lines.monaco-mouse-cursor-text';

  await codeBoxPage.locator(registerEditorSelector).waitFor({ state: 'visible' });
  await codeBoxPage.locator(registerEditorSelector).click();

  // 기존 내용 전체 선택 후 삭제
  await codeBoxPage.keyboard.press('Control+a');
  await codeBoxPage.keyboard.press('Backspace');

  // TC-LC-002 검증 코드 + openPage 코드 입력
  const registerCode = `// TC-LC-002 검증
console.log('[Component] register');
console.log('[Component] appendElement:', this.appendElement);
console.log('[Component] appendElement tagName:', this.appendElement?.tagName);

// openPage 코드
const openPage = wemb.pageManager.openPageByName.bind(wemb.pageManager);
this.appendElement.addEventListener('click', () => openPage('openPageTarget'));`;

  await codeBoxPage.keyboard.type(registerCode);

  console.log('✓ register 탭에 TC-LC-002 검증 코드 + openPage 코드 입력 완료');

  // beforeDestroy 탭 클릭
  await codeBoxPage.locator('#allEditArea .el-tabs__item:has-text("beforeDestroy")').click();

  // beforeDestroy 탭의 Monaco 에디터 선택자 (pane-2: register(0) → completed(1) → beforeDestroy(2))
  const beforeDestroyEditorSelector = '#allEditArea #pane-2 > div > div > div.overflow-guard > div.monaco-scrollable-element.editor-scrollable.vs-dark > div.lines-content.monaco-editor-background > div.view-lines.monaco-mouse-cursor-text';

  await codeBoxPage.locator(beforeDestroyEditorSelector).waitFor({ state: 'visible' });
  await codeBoxPage.locator(beforeDestroyEditorSelector).click();

  // 기존 내용 전체 선택 후 삭제
  await codeBoxPage.keyboard.press('Control+a');
  await codeBoxPage.keyboard.press('Backspace');

  // TC-LC-002 beforeDestroy 검증 코드 입력
  const beforeDestroyCode = `// TC-LC-002 검증
console.log('[Component] beforeDestroy');
console.log('[Component] appendElement still accessible:', !!this.appendElement);`;

  await codeBoxPage.keyboard.type(beforeDestroyCode);

  console.log('✓ beforeDestroy 탭에 TC-LC-002 검증 코드 입력 완료');

  // destroy 탭 클릭 (TC-LC-004: appendElement 접근 불가 검증)
  await codeBoxPage.getByRole('tab', { name: 'destroy', exact: true }).click();

  // destroy 탭의 Monaco 에디터 선택자 (pane-3: register(0) → completed(1) → beforeDestroy(2) → destroy(3))
  const destroyEditorSelector = '#allEditArea #pane-3 > div > div > div.overflow-guard > div.monaco-scrollable-element.editor-scrollable.vs-dark > div.lines-content.monaco-editor-background > div.view-lines.monaco-mouse-cursor-text';

  await codeBoxPage.locator(destroyEditorSelector).waitFor({ state: 'visible' });
  await codeBoxPage.locator(destroyEditorSelector).click();

  // 기존 내용 전체 선택 후 삭제
  await codeBoxPage.keyboard.press('Control+a');
  await codeBoxPage.keyboard.press('Backspace');

  // TC-LC-004 destroy 검증 코드 입력
  const destroyCode = `// TC-LC-004 검증: destroy 시점에서 appendElement 접근 불가 확인
console.log('[Component] destroy');
console.log('[Component] appendElement in destroy:', this.appendElement);
console.log('[Component] appendElement accessible in destroy:', !!this.appendElement);`;

  await codeBoxPage.keyboard.type(destroyCode);

  console.log('✓ destroy 탭에 TC-LC-004 검증 코드 입력 완료');

  // Apply 버튼 클릭
  await codeBoxPage.locator('.apply-btn').click();

  // visual.do 탭으로 돌아가기
  await page.bringToFront();

  // Ctrl+S로 저장
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(1000);

  console.log('✓ 코드 저장 완료');

  // 캔버스 영역 클릭하여 포커스
  await page.locator('#app-main').click();

  // 콘솔 로그 수집 배열 (미리 선언)
  const pageTransitionLogs: string[] = [];
  const componentLogs: string[] = [];

  // Ctrl+Enter로 미리보기 실행 - 새 탭이 열림
  const [previewPage] = await Promise.all([
    page.context().waitForEvent('page'),
    page.keyboard.press('Control+Enter')
  ]);

  // 콘솔 리스너 등록 (로드 전에 등록해야 register 로그 수집 가능)
  previewPage.on('console', (msg) => {
    if (msg.text().includes('[Page]')) {
      pageTransitionLogs.push(msg.text());
    }
    if (msg.text().includes('[Component]')) {
      componentLogs.push(msg.text());
    }
  });

  // 뷰어 탭 로드 대기
  await previewPage.waitForLoadState();

  // visualViewer.do URL 확인
  await expect(previewPage).toHaveURL(/visualViewer\.do/);

  // 뷰어 로딩 완료 대기 (Loading Viewer 사라질 때까지)
  await previewPage.locator('.badge_1').waitFor({ state: 'visible', timeout: 30000 });

  // Badge 컴포넌트 (badge_1) 클릭
  await previewPage.locator('.badge_1').click();

  // 페이지 이동 대기
  await previewPage.waitForTimeout(1000);

  // openPageTarget 페이지로 이동 확인
  // ViewerPageComponent_ViewerPageComponent 클래스와 openPageTarget 클래스를 모두 가진 요소 확인
  const targetPage = previewPage.locator('.ViewerPageComponent_ViewerPageComponent.openPageTarget');
  await expect(targetPage).toBeVisible();

  console.log('✓ Badge 클릭 후 openPageTarget 페이지 이동 확인 완료');

  // 페이지 이동 시 beforeUnload 실행 확인
  console.log('=== 페이지 이동 시 콘솔 로그 ===');
  pageTransitionLogs.forEach((log) => console.log(log));

  const beforeUnloadIndex = pageTransitionLogs.findIndex((log) => log.includes('Before Unload'));
  expect(beforeUnloadIndex).toBeGreaterThanOrEqual(0);

  console.log('✓ beforeUnload 라이프사이클 실행 확인 완료');

  // TC-LC-002: 컴포넌트 라이프사이클 검증
  console.log('=== 컴포넌트 라이프사이클 콘솔 로그 ===');
  componentLogs.forEach((log) => console.log(log));

  // register 로그 확인
  const registerIndex = componentLogs.findIndex((log) => log.includes('[Component] register'));
  expect(registerIndex).toBeGreaterThanOrEqual(0);

  // appendElement 접근 가능 확인
  const appendElementLog = componentLogs.find((log) => log.includes('[Component] appendElement tagName:'));
  expect(appendElementLog).toBeDefined();
  expect(appendElementLog).toContain('DIV');

  // beforeDestroy 로그 확인
  const beforeDestroyIndex = componentLogs.findIndex((log) => log.includes('[Component] beforeDestroy'));
  expect(beforeDestroyIndex).toBeGreaterThanOrEqual(0);

  // beforeDestroy에서 appendElement 접근 가능 확인
  const accessibleLog = componentLogs.find((log) => log.includes('[Component] appendElement still accessible:'));
  expect(accessibleLog).toBeDefined();
  expect(accessibleLog).toContain('true');

  // 순서 검증: register가 beforeDestroy보다 먼저
  expect(registerIndex).toBeLessThan(beforeDestroyIndex);

  console.log('✓ TC-LC-002: 컴포넌트 라이프사이클 순서 검증 완료 (register → beforeDestroy)');

  // TC-LC-004: destroy 시점에서 appendElement 접근 불가 검증
  const destroyIndex = componentLogs.findIndex((log) => log.includes('[Component] destroy'));
  expect(destroyIndex).toBeGreaterThanOrEqual(0);

  // destroy에서 appendElement 접근 불가 확인 (false)
  const destroyAccessibleLog = componentLogs.find((log) => log.includes('[Component] appendElement accessible in destroy:'));
  expect(destroyAccessibleLog).toBeDefined();
  expect(destroyAccessibleLog).toContain('false');

  // 순서 검증: beforeDestroy가 destroy보다 먼저
  expect(beforeDestroyIndex).toBeLessThan(destroyIndex);

  console.log('✓ TC-LC-004: destroy 시점에서 appendElement 접근 불가 검증 완료');

  // ========== TC-LC-005: 다중 컴포넌트 라이프사이클 순서 검증 ==========
  // visual.do 탭으로 돌아가기
  await page.bringToFront();

  // Components 패널 열기
  await page.locator('#edit-menu-bar .el-menu-item').nth(1).locator('svg').click();
  await page.locator('#panel-content-area').waitFor({ state: 'visible' });

  // Fundamental 카테고리 선택
  await page.locator('#panel-content-area .el-tree-node__content:has-text("Fundamental")').click();
  await page.waitForTimeout(500);

  const componentListForLC005 = page.locator('#panel-content-area .component-thumb-list .list').first();
  const editAreaForLC005 = page.locator('.editor .edit-area-main');

  // Button 컴포넌트 추가
  const buttonComponent = componentListForLC005.locator('.component span').filter({ hasText: 'Button' }).first().locator('..').locator('.img-wrap');
  await buttonComponent.dragTo(editAreaForLC005);
  await page.waitForTimeout(500);
  console.log('✓ Button 컴포넌트 추가 완료');

  // Close Button 컴포넌트 추가
  const closeButtonComponent = componentListForLC005.locator('.component span').filter({ hasText: 'Close Button' }).first().locator('..').locator('.img-wrap');
  await closeButtonComponent.dragTo(editAreaForLC005);
  await page.waitForTimeout(500);
  console.log('✓ Close Button 컴포넌트 추가 완료');

  // Spinners 컴포넌트 추가
  const spinnersComponent = componentListForLC005.locator('.component span').filter({ hasText: 'Spinners' }).first().locator('..').locator('.img-wrap');
  await spinnersComponent.dragTo(editAreaForLC005);
  await page.waitForTimeout(500);
  console.log('✓ Spinners 컴포넌트 추가 완료');

  // 저장
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(1000);

  console.log('✓ TC-LC-005: 컴포넌트 3개 추가 완료 (Button, Close Button, Spinners)');

  // Instance List 패널 열기
  await page.locator('#edit-menu-bar .el-menu-item').nth(2).locator('svg').click();
  await page.waitForTimeout(500);

  // 각 컴포넌트에 라이프사이클 로깅 코드 추가
  // badge_1을 마지막에 처리 (기존 CodeBox가 badge_1을 보고 있으면 갱신이 안되므로)
  const lc005Components = ['button_1', 'close_button_1', 'spinners_1', 'badge_1'];

  // 이미 열려있는 CodeBox 탭을 찾거나 새로 열기
  let compCodeBox = page.context().pages().find(p => p.url().includes('#/codeBox'));

  for (const instanceName of lc005Components) {
    // Instance List 패널이 보이는지 확인하고, 보이지 않으면 열기
    const instanceListVisible = await page.locator('#outline-panel-content').isVisible();
    if (!instanceListVisible) {
      await page.locator('#edit-menu-bar .el-menu-item').nth(2).locator('svg').click();
      await page.waitForTimeout(500);
    }

    // Instance List에서 컴포넌트 선택
    await page.locator('#outline-panel-content').getByText(instanceName, { exact: true }).click();
    await page.waitForTimeout(300);

    // CodeBox 탭이 없으면 새로 열기
    if (!compCodeBox) {
      const [newCodeBox] = await Promise.all([
        page.context().waitForEvent('page'),
        page.locator('.bi-code-slash').click()
      ]);
      compCodeBox = newCodeBox;
    } else {
      // 기존 CodeBox 탭 클릭 (새 컴포넌트 정보 로드)
      await page.locator('.bi-code-slash').click();
      await compCodeBox.bringToFront();
    }

    await compCodeBox.waitForLoadState();
    await compCodeBox.locator('.script-edit-main').waitFor({ state: 'visible' });

    // register 탭 코드 입력
    const registerEditorSel = '#allEditArea #pane-0 > div > div > div.overflow-guard > div.monaco-scrollable-element.editor-scrollable.vs-dark > div.lines-content.monaco-editor-background > div.view-lines.monaco-mouse-cursor-text';
    await compCodeBox.locator(registerEditorSel).waitFor({ state: 'visible' });
    await compCodeBox.locator(registerEditorSel).click();
    await compCodeBox.keyboard.press('Control+a');
    await compCodeBox.keyboard.press('Backspace');

    // badge_1에는 openPage 이벤트 추가
    const registerLogCode = instanceName === 'badge_1'
      ? `// TC-LC-005: ${instanceName} register
window.lifecycleLog.push({ type: 'component', name: '${instanceName}', phase: 'register', timestamp: Date.now() });
console.log('[LC-005] ${instanceName} register');

// openPage 이벤트
const openPage = wemb.pageManager.openPageByName.bind(wemb.pageManager);
this.appendElement.addEventListener('click', () => openPage('openPageTarget'));`
      : `// TC-LC-005: ${instanceName} register
window.lifecycleLog.push({ type: 'component', name: '${instanceName}', phase: 'register', timestamp: Date.now() });
console.log('[LC-005] ${instanceName} register');`;

    await compCodeBox.keyboard.type(registerLogCode);

    // beforeDestroy 탭 클릭 및 코드 입력
    await compCodeBox.locator('#allEditArea .el-tabs__item:has-text("beforeDestroy")').click();
    const beforeDestroyEditorSel = '#allEditArea #pane-2 > div > div > div.overflow-guard > div.monaco-scrollable-element.editor-scrollable.vs-dark > div.lines-content.monaco-editor-background > div.view-lines.monaco-mouse-cursor-text';
    await compCodeBox.locator(beforeDestroyEditorSel).waitFor({ state: 'visible' });
    await compCodeBox.locator(beforeDestroyEditorSel).click();
    await compCodeBox.keyboard.press('Control+a');
    await compCodeBox.keyboard.press('Backspace');

    const beforeDestroyLogCode = `// TC-LC-005: ${instanceName} beforeDestroy
window.lifecycleLog.push({ type: 'component', name: '${instanceName}', phase: 'beforeDestroy', timestamp: Date.now() });
console.log('[LC-005] ${instanceName} beforeDestroy');`;

    await compCodeBox.keyboard.type(beforeDestroyLogCode);

    // Apply 버튼 클릭
    await compCodeBox.locator('.apply-btn').click();

    // visual.do 탭으로 돌아가기
    await page.bringToFront();

    console.log(`✓ ${instanceName} 라이프사이클 로깅 코드 입력 완료`);
  }

  // 저장
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(1000);

  // 캔버스 빈 영역 클릭하여 컴포넌트 선택 해제 (페이지 스크립트 열기 위해)
  await page.locator('#app-main').click();
  await page.waitForTimeout(300);

  // 페이지 라이프사이클에 로깅 코드 추가 (기존 CodeBox 탭 사용 또는 새로 열기)
  let pageCodeBox = page.context().pages().find(p => p.url().includes('#/codeBox'));

  if (!pageCodeBox) {
    const [newCodeBox] = await Promise.all([
      page.context().waitForEvent('page'),
      page.locator('.bi-code-slash').click()
    ]);
    pageCodeBox = newCodeBox;
  } else {
    // 기존 CodeBox 탭에서 페이지 스크립트로 전환
    await page.locator('.bi-code-slash').click();
    await pageCodeBox.bringToFront();
  }

  await pageCodeBox.waitForLoadState();
  await pageCodeBox.locator('.script-edit-main').waitFor({ state: 'visible' });

  // beforeLoad 탭 - window.lifecycleLog 초기화 및 로깅
  await pageCodeBox.locator('#cssJsEditArea .el-tabs__item:has-text("beforeLoad")').click();
  const beforeLoadEditorSel = '#cssJsEditArea #pane-0 > div > div > div.overflow-guard > div.monaco-scrollable-element.editor-scrollable.vs-dark > div.lines-content.monaco-editor-background > div.view-lines.monaco-mouse-cursor-text';
  await pageCodeBox.locator(beforeLoadEditorSel).waitFor({ state: 'visible' });
  await pageCodeBox.locator(beforeLoadEditorSel).click();
  await pageCodeBox.keyboard.press('Control+a');
  await pageCodeBox.keyboard.press('Backspace');

  const beforeLoadCode = `// TC-LC-005: 페이지 beforeLoad - lifecycleLog 초기화
window.lifecycleLog = [];
window.lifecycleLog.push({ type: 'page', phase: 'before_load', timestamp: Date.now() });
console.log('[LC-005] Page before_load');`;

  await pageCodeBox.keyboard.type(beforeLoadCode);

  // loaded 탭 - 로깅 + 3초 후 페이지 이동
  await pageCodeBox.locator('#cssJsEditArea .el-tabs__item:has-text("loaded")').click();
  const loadedEditorSel = '#cssJsEditArea #pane-1 > div > div > div.overflow-guard > div.monaco-scrollable-element.editor-scrollable.vs-dark > div.lines-content.monaco-editor-background > div.view-lines.monaco-mouse-cursor-text';
  await pageCodeBox.locator(loadedEditorSel).waitFor({ state: 'visible' });
  await pageCodeBox.locator(loadedEditorSel).click();
  await pageCodeBox.keyboard.press('Control+a');
  await pageCodeBox.keyboard.press('Backspace');

  const loadedCode = `// TC-LC-005: 페이지 loaded
window.lifecycleLog.push({ type: 'page', phase: 'loaded', timestamp: Date.now() });
console.log('[LC-005] Page loaded');`;

  await pageCodeBox.keyboard.type(loadedCode);

  // beforeUnLoad 탭 - 로깅
  await pageCodeBox.locator('#cssJsEditArea .el-tabs__item:has-text("beforeUnLoad")').click();
  const beforeUnLoadEditorSel = '#cssJsEditArea #pane-2 > div > div > div.overflow-guard > div.monaco-scrollable-element.editor-scrollable.vs-dark > div.lines-content.monaco-editor-background > div.view-lines.monaco-mouse-cursor-text';
  await pageCodeBox.locator(beforeUnLoadEditorSel).waitFor({ state: 'visible' });
  await pageCodeBox.locator(beforeUnLoadEditorSel).click();
  await pageCodeBox.keyboard.press('Control+a');
  await pageCodeBox.keyboard.press('Backspace');

  const beforeUnLoadCode = `// TC-LC-005: 페이지 beforeUnLoad
window.lifecycleLog.push({ type: 'page', phase: 'before_unload', timestamp: Date.now() });
console.log('[LC-005] Page before_unload');`;

  await pageCodeBox.keyboard.type(beforeUnLoadCode);

  // Apply 버튼 클릭
  await pageCodeBox.locator('.apply-btn').click();

  // visual.do 탭으로 돌아가기
  await page.bringToFront();

  // 저장
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(1000);

  console.log('✓ 페이지 라이프사이클 로깅 코드 입력 완료');

  // 캔버스 영역 클릭하여 포커스
  await page.locator('#app-main').click();

  // 콘솔 로그 수집
  const lc005Logs: string[] = [];

  // Ctrl+Enter로 미리보기 실행
  const [lc005PreviewPage] = await Promise.all([
    page.context().waitForEvent('page'),
    page.keyboard.press('Control+Enter')
  ]);

  // 콘솔 리스너 등록
  lc005PreviewPage.on('console', (msg) => {
    if (msg.text().includes('[LC-005]')) {
      lc005Logs.push(msg.text());
    }
  });

  // 뷰어 탭 로드 대기
  await lc005PreviewPage.waitForLoadState();
  await expect(lc005PreviewPage).toHaveURL(/visualViewer\.do/);

  // 컴포넌트 로딩 대기
  await lc005PreviewPage.locator('.badge_1').waitFor({ state: 'visible', timeout: 30000 });

  // badge_1 클릭하여 페이지 이동
  await lc005PreviewPage.locator('.badge_1').click();
  await lc005PreviewPage.waitForTimeout(1000);

  // openPageTarget 페이지로 이동 확인
  const lc005TargetPage = lc005PreviewPage.locator('.ViewerPageComponent_ViewerPageComponent.openPageTarget');
  await expect(lc005TargetPage).toBeVisible();

  console.log('✓ openPageTarget 페이지 이동 완료');

  // 콘솔 로그 출력
  console.log('=== TC-LC-005 라이프사이클 로그 ===');
  lc005Logs.forEach((log) => console.log(log));

  // window.lifecycleLog 데이터 가져오기
  const lifecycleData = await lc005PreviewPage.evaluate(() => {
    return (window as any).lifecycleLog || [];
  });

  console.log('=== window.lifecycleLog 데이터 ===');
  console.log(JSON.stringify(lifecycleData, null, 2));

  // validateLifecycleOrder 실행 (evaluate 내부에서 함수 정의 및 실행)
  const validationResult = await lc005PreviewPage.evaluate(() => {
    const log = (window as any).lifecycleLog;
    const pageBeforeLoad = log.find((l: any) => l.type === 'page' && l.phase === 'before_load');
    const pageLoaded = log.find((l: any) => l.type === 'page' && l.phase === 'loaded');
    const pageBeforeUnload = log.find((l: any) => l.type === 'page' && l.phase === 'before_unload');
    const componentRegisters = log.filter((l: any) => l.type === 'component' && l.phase === 'register');
    const componentDestroys = log.filter((l: any) => l.type === 'component' && l.phase === 'beforeDestroy');
    const allRegistersAfterBeforeLoad = componentRegisters.every((r: any) => r.timestamp > pageBeforeLoad.timestamp);
    const loadedAfterAllRegisters = componentRegisters.every((r: any) => r.timestamp < pageLoaded.timestamp);
    const allDestroysAfterBeforeUnload = componentDestroys.every((d: any) => d.timestamp > pageBeforeUnload.timestamp);
    return { allRegistersAfterBeforeLoad, loadedAfterAllRegisters, allDestroysAfterBeforeUnload };
  });

  console.log('=== validateLifecycleOrder 결과 ===');
  console.log(JSON.stringify(validationResult, null, 2));

  // 검증
  expect(validationResult.allRegistersAfterBeforeLoad).toBe(true);
  expect(validationResult.loadedAfterAllRegisters).toBe(true);
  expect(validationResult.allDestroysAfterBeforeUnload).toBe(true);

  console.log('✓ TC-LC-005: 다중 컴포넌트 라이프사이클 순서 검증 완료');
});
