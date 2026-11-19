// 쏠 타로 하우스 — 고민 누적 엑셀을 구글 드라이브 폴더에 저장하는 Apps Script(owner 계정에서 실행).
// 설치: script.google.com → 새 프로젝트 → 이 코드 붙여넣기 → 프로젝트 설정 → 스크립트 속성에
//   SECRET = Vercel의 DRIVE_UPLOAD_SECRET과 같은 값, FOLDER_ID = 저장할 드라이브 폴더 주소 끝의 id
// → 배포 → 새 배포 → 유형 '웹 앱', 실행 사용자 '나', 액세스 '모든 사용자' → 웹 앱 URL을 Vercel DRIVE_UPLOAD_URL에.
// 비밀값이 맞지 않으면 아무것도 저장하지 않는다.
function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var out = function (o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); };
  try {
    var body = JSON.parse(e.postData.contents);
    if (!body.secret || body.secret !== props.getProperty("SECRET")) return out({ ok: false, error: "unauthorized" });
    var name = String(body.filename || "upload.xlsx").replace(/[\\/]/g, "_");
    var blob = Utilities.newBlob(Utilities.base64Decode(body.content), body.mimeType || "application/octet-stream", name);
    var file = DriveApp.getFolderById(props.getProperty("FOLDER_ID")).createFile(blob);
    return out({ ok: true, url: file.getUrl() });
  } catch (err) {
    return out({ ok: false, error: "failed" });
  }
}
