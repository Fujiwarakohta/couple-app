// .env.local の VITE_ALLOWED_UIDS を firestore.rules に埋め込む。
// 使い方: npm run rules
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv, parseUids, renderRules } from './rules-lib.mjs'

const root = resolve(import.meta.dirname, '..')
const envPath = resolve(root, '.env.local')
const templatePath = resolve(root, 'firestore.rules.template')
const outPath = resolve(root, 'firestore.rules')

try {
  if (!existsSync(envPath)) {
    throw new Error('.env.local がありません。.env.local.example をコピーして作成してください。')
  }
  const env = parseEnv(readFileSync(envPath, 'utf8'))
  const uids = parseUids(env.VITE_ALLOWED_UIDS)
  const rules = renderRules(readFileSync(templatePath, 'utf8'), uids)
  writeFileSync(outPath, rules, 'utf8')

  console.log(`firestore.rules を生成しました（許可 UID ${uids.length} 件）。`)
  const projectId = env.VITE_FIREBASE_PROJECT_ID
  console.log('\n次のコマンドでルールを反映してください:')
  console.log(
    `  npx firebase-tools deploy --only firestore:rules --project ${projectId || '<FirebaseのプロジェクトID>'}`,
  )
} catch (e) {
  console.error(`エラー: ${e.message}`)
  process.exit(1)
}
