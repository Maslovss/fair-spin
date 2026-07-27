import {
  automaticCardsDeal,
  availableCardResults,
  cardResultAt,
  cardsGridColumns,
  cutCards,
  dealCards,
  randomAvailableCard,
  visibleCardPositions
} from '../core/cards'
import { TickAudio } from '../io/audio'
import type { CardsLayout } from '../state/types'
import type { CardsLabels, Table, TableContext } from './table'

const DEAL_MS = 420
const FLIP_MS = 430

export class CardsTable implements Table {
  readonly id = 'cards' as const
  readonly min = 2
  readonly max = 16
  private container: HTMLElement | null = null
  private context: TableContext | null = null
  private layout: CardsLayout | null = null
  private pointerId: number | null = null
  private cutIndex = 0
  private suppressClick = false
  private cutting = false
  private timers: ReturnType<typeof setTimeout>[] = []
  private readonly audio = new TickAudio()

  mount(el: HTMLElement, context: TableContext): void {
    this.unmount()
    if (!('positions' in context.layout)) throw new TypeError('CardsTable requires a cards layout')
    if (!context.cardsLabels) throw new TypeError('CardsTable requires card labels')
    this.container = el
    this.context = context
    this.layout = context.layout
    this.render()
  }

  unmount(): void {
    this.timers.forEach((timer) => clearTimeout(timer))
    this.timers.length = 0
    this.pointerId = null
    this.cutting = false
    if (this.container) this.container.replaceChildren()
    this.container = null
    this.context = null
    this.layout = null
  }

  tryLuck(): void {
    const context = this.context
    const layout = this.layout
    if (
      !context ||
      !layout ||
      this.cutting ||
      context.interactive === false ||
      !context.onStart()
    ) return
    this.audio.unlock()
    context.onInteraction?.()
    if (layout.dealt) {
      this.flipResult(randomAvailableCard(
        layout,
        globalThis.crypto,
        context.roundItems,
        context.drawn
      ))
      return
    }
    this.audio.cardShuffle(context.sound)
    const dealt = automaticCardsDeal(context.items, context.drawn)
    this.persistLayout(dealt)
    this.render(true)
    const result = randomAvailableCard(
      dealt,
      globalThis.crypto,
      context.roundItems,
      context.drawn
    )
    this.schedule(() => this.flipResult(result), context.reducedMotion ? 30 : DEAL_MS)
  }

  highlightResult(index: number): void {
    this.clearHighlight()
    const card = this.container?.querySelector<HTMLElement>(
      `.cards-card[data-result-index="${index}"]`
    )
    card?.classList.add('table-result-highlight')
    this.container?.classList.add('table-is-revealing')
  }

  clearHighlight(): void {
    this.container?.querySelectorAll('.cards-card.table-result-highlight')
      .forEach((card) => card.classList.remove('table-result-highlight'))
    this.container?.classList.remove('table-is-revealing')
  }

  private render(dealing = false): void {
    const container = this.container
    const context = this.context
    const layout = this.layout
    if (!container || !context || !layout || !context.cardsLabels) return
    container.replaceChildren()
    const machine = document.createElement('div')
    machine.className = 'cards-machine'
    machine.setAttribute('role', 'application')
    machine.setAttribute('aria-label', context.ariaLabel)
    if (layout.dealt) this.renderGrid(machine, context.cardsLabels, dealing)
    else this.renderDeck(machine, context.cardsLabels)
    container.append(machine)
  }

