/** The frame owns the sidebar and rightbar tracks. Between them, business navigation
 * and the collapsible main outlet are independent of Session and panel selection.
 * The rightbar occupant reports its track and fullscreen state through `ctx.layout`.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  PropsLocale, PropsRenderSlots, PropsRuntime, PropsStore,
} from '@deepseek-ai/dsh-client-ui-slots'
import { computeColumns, RIGHTBAR_DEFAULT_RATIO, SIDEBAR_AUTO_COLLAPSE, SIDEBAR_DEFAULT } from './columns.ts'
import { DocumentTitle } from './DocumentTitle.tsx'
import type { createLayoutStore } from './stores.ts'
import { HUB_TABS, readBusinessPage, visibleBusinessModules } from './business-pages.ts'
import type { BusinessModule, HubTab } from './business-pages.ts'
import css from './AppFrame.module.css'

function HexGlyph({ glyph }: { glyph: string }) {
  const gradientId = `gooci-hex-${glyph}`
  return (
    <span className={css.hex} aria-hidden="true">
      <svg viewBox="0 0 32 36" width="22" height="24">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8ecbff" />
            <stop offset="1" stopColor="#2f78e6" />
          </linearGradient>
        </defs>
        <polygon points="16,1 31,9.5 31,26.5 16,35 1,26.5 1,9.5" fill={`url(#${gradientId})`} />
      </svg>
      <span>{glyph}</span>
    </span>
  )
}

type OpenPage = (module: BusinessModule, tab?: HubTab) => void

function ModuleRail({ collapsed, active, modules, open, expanded, toggle }: {
  collapsed: boolean; active: BusinessModule | undefined; modules: readonly BusinessModule[]; open: OpenPage; expanded: boolean; toggle: () => void
}) {
  const toggleLabel = expanded ? '收起工具页' : '展开工具页'
  return (
    <nav className={css.modules} aria-label="AI工具" data-collapsed={collapsed || undefined}>
      <div className={css.moduleHeader}>
        {!collapsed && <span className={css.moduleCaption}>AI工具</span>}
        <button type="button" className={css.moduleToggle} aria-label={toggleLabel} title={toggleLabel}
          aria-expanded={expanded} aria-controls="workbench-business" onClick={toggle}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" aria-hidden="true">
            <path d={expanded ? 'M10 3.5 5.5 8 10 12.5' : 'M6 3.5 10.5 8 6 12.5'} />
          </svg>
        </button>
      </div>
      {modules.map(item => (
        <button
          key={item.id}
          type="button"
          className={css.module}
          data-active={expanded && item === active || undefined}
          aria-current={expanded && item === active ? 'page' : undefined}
          aria-label={collapsed ? item.label : undefined}
          title={item.label}
          onClick={() => { if (!expanded || item !== active) open(item) }}
        >
          <HexGlyph glyph={item.glyph} />
          {!collapsed && <span className={css.moduleLabel}>{item.label}</span>}
        </button>
      ))}
    </nav>
  )
}

function BusinessPage({ module, tab, open, expanded }: ReturnType<typeof readBusinessPage> & { open: OpenPage; expanded: boolean }) {
  const content = module.id === 'AI_HUB' ? tab : module
  const stage = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (stage.current) stage.current.inert = !expanded
  }, [expanded])
  return (
    <main ref={stage} id="workbench-business" className={css.stage} aria-labelledby="business-page-title" aria-hidden={!expanded || undefined}>
      <div key={module.id} className={css.stageContent}>
        <h1 id="business-page-title" className={css.stageTitle}>{module.label}</h1>
        <p className={css.stageSub}>{module.purpose}</p>
        {module.id === 'AI_HUB' && (
          <nav className={css.tabs} aria-label="AI中台子页">
            {HUB_TABS.map(item => (
              <button key={item.id} type="button" className={css.tab} data-active={item === tab || undefined}
                aria-current={item === tab ? 'page' : undefined} onClick={() => { open(module, item) }}>
                {item.label}
              </button>
            ))}
          </nav>
        )}
        <div key={tab.id} className={css.stageDetails}>
          {module.id === 'AI_HUB' && <><h2>{tab.label}</h2><p>{tab.purpose}</p></>}
          <h2>待接入内容</h2>
          <p>{content.pending}</p>
        </div>
      </div>
    </main>
  )
}

/** Full composed props: runtime share + child-slot render share + store share. */
export type AppFrameProps =
  & PropsRuntime<'root'>
  & PropsRenderSlots<'sidebar' | 'main' | 'rightbar' | 'shell.overlay'>
  & PropsStore<ReturnType<typeof createLayoutStore>>
  & PropsLocale<'common'>
  & {
    /** Managed mode never shows business modules until a server allowlist is available. */
    managedAccess?: boolean
    /** Module IDs from the current authenticated session; not a server authorization check. */
    allowedModuleIds?: readonly string[]
  }

/** Subscribe to the main key without subscribing the column frame to each panel id. */
function MainPanel({ usePanelInfo, renderSlot }: Pick<PropsRuntime<'root'>, 'usePanelInfo'> & PropsRenderSlots<'main'>) {
  const panelId = usePanelInfo(info => info.activePanelId)
  return renderSlot('main', {}, { entryKey: panelId ?? 'conversation' })
}

