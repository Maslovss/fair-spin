import './styles.css'
import { detectLanguage, relativeTime, translator, type Translate } from './io/i18n'
import {
  applyResult,
  ensureWheelLayout,
  getLiveOrder,
  getRemainingItems,
  performFinalAct,
  startNewRound,
  syncEditedPreset
} from './state/round'
import {
  createPresetState,
  type Preset,
  type PresetState,
  type Stored,
  type WheelLayout
} from './state/types'
import {
  duplicatePreset,
  removePreset,
  seedStarterPresets
} from './state/presets'
import { PersistedStore, STORAGE_KEY } from './state/store'
import { WheelTable } from './tables/wheel'
import { isTableAvailable } from './tables/table'
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
let wheel: WheelTable | null = null
const dismissedResume = new Set<string>()
const lastResults = new Map<string, string>()
let statusTimer: ReturnType<typeof setTimeout> | null = null

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
        presets: [...stored.presets, next],
        states: { ...stored.states, [next.id]: createPresetState() }
      }
    }
    const oldState = stored.states[previous.id] ?? createPresetState()
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
        presets: [...value.presets, duplicate],
        states: { ...value.states, [duplicate.id]: createPresetState() }
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
  const state = store.get().states[preset.id] ?? createPresetState()
  if (state.drawn.length > 0 && !window.confirm(t('round.confirmReset'))) return
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

const renderGame = (preset: Preset, stored: Stored, t: Translate): void => {
  const settings = stored.settings
  let state = stored.states[preset.id] ?? createPresetState()
  const ensured = ensureWheelLayout(preset, state, crypto)
  state = ensured.state
  if (stored.states[preset.id] !== state) {
    persistPresetState(preset.id, () => state, false)
  }
  const remaining = getRemainingItems(preset, state)
  const liveOrder = getLiveOrder(ensured.layout.order, preset.elimination ? state.drawn : [])
  const completed = preset.elimination && remaining.length === 0
  const finalAct = preset.elimination && remaining.length === 1
  const wheelAvailable = isTableAvailable('wheel', liveOrder.length)

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
    preset.elimination &&
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
  const switcherLabel = document.createElement('span')
  switcherLabel.textContent = t('game.table')
  const wheelChoice = actionButton(t('game.wheel'), 'table-choice active', () => undefined)
  wheelChoice.setAttribute('aria-pressed', 'true')
  switcher.append(switcherLabel, wheelChoice)
  tableArea.append(switcher)

  const status = document.createElement('p')
  status.className = 'game-status'
  status.setAttribute('role', 'status')
  const rememberedResult = lastResults.get(preset.id)
  if (rememberedResult) status.textContent = t('game.result', { item: rememberedResult })

  const wheelHost = document.createElement('div')
  wheelHost.className = 'wheel-host'
  tableArea.append(wheelHost)

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
  } else if (wheelAvailable) {
    const luck = actionButton(t('game.tryLuck'), 'button button-primary luck-button', () => wheel?.tryLuck())
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
  if (preset.elimination) {
    layout.append(renderCemetery(state.drawn, t, () => void copyOrder(state.drawn, status, t)))
  }
  page.append(layout)
  root.append(page)

  if (!completed && (finalAct || wheelAvailable)) {
    wheel = new WheelTable()
    wheel.mount(wheelHost, {
      items: liveOrder,
      layout: ensured.layout,
      sound: settings.sound,
      haptics: settings.haptics,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      ariaLabel: t('game.wheelLabel'),
      interactive: !finalAct,
      onLayout: (next: WheelLayout) => {
        persistPresetState(preset.id, (current) => ({
          ...current,
          tables: { ...current.tables, wheel: next },
          updatedAt: Date.now()
        }), false)
      },
      onResult: (index) => {
        const selected = liveOrder[index]
        if (selected === undefined) return
        lastResults.set(preset.id, selected)
        const current = store.get().states[preset.id] ?? state
        if (preset.elimination) {
          dismissedResume.add(preset.id)
          persistPresetState(preset.id, () => applyResult(preset, current, liveOrder, index))
        } else {
          status.textContent = t('game.result', { item: selected })
        }
      },
      onWeakGesture: () => {
        status.textContent = t('game.weak')
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
  wheel?.unmount()
  wheel = null
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
