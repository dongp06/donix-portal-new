# Frontend artifact hardening

## 1. Phạm vi

Mục tiêu là làm mọi public JavaScript asset do Next phát hành khó đọc hơn sau build. Đây không phải cơ chế giấu code tuyệt đối: browser vẫn phải tải và thực thi JavaScript, nên DevTools/instrumented browser cuối cùng vẫn có thể quan sát runtime.

Không dùng encrypted chunk/decrypt-on-browser làm security boundary. Không đưa static AES key, session secret, device private key, Google token hoặc authorization rule bí mật vào bundle.

## 2. Pipeline hiện tại

web/package.json đang chạy:

~~~text
npm run build -w web
  -> next build --webpack
  -> node scripts/obfuscate-build.mjs
  -> node scripts/verify-obfuscated-build.mjs
~~~

obfuscate-build.mjs:

- quét đệ quy web/.next/static;
- xử lý mọi file có đuôi .js, gồm cả dynamic/lazy chunks;
- giữ compact output;
- đổi identifier về hexadecimal;
- dùng string array + RC4 encoding;
- bật control-flow flattening ở threshold thấp;
- không bật source map;
- không obfuscate properties/global names để giảm runtime compatibility risk;
- xóa artifact cũ build-shield trước mỗi build.

verify-obfuscated-build.mjs hiện kiểm tra:

- có public JavaScript asset;
- không còn .tbc;
- không còn thư mục build-shield;
- không có public source map;
- không có marker của trust/RBAC/fraud/private transport policy trong JS.
- `.next/artifact-manifest.json` khớp file count, byte size và SHA-256 của
  từng public JS asset; manifest nằm ngoài `.next/static` và không chứa secret.

Vì vậy trạng thái hiện tại là “all public static JS is transformed”, không phải “all browser logic is secret” và cũng không phải “CDN chỉ có ciphertext”.

## 3. Chính sách production

- Chỉ deploy output từ build command đã chạy cả obfuscator và verifier.
- Không deploy web/.next/static trước khi verifier pass.
- Không bật production browser source maps nếu không có policy lưu source map trong private symbol server.
- Không để source map, test fixture, .env*, private key hoặc raw API credential trong public artifact.
- CI phải scan public artifact để fail nếu có marker của domain-sensitive logic, ví dụ tên policy nội bộ, private role rule hoặc debug endpoint.
- CI phải ghi manifest gồm file count, total bytes, build id, git revision và verifier result; manifest không chứa secret.
- Không hand-edit generated .next files.

## 4. Obfuscation tuning

Obfuscation options có thể làm chunk lớn hơn và chậm parse. Mọi thay đổi phải có budget:

- build time;
- total JavaScript bytes;
- first load parse/evaluate;
- route transition;
- memory;
- error rate và hydration mismatch.

Nếu một third-party chunk hỏng vì transform, đưa file/module đó vào allowlist có lý do và ghi lại. Không nới toàn bộ pipeline chỉ để che một lỗi tương thích.

Các option nặng như selfDefending, debugProtection hoặc deadCodeInjection chỉ được bật sau browser matrix test; hiện không bật vì có thể phá CSP, performance và debugging vận hành.

## 5. Verification checklist

~~~powershell
npm run build -w web
Get-ChildItem -Recurse web/.next/static -Filter *.js
node web/scripts/verify-obfuscated-build.mjs
~~~

CI bổ sung cần làm:

~~~text
[x] scan source maps và protected business marker
[x] assert no plaintext server-only policy in public output
[x] verify build manifest file count/size/SHA-256
[x] fresh web/API runtime smoke through custom proxy and transport gate
[ ] run smoke browser on home, login, dashboard, editor and admin shell
[ ] compare build size against budget
[ ] retain private source-to-build mapping outside public artifact
~~~

## 6. Security boundary cần nói rõ

Obfuscation không chống được:

- DevTools breakpoint/pretty print;
- hook fetch/import/WebCrypto;
- extension hoặc same-origin XSS;
- instrumented Chromium;
- người dùng có quyền truy cập browser profile;
- runtime data/DOM/network quan sát được.

Vì vậy authorization, trust, fraud, pricing decision, RBAC, permit issuance và WebAuthn step-up vẫn phải enforce ở Fastify/private worker. Nếu cần bảo vệ artifact khi nằm trên storage/CDN, đó là bài toán deployment encryption/access control riêng, không được gọi là browser code secrecy.
