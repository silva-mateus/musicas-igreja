import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { CapoControl } from '../capo-control'

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

describe('CapoControl', () => {
  const defaultProps = {
    capo: 0,
    onCapoChange: vi.fn(),
  }

  function capoTrigger() {
    return screen.getByRole('button', { name: /Capo:/ })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with "Sem capo" on trigger when capo is 0', () => {
    render(<CapoControl {...defaultProps} />)

    expect(screen.getByText('Capo', { selector: '.vh-key-lbl' })).toBeInTheDocument()
    expect(within(capoTrigger()).getByText('Sem capo')).toBeInTheDocument()
  })

  it('renders fret label on trigger when capo is set', () => {
    render(<CapoControl {...defaultProps} capo={3} />)

    expect(within(capoTrigger()).getByText('3ª casa')).toBeInTheDocument()
  })

  it('opens popover when trigger is clicked', async () => {
    render(<CapoControl {...defaultProps} />)

    fireEvent.click(capoTrigger())

    await waitFor(() => {
      const panel = document.querySelector('.pop.pop-capo')
      expect(panel).toBeTruthy()
      expect(within(panel as HTMLElement).getByText('Capo')).toBeInTheDocument()
    })
  })

  it('shows capo num and hint in popover', async () => {
    render(<CapoControl {...defaultProps} capo={2} />)

    fireEvent.click(capoTrigger())

    await waitFor(() => {
      const panel = document.querySelector('.pop.pop-capo') as HTMLElement
      const num = panel.querySelector('.capo-num')
      expect(num?.textContent).toBe('2')
      expect(within(panel).getByText('Capotraste na 2ª casa')).toBeInTheDocument()
    })
  })

  it('calls onCapoChange when stepping up', async () => {
    const onCapoChange = vi.fn()

    render(<CapoControl {...defaultProps} capo={2} onCapoChange={onCapoChange} />)

    fireEvent.click(capoTrigger())

    await waitFor(() => {
      fireEvent.click(screen.getByTitle('Aumentar'))
    })

    expect(onCapoChange).toHaveBeenCalledWith(3)
  })

  it('calls onCapoChange when stepping down', async () => {
    const onCapoChange = vi.fn()

    render(<CapoControl {...defaultProps} capo={2} onCapoChange={onCapoChange} />)

    fireEvent.click(capoTrigger())

    await waitFor(() => {
      fireEvent.click(screen.getByTitle('Diminuir'))
    })

    expect(onCapoChange).toHaveBeenCalledWith(1)
  })

  it('does not go below 0 when stepping down', async () => {
    const onCapoChange = vi.fn()

    render(<CapoControl {...defaultProps} capo={0} onCapoChange={onCapoChange} />)

    fireEvent.click(capoTrigger())

    await waitFor(() => {
      fireEvent.click(screen.getByTitle('Diminuir'))
    })

    expect(onCapoChange).toHaveBeenCalledWith(0)
  })

  it('does not go above 11 when stepping up', async () => {
    const onCapoChange = vi.fn()

    render(<CapoControl {...defaultProps} capo={11} onCapoChange={onCapoChange} />)

    fireEvent.click(capoTrigger())

    await waitFor(() => {
      fireEvent.click(screen.getByTitle('Aumentar'))
    })

    expect(onCapoChange).toHaveBeenCalledWith(11)
  })

  it('removes capo when X button is clicked', async () => {
    const onCapoChange = vi.fn()

    render(<CapoControl {...defaultProps} capo={5} onCapoChange={onCapoChange} />)

    fireEvent.click(capoTrigger())

    await waitFor(() => {
      fireEvent.click(screen.getByTitle('Remover capo'))
    })

    expect(onCapoChange).toHaveBeenCalledWith(0)
  })

  it('shows Sem capo hint when fret is 0', async () => {
    render(<CapoControl {...defaultProps} capo={0} />)

    fireEvent.click(capoTrigger())

    await waitFor(() => {
      const panel = document.querySelector('.pop.pop-capo') as HTMLElement
      expect(within(panel).getByText('Sem capo')).toBeInTheDocument()
    })
  })

  it('shows capotraste hint for fret in popover', async () => {
    render(<CapoControl {...defaultProps} capo={7} />)

    fireEvent.click(capoTrigger())

    await waitFor(() => {
      const panel = document.querySelector('.pop.pop-capo') as HTMLElement
      expect(within(panel).getByText('Capotraste na 7ª casa')).toBeInTheDocument()
    })
  })

  it('disables trigger when disabled prop is true', () => {
    render(<CapoControl {...defaultProps} disabled />)

    expect(capoTrigger()).toBeDisabled()
  })
})
