// --- Google API Configuration ---
const CLIENT_ID = '527801730306-b9ai1utm1gj2m4tvnln77bbf95ffllir.apps.googleusercontent.com';
const API_KEY = 'AIzaSyBGO2TzEuMmP2X9oUngNRvx-rCb1U-Mjco'; // 실제 사용 시 본인의 API 키로 변경하세요.
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive';

// --- Fixed Google Drive Folder ID ---
const GOOGLE_DRIVE_FOLDER_ID = '1A2D7QtKPIG16jKD2HFaM_hyyyXHtEXEd'; // 구글 드라이브 폴더 ID

// --- DOM Elements ---
const authorizeButton = document.getElementById('authorize_button');
const signoutButton = document.getElementById('signout_button');
const appContent = document.getElementById('app_content');
const fileInput = document.getElementById('fileInput');
const fileNameInput = document.getElementById('fileName');
const photoDateInput = document.getElementById('photoDate');
const categorySelect = document.getElementById('categorySelect');
const uploadButton = document.getElementById('uploadButton');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');

// 카메라 관련 DOM 요소 (모바일/태블릿 전용)
const smartCameraButton = document.getElementById('smartCameraButton');
const nativeCameraInput = document.getElementById('nativeCameraInput');
const clearPhotosButton = document.getElementById('clearPhotosButton');

// --- Global Variables ---
let tokenClient;
let gapiInited = false;
let gisInited = false;
let initTimeout;

// 카메라 관련 변수 (모바일/태블릿 전용)
let capturedPhotos = []; // 촬영된 사진들을 저장할 배열

// --- Initialization and Event Listeners ---
window.onload = () => {
    console.log('페이지 로드 완료');
    
    fileInput.addEventListener('change', handleFilePreview);
    authorizeButton.addEventListener('click', handleAuthClick);
    signoutButton.addEventListener('click', handleSignoutClick);
    uploadButton.addEventListener('click', handleUploadClick);
    
            smartCameraButton.addEventListener('click', startSmartCapture);
    nativeCameraInput.addEventListener('change', handleNativeCameraPhotos);
    clearPhotosButton.addEventListener('click', clearAllPhotos);
    
    

        if (!GOOGLE_DRIVE_FOLDER_ID) {
        console.error('CRITICAL ERROR: GOOGLE_DRIVE_FOLDER_ID is not set in the script.');
        if(uploadButton) uploadButton.disabled = true;
    }
    
                // 한국 시간대로 오늘 날짜 설정
    const now = new Date();
    
    // 한국 시간대 (UTC+9)로 변환
    const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    
    // YYYY-MM-DD 형식으로 변환
    const year = koreanTime.getUTCFullYear();
    const month = String(koreanTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(koreanTime.getUTCDate()).padStart(2, '0');
    const formattedKoreanDate = `${year}-${month}-${day}`;
    
        photoDateInput.value = formattedKoreanDate;
    
    // 초기 버튼 텍스트 설정
    authorizeButton.textContent = 'Google API 로드 중...';
    
        initTimeout = setTimeout(() => {
        if (!gapiInited || !gisInited) {
            console.error('Google API 로드 타임아웃');
            authorizeButton.textContent = '수동으로 Google Drive 로그인 시도';
        }
    }, 10000);
};

// --- Google API Functions ---
function gapiLoaded() {
    console.log('GAPI 스크립트 로드됨');
    gapi.load('client', initializeGapiClient);
}

function gisLoaded() {
    console.log('GIS 스크립트 로드됨');
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: tokenResponseCallback,
        });
        gisInited = true;
        console.log('GIS 초기화 완료');
        checkReadyState();
        } catch (error) {
        console.error('GIS 초기화 오류:', error);
    }
}

window.gapiLoaded = gapiLoaded;
window.gisLoaded = gisLoaded;

async function initializeGapiClient() {
    try {
        console.log('GAPI 클라이언트 초기화 시작');
        
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: DISCOVERY_DOCS,
        });
        
        gapiInited = true;
        console.log('GAPI 클라이언트 초기화 완료');
        checkReadyState();
    } catch (error) {
        console.error("GAPI 클라이언트 초기화 오류:", error);
    }
}

