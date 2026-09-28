# 指示書：夫婦共有 妊娠〜育児アプリ（Claude Code 向け）

この文書を Claude Code に渡し、`seed/` ディレクトリと同じ場所に置いて作業させる。

---

## 0. 結論（先に決めること）

| 項目 | 決定 |
|---|---|
| 形態 | PWA（スマホのホーム画面に追加して使う Web アプリ） |
| フロント | Vite + React + TypeScript + Tailwind CSS |
| データ同期 | **Firebase（Spark 無料プラン）**：Firestore + Authentication（Google ログイン） |
| ホスティング | **GitHub Pages**（無料・静的） |
| 認可 | Firestore セキュリティルールで **許可した2つの Google アカウントの UID のみ** 読み書き可 |
| オフライン | Firestore の永続キャッシュを有効化（機内・実家の電波が弱い場所でも閲覧可） |
| コスト | 0円。Spark プランの無料枠（Firestore 読取 5万/日、書込 2万/日、1GiB）は2人利用で到達しない |
| 通知 | プッシュ通知は **実装しない**（iOS PWA の制約とコストを避ける）。代替として「今日・今週の期限」を起動時のトップに表示 |

### 採用しない選択肢と理由

| 案 | 不採用理由 |
|---|---|
| localStorage のみ | 端末間で共有できない |
| Supabase | 無料枠はあるが、1週間非アクティブでプロジェクトが停止する。妊娠期間は長期にわたるため不向き |
| Google スプレッドシート＋GAS | 認可・UI の作り込みに工数がかかり、PWA としての体験が劣る |
| Notion | 二人で共有は可能だが、週数連動やタスクの自動整理ができない |
| ネイティブアプリ | App Store 配布に開発者登録費（年額）が必要 |

---

## 1. ユーザー・利用文脈

- 利用者は **2名固定**（父・母）。他人に公開しない。
- 主端末はスマホ（iPhone / Android）。PC はほぼ使わない。**画面幅 375px を基準**に設計。
- 父は石垣島と石川県を往復する。機内・移動中のオフライン閲覧が発生する。
- 母は産後、片手・暗所・短時間で操作する。**タップ領域は最小 44px、コントラスト比 4.5:1 以上、ダークモード対応**。
- 前提となる日付：最終月経日（LMP）2026-08-17、出産予定日（EDD）2027-05-24。**EDD はアプリ内で変更可能**にし、変更時に週数連動の全表示を再計算する。
- 医療機関：石垣は沖縄県立八重山病院、分娩は医療法人社団恵愛会 松南病院（石川県白山市若宮3-63。分娩予約不要・初診は電話予約・34週頃までに受診）。33〜34週で帰省。
- 別添の調査報告書（docx）の内容は seed に反映済み。報告書の妊婦健診償還上限額の表は石垣市公式PDFと受診票区分の対応が一部異なるため、**seed は公式PDFの値を採用**している。

---

## 2. 機能要件

### 2.1 ホーム（起動時）

1. 現在の妊娠週数・日数（例：`14週3日`）、出産予定日までの日数、産後は生後日数・月齢。
2. **「期限まで7日以内」の未完了タスクとイベント**を最上部に赤系で表示。`critical:true` のイベントは期限超過後も消さない。
3. 今週のアドバイス（`advice.json` から現在週数に該当するものを最大3件、既読はたたむ）。
4. 相手が直近24時間に更新したタスク（「妻がt042を完了にしました」形式）。

### 2.2 スケジュール

- **表示単位**：月カレンダー／リスト（時系列）の2モード。
- データは `seed/schedule.json` の `events`（42件）を初期投入。各イベントは EDD からの `offsetDays` を持ち、**表示時に EDD を基準に絶対日付を算出**する。`window` は幅（日数）で、期間として描く。
- ユーザーが追加するイベント（健診予約、航空券、面会など）は絶対日付で保存。
- フィールド：`title, date（またはoffsetDays）, window, owner（母/父/両）, place, type（medical/admin/money/work/travel/class/milestone）, memo, fatherAttend（父同伴フラグ）`。
- **父の所在**を日単位で記録できるレーン（石垣／石川／京都／その他）。スケジュール上部に帯で表示。
- 「石川滞在」「島外出張なし期間」「正期産期間」を背景色で帯表示。

### 2.3 タスク

- 初期データは `seed/tasks.json`（169件）。フィールド：

