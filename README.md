# ふたりノート（夫婦共有 妊娠〜育児アプリ）

夫婦2人だけで使う、妊娠〜育児のタスク・予定・アドバイス・記録の共有アプリです。
スマホのホーム画面に追加して使う PWA で、費用はかかりません。

| 項目 | 内容 |
|---|---|
| フロント | Vite + React + TypeScript + Tailwind CSS |
| データ同期 | Firebase（Spark 無料プラン）：Firestore + Authentication（Google ログイン） |
| ホスティング | GitHub Pages |
| 認可 | Firestore セキュリティルールで、許可した2つの UID のみ読み書き可 |
| オフライン | Firestore の永続キャッシュ ＋ Service Worker |

仕様の元は [CLAUDE_CODE_INSTRUCTIONS.md](CLAUDE_CODE_INSTRUCTIONS.md)、初期データは [seed/](seed/) です。

---

## 公開範囲についての注意

- GitHub Pages を無料で使うため、このリポジトリは**公開**です。
- `seed/` の内容（予定日、病院名、タスクの文面など）はリポジトリと配信される JS に含まれるため、
  **URL を知っている人は誰でも読めます**。
- 2人が入力したデータ（タスクの状態、メモ、記録、領収書の金額など）は Firestore にあり、
  許可した2つの UID 以外は読めません。
- 領収書の写真は、撮影した端末の中にだけ保存されます（クラウドにも相手の端末にも送られません）。

---

## セットアップ手順（人間が行う作業）

必要なもの：Node.js 22 以上、Google アカウント2つ（父・母）、GitHub アカウント。
クレジットカードの登録は不要です。求められた場合は手順を止めてください（有料プランは使いません）。

### 1. Firebase プロジェクトを作る

