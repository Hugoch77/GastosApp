import { describe, expect, it } from 'vitest'
import {
  guessCategory,
  parseSpokenTransaction,
  type CategoryOption,
} from './spokenTransaction'

// Viernes 23 de octubre de 2026.
const TODAY = '2026-10-23'

const CATEGORIES: CategoryOption[] = [
  { id: 'food', name: 'Comida' },
  { id: 'groceries', name: 'Supermercado' },
  { id: 'transport', name: 'Transporte' },
  { id: 'fuel', name: 'Gasolina' },
  { id: 'utilities', name: 'Servicios' },
  { id: 'clothing', name: 'Ropa' },
  { id: 'other', name: 'Otros' },
  { id: 'pets', name: 'Mascotas' },
]

function parse(text: string) {
  return parseSpokenTransaction(text, TODAY, CATEGORIES)
}

describe('parseSpokenTransaction: frases completas', () => {
  it.each([
    [
      '250 en Rappi ayer',
      {
        type: 'charge',
        amountCents: 25000,
        description: 'Rappi',
        date: '2026-10-22',
        months: null,
        categoryId: 'food',
      },
    ],
    [
      'Llantas 9 mil 220 a 6 meses',
      {
        type: 'charge',
        amountCents: 922000,
        description: 'Llantas',
        date: TODAY,
        months: 6,
        categoryId: 'transport',
      },
    ],
    [
      'Gasté $1,250.50 en el súper',
      {
        type: 'charge',
        amountCents: 125050,
        description: 'Súper',
        date: TODAY,
        months: null,
        categoryId: 'groceries',
      },
    ],
    [
      'pagué 3000 a la tarjeta',
      {
        type: 'payment',
        amountCents: 300000,
        description: '',
        date: TODAY,
        months: null,
        categoryId: null,
      },
    ],
    [
      'devolución de 199.90 Amazon el 12 de octubre',
      {
        type: 'refund',
        amountCents: 19990,
        description: 'Amazon',
        date: '2026-10-12',
        months: null,
        categoryId: null,
      },
    ],
    [
      'compré unos tenis en Liverpool por 1,800 a doce meses sin intereses',
      {
        type: 'charge',
        amountCents: 180000,
        description: 'Tenis en Liverpool',
        date: TODAY,
        months: 12,
        categoryId: 'clothing',
      },
    ],
  ])('%j', (text, expected) => {
    expect(parse(text)).toEqual(expected)
  })
})

describe('monto', () => {
  it.each([
    ['Tacos 120 pesos', 12000],
    ['Tacos $120', 12000],
    ['Café 45 con 50', 4550],
    ['Café 45.5', 4550],
    ['Renta 2 mil', 200000],
    ['Pantalla 12,999', 1299900],
    ['Algo sin monto', null],
    ['Gratis 0', null],
  ])('%j → %s centavos', (text, cents) => {
    expect(parse(text).amountCents).toBe(cents)
  })
})

describe('fecha (hoy es viernes 23 oct 2026)', () => {
  it.each([
    ['Tacos 100', TODAY],
    ['Tacos 100 hoy', TODAY],
    ['Tacos 100 ayer', '2026-10-22'],
    ['Tacos 100 antier', '2026-10-21'],
    ['Tacos 100 el lunes', '2026-10-19'],
    ['Tacos 100 el miércoles', '2026-10-21'],
    ['Tacos 100 el viernes', TODAY], // hoy es viernes
    ['Tacos 100 el viernes pasado', '2026-10-16'],
    ['Tacos 100 el 5', '2026-10-05'],
    ['Tacos 100 el 28', '2026-09-28'], // aún no llega el 28: mes anterior
    ['Tacos 100 el 15 de diciembre', '2025-12-15'], // diciembre aún no llega
    ['Tacos 100 el 31', '2026-08-31'], // septiembre no tiene 31
  ])('%j → %s', (text, date) => {
    expect(parse(text).date).toBe(date)
  })

  it('"el 5" es la fecha, no el monto', () => {
    expect(parse('Gasolina 500 el 5')).toMatchObject({
      amountCents: 50000,
      date: '2026-10-05',
    })
  })
})

describe('meses sin intereses', () => {
  it.each([
    ['Pantalla 6000 a 6 meses', 6],
    ['Pantalla 6000 en 3 meses sin intereses', 3],
    ['Pantalla 6000 a tres meses', 3],
    ['Pantalla 6000 18 msi', 18],
    ['Pantalla 6000', null],
    ['Pantalla 6000 a 60 meses', null], // fuera de rango
  ])('%j → %s', (text, months) => {
    expect(parse(text).months).toBe(months)
  })

  it('el plazo no se confunde con el monto', () => {
    expect(parse('Pantalla a 12 meses 6000').amountCents).toBe(600000)
  })

  it('un pago nunca es a meses', () => {
    expect(parse('pago 500 a 3 meses').months).toBeNull()
  })
})

describe('guessCategory', () => {
  it.each([
    ['Uber Eats', 'food'], // antes que "Uber" de transporte
    ['Uber', 'transport'],
    ['Comida corrida', 'food'], // nombre de la categoría
    ['Mascotas', 'pets'], // categoría creada por el usuario
    ['Recarga cel', 'utilities'],
    ['Excel', null], // "cel" solo al inicio de una palabra
    ['Amazon', null],
  ])('%j → %s', (text, category) => {
    expect(guessCategory(text, CATEGORIES)).toBe(category)
  })

  it('no sugiere una categoría que el usuario borró', () => {
    const withoutFood = CATEGORIES.filter((c) => c.id !== 'food')
    expect(guessCategory('Rappi', withoutFood)).toBeNull()
  })
})
