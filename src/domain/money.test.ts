import { describe, expect, it } from 'vitest'
import { assertCents, centsToInputValue, formatMXN, parseMXN } from './money'

describe('formatMXN', () => {
  it.each([
    [0, '$0.00'],
    [5, '$0.05'],
    [123456, '$1,234.56'],
    [100000000, '$1,000,000.00'],
    [-150000, '-$1,500.00'],
  ])('%i centavos → %s', (cents, expected) => {
    expect(formatMXN(cents)).toBe(expected)
  })
})

describe('parseMXN', () => {
  it.each([
    ['1234.56', 123456],
    ['1,234.5', 123450],
    ['$ 1,234', 123400],
    ['0.99', 99],
    [' 12 ', 1200],
    ['.5', 50],
    ['1234.', 123400],
    ['0', 0],
    ['1,000,000.01', 100000001],
  ])('"%s" → %i centavos', (text, expected) => {
    expect(parseMXN(text)).toBe(expected)
  })

  it.each([
    '',
    '   ',
    '.',
    'abc',
    '12a',
    '1.234',
    '-5',
    '1,23',
    '12,34.00',
    '1.2.3',
  ])('rechaza "%s"', (text) => {
    expect(parseMXN(text)).toBeNull()
  })

  it('evita errores de flotantes (19.99 no se vuelve 1998.9999...)', () => {
    expect(parseMXN('19.99')).toBe(1999)
    expect(parseMXN('0.29')).toBe(29)
  })
})

describe('centsToInputValue', () => {
  it.each([
    [123456, '1234.56'],
    [5, '0.05'],
    [100, '1.00'],
    [-250, '-2.50'],
  ])('%i → "%s"', (cents, expected) => {
    expect(centsToInputValue(cents)).toBe(expected)
  })

  it('ida y vuelta con parseMXN', () => {
    expect(parseMXN(centsToInputValue(987654))).toBe(987654)
  })
})

describe('assertCents', () => {
  it.each([1.5, NaN, Infinity])('rechaza %s', (value) => {
    expect(() => assertCents(value)).toThrow()
  })
})