| フィールド | 内容 |
|---|---|
| `id` | 固定ID |
| `phase` | p0〜p8（`seed/phases.json` 参照） |
| `category` | `procedure`（行政・医療・労務手続き）/ `money`（保険・補助金・お金）/ `health`（からだ・栄養）/ `prep`（準備・民間優待）/ `father_work`（父の稼働設計） |
| `owner` | 母／父／両 |
| `title` | タスク本文 |
| `dueHint` | 期限の文字表記（元資料の記述） |
| `dueDate` | ユーザーが設定する絶対期限（null 可） |
| `status` | `todo` / `doing` / `done` / `na`（該当なし） |
| `note` | 自由記述（窓口で確認した結果、金額、担当者名など） |
| `updatedAt, updatedBy` | 同期用 |

- 表示：フェーズ → カテゴリの2階層。フィルタは「担当（母／父／両）」「カテゴリ」「未完了のみ」。
- 編集：タイトル・期限・担当・ステータス・メモを変更可。**新規タスクの追加、削除（論理削除）**も可。
- **カテゴリ `procedure` と `money` は、窓口・電話番号・必要書類を `note` テンプレートとして表示**（下記 2.6 の窓口マスタを参照させる）。
- 進捗バーはフェーズ別と全体。`na` は分母から除外。

### 2.4 アドバイス

- `seed/advice.json` を週数レンジで出し分ける。カテゴリタグ：栄養／体重／運動／医療／症状／生活／移動／里帰り／手続き／産後／父。
- 各項目に `source`（出典）を必ず表示。**数値は seed の値をそのまま表示し、アプリ側で丸めない**。
- 「既読」「ピン留め」をユーザー単位で保持。
- 「父向け」タグの項目は父のログイン時にホームで優先表示。
- 免責を固定文で表示：「一般情報です。主治医の指示を優先してください。制度・金額は各機関の最新情報を確認してください。」

### 2.4b 償還払いファイル（証憑管理）

里帰り先で自費払いした費用を、帰島後に石垣市へ一括申請するための台帳。

- 種別：`妊婦健診` / `産婦健診` / `新生児聴覚検査` / `予防接種` / `こども医療費（県外）` / `その他`。
- 各レコード：日付、施設、金額、受診票番号（妊婦健診のみ：1〜5、9-1〜9-9）、**3点セットの有無チェック**（領収書原本／診療明細書／医師記入済み受診票）、EPDS実施チェック（産婦健診のみ）、依頼書取得チェック（予防接種のみ）、写真（端末内保存）。
- 申請期限を種別ごとに自動計算して表示：健診・聴覚検査＝最終受診日から1年、予防接種＝接種後6か月、こども医療費＝受診月の翌月から2年。
- 妊婦健診は受診票番号ごとの石垣市上限額（seed の値）を表示し、実費と上限の小さい方を「見込み返金額」として合計する。

### 2.5 記録（軽量）

- 母の体重（週1）、血圧（任意）、胎動メモ。折れ線グラフで体重増加の目安レンジ（妊娠前BMIから算出）を背景に重ねる。
- 妊娠前体重・身長は設定画面で入力。
- 領収書写真は 2.4b の償還払いファイルに属する。写真は Firebase Storage を使わず、**端末内にのみ保存（IndexedDB）**し、金額・日付・施設名など文字情報のみ Firestore に同期する（Storage の無料枠・公開設定リスクを避ける）。

### 2.6 窓口マスタ（静的）

以下をアプリ内に定数として持ち、タスク・イベントから参照できるようにする。

| 窓口 | 電話 | 対象 |
|---|---|---|
| 石垣市健康福祉センター 健康づくり係／地域保健係 | 0980-88-0088 | 妊娠届、妊婦健診・産婦健診（償還払い）、支援給付金、産後ケア、離島通院費助成 |
| 石垣市こども家庭課 給付係 | 0980-87-0771 | こども医療費助成、児童手当（マイナポータル電子申請も可） |
| 恵愛会松南病院 | （設定画面で入力） | 分娩、初診の電話予約、直接支払制度、出産手当金の医師記入、新生児聴覚検査 |
| 沖縄県立八重山病院 | （設定画面で入力） | 初診・妊婦健診、松南病院宛の紹介状 |
| 白山市いきいき健康課 | 076-274-2155 | 里帰り中の母子保健の相談 |
| 白山市子育て支援課 | 076-274-9575 | 里帰り中の子育て支援の相談 |
| 母の勤務先 人事 | （設定画面で入力） | 産休・育休・出産手当金・育休給付 |
| 父の会社 総務 | （設定画面で入力） | 子の健保加入 |

電話番号は `tel:` リンクにする。

### 2.7 設定

