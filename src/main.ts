import './styles.css'
import { detectLanguage, relativeTime, translator, type Translate } from './io/i18n'
import {
  RevealLifecycle,
  type TableLifecycleState
} from './core/reveal'
import {
  applyResult,
  canResetRound,
  ensureLayout,
  getLiveOrder,
  getRemainingItems,
  performFinalAct,
  setEliminationMode,
  startNewRound,
  syncEditedPreset
} from './state/round'
import {
  createPresetState,
  type Preset,
  type PresetState,
  type ReelLayout,
  type Stored,
  type TableId,
  type WheelLayout
} from './state/types'
import {
  duplicatePreset,
  createPresetStateForPreset,
  removePreset,
  seedStarterPresets
} from './state/presets'
import { PersistedStore, STORAGE_KEY } from './state/store'
import {
  availableTableRegistrations,
  createRegisteredTable,
  type TableRegistration
} from './tables/registry'
import type { Table } from './tables/table'
import { renderCemetery } from './ui/cemetery'
import { openPresetEditor } from './ui/preset-editor'
import { renderPresetList } from './ui/preset-list'
import { openSettings } from './ui/settings'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Application root is missing')

const wasFirstLaunch = localStorage.getItem(STORAGE_KEY) === null
const store = new PersistedStore(localStorage, detectLanguage())
if (wasFirstLaunch) store.replace(seedStarterPresets(store.get()), false)

let activePresetId: string | null = null
let activeTable: Table | null = null
let activeLifecycle: RevealLifecycle<number> | null = null
const dismissedResume = new Set<string>()
const lastResults = new Map<string, string>()
let statusTimer: ReturnType<typeof setTimeout> | null = null
const APPLY_REBUILD_DELAY_MS = 160
const RESULT_FLIGHT_MS = 560

const actionButton = (label: string, className: string, action: () => void): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.textContent = label
  button.addEventListener('click', action)
  return button
}

const updatePresetInStore = (next: Preset, previous?: Preset): void => {
  store.update((stored) => {
    if (!previous) {
      return {
        ...stored,
        presets: [...stored.presets, next]
      }
    }
    const oldState = stored.states[previous.id] ?? createPresetStateForPreset(previous)
    return {
      ...stored,
      presets: stored.presets.map((preset) => preset.id === previous.id ? next : preset),
      states: {
        ...stored.states,
        [next.id]: syncEditedPreset(previous, next, oldState, crypto)
      }
    }
  })
}

const editPreset = (preset?: Preset): void => {
  const t = translator(store.get().settings.lang)
  openPresetEditor(root, t, preset, updatePresetInStore)
}

const showSettings = (): void => {
  const settings = store.get().settings
  openSettings(root, settings, translator(settings.lang), (next, redraw) => {
    store.update((stored) => ({ ...stored, settings: next }), redraw)
  })
}

const renderList = (stored: Stored, t: Translate): void => {
  renderPresetList(root, stored.presets, t, {
    open: (preset) => {
      activePresetId = preset.id
      dismissedResume.delete(preset.id)
      lastResults.delete(preset.id)
      render()
    },
    edit: editPreset,
    duplicate: (preset) => {
      const duplicate = duplicatePreset(preset, t('presets.copyName', { name: preset.name }))
      store.update((value) => ({
        ...value,
        presets: [...value.presets, duplicate]
      }))
    },
    delete: (preset) => {
      if (window.confirm(t('presets.deleteConfirm', { name: preset.name }))) {
        store.replace(removePreset(store.get(), preset.id))
      }
    },
    create: () => editPreset(),
    settings: showSettings
  })
}

const persistPresetState = (
  presetId: string,
  recipe: (state: PresetState) => PresetState,
  notify = true
): void => {
  store.update((stored) => ({
    ...stored,
    states: {
      ...stored.states,
      [presetId]: recipe(stored.states[presetId] ?? createPresetState())
    }
  }), notify)
}

const resetRound = (preset: Preset, t: Translate): void => {
  const state = store.get().states[preset.id] ?? createPresetStateForPreset(preset)
  if (
    canResetRound(state) &&
    !window.confirm(t('round.confirmReset', {
      drawn: state.drawn.length,
      total: preset.items.length
    }))
  ) return
  dismissedResume.add(preset.id)
  lastResults.delete(preset.id)
  persistPresetState(preset.id, (current) => startNewRound(preset, crypto, current))
}

