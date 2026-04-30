import { describe, it, expect } from 'vitest'
import { musicKeys } from '@/hooks/use-music'
import { listsKeys } from '@/hooks/use-lists'
import { dashboardKeys, filtersKeys } from '@/hooks/use-dashboard'

describe('musicKeys', () => {
  it('all should be stable reference', () => {
    expect(musicKeys.all).toEqual(['music'])
  })

  it('lists should extend all', () => {
    expect(musicKeys.lists()).toEqual(['music', 'list'])
  })

  it('list should include filters and pagination', () => {
    const filters = { query: 'test' }
    const pagination = { page: 1, limit: 20 }
    const key = musicKeys.list(filters, pagination)
    expect(key).toEqual(['music', 'list', { filters, pagination }])
  })

  it('infiniteList should include infinite marker', () => {
    const filters = { query: 'test' }
    const pagination = { limit: 20, sort_by: 'upload_date', sort_order: 'desc' }
    const key = musicKeys.infiniteList(filters, pagination)
    expect(key).toEqual(['music', 'list', 'infinite', { filters, pagination }])
  })

  it('detail should include id', () => {
    expect(musicKeys.detail(42)).toEqual(['music', 'detail', 42])
  })

  it('different filters should produce different keys', () => {
    const key1 = musicKeys.list({ query: 'a' }, { page: 1, limit: 20 })
    const key2 = musicKeys.list({ query: 'b' }, { page: 1, limit: 20 })
    expect(key1).not.toEqual(key2)
  })
})

describe('listsKeys', () => {
  it('all should be stable', () => {
    expect(listsKeys.all).toEqual(['lists'])
  })

  it('lists should extend all', () => {
    expect(listsKeys.lists()).toEqual(['lists', 'list'])
  })

  it('detail should include id', () => {
    expect(listsKeys.detail(5)).toEqual(['lists', 'detail', 5])
  })

  it('list should include pagination and search', () => {
    const key = listsKeys.list({ page: 2, limit: 10 }, 'test')
    expect(key).toEqual(['lists', 'list', { pagination: { page: 2, limit: 10 }, search: 'test' }])
  })
})

describe('dashboardKeys', () => {
  it('stats should extend all', () => {
    expect(dashboardKeys.stats()).toEqual(['dashboard', 'stats'])
  })

  it('topArtists should extend all', () => {
    expect(dashboardKeys.topArtists()).toEqual(['dashboard', 'topArtists'])
  })

  it('topSongsByCategory should include category', () => {
    expect(dashboardKeys.topSongsByCategory('entrada')).toEqual(['dashboard', 'topSongs', 'entrada'])
  })
})

describe('filtersKeys', () => {
  it('categories should extend all', () => {
    expect(filtersKeys.categories()).toEqual(['filters', 'categories'])
  })

  it('customFilterGroups should extend all', () => {
    expect(filtersKeys.customFilterGroups()).toEqual(['filters', 'customFilterGroups'])
  })
})
