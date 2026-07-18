import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { FabricatorMark } from './FabricatorMark'

describe('FabricatorMark', () => {
  afterEach(cleanup)

  function renderMark(props: Parameters<typeof FabricatorMark>[0] = {}): HTMLImageElement {
    const { container } = render(<FabricatorMark {...props} />)
    const image = container.querySelector('img')
    if (!image) throw new Error('expected an <img>')
    return image
  }

  it('keeps the base fab-mark class and appends the sizing class', () => {
    const image = renderMark({ className: 'brand-mark' })
    expect(image.classList.contains('fab-mark')).toBe(true)
    expect(image.classList.contains('brand-mark')).toBe(true)
  })

  it('uses the VESPERTTINE tiled mark asset', () => {
    expect(renderMark().getAttribute('src')).toContain('vesperttine-mark')
  })

  it('is decorative by default and labelled when a title is given', () => {
    expect(renderMark().getAttribute('aria-hidden')).toBe('true')

    const labelled = renderMark({ title: 'VESPERTTINE' })
    expect(labelled.getAttribute('aria-hidden')).toBeNull()
    expect(labelled.getAttribute('alt')).toBe('VESPERTTINE')
  })
})
