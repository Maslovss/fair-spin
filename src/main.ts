import './styles.css'
import { detectLanguage, relativeTime, translator, type Translate } from './io/i18n'
import {
  RevealLifecycle,
  type TableLifecycleState
} from './core/reveal'
import { createCardsLayout } from './core/cards'
import {
  isPlaceholderCompletion,
  isQuestionTemplate,
  questionTemplateParts
} from './core/question'
import { CurrentTableResult } from './core/result-label'
import { createAnswerPair } from './core/answer-presentation'
import {
  clearQuestionHashUrl,
  decodeQuestionHash,
  prepareQuestionShare,
  QuestionShareError,
  type SharedQuestion
} from './io/question-share'
import {
  formatSharedOrder,
  formatSingleAnswer,
  fullOrderText,
  shareText
} from './io/share'
import {
  applyResult,
  canPlayQuestion,
  canStartNewRound,
  ensureLayout,
  getPosedQuestion,
  getLiveOrder,
  getRemainingItems,
  needsRoundResetConfirmation,
  performFinalAct,
  setEliminationModeForPreset,
  startNewRound,
  syncEditedPreset
} from './state/round'
import {
  createPresetState,
  type CardsLayout,
  type Preset,
  type PresetState,
  type ReelLayout,
  type Stored,
  type TableId,
  type WheelLayout
} from './state/types'
import {
  addStarterPresets,
  assertUniquePresetName,
  createPreset,
  duplicatePreset,
  createPresetStateForPreset,
  removePreset,
  nextUniquePresetName,
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
import { openQuestionPrompt } from './ui/question-prompt'
import { renderAnswerBlock } from './ui/answer-block'
import {
  openQuestionImport,
  openQuestionImportError
} from './ui/question-import'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Application root is missing')

const wasFirstLaunch = localStorage.getItem(STORAGE_KEY) === null
const store = new PersistedStore(localStorage, detectLanguage())
if (wasFirstLaunch) store.replace(seedStarterPresets(store.get()), false)

let activePresetId: string | null = null
let activeTable: Table | null = null
let activeLifecycle: RevealLifecycle<number> | null = null
const dismissedResume = new Set<string>()
const currentTableResult = new CurrentTableResult()
let statusTimer: ReturnType<typeof setTimeout> | null = null
const APPLY_REBUILD_DELAY_MS = 160
const CARDS_COLLECT_MS = 320
const RESULT_FLIGHT_MS = 560
const appUrl = new URL(location.pathname, location.origin).href

const actionButton = (label: string, className: string, action: () => void): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.textContent = label
  button.addEventListener('click', action)
  return button
}

const showToast = (message: string): void => {
  document.querySelector('.app-toast')?.remove()
  const toast = document.createElement('p')
  toast.className = 'app-toast'
  toast.setAttribute('role', 'status')
  toast.textContent = message
  document.body.append(toast)
  setTimeout(() => toast.remove(), 3_000)
}

const performShare = async (
  text: string,
  t: Translate,
  status?: HTMLElement
): Promise<void> => {
  try {
    const outcome = await shareText(text)
    const message = t(outcome === 'shared' ? 'share.shared' : 'share.copied')
    if (status) status.textContent = message
    else showToast(message)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    const message = t('share.failed')
    if (status) status.textContent = message
    else showToast(message)
  }
}

const shareQuestion = async (preset: Preset, t: Translate): Promise<void> => {
  const prepared = await prepareQuestionShare(preset, location.href)
  const text = prepared.kind === 'link'
    ? prepared.text
    : `${t('share.listTooLong')}\n\n${preset.name}\n${prepared.text}`
  await performShare(text, t)
}