/**
 * Right column grid item. Zero-width unless the occupant asked for a track; the
 * occupant's panel is positioned against the column's right edge, which never
 * moves, so it can hang over the centre when there is no track.
 */
function RightbarColumn(props: { children?: ReactNode }) {
  return <div className={css.rightbarCol} data-rightbar-col>{props.children}</div>
}

/**
 * One drag handle: pointer capture, rAF-throttled dx reports against the drag-start origin.
 * `side` keys the hover-reveal CSS to the owning column.
 */
function DragHandle(props: { side: 'sidebar' | 'rightbar'; left: number; onStart: () => void; onDrag: (dx: number) => void; onEnd: () => void }) {
  const [dragging, setDragging] = useState(false)
  const origin = useRef(0)
  const latest = useRef(0)
  const frame = useRef<number | null>(null)
  const capture = useRef<{ element: HTMLDivElement; id: number } | null>(null)
  const callbacks = useRef({ onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd })
  callbacks.current = { onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd }

  const endDrag = useCallback(() => {
    const active = capture.current
    if (active === null) return
    capture.current = null
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null }
    if (active.element.hasPointerCapture(active.id)) active.element.releasePointerCapture(active.id)
    setDragging(false)
    callbacks.current.onEnd()
  }, [])
  useEffect(() => endDrag, [endDrag])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || capture.current !== null) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    capture.current = { element: e.currentTarget, id: e.pointerId }
    origin.current = e.clientX
    latest.current = e.clientX
    callbacks.current.onStart()
    setDragging(true)
  }, [])
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (capture.current?.id !== e.pointerId) return
    latest.current = e.clientX
    frame.current ??= requestAnimationFrame(() => {
      frame.current = null
      callbacks.current.onDrag(latest.current - origin.current)
    })
  }, [])
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (capture.current?.id !== e.pointerId) return
    callbacks.current.onDrag(e.clientX - origin.current)
    endDrag()
  }, [endDrag])
  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (capture.current?.id === e.pointerId) endDrag()
  }, [endDrag])

  return (
    <div
      className={css.handle}
      style={{ left: props.left }}
      data-side={props.side}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
    />
  )
}