function checkReadyState() {
    console.log(`상태 체크: GAPI=${gapiInited}, GIS=${gisInited}`);
    
    if (gapiInited && gisInited) {
        if (initTimeout) {
            clearTimeout(initTimeout);
            initTimeout = null;
        }
        
        console.log('Google API 초기화 완료!');
        authorizeButton.textContent = 'Google Drive 로그인';
        
        // 페이지 로드 시 자동 로그인 시도
        attemptAutoLogin();
    } else {
        const loadingParts = [];
        if (!gapiInited) loadingParts.push('Drive API');
        if (!gisInited) loadingParts.push('인증 시스템');
        
        console.log(`🔄 ${loadingParts.join(', ')} 로드 중... (${loadingParts.length}/2)`);
    }
}

// --- Smart Camera Functions (모바일/태블릿 전용) ---
function startSmartCapture() {
    // 로그인 체크
    if (!checkLoginAndPrompt("이 기능을 사용")) {
        return;
    }
    
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isTablet = /iPad/i.test(userAgent) || 
                    (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent)) || // Android 태블릿
                    /Tablet/i.test(userAgent); // 기타 태블릿
    
    const isMobileOrTablet = isMobile || isTablet;
    const deviceType = isTablet ? '태블릿' : isMobileOrTablet ? '모바일' : '데스크톱';
    
    // 데스크탑에서는 파일 선택 안내
    if (!isMobileOrTablet) {
        console.log('📱 모바일 또는 태블릿에서만 카메라를 사용할 수 있습니다.');
        return;
    }
    
    // 모바일/태블릿에서만 카메라 사용 가능
    console.log(`📱 ${deviceType}에서 기본 카메라 앱을 여는 중...`);
    
    // 기본 카메라 앱 실행
    nativeCameraInput.click();
}

function handleNativeCameraPhotos(event) {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) {
        console.log('사진이 선택되지 않았습니다.');
        return;
    }
    
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        console.log('이미지 파일이 없습니다. 다시 촬영해주세요.');
        return;
    }
    
    // 기존 촬영된 사진들에 추가
    capturedPhotos.push(...imageFiles);
    updateImagePreview();
    
    const photoCount = imageFiles.length;
    const totalSize = imageFiles.reduce((sum, file) => sum + file.size, 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    
    console.log(`📸 고화질 촬영 완료! ${photoCount}장 촬영됨 (총 ${totalSizeMB}MB)`);
    
    // 파일 입력 필드 초기화 (같은 파일을 다시 선택할 수 있도록)
    nativeCameraInput.value = '';
    
    console.log(`기본 카메라로 ${photoCount}장 촬영 완료:`, imageFiles.map(f => `${f.name} (${(f.size/1024).toFixed(1)}KB)`));
}



