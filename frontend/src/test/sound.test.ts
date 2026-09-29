import { describe, it, expect, beforeEach, vi } from 'vitest'
import { sound, isSoundEnabled, setSoundEnabled } from '../lib/sound'

describe('sound engine', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('enables and disables sound effects via localStorage', () => {
    expect(isSoundEnabled()).toBe(false)
    setSoundEnabled(true)
    expect(isSoundEnabled()).toBe(true)
    setSoundEnabled(false)
    expect(isSoundEnabled()).toBe(false)
  })

  it('calls sound methods safely without crashing when audio is muted', () => {
    setSoundEnabled(false)
    expect(() => sound.click()).not.toThrow()
    expect(() => sound.chime()).not.toThrow()
    expect(() => sound.success()).not.toThrow()
    expect(() => sound.guard()).not.toThrow()
  })

  it('calls sound methods safely when sound is enabled with mock AudioContext', () => {
    setSoundEnabled(true)
    const mockOsc = {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    const mockGain = {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    }
    const mockCtx = {
      currentTime: 0,
      state: 'running',
      createOscillator: vi.fn(() => mockOsc),
      createGain: vi.fn(() => mockGain),
      destination: {},
      resume: vi.fn(),
    }

    // @ts-expect-error test mock
    window.AudioContext = vi.fn(function () { return mockCtx })

    expect(() => sound.click()).not.toThrow()
    expect(() => sound.chime()).not.toThrow()
    expect(() => sound.success()).not.toThrow()
    expect(() => sound.guard()).not.toThrow()
  })
})

