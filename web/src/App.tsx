import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGetMeQuery } from './api'

export default function App() {
  const { data: me, error, refetch } = useGetMeQuery()

  let text = 'Connecting…'
  if (me) {
    text = `Connected to API as ${me.name} (${me.homeCountry}${me.isAdmin ? ', admin' : ''})`
  } else if (error) {
    const reason = 'status' in error ? `HTTP ${error.status}` : (error.message ?? 'unknown error')
    text = `API not reachable: ${reason}`
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>World Alerts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4">
          <p>{text}</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    </main>
  )
}
