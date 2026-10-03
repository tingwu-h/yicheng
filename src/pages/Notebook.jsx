import { Breadcrumb } from '../components/ui'
import ExplorationBoard from '../components/ExplorationBoard'

export default function Notebook() {
  return <div className="container page notebook-page"><Breadcrumb items={[{label:'手札'}]}/><ExplorationBoard/></div>
}