const copyOrder = async (items: readonly string[], status: HTMLElement, t: Translate): Promise<void> => {
  try {
    await navigator.clipboard.writeText(items.map((item, index) => `${index + 1}. ${item}`).join('\n'))
    status.textContent = t('round.copied')
  } catch {
    status.textContent = t('round.copyFailed')
  }
}

const createResumeBanner = (
  preset: Preset,
  state: PresetState,
  t: Translate
): HTMLElement => {
  const banner = document.createElement('section')
  banner.className = 'resume-banner'
  const message = document.createElement('p')
  message.textContent = t('round.resume', {
    drawn: state.drawn.length,
    total: preset.items.length,
    ago: relativeTime(state.updatedAt, store.get().settings.lang)
  })
  const actions = document.createElement('div')
  actions.append(
    actionButton(t('round.continue'), 'button button-primary', () => {
      dismissedResume.add(preset.id)
      render()
    }),
    actionButton(t('round.new'), 'button button-quiet', () => resetRound(preset, t))
  )
  banner.append(message, actions)
  return banner
}

const createModeSwitch = (
  preset: Preset,
  state: PresetState,
  t: Translate
): HTMLElement => {
  const group = document.createElement('div')
  group.className = 'mode-switch'
  group.setAttribute('role', 'group')
  group.setAttribute('aria-label', t('game.mode'))
  const label = document.createElement('span')
  label.className = 'mode-switch-label'
  label.textContent = t('game.mode')
  const options = document.createElement('div')
  options.className = 'mode-switch-options'
  const option = (elimination: boolean, text: string): HTMLButtonElement => {
    const button = actionButton(text, 'mode-choice', () => {
      persistPresetState(preset.id, (current) => setEliminationMode(current, elimination))
    })
    button.setAttribute('aria-pressed', String(state.elimination === elimination))
    return button
  }
  options.append(
    option(false, t('game.modeStays')),
    option(true, t('game.modeEliminates'))
  )
  group.append(label, options)
  return group
}

const tableLabel = (id: TableId, t: Translate): string => {
  if (id === 'wheel') return t('game.wheel')
  if (id === 'slot') return t('game.slot')
  if (id === 'strip') return t('game.strip')
  return t('game.cards')
}

const tableAriaLabel = (id: TableId, t: Translate): string => {
  if (id === 'wheel') return t('game.wheelLabel')
  if (id === 'slot') return t('game.slotLabel')
  if (id === 'strip') return t('game.stripLabel')
  return t('game.cards')
}

const weakGestureLabel = (id: TableId, t: Translate): string => {
  if (id === 'slot') return t('game.weakSlot')
  if (id === 'strip') return t('game.weakStrip')
  return t('game.weak')
}

const resolveRegistration = (
  remembered: TableId,
  itemCount: number
): { active: TableRegistration; available: TableRegistration[] } => {
  const available = availableTableRegistrations(itemCount)
  const active = available.find(({ id }) => id === remembered) ?? available[0]
  if (!active) throw new Error('No table is available for the current item count')
  return { active, available }
}

const startResultFlight = (tableHost: HTMLElement, item: string): void => {
  const source = tableHost.querySelector<HTMLElement | SVGGraphicsElement>('.table-result-highlight')
  const target = document.querySelector<HTMLElement>('.cemetery')
  if (!source || !target) return
  const sourceRect = source.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const flight = document.createElement('div')
  flight.className = 'result-flight'
  flight.textContent = item
  flight.style.left = `${sourceRect.left + sourceRect.width / 2}px`
  flight.style.top = `${sourceRect.top + sourceRect.height / 2}px`
  flight.style.setProperty(
    '--flight-x',
    `${targetRect.left + Math.min(targetRect.width / 2, 120) - (sourceRect.left + sourceRect.width / 2)}px`
  )
  flight.style.setProperty(
    '--flight-y',
    `${targetRect.top + Math.min(targetRect.height / 2, 90) - (sourceRect.top + sourceRect.height / 2)}px`
  )
  document.body.append(flight)
  requestAnimationFrame(() => requestAnimationFrame(() => flight.classList.add('result-flight-active')))
  setTimeout(() => flight.remove(), RESULT_FLIGHT_MS)
}