- EDD・LMP・妊娠前体重・身長・母子の名前（表示用）・上記の窓口の空欄。
- 「相手の UID」を表示（セキュリティルール設定のために使う）。
- データのエクスポート（JSON ダウンロード）。

---

## 3. 非機能要件

- **PWA**：`manifest.json`、Service Worker（Workbox）、ホーム画面追加の案内バナー（iOS Safari は「共有→ホーム画面に追加」の手順を表示）。
- **オフライン**：Firestore `persistentLocalCache` を有効化。オフライン中の編集はキューされ、復帰時に同期。競合は「最後の書き込み優先」で良い（2人利用）。
- **表示速度**：初回ロード 200KB 以下（gzip）を目標。グラフは軽量ライブラリ（`recharts` 不可なら SVG 手描き）。
- **言語**：日本語のみ。日付は `2027-05-24（月）` 形式、週数は `14w3d` ではなく `14週3日`。
- **アクセシビリティ**：フォーカス可視、`prefers-reduced-motion` 尊重、ボタンに aria-label。
- **セキュリティ**：
  - Firebase の Web API キーは公開前提（制限は Firestore ルールで行う）。
  - Firestore ルール：`request.auth.uid in ['<父UID>', '<母UID>']` の場合のみ `read, write`。それ以外はすべて拒否。
  - Authentication は Google プロバイダのみ。**新規ユーザーの自己登録が意味を持たないよう、ルール側で UID 固定**にする。
  - 個人情報（住所・保険証番号・口座番号）は入力欄を設けない。

---

## 4. データモデル（Firestore）

```
/households/{householdId}
  settings: { edd, lmp, prePregnancyWeightKg, heightCm, motherName, fatherName, contacts: {...} }
  members: { [uid]: { role: "father"|"mother", displayName } }

/households/{householdId}/tasks/{taskId}
  { phase, category, owner, title, dueHint, dueDate, status, note, deleted, updatedAt, updatedBy, createdBy }

/households/{householdId}/events/{eventId}
  { title, offsetDays|date, window, owner, place, type, memo, fatherAttend, critical, updatedAt, updatedBy }

/households/{householdId}/presence/{yyyy-mm-dd}
  { father: "ishigaki"|"ishikawa"|"kyoto"|"other" }

/households/{householdId}/records/{recordId}
  { kind: "weight"|"bp"|"movement", date, value, memo, updatedBy }

/households/{householdId}/receipts/{receiptId}
  { kind: "ninpu"|"sanpu"|"hearing"|"vaccine"|"kodomo_iryo"|"other", date, facility, amountYen,
    ticketNo, hasReceipt, hasStatement, hasTicketFilled, epdsDone, requestLetterObtained,
    deadline, claimedAt, updatedBy }

/households/{householdId}/adviceState/{uid}
  { read: [adviceId...], pinned: [adviceId...] }
```

`householdId` は固定文字列で良い（1世帯のみ）。

---

## 5. 初期投入（シード）

1. `seed/phases.json`、`seed/tasks.json`、`seed/schedule.json`、`seed/advice.json` を読み込む。
2. `tasks.json` と `schedule.json` は **初回ログイン時に Firestore へ一括投入**（既に存在すれば投入しない）。`advice.json` と `phases.json` は静的にバンドル。
3. seed の日付は EDD=2027-05-24 基準。`schedule.json` の `edd` を `settings.edd` の初期値に使う。

---

## 6. 画面一覧

| 画面 | パス | 主要要素 |
|---|---|---|
| ホーム | `/` | 週数、期限7日以内、今週のアドバイス、相手の更新 |
| スケジュール | `/schedule` | 月／リスト切替、父の所在帯、イベント追加 |
| タスク | `/tasks` | フェーズ×カテゴリ、フィルタ、進捗、編集モーダル |
| アドバイス | `/advice` | 週数連動、タグフィルタ、既読・ピン |
| 記録 | `/records` | 体重グラフ、領収書一覧 |
| 設定 | `/settings` | EDD、窓口、UID、エクスポート |

下部タブナビ 5つ（ホーム／予定／タスク／助言／記録）。設定はホーム右上。

---

## 7. デザイン指針

- **1画面1目的**。ホームは「今日やること」だけが見えれば良い。
- 色：ベースは白／ダークグレー、担当色は 母＝ローズ系、父＝ブルー系、両＝グリーン系（既存 HTML チェックリストと同一）。期限警告は赤（アクセントは1色）。
- フォント：システムフォント（Hiragino Sans / Noto Sans JP）。Web フォント読込は行わない。
- 装飾のアニメーションは入れない。状態変化（完了チェック）のみ短いトランジション。