  private renderDeck(machine: HTMLElement, labels: CardsLabels): void {
    const context = this.context
    const layout = this.layout
    if (!context || !layout) return
    const stage = document.createElement('div')
    stage.className = 'cards-cut-stage'
    const fan = document.createElement('div')
    fan.className = 'cards-cut-fan'
    fan.dataset.cardsDeck = ''
    fan.setAttribute('role', 'group')
    fan.setAttribute('aria-label', labels.deck)
    fan.style.setProperty('--cut-card-count', String(layout.order.length))
    fan.style.setProperty('--cut-denominator', String(Math.max(1, layout.order.length - 1)))

    layout.order.forEach((_, index) => {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'cards-cut-card'
      card.dataset.cutIndex = String(index)
      card.style.setProperty('--cut-card-index', String(index))
      card.style.zIndex = String(index + 1)
      card.setAttribute('aria-label', labels.cardBack(index + 1))
      card.addEventListener('click', () => this.onCutCardClick(index))
      fan.append(card)
    })

    const indicator = document.createElement('span')
    indicator.className = 'cards-cut-boundary'
    indicator.setAttribute('aria-hidden', 'true')
    indicator.style.setProperty('--cut-card-index', String(this.cutIndex))
    fan.append(indicator)
    fan.addEventListener('pointerdown', this.onCutStart)
    fan.addEventListener('pointermove', this.onCutMove)
    fan.addEventListener('pointerup', this.onCutEnd)
    fan.addEventListener('pointercancel', this.onCutCancel)
    stage.append(fan)

    const hint = document.createElement('p')
    hint.className = 'cards-cut-hint'
    hint.textContent = layout.cut ? labels.cutHint : labels.cutRequired
    const deal = document.createElement('button')
    deal.type = 'button'
    deal.className = 'button button-primary cards-deal-button'
    deal.textContent = labels.deal
    deal.disabled = !layout.cut || context.interactive === false
    deal.addEventListener('click', this.deal)
    machine.append(stage, hint, deal)
  }

  private renderGrid(machine: HTMLElement, labels: CardsLabels, dealing: boolean): void {
    const layout = this.layout
    const context = this.context
    if (!layout || !context) return
    const grid = document.createElement('div')
    grid.className = dealing ? 'cards-grid cards-grid-dealing' : 'cards-grid'
    const positions = visibleCardPositions(layout, context.roundItems, context.drawn)
    grid.style.setProperty('--cards-count', String(positions.length))
    grid.style.setProperty(
      '--cards-columns',
      String(layout.columns ?? cardsGridColumns(positions.length))
    )
    positions.forEach((resultIndex, slot) => {
      const cell = document.createElement('div')
      cell.className = 'cards-slot'
      cell.style.setProperty('--card-slot', String(slot))
      if (resultIndex < 0) {
        cell.classList.add('cards-slot-empty')
        cell.setAttribute('role', 'img')
        cell.setAttribute('aria-label', labels.empty(slot + 1))
        grid.append(cell)
        return
      }
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'cards-card'
      card.dataset.resultIndex = String(resultIndex)
      card.setAttribute('aria-label', labels.cardBack(slot + 1))
      const inner = document.createElement('span')
      inner.className = 'cards-card-inner'
      const back = document.createElement('span')
      back.className = 'cards-card-face cards-card-back'
      back.setAttribute('aria-hidden', 'true')
      const front = document.createElement('span')
      front.className = 'cards-card-face cards-card-front'
      front.textContent = layout.order[resultIndex] ?? ''
      inner.append(back, front)
      card.append(inner)
      card.addEventListener('click', () => this.chooseSlot(slot))
      cell.append(card)
      grid.append(cell)
    })
    machine.append(grid)
  }

  private readonly onCutStart = (event: PointerEvent): void => {
    const context = this.context
    const fan = event.currentTarget as HTMLElement
    if (
      !context ||
      !this.layout ||
      this.layout.dealt ||
      !context.canPrepare() ||
      this.pointerId !== null ||
      event.button !== 0
    ) return
    this.audio.unlock()
    this.audio.cardShuffle(context.sound)
    this.pointerId = event.pointerId
    fan.setPointerCapture(event.pointerId)
    const target = (event.target as Element).closest<HTMLElement>('.cards-cut-card')
    this.setCutIndex(
      target ? Number(target.dataset.cutIndex) : this.cutIndexFromPointer(event, fan),
      fan
    )
  }