/** The three-column frame (see module doc). */
export function AppFrame({
  useStore,
  useSessions,
  usePanelInfo,
  actions,
  renderSlot,
  t,
  managedAccess,
  allowedModuleIds,
}: AppFrameProps) {
  const [page, setPage] = useState(readBusinessPage)
  const modules = visibleBusinessModules(managedAccess ? allowedModuleIds ?? [] : allowedModuleIds)
  const activeModule = modules.includes(page.module) ? page.module : undefined
  const [businessExpanded, setBusinessExpanded] = useState(true)
  const [mainExpanded, setMainExpanded] = useState(true)
  useEffect(() => {
    const restore = () => { setPage(readBusinessPage()) }
    window.addEventListener('popstate', restore)
    return () => { window.removeEventListener('popstate', restore) }
  }, [])
  const openPage: OpenPage = (module, tab = module === page.module ? page.tab : HUB_TABS[0]) => {
    if (!modules.includes(module)) return
    setBusinessExpanded(true)
    if (module === page.module && tab === page.tab) return
    const url = new URL(window.location.href)
    url.searchParams.set('fn', module.id)
    if (module.id === 'AI_HUB') url.searchParams.set('tab', tab.id)
    else url.searchParams.delete('tab')
    if (url.href !== window.location.href) window.history.pushState(window.history.state, '', url)
    setPage({ module, tab })
  }
  const layoutInfo = useStore(state => state.layoutInfo)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const viewport = layoutInfo.viewportWidth

  // Track the frame's own box (not the window): rAF-throttled ResizeObserver.
  useLayoutEffect(() => {
    const el = frameRef.current
    /* v8 ignore next -- the ref is always attached by effect time: the frame div renders unconditionally. */
    if (el === null) return
    let raf: number | null = null
    let disposed = false
    const measure = () => {
      const width = el.getBoundingClientRect().width
      if (width > 0) actions.setViewportWidth(width)
    }
    measure()
    const observer = new ResizeObserver(() => {
      if (disposed) return
      raf ??= requestAnimationFrame(() => {
        raf = null
        measure()
      })
    })
    observer.observe(el)
    return () => {
      disposed = true
      observer.disconnect()
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [actions])

  const narrow = viewport < SIDEBAR_AUTO_COLLAPSE
  const sidebarCollapsed = narrow ? !layoutInfo.narrowExpanded : layoutInfo.sidebar === 0
  const sidebarPreference = sidebarCollapsed
    ? 0
    : layoutInfo.sidebar === 0 ? SIDEBAR_DEFAULT : layoutInfo.sidebar
  const rightbarPreference = layoutInfo.rightbar ?? viewport * RIGHTBAR_DEFAULT_RATIO
  // Opening on a narrow frame collapses the left sidebar. Eligibility must
  // include that space before the occupant's first shown report arrives.
  const normal = computeColumns(viewport, !layoutInfo.rightbarShown && narrow ? 0 : sidebarPreference, rightbarPreference)
  const cols = computeColumns(viewport, sidebarPreference, layoutInfo.rightbarTrack ? rightbarPreference : 0)
  const colsRef = useRef(cols)
  colsRef.current = cols
  const rightbarWidth = useRef(normal.rightbar)
  rightbarWidth.current = normal.rightbar

  // The drag base is the rendered width captured at drag start (grabbing a
  // concession-clamped panel must not jump back to the stored preference);
  // it stays frozen for the whole gesture so dx deltas do not compound.
  const sidebarBase = useRef(0)
  const rightbarBase = useRef(0)
  // Track-level transitions pause for the whole gesture: eased tracks would
  // detach the column edge from the pointer (AppFrame.module.css).
  const [dragging, setDragging] = useState(false)
  const onDragEnd = useCallback(() => { setDragging(false) }, [])
  const onSidebarStart = useCallback(() => { sidebarBase.current = colsRef.current.sidebar; setDragging(true) }, [])
  const onSidebarDrag = useCallback((dx: number) => {
    actions.setSidebar(sidebarBase.current + dx)
  }, [actions])
  const onRightbarStart = useCallback(() => { rightbarBase.current = rightbarWidth.current; setDragging(true) }, [])
  const onRightbarDrag = useCallback((dx: number) => {
    actions.setRightbar(rightbarBase.current - dx)
  }, [actions])
  const productTitle = process.env.DSH_CLIENT_TITLE ?? t('brand.localBuild')
  const sidebar = useMemo(() => renderSlot('sidebar', {
    collapsed: sidebarCollapsed,
    width: cols.sidebar,
  }), [renderSlot, sidebarCollapsed, cols.sidebar])
  const main = useMemo(() => (
    <MainPanel usePanelInfo={usePanelInfo} renderSlot={renderSlot} />
  ), [usePanelInfo, renderSlot])
  const overlays = useMemo(() => renderSlot('shell.overlay', {}), [renderSlot])

  return (
    <div
      ref={frameRef}
      className={css.frame}
      style={{
        gridTemplateColumns:
          `${cols.sidebar}px minmax(0, 1fr) ${cols.rightbar}px`,
      }}
      data-sidebar-collapsed={sidebarCollapsed || undefined}
      data-rightbar-collapsed={cols.rightbar === 0 || undefined}
      data-rightbar-fullscreen={layoutInfo.rightbarFullscreen || undefined}
      data-rightbar-instant={layoutInfo.rightbarInstant || undefined}
      data-dragging={dragging || undefined}
    >
      <header className={css.topbar}>
        <span className={css.brand}>
          <span className={css.mark} aria-hidden="true">G</span>
          <b>谷器</b>
        </span>
        <button type="button" className={css.tab} aria-expanded={mainExpanded} aria-controls="workbench-main"
          onClick={() => { setMainExpanded(value => !value) }}>
          {mainExpanded ? '收起会话' : '展开会话'}
        </button>
        <span className={css.topActions} aria-hidden="true">
          <span className={css.topDot} />
          <span className={css.topDot} />
          <span className={css.topDot} />
          <span className={css.avatar}>A</span>
        </span>
      </header>
      <DocumentTitle
        productTitle={productTitle}
        useSessions={useSessions}
        usePanelInfo={usePanelInfo}
      />
      <div className={css.sidebarCol}>
        {modules.length > 0 && <ModuleRail collapsed={sidebarCollapsed} active={activeModule} modules={modules} open={openPage} expanded={businessExpanded}
          toggle={() => { setBusinessExpanded(value => !value) }} />}
        <div className={css.sessionDock}>{sidebar}</div>
      </div>
      <div className={css.centerCol} data-stacked={cols.center < 760 || undefined} data-business-hidden={!businessExpanded || !activeModule || undefined}>
        {activeModule && <BusinessPage {...page} open={openPage} expanded={businessExpanded} />}
        <aside id="workbench-main" aria-label="会话与工作面板" className={css.stageBody} hidden={!mainExpanded}>{main}</aside>
      </div>
      <RightbarColumn>
        {renderSlot('rightbar', { width: normal.rightbar, viewportWidth: viewport, canShow: normal.rightbar > 0 })}
      </RightbarColumn>
      <div className={css.overlayLayer} data-shell-overlay>
        {overlays}
      </div>
      {/* The collapsed rail is fixed-width: no resize handle while closed. */}
      {!sidebarCollapsed && <DragHandle side="sidebar" left={cols.sidebar} onStart={onSidebarStart} onDrag={onSidebarDrag} onEnd={onDragEnd} />}
      {layoutInfo.rightbarShown && !layoutInfo.rightbarFullscreen && normal.rightbar > 0 && (
        <DragHandle side="rightbar" left={viewport - normal.rightbar} onStart={onRightbarStart} onDrag={onRightbarDrag} onEnd={onDragEnd} />
      )}
    </div>
  )
}