function clearAllPhotos() {
    // 로그인 체크
    if (!checkLoginAndPrompt("이 기능을 사용")) {
        return;
    }
    
    if (capturedPhotos.length === 0) {
        console.log('삭제할 사진이 없습니다.');
        return;
    }
    
    showCustomConfirm(
        '🗑️ 모든 사진 삭제',
        `총 ${capturedPhotos.length}장의 사진을 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
        () => {
            capturedPhotos = [];
            updateImagePreview();
            console.log('모든 사진이 삭제되었습니다.');
        },
        () => {
            console.log('삭제가 취소되었습니다.');
        }
    );
}

function removePhoto(index) {
    const fileName = capturedPhotos[index]?.name || `사진 ${index + 1}`;
    
        showCustomConfirm(
        '🗑️ 사진 삭제',
        `"${fileName}"을(를) 삭제하시겠습니까?`,
        () => {
            capturedPhotos.splice(index, 1);
            updateImagePreview();
            console.log(`사진이 삭제되었습니다. (남은 사진: ${capturedPhotos.length}장)`);
        },
        () => {
            console.log('삭제가 취소되었습니다.');
        }
    );
}

// --- Authentication ---
function handleAuthClick() {
    console.log('로그인 버튼 클릭됨');
    console.log('Google 로그인 창을 여는 중...');
    
    try {
        if (!tokenClient) {
            throw new Error('토큰 클라이언트가 초기화되지 않았습니다.');
        }
        // 수동 로그인 시에는 consent 화면을 표시 (prompt: 'consent')
        // 하지만 이미 승인된 경우에는 자동으로 진행 (prompt: 'select_account')
        tokenClient.requestAccessToken({prompt: 'select_account'});
    } catch (error) {
        console.error('로그인 시도 오류:', error);
    }
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        console.log('로그아웃 중...');
        google.accounts.oauth2.revoke(token.access_token, () => {
            gapi.client.setToken('');
            updateSigninStatus(false);
            console.log('로그아웃되었습니다.');
            console.log('로그아웃 완료 및 토큰 해지됨');
        });
    } else {
        updateSigninStatus(false);
        console.log('이미 로그아웃된 상태입니다.');
    }
}

function tokenResponseCallback(resp) {
    console.log('토큰 응답 수신:', resp);
    
    if (resp.error) {
        console.error('토큰 응답 오류:', resp.error, resp);
        
        // 자동 로그인 진행 중이었다면 버튼 상태 복구
        if (authorizeButton.disabled) {
            authorizeButton.textContent = 'Google Drive 로그인';
            authorizeButton.disabled = false;
        }
        
        updateSigninStatus(false);
        return;
    }
    // gapi.client.setToken()은 GIS 라이브러리가 자동으로 처리해줍니다.
    // access_token이 실제로 있는지 확인
    if (gapi.client.getToken() && gapi.client.getToken().access_token) {
        console.log('액세스 토큰 설정 확인됨:', gapi.client.getToken());
        
        // 로그인 상태를 localStorage에 저장
        localStorage.setItem('googleDriveLoggedIn', 'true');
        localStorage.setItem('lastLoginTime', Date.now().toString());
        
        updateSigninStatus(true);
        console.log('로그인 성공! (상태 저장됨)');
        
        // 자동 로그인 진행 중이었다면 버튼 상태 복구
        if (authorizeButton.disabled) {
            authorizeButton.disabled = false;
        }
    } else {
        // 간혹 콜백은 성공했으나 토큰이 바로 설정되지 않는 경우가 있을 수 있음 (이론상)
        console.error('토큰 응답은 성공적이었으나, gapi.client에 토큰이 설정되지 않았습니다.');
        
        // 자동 로그인 진행 중이었다면 버튼 상태 복구
        if (authorizeButton.disabled) {
            authorizeButton.textContent = 'Google Drive 로그인';
            authorizeButton.disabled = false;
        }
        
        updateSigninStatus(false);
    }
}

function updateSigninStatus(isSignedIn) {
    console.log('로그인 상태 업데이트:', isSignedIn);
    
    if (isSignedIn) {
        authorizeButton.style.display = 'none';
        signoutButton.style.display = 'block';
    } else {
        authorizeButton.style.display = 'block';
        signoutButton.style.display = 'none';
        
        // 로그아웃 시 localStorage 상태 제거
        localStorage.removeItem('googleDriveLoggedIn');
        localStorage.removeItem('lastLoginTime');
        
        // 로그아웃 시 미리보기 정리
        capturedPhotos = [];
        updateImagePreview();
    }
}

// --- File Handling and Preview ---
function handleFilePreview(event) {
    const files = Array.from(event.target.files);
    const newPhotos = [];

    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            newPhotos.push(file);
        } else {
            console.warn(`선택된 파일 중 이미지 파일이 아닌 것이 있습니다: ${file.name} (타입: ${file.type})`);
        }
    });

        if (newPhotos.length === 0 && files.length > 0) {
        console.log('선택된 파일 중에 이미지 파일이 없습니다.');
        return;
    }
    
    capturedPhotos.push(...newPhotos);
    updateImagePreview();
    
    console.log(`총 ${capturedPhotos.length}개의 사진이 준비되었습니다.`);
}

function updateImagePreview() {
    imagePreviewContainer.innerHTML = ''; // 이전 미리보기 모두 제거
    
    capturedPhotos.forEach((file, index) => {
        if (file.type.startsWith('image/')) {
            const previewDiv = document.createElement('div');
            previewDiv.className = 'preview-image';
            
            const img = document.createElement('img');
            const objectURL = URL.createObjectURL(file);
            img.src = objectURL;
            img.alt = file.name;
            img.title = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`; // 파일 크기 표시
            
            const cleanup = () => {
                URL.revokeObjectURL(objectURL);
                console.log(`Object URL 해제: ${objectURL}`);
            };
            img.onload = cleanup;
            img.onerror = (e) => {
                console.error(`이미지 미리보기 로드 오류: ${file.name}`, e);
                cleanup();
                previewDiv.innerHTML = `<div class="preview-error">미리보기<br>오류</div><span>${file.name}</span>`;
            };
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.title = '이 사진 삭제';
            removeBtn.onclick = (e) => {
                e.stopPropagation(); // 이벤트 버블링 방지
                removePhoto(index);
            };
            
            previewDiv.appendChild(img);
            previewDiv.appendChild(removeBtn);
            imagePreviewContainer.appendChild(previewDiv);
        }
    });
    // 미리보기 업데이트 후 파일 입력 필드 초기화 (선택 사항)
    // fileInput.value = ''; // 이렇게 하면 같은 파일을 다시 선택할 때 change 이벤트가 발생
}

function getFileExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1 || lastDot === 0 || lastDot === filename.length - 1) {
        return ""; // 확장자 없음 또는 잘못된 형식
    }
    return filename.substring(lastDot).toLowerCase(); // 소문자로 통일
}

// --- Upload Logic ---
async function findFolderByName(parentFolderId, folderName, accessToken) {
    try {
        const query = `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        console.log(`폴더 검색 쿼리: ${query}`);
        const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`폴더 검색 실패: HTTP ${response.status} - ${errorData.error?.message || response.statusText}`);
        }
        const data = await response.json();
        return data.files && data.files.length > 0 ? data.files[0] : null;
    } catch (error) {
        console.error('findFolderByName 오류:', error);
        throw error; // 오류를 상위로 전파
    }
}

async function createFolder(parentFolderId, folderName, accessToken) {
    try {
        console.log(`폴더 생성 시도: 이름='${folderName}', 부모ID='${parentFolderId}'`);
        const metadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId]
        };
                const response = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });

        if (!response.ok) {
            const errorDetails = await response.json().catch(() => ({ error: { message: '알 수 없는 폴더 생성 오류' } }));
            throw new Error(`폴더 생성 실패: ${errorDetails.error.message || '오류 메시지 없음'} (HTTP ${response.status})`);
        }
        return await response.json();
    } catch (error) {
        console.error('createFolder 오류:', error);
        throw error;
    }
}

async function findOrCreateCategoryFolder(parentFolderId, categoryName, accessToken) {
    try {
        console.log(`카테고리 폴더 검색/생성: ${categoryName}`);
        
        let categoryFolder = await findFolderByName(parentFolderId, categoryName, accessToken);
        
        if (categoryFolder) {
            console.log(`기존 카테고리 폴더 '${categoryName}' 발견 (ID: ${categoryFolder.id})`);
            return categoryFolder.id;
        }
        
        console.log(`카테고리 폴더 '${categoryName}' 생성 중...`);
        categoryFolder = await createFolder(parentFolderId, categoryName, accessToken);
        console.log(`카테고리 폴더 '${categoryName}' 생성 완료 (ID: ${categoryFolder.id})`);
        return categoryFolder.id;
    } catch (error) {
        console.error(`카테고리 폴더 '${categoryName}' 처리 오류:`, error);
        throw error; // 상위로 전파하여 업로드 중단
    }
}

async function handleUploadClick() {
    // 로그인 체크
    if (!checkLoginAndPrompt("이 기능을 사용")) {
        return;
    }

    if (!GOOGLE_DRIVE_FOLDER_ID) {
        console.error('CRITICAL ERROR: GOOGLE_DRIVE_FOLDER_ID is not set in the script.');
        return;
    }

    const photoDate = photoDateInput.value;
    const category = categorySelect.value;
    const baseFileName = fileNameInput.value.trim();

    if (capturedPhotos.length === 0) {
        console.log('업로드할 사진이 없습니다. 먼저 사진을 촬영하거나 선택해주세요.');
        return;
    }
    if (!category) {
        console.log('카테고리를 선택해주세요.');
        categorySelect.focus();
        return;
    }
    if (!photoDate) {
        console.log('촬영 날짜를 입력해주세요.');
        photoDateInput.focus();
        return;
    }
    if (!baseFileName) {
        console.log('파일명을 입력해주세요.');
        fileNameInput.focus();
        return;
    }

        const tokenObject = gapi.client.getToken();

    const formattedDateForFileName = formatDateToYYYYMMDD(photoDate); // 파일명용 날짜
    const uploadTimeForFileName = formatCurrentTimeToYYMMDDHHNNSS();

        console.log(`${capturedPhotos.length}개 사진 업로드 준비 중...`);
    appContent.classList.add('loading');
    uploadButton.disabled = true;

    let successCount = 0;
    let errorCount = 0;
    const totalFiles = capturedPhotos.length;

    let targetFolderId;
    try {
        console.log(`카테고리 폴더 확인 중... ${category} 폴더를 찾거나 생성합니다...`);
        targetFolderId = await findOrCreateCategoryFolder(GOOGLE_DRIVE_FOLDER_ID, category, tokenObject.access_token);
        console.log(`카테고리 폴더 준비 완료. ${category} 폴더에 업로드합니다.`);
    } catch (error) {
        console.error('업로드 중 카테고리 폴더 처리 실패:', error);
        showUploadResultModal("업로드 실패", `❌ 폴더 생성 실패\n업로드 중 오류가 발생했습니다.\n${error.message}`, false);
        appContent.classList.remove('loading');
        uploadButton.disabled = false;
        return;
    }

    for (let i = 0; i < totalFiles; i++) {
        const file = capturedPhotos[i];
        const originalExtension = getFileExtension(file.name) || (file.type === 'image/jpeg' ? '.jpg' : (file.type === 'image/png' ? '.png' : '.dat'));
        
                let finalName = `${category}_${formattedDateForFileName}_${baseFileName}`;
        if (totalFiles > 1) {
            finalName += ` (${i + 1})${originalExtension}`;
        } else {
            finalName += originalExtension;
        }
        
                console.log(`업로드 중: ${i + 1} / ${totalFiles} - ${finalName} (진행률: ${((i / totalFiles) * 100).toFixed(0)}%)`);
        
        try {
            console.log(`%c[파일 업로드 시작 ${i+1}/${totalFiles}]`, "font-weight:bold;", `이름: ${finalName}, 대상 폴더 ID: ${targetFolderId}`);
            const uploadedFile = await uploadSingleFileToDrive(file, finalName, targetFolderId, tokenObject.access_token);
            if (uploadedFile && uploadedFile.id) {
                successCount++;
                console.log(`%c[업로드 성공 ${i+1}]`, "color:green", `${finalName} (ID: ${uploadedFile.id})`);
            } else {
                errorCount++;
                console.warn(`[업로드 실패 ${i+1}] ${finalName} - 응답은 성공했으나 파일 ID 없음`, uploadedFile);
            }
        } catch (error) {
            console.error(`[업로드 오류 ${i+1}] ${finalName}:`, error);
            errorCount++;
            // 개별 파일 업로드 실패 시 계속 진행할지, 중단할지 결정 가능. 현재는 계속 진행.
        }
    }

        // 최종 결과 표시
    console.log(`업로드 완료 (${totalFiles}개 중 ${successCount}개 성공)`);
    
    // 사용자에게 업로드 결과 알림
    if (successCount === totalFiles) {
        const successMessage = `🎉 업로드 성공!\n${successCount}개 사진이 '${category}' 폴더에 성공적으로 업로드되었습니다.`;
        console.log(successMessage);
        showUploadResultModal("업로드 성공", successMessage, true);
    } else if (successCount > 0) {
        const partialMessage = `⚠️ 일부 업로드 완료\n성공: ${successCount}개\n실패: ${errorCount}개\n폴더: '${category}'`;
        console.log(partialMessage);
        showUploadResultModal("일부 업로드 완료", partialMessage, true);
    } else {
        const failMessage = `❌ 업로드 실패\n모든 파일 업로드에 실패했습니다.\n다시 시도해주세요.`;
        console.log(failMessage);
        showUploadResultModal("업로드 실패", failMessage, false);
    }
    
    if (successCount > 0 && errorCount === 0) { // 모든 파일 성공 시에만 초기화
        capturedPhotos = [];
        updateImagePreview();
        fileInput.value = ''; // 파일 선택 input도 초기화
        fileNameInput.value = ''; // 파일명 input도 초기화
    }
    
    appContent.classList.remove('loading');
    uploadButton.disabled = false;
}

async function uploadSingleFileToDrive(fileObject, targetFileName, parentFolderId, accessToken) {
    const metadata = {
        name: targetFileName,
        mimeType: fileObject.type || 'application/octet-stream', // 기본 MIME 타입 변경
        parents: parentFolderId ? [parentFolderId] : [] // 없으면 루트에 업로드 (여기서는 항상 ID가 있을 것으로 예상)
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileObject);

    if (!accessToken) {
        console.error('uploadSingleFileToDrive: 액세스 토큰 없음.');
        throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');
    }

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true', { // fields 추가
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }, // Content-Type은 FormData가 자동으로 설정
        body: form
    });

    if (!response.ok) {
        const errorDetails = await response.json().catch(() => ({ error: { message: `알 수 없는 서버 오류 (HTTP ${response.status})` } }));
        console.error('Google Drive API 업로드 오류:', errorDetails);
        throw new Error(`Google Drive API 오류: ${errorDetails.error.message} (HTTP ${response.status})`);
    }
    return await response.json();
}

function formatDateToYYYYMMDD(dateString) {
    if (!dateString) return '';
    // T00:00:00을 추가하여 로컬 시간대 기준으로 날짜 객체 생성
    const date = new Date(dateString + 'T00:00:00'); 
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

function formatCurrentTimeToYYMMDDHHNNSS() {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hour}${minute}${second}`;
}



// --- Status Message Functions ---
function showUploadResultModal(title, message, isSuccess) {
    showCustomConfirm(
        title,
        message,
        () => {
            // 확인 버튼 클릭 시 실행할 동작 (없음)
            console.log(`업로드 결과 모달 닫힘: ${title}`);
        },
        null // 취소 버튼 비활성화
    );
}


// --- Auto Login Functions ---
function attemptAutoLogin() {
    const wasLoggedIn = localStorage.getItem('googleDriveLoggedIn') === 'true';
    const lastLoginTime = localStorage.getItem('lastLoginTime');
    
    if (!wasLoggedIn) {
        console.log('이전 로그인 기록이 없습니다.');
        return;
    }
    
    // 마지막 로그인으로부터 7일이 지났으면 자동 로그인 시도하지 않음
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    if (lastLoginTime && parseInt(lastLoginTime) < sevenDaysAgo) {
        console.log('마지막 로그인이 너무 오래되어 자동 로그인을 시도하지 않습니다.');
        localStorage.removeItem('googleDriveLoggedIn');
        localStorage.removeItem('lastLoginTime');
        return;
    }
    
    console.log('🔄 자동 로그인 시도 중...');
    
    // 로그인 버튼에 상태 표시
    authorizeButton.textContent = '자동 로그인 중...';
    authorizeButton.disabled = true;
    
    try {
        // 자동 로그인 시도 (prompt: '' 는 이미 승인된 경우 자동으로 토큰 받기)
        tokenClient.requestAccessToken({prompt: ''});
        
        // 3초 후에도 로그인이 안되면 원래 상태로 복구
        setTimeout(() => {
            if (authorizeButton.disabled) {
                authorizeButton.textContent = 'Google Drive 로그인';
                authorizeButton.disabled = false;
                console.log('자동 로그인 시간 초과');
            }
        }, 3000);
        
    } catch (error) {
        console.error('자동 로그인 실패:', error);
        localStorage.removeItem('googleDriveLoggedIn');
        localStorage.removeItem('lastLoginTime');
        authorizeButton.textContent = 'Google Drive 로그인';
        authorizeButton.disabled = false;
    }
}

// 토큰 유효성 검사 함수 - 현재 사용되지 않음
/* async function checkTokenValidity() {
    const token = gapi.client.getToken();
    if (!token || !token.access_token) {
        return false;
    }
    
    try {
        // Google Drive API를 사용해서 토큰이 유효한지 확인
        const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token.access_token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('토큰 유효성 확인됨. 사용자:', data.user?.emailAddress);
            return true;
        } else {
            console.log('토큰이 유효하지 않습니다.');
            return false;
        }
    } catch (error) {
        console.error('토큰 유효성 검사 오류:', error);
        return false;
    }
} */

// --- Login Check Functions ---
function checkLoginAndPrompt(actionName = "이 기능을 사용") {
    const tokenObject = gapi.client.getToken();
    if (!tokenObject || !tokenObject.access_token) {
        showLoginRequiredModal(actionName);
        return false;
    }
    
    // 로그인 상태 시간 업데이트 (활동 중임을 표시)
    localStorage.setItem('lastLoginTime', Date.now().toString());
    
    return true;
}

function showLoginRequiredModal(actionName = "이 기능을 사용") {
    const title = "🔐 로그인이 필요합니다";
    const message = `${actionName}하려면 먼저 Google Drive에 로그인해주세요.`;
    
    showCustomConfirm(
        title,
        message,
        () => {
            // 확인 버튼을 누르면 로그인 버튼에 포커스
            if (authorizeButton.style.display !== 'none') {
                authorizeButton.focus();
                // 버튼을 살짝 하이라이트
                authorizeButton.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    authorizeButton.style.transform = '';
                }, 200);
            }
        },
        null
    );
}

