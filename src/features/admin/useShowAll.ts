import { useSearchParams } from 'react-router'

/** "Show all" and the page, in the address: `?show=all&page=2`. */
export function useShowAll() {
  const [params, setParams] = useSearchParams()
  const all = params.get('show') === 'all'
  const page = Math.max(0, Number.parseInt(params.get('page') ?? '0', 10) || 0)
  const set = (next: { all?: boolean; page?: number }) => {
    const search = new URLSearchParams()
    if (next.all ?? all) search.set('show', 'all')
    if ((next.page ?? 0) > 0) search.set('page', String(next.page))
    setParams(search)
  }
  return { all, page, set }
}
