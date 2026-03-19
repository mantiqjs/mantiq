import { describe, test, expect } from 'bun:test'
import { guessMimeType } from '../../src/helpers/mime.ts'

describe('guessMimeType', () => {
  test('detects common image types', () => {
    expect(guessMimeType('photo.jpg')).toBe('image/jpeg')
    expect(guessMimeType('photo.jpeg')).toBe('image/jpeg')
    expect(guessMimeType('icon.png')).toBe('image/png')
    expect(guessMimeType('logo.svg')).toBe('image/svg+xml')
    expect(guessMimeType('banner.webp')).toBe('image/webp')
    expect(guessMimeType('photo.gif')).toBe('image/gif')
    expect(guessMimeType('avatar.avif')).toBe('image/avif')
  })

  test('detects common document types', () => {
    expect(guessMimeType('readme.txt')).toBe('text/plain')
    expect(guessMimeType('page.html')).toBe('text/html')
    expect(guessMimeType('style.css')).toBe('text/css')
    expect(guessMimeType('app.js')).toBe('application/javascript')
    expect(guessMimeType('data.json')).toBe('application/json')
    expect(guessMimeType('doc.pdf')).toBe('application/pdf')
    expect(guessMimeType('notes.md')).toBe('text/markdown')
  })

  test('detects archive types', () => {
    expect(guessMimeType('bundle.zip')).toBe('application/zip')
    expect(guessMimeType('backup.gz')).toBe('application/gzip')
    expect(guessMimeType('archive.tar')).toBe('application/x-tar')
    expect(guessMimeType('files.7z')).toBe('application/x-7z-compressed')
  })

  test('detects font types', () => {
    expect(guessMimeType('font.woff2')).toBe('font/woff2')
    expect(guessMimeType('font.woff')).toBe('font/woff')
    expect(guessMimeType('font.ttf')).toBe('font/ttf')
  })

  test('detects media types', () => {
    expect(guessMimeType('song.mp3')).toBe('audio/mpeg')
    expect(guessMimeType('video.mp4')).toBe('video/mp4')
    expect(guessMimeType('clip.webm')).toBe('video/webm')
    expect(guessMimeType('movie.mov')).toBe('video/quicktime')
  })

  test('is case insensitive', () => {
    expect(guessMimeType('FILE.JPG')).toBe('image/jpeg')
    expect(guessMimeType('DATA.JSON')).toBe('application/json')
    expect(guessMimeType('Page.HTML')).toBe('text/html')
  })

  test('returns undefined for unknown extensions', () => {
    expect(guessMimeType('file.xyz')).toBeUndefined()
    expect(guessMimeType('data.custom')).toBeUndefined()
  })

  test('returns undefined for files with no extension', () => {
    expect(guessMimeType('Makefile')).toBeUndefined()
    expect(guessMimeType('LICENSE')).toBeUndefined()
  })

  test('handles paths with directories', () => {
    expect(guessMimeType('uploads/photos/avatar.jpg')).toBe('image/jpeg')
    expect(guessMimeType('/var/www/html/index.html')).toBe('text/html')
  })
})
