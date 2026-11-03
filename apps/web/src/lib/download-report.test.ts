import { http, HttpResponse } from 'msw'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest'

import { API_URL } from '@/lib/api-url'

import { server } from '../mocks/server'
import { buildReportFilename, downloadReport } from './download-report'

const REPORT_URL = `${API_URL}/reports/test`

describe('buildReportFilename', () => {
  afterEach(() => vi.useRealTimers())

  it('appends today’s date and the .pdf extension', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-07T10:00:00.000Z'))
    expect(buildReportFilename('audit-log')).toBe('audit-log-2026-03-07.pdf')
  })
})

describe('downloadReport', () => {
  let clickSpy: MockInstance<HTMLAnchorElement['click']>

  // The anchor downloadReport clicked (the `this` of the click call).
  const clickedAnchor = () =>
    clickSpy.mock.contexts[0] as HTMLAnchorElement | undefined

  beforeEach(() => {
    // jsdom implements neither object URLs nor anchor-driven downloads.
    URL.createObjectURL = vi.fn(() => 'blob:report')
    URL.revokeObjectURL = vi.fn()
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
  })

  afterEach(() => vi.restoreAllMocks())

  it('requests the report with only the defined filters as query params', async () => {
    let requestUrl: URL | undefined
    server.use(
      http.get(REPORT_URL, ({ request }) => {
        requestUrl = new URL(request.url)
        return new HttpResponse(new Blob(['%PDF']), {
          headers: { 'Content-Type': 'application/pdf' },
        })
      })
    )

    await downloadReport(
      '/reports/test',
      { action: 'create', resource: undefined, userId: 'user-1' },
      'report.pdf'
    )

    expect(Object.fromEntries(requestUrl!.searchParams)).toEqual({
      action: 'create',
      userId: 'user-1',
    })
  })

  it('sends the session cookie', async () => {
    let credentials: RequestCredentials | undefined
    server.use(
      http.get(REPORT_URL, ({ request }) => {
        credentials = request.credentials
        return new HttpResponse(new Blob(['%PDF']))
      })
    )
    await downloadReport('/reports/test', {}, 'report.pdf')
    expect(credentials).toBe('include')
  })

  it('triggers a download with the given filename and frees the object URL', async () => {
    server.use(http.get(REPORT_URL, () => new HttpResponse(new Blob(['%PDF']))))

    await downloadReport('/reports/test', {}, 'audit-log-2026-03-07.pdf')

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(clickedAnchor()?.href).toBe('blob:report')
    expect(clickedAnchor()?.download).toBe('audit-log-2026-03-07.pdf')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report')
  })

  it('throws with the status and response body when the API fails', async () => {
    server.use(
      http.get(
        REPORT_URL,
        () => new HttpResponse('Too many rows', { status: 422 })
      )
    )

    await expect(
      downloadReport('/reports/test', {}, 'report.pdf')
    ).rejects.toThrow('Failed to generate report (422: Too many rows)')
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it('throws with the status only when the error body is empty', async () => {
    server.use(
      http.get(REPORT_URL, () => new HttpResponse(null, { status: 500 }))
    )

    await expect(
      downloadReport('/reports/test', {}, 'report.pdf')
    ).rejects.toThrow(/^Failed to generate report \(500\)$/)
  })
})
