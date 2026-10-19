import InjectEventDialog from '@/components/InjectEventDialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Deliveries from './Deliveries'
import Events from './Events'
import Rules from './Rules'
import Sources from './Sources'
import Users from './Users'

const tabs = [
  { value: 'users', label: 'Users', content: <Users /> },
  { value: 'rules', label: 'Rules', content: <Rules /> },
  { value: 'events', label: 'Events', content: <Events /> },
  { value: 'deliveries', label: 'Deliveries', content: <Deliveries /> },
  { value: 'sources', label: 'Sources', content: <Sources /> },
]

export default function AdminLayout() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <InjectEventDialog />
      </div>
      <Tabs defaultValue="users">
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value}>{t.content}</TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
