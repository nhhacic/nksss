# NKSSS Project Rules — Bắt buộc AI tuân thủ

> Dự án: **Sổ tay NKSSS** — Ứng dụng hỗ trợ chẩn đoán và điều trị Nhiễm Khuẩn Sơ Sinh Sớm.
> Stack: React 19 + Vite 7 + Firebase (Firestore, Auth, Storage) + react-i18next

---

## 0. Ngôn ngữ giao tiếp — ƯU TIÊN CAO NHẤT

- **BẮT BUỘC** giao tiếp, giải thích, trả lời bằng **tiếng Việt** trong mọi trường hợp.
- Kể cả khi user prompt bằng tiếng Anh hoặc ngôn ngữ khác, AI **VẪN PHẢI** trả lời bằng tiếng Việt.
- Code comments có thể viết bằng tiếng Anh hoặc tiếng Việt, nhưng mọi giao tiếp với user phải là tiếng Việt.

---

## 1. Bảo mật (KHÔNG ĐƯỢC vi phạm)

- **KHÔNG BAO GIỜ** hardcode API key, secret, hoặc credential trong source code.
- Mọi config nhạy cảm (Firebase, VAPID, reCAPTCHA) **PHẢI** dùng `import.meta.env.VITE_*` từ file `.env`.
- File `.env` **KHÔNG ĐƯỢC** commit vào git (đã có trong `.gitignore`).
- Khi thêm biến môi trường mới, **PHẢI** cập nhật cả `.env.example` với giá trị placeholder.
- Firestore rules (`firestore.rules`) **PHẢI** kiểm tra `request.auth.uid` cho mọi write operation.
- Không cho phép user sửa document của người khác (trừ các field được phép rõ ràng như `replyCount`).

## 2. Kiến trúc dự án

```
webapp/
├── src/
│   ├── components/     # Shared UI components (Toast, ErrorBoundary)
│   ├── context/        # React Context (AuthContext, PatientContext)
│   ├── hooks/          # Custom hooks (usePushNotification)
│   ├── i18n/           # Translations (vi.js, en.js, LanguageContext.jsx)
│   ├── layouts/        # AppLayout.jsx
│   ├── lib/            # Utilities (firebase.js, storage.js, utils.js, patientUtils.js)
│   ├── pages/          # Page components (Home, Admission, Diagnosis, etc.)
│   ├── App.jsx         # Router + lazy loading
│   └── main.jsx        # Entry point
├── public/
│   └── sw.js           # Service Worker (PWA + Push)
├── firestore.rules     # Security rules
├── .env                # Secret config (KHÔNG commit)
└── .env.example        # Template cho developer mới
```

- **KHÔNG** tạo file ngoài cấu trúc này trừ khi có lý do chính đáng.
- **KHÔNG** cài thêm thư viện CSS framework (TailwindCSS, Bootstrap...) — dự án dùng vanilla CSS với CSS variables.
- Tất cả page components **PHẢI** có `export default function` để hỗ trợ `React.lazy()`.

## 3. Đa ngôn ngữ (i18n) — BẮT BUỘC

- **TUYỆT ĐỐI KHÔNG** viết text hiển thị cho user bằng chuỗi cứng (hardcoded string) trong JSX.
- Mọi text UI **PHẢI** dùng `t('section.key')` từ `useTranslation()`.
- Khi thêm text mới, **PHẢI** cập nhật **CẢ HAI** file: `src/i18n/vi.js` và `src/i18n/en.js`.
- Cấu trúc key: `section.subKey` (ví dụ: `home.urgentAlert`, `lab.crpLabel`).
- Các section hiện tại: `common`, `nav`, `login`, `home`, `dashboard`, `admission`, `diagnosis`, `treatment`, `calculator`, `review`, `reeval`, `profile`, `notifications`, `consult`, `consultDetail`, `followup`, `error`, `lab`, `doseAlert`, `transfer`, `trend`, `advSearch`, `evalOptions`, `pushToggle`, `homeExtra`.

## 4. Code Style & Conventions

- **State management**: Dùng React Context API (AuthContext, PatientContext). KHÔNG cài Redux/Zustand.
- **Routing**: React Router DOM v7. Tất cả routes định nghĩa trong `App.jsx`.
- **Icons**: Dùng `lucide-react`. KHÔNG dùng thư viện icon khác.
- **Date/Time**: Dùng `date-fns`. KHÔNG dùng moment.js.
- **Toast/Notification**: Dùng `useToast()` từ `components/Toast.jsx`.
- **Confirm dialog**: Dùng `window.confirm()` hoặc `confirmDialog()` từ `lib/utils.js`.
- **Form validation**: Validate trước khi gọi Firebase. Hiển thị toast khi lỗi.

