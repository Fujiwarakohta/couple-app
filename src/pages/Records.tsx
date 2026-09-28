import { useSearchParams } from 'react-router-dom'
import { Page } from '../components/Layout'
import { Choice } from '../components/ui'
import { BodyRecords } from './records/Body'
import { Receipts } from './records/Receipts'

type Tab = 'body' | 'receipts'

const TAB_OPTIONS = [
  { value: 'body', label: '体重・血圧・胎動' },
  { value: 'receipts', label: '償還払いファイル' },
] as const

export default function Records() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'receipts' ? 'receipts' : 'body'

  const change = (next: Tab) => {
    const p = new URLSearchParams(params)
    p.set('tab', next)
    setParams(p, { replace: true })
  }

  return (
    <Page title="記録">
      <Choice legend="記録の切り替え" hideLegend options={TAB_OPTIONS} value={tab} onChange={change} />
      {tab === 'body' ? <BodyRecords /> : <Receipts />}
    </Page>
  )
}