1. [Firebase コンソール](https://console.firebase.google.com/) でプロジェクトを作成する（プランは **Spark（無料）** のまま）。
2. **Authentication** →「始める」→ ログイン方法で **Google** を有効にする（他のプロバイダは有効にしない）。
3. **Firestore Database** →「データベースの作成」
   - モード：**本番環境モード**（テストモードにしない）
   - ロケーション：**asia-northeast1**
4. Storage・Functions・Hosting などは使いません。有効にしないでください。

### 2. 設定値を `.env.local` に書く

1. Firebase コンソール → プロジェクトの設定 → 全般 → マイアプリ →「ウェブアプリを追加」。
2. 表示された設定値を `.env.local` に書き写す。

```bash
cp .env.local.example .env.local
```

`.env.local` の `VITE_FIREBASE_*` に値を入れます（入力箇所は `.env.local.example` のコメントを参照）。
`.env.local` は Git に入りません。

### 3. 2人がログインして UID を控える

```bash
npm install
```

```bash
npm run dev
```

1. 表示された URL をブラウザで開き、父の Google アカウントでログインする。
2. まだルールに UID が入っていないので「このアカウントは許可されていません」と表示されます。
   画面の **「あなたの UID」** を控える（コピーボタンあり）。
3. ログアウトし、母の Google アカウントでも同じことをする。

### 4. ルールに UID を入れて反映する

`.env.local` に2つの UID をカンマ区切りで書きます。

```
VITE_ALLOWED_UIDS=父のUID,母のUID
```

```bash
npm run rules
```

`firestore.rules` が生成されます（UID は必ず2つ。1つや3つではエラーになります）。
続けて、表示されたコマンドでルールを反映します。初回は Google アカウントでのログインを求められます。

```bash
npx firebase-tools login
```

```bash
npx firebase-tools deploy --only firestore:rules --project <FirebaseのプロジェクトID>
```

反映後にアプリを開き直すと、初回だけ seed（タスク173件・予定42件）が Firestore に投入されます。
その後「あなたはどちらですか？」で父／母を選びます。

### 5. GitHub に置いて公開する

1. GitHub にリポジトリ `couple-app` を作り、`main` に push する。
2. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする。
3. **Settings → Secrets and variables → Actions → Variables** に、`.env.local` と同じ値を登録する。
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`

   `VITE_ALLOWED_UIDS` は登録不要です（ルールの生成にだけ使います）。
4. `main` に push すると、Actions がテスト → ビルド → Pages へのデプロイを行います。
5. Firebase コンソール → Authentication → 設定 → **承認済みドメイン** に `<GitHubのユーザー名>.github.io` を追加する。

リポジトリ名を `couple-app` 以外にした場合、Actions のビルドは自動でその名前に合わせます。
手元で `npm run build` するときは [vite.config.ts](vite.config.ts) の `REPO_NAME` を直してください。

### 6. スマホのホーム画面に追加する

`https://<GitHubのユーザー名>.github.io/couple-app/` をスマホで開きます。

- **iPhone（Safari）**：共有ボタン →「ホーム画面に追加」
- **Android（Chrome）**：画面の案内、またはメニュー →「ホーム画面に追加」

iPhone では、**先に Safari でログインを済ませてから**ホーム画面に追加してください。
ホーム画面のアプリ内でログイン画面が開かない場合は、Safari で開いてログインし直します。

---

## 完了条件の確認（実機で行う）

次の3つは、実際の Firebase プロジェクトとスマホ2台が必要なため、セットアップ後に確認してください。

| # | 確認すること | 手順 | 期待する結果 |
|---|---|---|---|
| 1 | 3秒以内の同期 | 2台でそれぞれ父・母としてログインし、片方でタスクを完了にする | もう片方の画面に3秒以内に反映される。ホームの「相手の更新」にも出る |
| 2 | オフライン | 一度オンラインで開いた後、機内モードにしてアプリを開く。タスクを1つ完了にする。機内モードを解除する | 機内モード中もタスク・予定・アドバイスが見える。解除後、完了が相手の端末に届く |
| 3 | 許可していないアカウント | 3つ目の Google アカウントでログインする | 「このアカウントは許可されていません」と表示され、データは何も表示されない |

---

## 開発用コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー（Firebase に接続） |
| `npm run dev:demo` | デモモード。Firebase に接続せず、seed をブラウザ内に入れて画面を確認する |
| `npm test` | 単体テスト（Vitest） |
| `npm run lint` | lint（oxlint） |
| `npm run build` | 本番ビルド（`dist/`） |
| `npm run preview` | ビルド結果の確認（`http://localhost:4173/couple-app/`） |
| `npm run rules` | `.env.local` の UID から `firestore.rules` を生成 |
| `npm run icons` | PWA アイコンを生成 |

確認用のスクリプト（端末に入っている Chrome / Edge を使います）：

| コマンド | 前提 | 内容 |
|---|---|---|
| `node scripts/e2e-demo.mjs` | `npm run dev:demo -- --port 5183` | 一連の操作の自動確認 |
| `node scripts/audit-ui.mjs` | 同上 | 全画面をライト／ダークで開き、コントラスト・タップ領域・はみ出しを検査 |
| `node scripts/screenshot.mjs` | 同上 | 375×812 のスクリーンショットを `screenshots/` に保存 |
| `node scripts/check-pwa.mjs` | `npm run build` → `npm run preview` | インストール可否とオフライン表示の確認 |

デモモードでは、URL に `?as=mother` / `?as=father` を付けると母／父として表示できます。
`?as=stranger` は「許可していないアカウント」の再現です（データは表示されません）。

---

## 画面

| 画面 | パス | 内容 |
|---|---|---|
| ホーム | `/` | 週数、期限まで7日以内、今週のアドバイス、相手の更新 |
| スケジュール | `/schedule` | 月／リスト切替、父の所在、期間の帯、予定の追加 |
| タスク | `/tasks` | フェーズ×カテゴリ、絞り込み、進捗、編集 |
| アドバイス | `/advice` | 週数連動、タグ、既読・ピン留め |
| 記録 | `/records` | 体重・血圧・胎動、償還払いファイル |
| 設定 | `/settings` | 予定日、出生日、窓口、UID、エクスポート |

## データモデル（Firestore）

```
/households/main
  settings: { edd, lmp, birthDate, prePregnancyWeightKg, heightCm, motherName, fatherName, babyName, contacts }
  members:  { [uid]: { role: "father"|"mother", displayName } }
  seededAt
/households/main/tasks/{taskId}
/households/main/events/{eventId}
/households/main/presence/{yyyy-mm-dd}
/households/main/records/{recordId}
/households/main/receipts/{receiptId}
/households/main/adviceState/{uid}
```

## 日付の計算

- 週数は**出産予定日（EDD）を基準**に計算します（EDD の 280 日前を 0週0日とする）。
  EDD を変更すると、週数・予定の日付・アドバイスがすべて再計算されます。
- seed の予定は EDD からの相対日数（`offsetDays`）で持ち、表示時に日付へ変換します。
- 出生日を入力すると産後の表示に切り替わり、産後の予定（`offsetDays` が正のもの）は
  出生日を基準に再計算されます。
- 予定の日付を手で変更すると、その予定は固定の日付になり、EDD を変えても動かなくなります。

## seed の扱い

- `seed/` の4ファイルは書き換えていません。金額・期限・週数は seed の値をそのまま表示します。
- `seed/ninpu_limits.json`（妊婦健診の受診票ごとの上限額）は、利用者から受領した値を追加したものです。
- 数値を更新するときは、seed ファイルを修正し、出典を併記してください。
- 資料で「要確認」の項目には「未確認」の表示を付けています（[src/data/unconfirmed.ts](src/data/unconfirmed.ts)）。
  確認が済んだら、その一覧から外してください。

## 指示書のデータモデルに追加した項目

| 項目 | 理由 |
|---|---|
| `settings.birthDate` | 出生日入力後の切替（指示書 8-2）に必要 |
| `settings.babyName` | 「母子の名前（表示用）」（指示書 2.7） |
| `tasks.lastAction` | 「相手の更新」で、完了・編集・追加・削除を正しく言い分けるため |
| `events.done` | 重要な予定を「済み」にしてホームから外すため |
| `events.deleted` / `receipts.deleted` | 論理削除のため |
| `household.seededAt` | 初回投入の記録 |

## 守っていること

- 有料の API・プラン、クレジットカード登録が必要な設定は使っていません。
- 保険証番号・口座番号・住所を入力する欄はありません。
- プッシュ通知・メール送信・外部カレンダー連携はありません。