## 5. Firestore Data Model

```
patients/{patientId}
  ├── doctorId: string (uid)
  ├── id, dob, weight, gestationalAge, ageDays
  ├── admissionTime, createdAt, updatedAt
  ├── diagnosis: 'A' | 'B'
  ├── warningSigns[], riskFactors[], clinicalSigns[]
  ├── antibioticGroup: { label, rec }
  ├── doses: [{ med, dose, freq, route }]
  ├── evaluationResult, evaluationNote, evaluatedAt
  ├── tags: string[]
  ├── clinicalImages: string[] (Firebase Storage URLs)
  ├── labData: { crp1, crp2, cultureResult, cultureGram, antibiogram[] }
  └── timeline: [{ type, result, note, by, at }]

users/{userId}
  ├── email, displayName, hospital, department
  ├── alertFrequency, photoURL, theme

notifications/{notificationId}
  ├── userId, type, title, message, isRead, createdAt

consults/{consultId}
  ├── authorId, authorName, title, content
  ├── attachedPatient (snapshot), replyCount
  └── replies/{replyId}

subscriptions/{userId}
  └── endpoint, keys (push subscription)
```

- **KHÔNG** thay đổi cấu trúc collection mà không cập nhật `firestore.rules`.
- Khi thêm field mới vào patient, **PHẢI** dùng `setDoc(ref, data, { merge: true })`.
- **KHÔNG** ghi `undefined` vào Firestore (sẽ throw error).

## 6. Shared Utilities — BẮT BUỘC tái sử dụng

File `lib/patientUtils.js` chứa logic dùng chung. **KHÔNG** duplicate logic này:

| Function | Dùng cho |
|----------|----------|
| `matchesPatientFilter(patient, filter)` | Lọc bệnh nhân theo type/value |
| `getFilterLabel(filter, t)` | Label cho filter badge |
| `computePatientStats(patients)` | Đếm urgent/pending/done/total |
| `computeGAStats(patients)` | Phân bố tuổi thai |
| `computeWeightStats(patients)` | Phân bố cân nặng |
| `computeAntibioticStats(patients)` | Thống kê kháng sinh |
| `computeTagStats(patients)` | Thống kê tags |
| `getPatientPriority(patient)` | Sort priority (1=urgent, 2=pending, 3=done) |
| `checkDoseAdjustmentNeeded(patient)` | Cảnh báo chỉnh liều |
| `getRecommendedDuration(patient)` | Đề xuất thời gian điều trị KS |

## 7. Performance

- Tất cả pages **PHẢI** lazy-load qua `React.lazy()` trong `App.jsx`.
- Dùng `useMemo()` cho computed data (stats, filtered lists) khi dependency array rõ ràng.
- **KHÔNG** tạo `new Date()` trong render loop — cache reference time.
- Khi upload ảnh lên Storage, **PHẢI** cung cấp chức năng xoá (gọi `deleteStorageFile()`).

## 8. Patient Workflow (Luồng xử lý bệnh nhân)

```
Admission → Diagnosis → [A: Treatment → Calculator → Review] / [B: Followup]
                                                                 ↓
                                                            ReEvaluation
```

- Hướng A: Cần kháng sinh → đi qua Treatment → Calculator → Review → lưu Firestore.
- Hướng B: Theo dõi → lưu Firestore ngay → redirect Followup.
- ReEvaluation: Đánh giá lại sau 18-24h, nhập lab, chuyển giao.
- **Session storage** giữ patient draft giữa các bước. Reset sau khi lưu.
- `AppLayout.jsx` cảnh báo khi navigate ra khỏi flow chưa lưu.

## 9. Deploy

- Deploy bằng Firebase Hosting: `firebase deploy --only hosting` tại thư mục root `d:\NKSSS`.
- Build trước khi deploy: `npm run build` hoặc `pnpm run build` tại `d:\NKSSS\webapp`.
- Tham khảo workflow `/deploy` nếu có.

## 10. Testing & Verification

- Sau mỗi thay đổi lớn, **PHẢI** chạy `vite build` để kiểm tra lỗi compile.
- Kiểm tra console browser cho runtime errors.
- Khi thay đổi Firestore rules, deploy rules trước: `firebase deploy --only firestore:rules`.
