import { describe, expect, it } from 'vitest'
import { matchesQuery, normalizeText } from './search'

describe('normalizeText', () => {
  it('quita acentos, mayúsculas y espacios a los lados', () => {
    expect(normalizeText('  Café MAÑANA ')).toBe('cafe manana')
  })
})

describe('matchesQuery', () => {
  it.each([
    ['Café de la esquina', 'cafe', true],
    ['Uber Eats', 'eats uber', true], // palabras en cualquier orden
    ['Uber Eats', 'uber didi', false], // todas deben aparecer
    ['Maestría', 'MAESTRIA', true],
    ['Rappi', '', true], // búsqueda vacía: todo coincide
    ['Rappi', '   ', true],
    ['Gasolina', 'gas', true], // coincidencia parcial
  ])('%j con %j → %s', (text, query, expected) => {
    expect(matchesQuery(text, query)).toBe(expected)
  })
})