// --- Toggle Functions ---
function toggleFileSection() {
    const fileContent = document.getElementById('fileContent');
    const toggleIcon = document.getElementById('fileToggleIcon');
    
    if (fileContent && toggleIcon) { // 요소 존재 여부 확인
        if (fileContent.classList.contains('collapsed')) {
            fileContent.classList.remove('collapsed');
            toggleIcon.classList.remove('collapsed');
            toggleIcon.textContent = '▼';
        } else {
            fileContent.classList.add('collapsed');
            toggleIcon.classList.add('collapsed');
            toggleIcon.textContent = '▶';
        }
    } else {
        console.warn("toggleFileSection: 'fileContent' 또는 'fileToggleIcon' 요소를 찾을 수 없습니다.");
    }
}
window.toggleFileSection = toggleFileSection;


// --- Custom Confirm Modal Functions ---
function showCustomConfirm(title, message, onConfirm, onCancel = null) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customConfirmModal');
        const titleElement = document.getElementById('confirmTitle');
        const messageElement = document.getElementById('confirmMessage');
        const confirmBtn = document.getElementById('confirmOkBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');

        if (!modal || !titleElement || !messageElement || !confirmBtn || !cancelBtn) {
            console.error("Custom confirm modal의 DOM 요소 중 일부를 찾을 수 없습니다. 기본 confirm을 사용합니다.");
            // 폴백: 기본 confirm 사용
            if (confirm(message)) {
                if (onConfirm) onConfirm();
                resolve(true);
            } else {
                if (onCancel) onCancel();
                resolve(false);
            }
            return;
        }
        
        titleElement.textContent = title;
        messageElement.innerHTML = message.replace(/\n/g, '<br>'); // 개행문자 처리
        
        modal.style.display = 'flex';
        
        // 이벤트 리스너 중복 방지를 위해 기존 리스너 제거 후 새로 할당 (cloneNode 방식 사용)
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        // 취소 버튼 표시/숨김 처리
        if (onCancel === null) {
            newCancelBtn.style.display = 'none';
        } else {
            newCancelBtn.style.display = 'block';
        }

        const closeAndResolve = (result) => {
            modal.style.display = 'none';
            document.removeEventListener('keydown', handleEscapeKeyForModal); // ESC 리스너 제거
            if (result && onConfirm) onConfirm();
            if (!result && onCancel) onCancel();
            resolve(result);
        };
        
        newConfirmBtn.addEventListener('click', () => closeAndResolve(true));
        newCancelBtn.addEventListener('click', () => closeAndResolve(false));
        
        // 모달 외부 클릭 시 닫기 (이벤트 리스너 중복 방지 필요)
        const handleModalOuterClick = (e) => {
            if (e.target === modal) {
                closeAndResolve(false);
                modal.removeEventListener('click', handleModalOuterClick); // 자기 자신 제거
            }
        };
        // 이전 리스너가 있다면 제거 (더 확실한 방법은 cloneNode 또는 별도 플래그 관리)
        modal.removeEventListener('click', handleModalOuterClick); 
        modal.addEventListener('click', handleModalOuterClick);
        
        const handleEscapeKeyForModal = (e) => {
            if (e.key === 'Escape') {
                closeAndResolve(false);
            }
        };
        // 이전 ESC 리스너 제거 후 새로 등록
        document.removeEventListener('keydown', handleEscapeKeyForModal);
        document.addEventListener('keydown', handleEscapeKeyForModal);
    });
}
