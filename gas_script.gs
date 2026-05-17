/**
 * GFCH Secure File Upload Google Apps Script
 * 
 * 구글 드라이브 업로드용 Google Apps Script 보안 버전 코드입니다.
 * 구글 시트 또는 독립형 Apps Script 프로젝트에 붙여넣어 사용하세요.
 */

// ⚠️ 실제 운영 시 강력한 비밀키로 변경하십시오.
var SECURE_API_KEY = "gfch_secret_upload_key_2026";
// ⚠️ 파일이 저장될 구글 드라이브 폴더 ID를 지정하세요.
var DRIVE_FOLDER_ID = "1CnbxnRIKWvW6K-gOzkUBE0cYMuYeZ2hP";

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // 🔒 1단계: API KEY 검증 (보안 핵심)
    if (!data.apiKey || data.apiKey !== SECURE_API_KEY) {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Unauthorized access. Invalid or missing API Key."
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 데이터 추출
    var filename = data.filename;
    var contentType = data.contentType;
    var base64Data = data.base64Data;
    
    if (!filename || !contentType || !base64Data) {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Missing required fields (filename, contentType, base64Data)."
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Base64 데이터를 바이트 배열로 변환
    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, contentType, filename);
    
    // 구글 드라이브 폴더에 파일 저장
    var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    var file = folder.createFile(blob);
    
    // 외부 접근을 위해 공유 권한을 '링크가 있는 모든 사용자가 보기 가능'으로 설정
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "fileUrl": file.getUrl(),
      "fileId": file.getId()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