  private readonly onCutMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return
    const fan = event.currentTarget as HTMLElement
    this.setCutIndex(this.cutIndexFromPointer(event, fan), fan)
  }

  private readonly onCutEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId || !this.layout || !this.context) return
    const fan = event.currentTarget as HTMLElement
    if (fan.hasPointerCapture(event.pointerId)) fan.releasePointerCapture(event.pointerId)
    this.pointerId = null
    this.suppressClick = true
    setTimeout(() => {
      this.suppressClick = false
    }, 0)
    this.performCut(this.cutIndex, fan)
  }

  private readonly onCutCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return
    const fan = event.currentTarget as HTMLElement
    if (fan.hasPointerCapture(event.pointerId)) fan.releasePointerCapture(event.pointerId)
    this.pointerId = null
  }

  private cutIndexFromPointer(event: PointerEvent, fan: HTMLElement): number {
    const cards = [...fan.querySelectorAll<HTMLElement>('.cards-cut-card')]
    const first = cards[0]?.getBoundingClientRect()
    const second = cards[1]?.getBoundingClientRect()
    if (!first) return 0
    const step = second ? Math.max(1, second.left - first.left) : first.width
    return Math.max(
      0,
      Math.min(cards.length - 1, Math.round((event.clientX - first.left) / step))
    )
  }

  private setCutIndex(index: number, fan: HTMLElement): void {
    if (!Number.isInteger(index)) return
    this.cutIndex = Math.max(0, Math.min((this.layout?.order.length ?? 1) - 1, index))
    fan.querySelector<HTMLElement>('.cards-cut-boundary')?.style.setProperty(
      '--cut-card-index',
      String(this.cutIndex)
    )
    fan.querySelectorAll<HTMLElement>('.cards-cut-card').forEach((card) => {
      card.classList.toggle('cards-cut-card-selected', Number(card.dataset.cutIndex) === this.cutIndex)
    })
  }

  private onCutCardClick(index: number): void {
    if (this.suppressClick) {
      this.suppressClick = false
      return
    }
    const fan = this.container?.querySelector<HTMLElement>('[data-cards-deck]')
    if (!fan) return
    this.audio.unlock()
    this.performCut(index, fan)
  }

  private performCut(index: number, fan: HTMLElement): void {
    const context = this.context
    const layout = this.layout
    if (!context || !layout || this.cutting || !context.canPrepare()) return
    this.cutting = true
    this.audio.cardCut(context.sound)
    fan.classList.add('cards-cut-animating')
    fan.querySelectorAll<HTMLElement>('.cards-cut-card').forEach((card) => {
      const cardIndex = Number(card.dataset.cutIndex)
      const gatherX = fan.clientWidth / 2 - card.clientWidth / 2 - card.offsetLeft
      card.style.setProperty('--cut-gather-x', `${gatherX}px`)
      card.classList.toggle('cards-cut-upper', cardIndex >= index)
      card.classList.toggle('cards-cut-lower', cardIndex < index)
    })
    const duration = context.reducedMotion ? 30 : 520
    this.schedule(() => {
      const next = cutCards(layout, index)
      this.cutting = false
      this.persistLayout(next)
      this.render()
    }, duration)
  }

  private readonly deal = (): void => {
    const context = this.context
    const layout = this.layout
    if (!context || !layout || this.cutting || !context.canPrepare() || !layout.cut) return
    this.audio.unlock()
    const next = dealCards(layout, context.drawn)
    this.persistLayout(next)
    this.render(true)
  }

  private chooseSlot(slot: number): void {
    const layout = this.layout
    const context = this.context
    if (!layout || !context) return
    let result: number
    try {
      result = cardResultAt(layout, slot, context.roundItems, context.drawn)
    } catch {
      return
    }
    if (!context.onStart()) return
    context.onInteraction?.()
    this.flipResult(result)
  }

  private flipResult(result: number): void {
    const context = this.context
    const layout = this.layout
    if (
      !context ||
      !layout ||
      !availableCardResults(layout, context.roundItems, context.drawn).includes(result)
    ) {
      context?.onCancel()
      return
    }
    context.onResolved(result)
    const card = this.container?.querySelector<HTMLElement>(
      `.cards-card[data-result-index="${result}"]`
    )
    card?.classList.add('cards-card-flipped')
    this.audio.cardFlip(context.sound)
    this.schedule(() => context.onSettled(), context.reducedMotion ? 30 : FLIP_MS)
  }

  private persistLayout(layout: CardsLayout): void {
    this.layout = layout
    this.context?.onLayout(layout)
  }

  private schedule(callback: () => void, delay: number): void {
    const timer = setTimeout(() => {
      this.timers = this.timers.filter((candidate) => candidate !== timer)
      callback()
    }, delay)
    this.timers.push(timer)
  }
}