const updatePresetInStore = (next: Preset, previous?: Preset): void => {
  store.update((stored) => {
    assertUniquePresetName(stored.presets, next.name, previous?.id)
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
  openPresetEditor(root, t, preset, store.get().presets, updatePresetInStore)
}

const showSettings = (): void => {
  const settings = store.get().settings
  openSettings(root, settings, translator(settings.lang), (next, redraw) => {
    store.update((stored) => ({ ...stored, settings: next }), redraw)
  }, () => {
    let added = 0
    store.update((stored) => {
      const result = addStarterPresets(stored, stored.settings.lang)
      added = result.added
      return result.stored
    }, false)
    return added
  })
}

const renderList = (stored: Stored, t: Translate): void => {
  renderPresetList(root, stored.presets, t, {
    open: (preset) => {
      activePresetId = preset.id
      dismissedResume.delete(preset.id)
      currentTableResult.clear()
      render()
    },
    edit: editPreset,
    duplicate: (preset) => {
      const duplicate = duplicatePreset(
        preset,
        nextUniquePresetName(
          store.get().presets,
          t('questions.copyName', { name: preset.name })
        )
      )
      store.update((value) => ({
        ...value,
        presets: [...value.presets, duplicate]
      }))
    },
    delete: (preset) => {
      if (window.confirm(t('questions.deleteConfirm', { name: preset.name }))) {
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
    needsRoundResetConfirmation(state) &&
    !window.confirm(t('round.confirmReset', {
      drawn: state.drawn.length,
      total: preset.items.length
    }))
  ) return
  dismissedResume.add(preset.id)
  currentTableResult.clear()
  persistPresetState(preset.id, (current) => startNewRound(preset, crypto, current))
}

const poseNewQuestion = (preset: Preset, state: PresetState, t: Translate): void => {
  openQuestionPrompt(
    root,
    t,
    preset.name,
    (value) => {
      if (
        needsRoundResetConfirmation(state) &&
        !window.confirm(t('round.confirmReset', {
          drawn: state.drawn.length,
          total: preset.items.length
        }))
      ) return false
      const completion = value || t('question.placeholder')
      dismissedResume.add(preset.id)
      currentTableResult.clear()
      persistPresetState(
        preset.id,
        (current) => startNewRound(preset, crypto, current, Date.now(), completion)
      )
      return true
    },
    () => {
      activePresetId = null
      render()
    }
  )
}

const copyOrder = async (items: readonly string[], status: HTMLElement, t: Translate): Promise<void> => {
  try {
    await navigator.clipboard.writeText(fullOrderText(items))
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
      if (state.elimination !== elimination) currentTableResult.clear()
      persistPresetState(
        preset.id,
        (current) => setEliminationModeForPreset(preset, current, elimination, crypto)
      )
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
  return t('game.cardsLabel')
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
  const template = isQuestionTemplate(preset.name)
  const canPlay = canPlayQuestion(preset, state)
  currentTableResult.enter(preset.id, tableId)
  state = ensureLayout(tableId, preset, state, crypto)
  if (state.lastTable !== tableId) state = { ...state, lastTable: tableId }
  if (stored.states[preset.id] !== state) {
    persistPresetState(preset.id, () => state, false)
  }
  const activeLayout = tableId === 'wheel'
    ? state.tables.wheel
    : tableId === 'cards'
      ? state.tables.cards
      : state.tables.reel
  if (!activeLayout) throw new Error(`Layout was not created for table: ${tableId}`)
  const liveOrder = tableId === 'cards'
    ? [...activeLayout.order]
    : getLiveOrder(activeLayout.order, state.elimination ? state.drawn : [])
  let currentTableItems = [...liveOrder]
  const completed = canPlay && state.elimination && remaining.length === 0
  const finalAct = canPlay && state.elimination && remaining.length === 1 && tableId !== 'cards'

  const page = document.createElement('main')
  page.className = 'game-page'
  const header = document.createElement('header')
  header.className = 'game-header'
  const back = actionButton(`← ${t('game.back')}`, 'text-button back-button', () => {
    currentTableResult.clear()
    activePresetId = null
    render()
  })
  const titleGroup = document.createElement('div')
  const eyebrow = document.createElement('span')
  eyebrow.className = 'eyebrow'
  eyebrow.textContent = t('brand')
  const title = document.createElement('h1')
  const posedTitle = getPosedQuestion(preset, state)
  if (template && state.question !== undefined) {
    const parts = questionTemplateParts(preset.name)
    const before = parts?.before ?? ''
    title.append(document.createTextNode(
      before && !/\s$/u.test(before) ? `${before} ` : before
    ))
    const completion = document.createElement('span')
    completion.className = 'question-completion'
    completion.textContent = state.question
    title.append(completion, document.createTextNode(parts?.after ?? ''))
  } else {
    title.textContent = posedTitle
  }
  if (template && state.question === undefined) {
    title.classList.add('question-title-action')
    title.tabIndex = 0
    title.setAttribute('role', 'button')
    title.setAttribute('aria-label', t('question.poseTitle'))
    const openQuestion = () => poseNewQuestion(preset, state, t)
    title.addEventListener('click', openQuestion)
    title.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') openQuestion()
    })
  }
  titleGroup.append(eyebrow, title)
  const headerActions = document.createElement('div')
  headerActions.className = 'game-header-actions'
  if (template) {
    headerActions.append(actionButton(
      t('question.new'),
      'button button-quiet question-new',
      () => poseNewQuestion(preset, state, t)
    ))
  } else if (canStartNewRound(preset, state)) {
    headerActions.append(actionButton(
      t('round.new'),
      'button button-quiet',
      () => resetRound(preset, t)
    ))
  }
  if (
    template &&
    state.question !== undefined &&
    !isPlaceholderCompletion(state.question)
  ) {
    const menu = document.createElement('details')
    menu.className = 'question-menu'
    const summary = document.createElement('summary')
    summary.textContent = t('question.menu')
    const saveCopy = actionButton(
      t('question.saveCopy'),
      'text-button question-save-copy',
      () => {
        if (!window.confirm(t('question.saveCopyConfirm'))) return
        openPresetEditor(
          root,
          t,
          undefined,
          store.get().presets,
          updatePresetInStore,
          { name: posedTitle, items: [...preset.items] }
        )
      }
    )
    menu.append(summary, saveCopy)
    headerActions.append(menu)
  }
  headerActions.append(actionButton(
    t('share.question'),
    'button button-quiet',
    () => void shareQuestion(preset, t)
  ))
  headerActions.append(
    actionButton(t('game.edit'), 'button button-quiet', () => editPreset(preset))
  )
  header.append(back, titleGroup, headerActions)
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
      if (id !== tableId) currentTableResult.clear()
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

  const answerHost = document.createElement('section')
  answerHost.className = 'answer-block'
  answerHost.setAttribute('role', 'status')
  answerHost.setAttribute('aria-live', 'polite')
  const answerShare = actionButton(
    t('share.answer'),
    'text-button answer-share',
    () => {
      const answer = currentTableResult.read(preset.id, tableId)
      if (!answer) return
      void performShare(
        formatSingleAnswer(
          createAnswerPair(preset, state, answer),
          tableLabel(tableId, t),
          appUrl
        ),
        t,
        status
      )
    }
  )
  const rememberedResult = currentTableResult.read(preset.id, tableId)
  const showAnswer = (answer: string | null) => {
    renderAnswerBlock(
      answerHost,
      answer ? createAnswerPair(preset, state, answer) : null
    )
    answerShare.hidden = answer === null
  }

  const status = document.createElement('p')
  status.className = 'game-status'
  status.setAttribute('role', 'status')
  showAnswer(rememberedResult)

  const shareOrder = () => void performShare(
    formatSharedOrder(
      posedTitle,
      state.drawn,
      preset.items.length,
      completed,
      {
        order: t('share.orderLabel'),
        all: t('share.allLabel'),
        of: t('share.ofLabel'),
        andMore: t('share.andMoreLabel')
      },
      appUrl
    ),
    t,
    status
  )

  const tableHost = document.createElement('div')
  tableHost.className = 'table-host'
  tableArea.append(tableHost)

  const controls = document.createElement('div')
  controls.className = 'game-controls'
  if (!canPlay) {
    const required = document.createElement('p')
    required.className = 'question-required'
    required.textContent = t('question.required')
    controls.append(
      required,
      actionButton(
        t('question.pose'),
        'button button-primary question-pose',
        () => poseNewQuestion(preset, state, t)
      )
    )
  } else if (completed) {
    const complete = document.createElement('div')
    complete.className = 'round-complete'
    const completeTitle = document.createElement('h2')
    completeTitle.textContent = t('round.complete')
    complete.append(
      completeTitle,
      actionButton(t('round.new'), 'button button-primary', () => resetRound(preset, t)),
      actionButton(t('round.copy'), 'button button-quiet', () => void copyOrder(state.drawn, status, t)),
      actionButton(t('share.order'), 'button button-quiet', shareOrder)
    )
    controls.append(complete)
  } else if (finalAct) {
    const finalItem = remaining[0] ?? ''
    controls.append(actionButton(
      t('game.finalAct', { item: finalItem }),
      'button button-primary final-act',
      () => {
        currentTableResult.record(preset.id, tableId, finalItem)
        persistPresetState(preset.id, (current) => performFinalAct(preset, current))
      }
    ))
  } else if (tableId === 'cards' ? remaining.length >= 1 : liveOrder.length >= 2) {
    const luck = actionButton(
      t('game.tryLuck'),
      'button button-primary luck-button',
      () => activeTable?.tryLuck()
    )
    luck.disabled = !canPlay
    controls.append(luck)
  } else {
    const unavailable = document.createElement('p')
    unavailable.className = 'unavailable'
    unavailable.textContent = t('game.unavailable')
    controls.append(unavailable)
  }
  if (state.elimination && state.drawn.length > 0 && !completed) {
    controls.append(actionButton(t('share.order'), 'text-button order-share', shareOrder))
  }
  controls.append(answerHost, answerShare, status)
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
        const selected = currentTableItems[index]
        if (selected === undefined) return
        currentTableResult.record(preset.id, tableId, selected)
        showAnswer(selected)
        activeTable?.highlightResult(index)
      },
      onApply: (index) => {
        const selected = currentTableItems[index]
        if (selected === undefined) {
          activeTable?.clearHighlight()
          lifecycle.completeApplying()
          return
        }
        if (!state.elimination) {
          activeTable?.clearHighlight()
          if (tableId === 'cards') {
            currentTableResult.clear()
            showAnswer(null)
            status.textContent = ''
            tableHost.classList.add('cards-collecting')
            setTimeout(() => {
              persistPresetState(preset.id, (current) => ({
                ...current,
                tables: {
                  ...current.tables,
                  cards: createCardsLayout(preset.items, crypto)
                },
                updatedAt: Date.now()
              }))
            }, CARDS_COLLECT_MS)
            return
          }
          lifecycle.completeApplying()
          return
        }
        dismissedResume.add(preset.id)
        startResultFlight(tableHost, selected)
        activeTable?.clearHighlight()
        setTimeout(() => {
          const current = store.get().states[preset.id] ?? state
          persistPresetState(
            preset.id,
            () => applyResult(preset, current, currentTableItems, index)
          )
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
      items: currentTableItems,
      roundItems: preset.items,
      layout: activeLayout,
      drawn: state.elimination ? state.drawn : [],
      sound: settings.sound,
      haptics: settings.haptics,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      ariaLabel: tableAriaLabel(tableId, t),
      interactive: canPlay && !finalAct,
      cardsLabels: tableId === 'cards' ? {
        deck: t('cards.deck'),
        cutHint: t('cards.cutHint'),
        cutRequired: t('cards.cutRequired'),
        deal: t('cards.deal'),
        dealing: t('cards.dealing'),
        cardBack: (position) => t('cards.cardBack', { position }),
        empty: (position) => t('cards.empty', { position })
      } : undefined,
      canPrepare: () => canPlay && lifecycle.state === 'idle',
      onStart: () => canPlay && lifecycle.tryStart(),
      onCancel: () => {
        lifecycle.cancelStart()
      },
      onResolved: (index) => {
        lifecycle.resolve(index)
      },
      onSettled: () => {
        lifecycle.settle()
      },
      onLayout: (next: WheelLayout | ReelLayout | CardsLayout) => {
        if ('positions' in next) currentTableItems = [...next.order]
        persistPresetState(preset.id, (current) => ({
          ...current,
          tables: {
            ...current.tables,
            ...(
              'angle' in next
                ? { wheel: next }
                : 'positions' in next
                  ? { cards: next }
                  : { reel: next }
            )
          },
          updatedAt: Date.now()
        }), false)
      },
      onWeakGesture: () => {
        status.textContent = weakGestureLabel(tableId, t)
        if (statusTimer !== null) clearTimeout(statusTimer)
        statusTimer = setTimeout(() => {
          status.textContent = ''
        }, 3_000)
      },
      onInteraction: () => {
        currentTableResult.clear()
        showAnswer(null)
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

const clearImportHash = (): void => {
  history.replaceState(null, '', clearQuestionHashUrl(location))
}

const addImportedQuestion = (question: SharedQuestion): void => {
  const preset = createPreset(question)
  store.update((stored) => ({
    ...stored,
    presets: [...stored.presets, preset]
  }))
}

const replaceImportedQuestion = (
  existing: Preset,
  question: SharedQuestion
): void => {
  const now = Date.now()
  const replacement: Preset = {
    ...existing,
    name: question.name,
    items: [...question.items],
    updatedAt: now
  }
  currentTableResult.clear()
  store.update((stored) => ({
    ...stored,
    presets: stored.presets.map((preset) =>
      preset.id === existing.id ? replacement : preset
    ),
    states: {
      ...stored.states,
      [existing.id]: startNewRound(
        replacement,
        crypto,
        stored.states[existing.id] ?? createPresetStateForPreset(existing),
        now
      )
    }
  }))
}

const offerQuestionImport = async (): Promise<void> => {
  if (!location.hash.startsWith('#q=')) return
  const t = translator(store.get().settings.lang)
  try {
    const question = await decodeQuestionHash(location.hash)
    openQuestionImport(root, t, question, store.get().presets, {
      add: (imported) => {
        clearImportHash()
        addImportedQuestion(imported)
      },
      replace: (existing, imported) => {
        clearImportHash()
        replaceImportedQuestion(existing, imported)
      },
      cancel: clearImportHash
    })
  } catch (error) {
    openQuestionImportError(
      root,
      t,
      error instanceof QuestionShareError && error.code === 'new-version',
      clearImportHash
    )
  }
}

void offerQuestionImport()