---

## 8. 実装手順（Claude Code が実行する順）

1. `npm create vite@latest couple-app -- --template react-ts`、Tailwind、`firebase`、`react-router-dom`、`vite-plugin-pwa`、`date-fns` を導入。
2. `src/lib/dates.ts`：LMP／EDD から週数・日数・生後日数を返す純関数と単体テスト（Vitest）。**境界：EDD 当日、EDD 超過、出生日入力後の切替**。
3. `src/lib/firebase.ts`：初期化、`persistentLocalCache`、Google ログイン。
4. `src/data/seed.ts`：seed JSON の型定義と初回投入ロジック。
5. 画面をホーム → タスク → スケジュール → アドバイス → 記録 → 設定の順で実装。各画面完成ごとにスマホ幅（375×812）でスクリーンショットを取って確認。
6. `firestore.rules` を作成し、UID を環境変数（`.env.local`）から埋め込むスクリプトを用意。
7. PWA 設定（manifest、アイコン 192/512、SW）。
8. GitHub Actions で `main` push 時に `vite build` → `gh-pages` へデプロイ。`vite.config.ts` の `base` をリポジトリ名に設定。
9. README に **セットアップ手順（下記 9）** を記載。

### 完了条件

- 2台のスマホで同じ Google アカウント2つでログインし、片方のタスク完了が他方に3秒以内に反映される。
- 機内モードでアプリを開いてもタスク・予定・アドバイスが閲覧でき、オフラインで完了にしたタスクが復帰後に同期される。
- 許可 UID 以外のアカウントでログインすると、データが一切表示されない。
- Lighthouse（モバイル）：Performance 90 以上、Accessibility 95 以上、PWA インストール可。

---

## 9. 人間側のセットアップ手順（README に記載する内容）

1. Firebase コンソールでプロジェクト作成（Spark プラン）。Authentication で Google を有効化。Firestore をネイティブモードで作成（リージョン asia-northeast1）。
2. Web アプリを追加し、設定値を `.env.local` に転記（`VITE_FIREBASE_*`）。
3. アプリを一度起動して父・母がそれぞれ Google ログイン。設定画面に表示される UID を2つ控える。
4. `.env.local` に `VITE_ALLOWED_UIDS=uid1,uid2` を記入し、`npm run rules` で `firestore.rules` を生成、`firebase deploy --only firestore:rules`。
5. GitHub リポジトリを作成し、`main` に push。Actions が Pages にデプロイ。Firebase Authentication の「承認済みドメイン」に `<user>.github.io` を追加。
6. スマホで URL を開き、ホーム画面に追加。

---

## 10. 禁止事項・注意

- 有料 API、有料プラン、クレジットカード登録を要する設定は使わない。
- 個人の保険証番号・口座番号・住所を保存する欄を作らない。
- seed に含まれる数値（助成上限額、栄養付加量、週数の期限）を独自に書き換えない。更新は seed ファイルの修正として行い、出典を併記する。
- 「妊婦のための遠方の分娩取扱施設への交通費・宿泊費支援」「離島通院費助成の里帰りへの適用」など、資料で「要確認」となっている項目は、タスクの `note` に「未確認」と表示し、確認済みに変わるまで断定表示しない。
- プッシュ通知・メール送信・外部カレンダー連携は初期スコープ外。**Google カレンダーへの `.ics` エクスポート**のみ、余力があれば追加。

---

## 付録：seed ファイル

| ファイル | 内容 | 件数 |
|---|---|---|
| `seed/phases.json` | フェーズ定義（p0〜p8） | 9 |
| `seed/tasks.json` | タスク（行政・医療・労務・保険・補助金・栄養・民間優待・父の稼働） | 173 |
| `seed/schedule.json` | EDD 基準の相対日付イベント | 42 |
| `seed/advice.json` | 週数連動の生活・栄養・移動・手続き・ライフハック（出典付き） | 33 |

いずれも EDD=2027-05-24、石垣市在住（八重山病院で健診）・石川県白山市の恵愛会松南病院で里帰り出産・父は法定休業なしで石垣⇄石川往復、という前提で作成されている。

調査報告書に基づき「確認済み扱い」にしていない項目（アプリ内で「要確認」表示にすること）：新生児聴覚検査助成の上限3,500円、こども医療費（県外）の申請期限2年、無痛分娩の追加費用10万円〜、離島通院費助成の里帰り適用、妊婦歯科健診の有無。
