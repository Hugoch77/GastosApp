import { describe, expect, it } from 'vitest'
import { sharedText, shareTargetRedirect } from './shareTarget'

describe('sharedText', () => {
  it.each([
    ['solo texto', { 'compartido-texto': '250 en Rappi' }, '250 en Rappi'],
    [
      'título y texto distintos',
      { 'compartido-titulo': 'BBVA', 'compartido-texto': 'Compra por $250' },
      'BBVA Compra por $250',
    ],
    [
      'el texto ya incluye el título',
      {
        'compartido-titulo': 'Compra por $250',
        'compartido-texto': 'Compra por $250 en OXXO',
      },
      'Compra por $250 en OXXO',
    ],
    [
      'el título ya incluye el texto',
      {
        'compartido-titulo': 'Compra por $250 en OXXO',
        'compartido-texto': 'Compra por $250',
      },
      'Compra por $250 en OXXO',
    ],
    [
      'el enlace se ignora si hay texto',
      {
        'compartido-texto': '250 en Rappi',
        'compartido-enlace': 'https://rappi.com/pedido/123',
      },
      '250 en Rappi',
    ],
    [
      'el enlace se usa si no hay nada más',
      { 'compartido-enlace': '250 en Rappi' },
      '250 en Rappi',
    ],
    [
      'quita espacios de sobra',
      { 'compartido-texto': '  250 en Rappi \n' },
      '250 en Rappi',
    ],
    ['vacío', { 'compartido-texto': '   ' }, ''],
  ])('%s', (_case, params, expected) => {
    expect(sharedText(new URLSearchParams(params))).toBe(expected)
  })
})

describe('shareTargetRedirect', () => {
  it.each([
    [
      'en la raíz',
      'http://localhost:4173/?compartido-texto=250%20en%20Rappi',
      '/#/movimientos/nuevo?texto=250%20en%20Rappi',
    ],
    [
      'en una subcarpeta',
      'https://ejemplo.github.io/GastosApp/?compartido-texto=Caf%C3%A9+%2445',
      '/GastosApp/#/movimientos/nuevo?texto=Caf%C3%A9%20%2445',
    ],
    [
      'sin texto abre el formulario vacío',
      'https://ejemplo.github.io/GastosApp/?compartido-texto=',
      '/GastosApp/#/movimientos/nuevo',
    ],
    ['apertura normal', 'https://ejemplo.github.io/GastosApp/', null],
    [
      'apertura normal con otra ruta',
      'https://ejemplo.github.io/GastosApp/#/movimientos?texto=no',
      null,
    ],
  ])('%s', (_case, href, expected) => {
    expect(shareTargetRedirect(new URL(href))).toBe(expected)
  })
})
