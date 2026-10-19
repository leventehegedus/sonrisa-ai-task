import { useState } from 'react'
import { toast } from 'sonner'
import { errorText, useInjectEventMutation } from '@/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import type { Category } from '@/types'

export default function InjectEventDialog() {
  const [inject, { isLoading }] = useInjectEventMutation()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<Category>('news')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [url, setUrl] = useState('')
  const [country, setCountry] = useState('')
  const [severity, setSeverity] = useState(0.5)
  const [error, setError] = useState<string>()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)
    const body = {
      category, title: title.trim(), severity,
      ...(summary.trim() && { summary: summary.trim() }),
      ...(url.trim() && { url: url.trim() }),
      ...(country.trim() && { country: country.trim().toUpperCase() }),
    }
    try {
      const r = await inject(body).unwrap()
      toast.success(`${r.deliveriesCreated} deliveries created`)
      setOpen(false)
      setTitle(''); setSummary(''); setUrl(''); setCountry('')
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Inject event</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inject event</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(c) => setCategory(c as Category)}>
              <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['news', 'market', 'disaster'].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inject-title">Title</Label>
            <Input id="inject-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inject-summary">Summary</Label>
            <Input id="inject-summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inject-url">URL</Label>
            <Input id="inject-url" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inject-country">Country (ISO2)</Label>
            <Input id="inject-country" maxLength={2} placeholder="blank = global" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Severity: {severity.toFixed(2)}</Label>
            <Slider aria-label="Severity" min={0} max={1} step={0.05} value={[severity]} onValueChange={([v]) => setSeverity(v)} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>Inject</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