const renderGame = (preset: Preset, stored: Stored, t: Translate): void => {
  const settings = stored.settings
  let state = stored.states[preset.id] ?? createPresetStateForPreset(preset)
  const remaining = getRemainingItems(preset, state)
  const { active: registration, available: availableTables } = resolveRegistration(
    state.lastTable,
    Math.max(2, remaining.length)
  )
  const tableId = registration.id
  state = ensureLayout(tableId, preset, state, crypto)
  if (state.lastTable !== tableId) state = { ...state, lastTable: tableId }
  if (stored.states[preset.id] !== state) {
    persistPresetState(preset.id, () => state, false)
  }
  const activeLayout = tableId === 'wheel' ? state.tables.wheel : state.tables.reel
  if (!activeLayout) throw new Error(`Layout was not created for table: ${tableId}`)
  const liveOrder = getLiveOrder(activeLayout.order, state.elimination ? state.drawn : [])
  const completed = state.elimination && remaining.length === 0
  const finalAct = state.elimination && remaining.length === 1

  const page = document.createElement('main')
  page.className = 'game-page'
  const header = document.createElement('header')
  header.className = 'game-header'
  const back = actionButton(`← ${t('game.back')}`, 'text-button back-button', () => {
    activePresetId = null
    render()
  })
  const titleGroup = document.createElement('div')
  const eyebrow = document.createElement('span')
  eyebrow.className = 'eyebrow'
  eyebrow.textContent = t('brand')
  const title = document.createElement('h1')
  title.textContent = preset.name
  titleGroup.append(eyebrow, title)
  header.append(back, titleGroup, actionButton(t('game.edit'), 'button button-quiet', () => editPreset(preset)))
  page.append(header)

  if (
    state.elimination &&
    state.drawn.length > 0 &&
    !completed &&
    !dismissedResume.has(preset.id)
  ) {
    page.append(createResumeBanner(preset, state, t))
  }

  const layout = document.createElement('div')
  layout.className = 'game-layout'
  const tableArea = document.createElement('section')
  tableArea.className = 'table-area'
  const switcher = document.createElement('div')
  switcher.className = 'table-switcher'
  const tableChoiceGroup = document.createElement('div')
  tableChoiceGroup.className = 'table-choice-group'
  const switcherLabel = document.createElement('span')
  switcherLabel.textContent = t('game.table')
  tableChoiceGroup.append(switcherLabel)
  availableTables.forEach(({ id }) => {
    const choice = actionButton(tableLabel(id, t), 'table-choice', () => {
      persistPresetState(preset.id, (current) => ({
        ...current,
        lastTable: id,
        updatedAt: Date.now()
      }))
    })
    choice.setAttribute('aria-pressed', String(id === tableId))
    tableChoiceGroup.append(choice)
  })
  switcher.append(tableChoiceGroup, createModeSwitch(preset, state, t))
  tableArea.append(switcher)

  const status = document.createElement('p')
  status.className = 'game-status'
  status.setAttribute('role', 'status')
  const rememberedResult = lastResults.get(preset.id)
  if (rememberedResult) status.textContent = t('game.result', { item: rememberedResult })

  const tableHost = document.createElement('div')
  tableHost.className = 'table-host'
  tableArea.append(tableHost)

  const controls = document.createElement('div')
  controls.className = 'game-controls'
  if (completed) {
    const complete = document.createElement('div')
    complete.className = 'round-complete'
    const completeTitle = document.createElement('h2')
    completeTitle.textContent = t('round.complete')
    complete.append(
      completeTitle,
      actionButton(t('round.new'), 'button button-primary', () => resetRound(preset, t)),
      actionButton(t('round.copy'), 'button button-quiet', () => void copyOrder(state.drawn, status, t))
    )
    controls.append(complete)
  } else if (finalAct) {
    controls.append(actionButton(
      t('game.finalAct', { item: remaining[0] ?? '' }),
      'button button-primary final-act',
      () => persistPresetState(preset.id, (current) => performFinalAct(preset, current))
    ))
  } else if (liveOrder.length >= 2) {
    const luck = actionButton(
      t('game.tryLuck'),
      'button button-primary luck-button',
      () => activeTable?.tryLuck()
    )
    controls.append(luck)
  } else {
    const unavailable = document.createElement('p')
    unavailable.className = 'unavailable'
    unavailable.textContent = t('game.unavailable')
    controls.append(unavailable)
  }
  controls.append(status)
  tableArea.append(controls)
  layout.append(tableArea)
  if (state.elimination) {
    layout.append(renderCemetery(
      state.drawn,
      t,
      () => void copyOrder(state.drawn, status, t),
      () => resetRound(preset, t)
    ))
  }
  page.append(layout)
  root.append(page)

  if (!completed) {
    activeTable = createRegisteredTable(tableId)
    let lifecycle: RevealLifecycle<number>
    const updateInteractionState = (phase: TableLifecycleState): void => {
      tableHost.dataset.lifecycleState = phase
      const locked = phase !== 'idle'
      page.querySelectorAll<HTMLButtonElement>('.table-choice, .mode-choice, .luck-button')
        .forEach((button) => {
          button.disabled = locked
        })
    }
    lifecycle = new RevealLifecycle<number>({
      onStateChange: updateInteractionState,
      onReveal: (index) => {
        const selected = liveOrder[index]
        if (selected === undefined) return
        lastResults.set(preset.id, selected)
        status.textContent = t('game.result', { item: selected })
        activeTable?.highlightResult(index)
      },
      onApply: (index) => {
        const selected = liveOrder[index]
        if (selected === undefined) {
          activeTable?.clearHighlight()
          lifecycle.completeApplying()
          return
        }
        if (!state.elimination) {
          activeTable?.clearHighlight()
          lifecycle.completeApplying()
          return
        }
        dismissedResume.add(preset.id)
        startResultFlight(tableHost, selected)
        activeTable?.clearHighlight()
        setTimeout(() => {
          const current = store.get().states[preset.id] ?? state
          persistPresetState(preset.id, () => applyResult(preset, current, liveOrder, index))
        }, APPLY_REBUILD_DELAY_MS)
      }
    })
    activeLifecycle = lifecycle
    updateInteractionState(lifecycle.state)
    tableHost.addEventListener('pointerdown', (event) => {
      if (lifecycle.state !== 'revealing') return
      event.preventDefault()
      event.stopImmediatePropagation()
      lifecycle.skipReveal()
    }, { capture: true })
    activeTable.mount(tableHost, {
      items: liveOrder,
      layout: activeLayout,
      sound: settings.sound,
      haptics: settings.haptics,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      ariaLabel: tableAriaLabel(tableId, t),
      interactive: !finalAct,
      onStart: () => lifecycle.tryStart(),
      onCancel: () => {
        lifecycle.cancelStart()
      },
      onResolved: (index) => {
        lifecycle.resolve(index)
      },
      onSettled: () => {
        lifecycle.settle()
      },
      onLayout: (next: WheelLayout | ReelLayout) => {
        persistPresetState(preset.id, (current) => ({
          ...current,
          tables: {
            ...current.tables,
            ...('angle' in next ? { wheel: next } : { reel: next })
          },
          updatedAt: Date.now()
        }), false)
      },
      onWeakGesture: () => {
        status.textContent = weakGestureLabel(tableId, t)
        if (statusTimer !== null) clearTimeout(statusTimer)
        statusTimer = setTimeout(() => {
          status.textContent = rememberedResult ? t('game.result', { item: rememberedResult }) : ''
        }, 3_000)
      },
      onInteraction: () => {
        lastResults.delete(preset.id)
        status.textContent = ''
      }
    })
  }
}

const render = (): void => {
  activeLifecycle?.destroy()
  activeLifecycle = null
  activeTable?.unmount()
  activeTable = null
  root.replaceChildren()
  const stored = store.get()
  const t = translator(stored.settings.lang)
  document.documentElement.lang = stored.settings.lang
  document.title = t('brand')
  const preset = activePresetId
    ? stored.presets.find((candidate) => candidate.id === activePresetId)
    : undefined
  if (preset) renderGame(preset, stored, t)
  else {
    activePresetId = null
    renderList(stored, t)
  }
}

store.subscribe(render)
window.addEventListener('pagehide', () => store.flush())
render()
