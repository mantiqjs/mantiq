import { describe, it, expect } from 'bun:test'
import { MantiqResponse, ResponseBuilder } from '../../src/http/Response.ts'

describe('MantiqResponse', () => {
  it('json: returns JSON response with correct content-type', async () => {
    const res = MantiqResponse.json({ ok: true })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual({ ok: true })
  })

  it('json: supports custom status code', () => {
    const res = MantiqResponse.json({ error: 'not found' }, 404)
    expect(res.status).toBe(404)
  })

  it('html: returns HTML response', async () => {
    const res = MantiqResponse.html('<h1>Hello</h1>')
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toBe('<h1>Hello</h1>')
  })

  it('redirect: returns redirect with Location header', () => {
    const res = MantiqResponse.redirect('/dashboard', 302)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/dashboard')
  })

  it('noContent: returns 204', () => {
    const res = MantiqResponse.noContent()
    expect(res.status).toBe(204)
  })

  it('download: sets Content-Disposition header', () => {
    const res = MantiqResponse.download('data', 'file.txt', 'text/plain')
    expect(res.headers.get('content-disposition')).toContain('file.txt')
    expect(res.headers.get('content-type')).toBe('text/plain')
  })
})

describe('ResponseBuilder', () => {
  it('status: sets status code', () => {
    const res = new ResponseBuilder().status(201).json({ created: true })
    expect(res.status).toBe(201)
  })

  it('header: sets custom header', () => {
    const res = new ResponseBuilder().header('X-Custom', 'value').json({})
    expect(res.headers.get('x-custom')).toBe('value')
  })

  it('withHeaders: sets multiple headers', () => {
    const res = new ResponseBuilder()
      .withHeaders({ 'X-A': '1', 'X-B': '2' })
      .json({})
    expect(res.headers.get('x-a')).toBe('1')
    expect(res.headers.get('x-b')).toBe('2')
  })

  it('cookie: sets Set-Cookie header', () => {
    const res = new ResponseBuilder()
      .cookie('session', 'abc123', { httpOnly: true, path: '/' })
      .json({})
    const cookie = res.headers.get('set-cookie')
    expect(cookie).toContain('session')
    expect(cookie).toContain('HttpOnly')
  })

  it('html: returns HTML with status and headers', () => {
    const res = new ResponseBuilder().status(201).html('<p>created</p>')
    expect(res.status).toBe(201)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('redirect: sets Location header', () => {
    const res = new ResponseBuilder().redirect('/home')
    expect(res.headers.get('location')).toBe('/home')
    expect(res.status).toBe(302)
  })

  // ── Security: open redirect prevention (#122) ──────────────────────────────

  it('redirect: rejects protocol-relative URLs', () => {
    expect(() => new ResponseBuilder().redirect('//evil.com/steal')).toThrow(/protocol-relative/)
  })

  it('redirect: rejects javascript: scheme', () => {
    expect(() => new ResponseBuilder().redirect('javascript:alert(1)')).toThrow(/dangerous scheme/)
  })

  it('redirect: rejects data: scheme', () => {
    expect(() => new ResponseBuilder().redirect('data:text/html,<h1>hi</h1>')).toThrow(/dangerous scheme/)
  })
})

// ── Security: MantiqResponse.redirect open redirect prevention (#122) ────────

describe('MantiqResponse redirect security', () => {
  it('allows relative paths', () => {
    const res = MantiqResponse.redirect('/dashboard')
    expect(res.headers.get('location')).toBe('/dashboard')
  })

  it('allows same-origin https URL', () => {
    const res = MantiqResponse.redirect('https://myapp.com/home')
    expect(res.headers.get('location')).toBe('https://myapp.com/home')
  })

  it('rejects protocol-relative URL (//evil.com)', () => {
    expect(() => MantiqResponse.redirect('//evil.com')).toThrow(/protocol-relative/)
  })

  it('rejects javascript: scheme', () => {
    expect(() => MantiqResponse.redirect('javascript:alert(document.cookie)')).toThrow(/dangerous scheme/)
  })

  it('rejects data: scheme', () => {
    expect(() => MantiqResponse.redirect('data:text/html,<script>alert(1)</script>')).toThrow(/dangerous scheme/)
  })

  it('rejects vbscript: scheme', () => {
    expect(() => MantiqResponse.redirect('vbscript:MsgBox("XSS")')).toThrow(/dangerous scheme/)
  })

  it('rejects ftp: scheme', () => {
    expect(() => MantiqResponse.redirect('ftp://evil.com/file')).toThrow(/only http and https/)
  })

  it('is case-insensitive for dangerous schemes', () => {
    expect(() => MantiqResponse.redirect('JAVASCRIPT:alert(1)')).toThrow(/dangerous scheme/)
  })
})
