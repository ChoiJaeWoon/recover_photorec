# 🧬 recover_photorec – 파일 복구 웹 서비스

![GitHub repo size](https://img.shields.io/github/repo-size/ChoiJaeWoon/recover_photorec?color=blue)
![Last Commit](https://img.shields.io/github/last-commit/ChoiJaeWoon/recover_photorec?color=green)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![PhotoRec](https://img.shields.io/badge/Photorec-CGSecurity-blue)

> 💡 **Node.js 기반 웹 서버에서 PhotoRec 오픈소스를 실행하여 손쉽게 이미지 및 문서 복구를 지원하는 프로젝트입니다.**  
> 터미널 명령어 없이도 웹 인터페이스로 간단히 복구 작업을 진행할 수 있습니다.

---

## 📌 프로젝트 소개

- **목적**: CLI에서만 사용 가능했던 PhotoRec을 Node.js 환경에서 실행해 웹 사용자에게 파일 복구 기능 제공
- **대상**: 실수로 삭제된 이미지·문서 파일을 복구하고자 하는 일반 사용자
- **구성**:
  - 프론트: 업로드 및 결과 UI
  - 백엔드: Node.js 서버에서 PhotoRec 명령어 호출
  - 복구 결과는 압축된 폴더 또는 파일로 다운로드 가능

---

## 🖼 주요 기능

- ✅ 이미지 및 문서 파일 복구 (.jpg, .png, .pdf 등)
- ✅ 복구 경로 설정 자동화
- ✅ drag & drop 업로드 지원
- ✅ 복구된 파일 다운로드
- ✅ CLI 없이도 사용 가능한 직관적인 UI

---

## ⚙️ 사용 기술 스택

| 분야 | 기술 |
|------|------|
| 🌐 웹 서버 | ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white) ![Express](https://img.shields.io/badge/Express.js-000000?style=flat&logo=express&logoColor=white) |
| 🧩 복구 엔진 | ![PhotoRec](https://img.shields.io/badge/Photorec-TestDisk-orange) |
| 🎨 프론트엔드 | HTML5, CSS3, JavaScript |
| 📁 파일 핸들링 | `multer`, `child_process` (Node.js 내장 모듈) |

---

## 🗂 디렉토리 구조

recover_photorec/<br/>
├── public/ # 프론트엔드 정적 파일<br/>
│ ├── index.html<br/>
│ └── style.css<br/>
├── uploads/ # 사용자 업로드 파일<br/>
├── recovered/ # 복구된 결과 파일<br/>
├── app.js # 메인 서버 파일<br/>
├── photorec-runner.js # child_process로 photorec 실행 로직<br/>
├── package.json<br/>
└── README.md<br/>

---

## 🚀 실행 방법

### 1. 설치

```bash
git clone https://github.com/ChoiJaeWoon/recover_photorec.git
cd recover_photorec
npm install
node app.js
```

---
