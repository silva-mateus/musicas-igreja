import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { TomControl } from '../tom-control'

/** Radix Popover from @core resolves a second React; mock for unit tests. */
vi.mock('@core/components/ui/popover', () => ({
  Popover: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
    <div data-testid="popover-root" data-state={open ? 'open' : 'closed'}>
      {children}
    </div>
  ),
  PopoverTrigger: ({ children, asChild }: { children: React.ReactElement; asChild?: boolean }) =>
    asChild ? children : <button type="button">{children}</button>,
  PopoverContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div role="dialog" className={className}>
      {children}
    </div>
  ),
}))

describe('TomControl', () => {
  const defaultProps = {
    currentKey: 'C',
    originalKey: 'C',
    onKeyChange: vi.fn(),
    onTranspose: vi.fn(),
  }

  function tomTrigger() {
    return screen.getByRole('button', { name: /Tom:/ })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with current key displayed', () => {
    render(<TomControl {...defaultProps} />)

    expect(screen.getByText('Tom')).toBeInTheDocument()
    expect(within(tomTrigger()).getByText('C')).toBeInTheDocument()
  })

  it('shows original key when different from current', () => {
    render(
      <TomControl
        {...defaultProps}
        currentKey="D"
        originalKey="C"
      />,
    )

    expect(within(tomTrigger()).getByText('D')).toBeInTheDocument()
    expect(within(tomTrigger()).getByText('(C)')).toBeInTheDocument()
  })

  it('does not show original key when same as current', () => {
    render(<TomControl {...defaultProps} />)

    expect(screen.queryByText('(C)')).not.toBeInTheDocument()
  })

  it('opens popover when trigger is clicked', async () => {
    render(<TomControl {...defaultProps} />)

    fireEvent.click(tomTrigger())

    await waitFor(() => {
      expect(screen.getByText('Trocar tom')).toBeInTheDocument()
    })
  })

  it('displays all musical keys in grid', async () => {
    const musicalKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    render(<TomControl {...defaultProps} />)
    fireEvent.click(tomTrigger())

    await waitFor(() => {
      expect(screen.getByText('Trocar tom')).toBeInTheDocument()
    })

    const grid = document.querySelector('.key-grid')
    expect(grid).toBeTruthy()
    musicalKeys.forEach((key) => {
      expect(
        within(grid as HTMLElement).getAllByRole('button').some((btn) => within(btn).queryByText(key, { exact: true })),
      ).toBe(true)
    })
  })

  it('calls onKeyChange when key is selected', async () => {
    const onKeyChange = vi.fn()
    const onTranspose = vi.fn()

    render(
      <TomControl
        {...defaultProps}
        onKeyChange={onKeyChange}
        onTranspose={onTranspose}
      />,
    )

    fireEvent.click(tomTrigger())

    await waitFor(() => {
      expect(document.querySelector('.key-grid')).toBeTruthy()
    })

    const grid = document.querySelector('.key-grid') as HTMLElement
    const dBtn = within(grid)
      .getAllByRole('button')
      .find((btn) => within(btn).queryByText('D', { exact: true }))
    expect(dBtn).toBeTruthy()
    fireEvent.click(dBtn!)

    expect(onKeyChange).toHaveBeenCalledWith('D')
    expect(onTranspose).toHaveBeenCalledWith(2)
  })

  it('calls restore original when link is clicked', async () => {
    const onKeyChange = vi.fn()
    const onTranspose = vi.fn()

    render(
      <TomControl
        {...defaultProps}
        currentKey="D"
        originalKey="C"
        onKeyChange={onKeyChange}
        onTranspose={onTranspose}
      />,
    )

    fireEvent.click(tomTrigger())

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Restaurar tom original' }))
    })

    expect(onKeyChange).toHaveBeenCalledWith('C')
    expect(onTranspose).toHaveBeenCalledWith(0)
  })

  it('handles step up via inline key-stepper-mini', () => {
    const onStepKey = vi.fn()

    render(<TomControl {...defaultProps} onStepKey={onStepKey} />)

    fireEvent.click(screen.getByTitle('Meio tom acima'))

    expect(onStepKey).toHaveBeenCalledWith(1)
  })

  it('handles step down via inline key-stepper-mini', () => {
    const onStepKey = vi.fn()

    render(<TomControl {...defaultProps} onStepKey={onStepKey} />)

    fireEvent.click(screen.getByTitle('Meio tom abaixo'))

    expect(onStepKey).toHaveBeenCalledWith(-1)
  })

  it('disables trigger when disabled prop is true', () => {
    render(<TomControl {...defaultProps} disabled />)

    expect(tomTrigger()).toBeDisabled()
  })
})
