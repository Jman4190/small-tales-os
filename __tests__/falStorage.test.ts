import { uploadToFal } from '../lib/falStorage'
import { fal } from '@fal-ai/client'
import { exponentialBackoff } from '../lib/exponentialBackoff'

jest.mock('@fal-ai/client', () => ({
  fal: { storage: { upload: jest.fn() } }
}))

jest.mock('../lib/exponentialBackoff', () => ({
  exponentialBackoff: jest.fn(() => Promise.resolve())
}))

const mockedUpload = fal.storage.upload as jest.Mock
const mockedBackoff = exponentialBackoff as jest.Mock

describe('uploadToFal', () => {
  beforeEach(() => {
    mockedUpload.mockReset()
    mockedBackoff.mockClear()
  })

  it('retries on transient network error and succeeds', async () => {
    mockedUpload
      .mockRejectedValueOnce({ code: 'ECONNRESET' })
      .mockResolvedValueOnce('url')

    const result = await uploadToFal({} as File)
    expect(result).toBe('url')
    expect(mockedUpload).toHaveBeenCalledTimes(2)
    expect(mockedBackoff).toHaveBeenCalledTimes(1)
  })

  it('does not retry on validation error', async () => {
    mockedUpload.mockRejectedValueOnce({
      message: 'fail',
      response: { status: 422, data: { type: 'file_too_large' } }
    })

    await expect(uploadToFal({} as File)).rejects.toThrow(
      JSON.stringify({ type: 'file_too_large', status: 422, message: 'fail' })
    )
    expect(mockedUpload).toHaveBeenCalledTimes(1)
    expect(mockedBackoff).not.toHaveBeenCalled()
  })

  it('retries on 5xx response and fails after max attempts', async () => {
    mockedUpload.mockRejectedValue({
      message: 'oops',
      response: { status: 500, data: { type: 'server_error' } }
    })

    await expect(uploadToFal({} as File)).rejects.toThrow(
      JSON.stringify({ type: 'server_error', status: 500, message: 'oops' })
    )
    expect(mockedUpload).toHaveBeenCalledTimes(2)
    expect(mockedBackoff).toHaveBeenCalledTimes(1)
  })
})
