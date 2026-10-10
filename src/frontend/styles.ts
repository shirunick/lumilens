import type { SpindleFrontendContext } from 'lumiverse-spindle-types'
import { MOBILE_MAX_WIDTH } from './safe-modal'

export function addLumiLensStyles(ctx: SpindleFrontendContext): () => void {
  return ctx.dom.addStyle(`
    .ll-root, .ll-qv, .ll-chat-picker, .ll-tinder-modal {
      --ll-accent: var(--lumiverse-accent, #a78bfa);
      --ll-accent-fg: var(--lumiverse-accent-fg, #ffffff);
      --ll-text: var(--lumiverse-text, #f1f5f9);
      --ll-dim: var(--lumiverse-text-dim, #94a3b8);
      --ll-fill: var(--lumiverse-fill, rgba(255, 255, 255, 0.07));
      --ll-fill-subtle: var(--lumiverse-fill-subtle, rgba(255, 255, 255, 0.04));
      --ll-border: var(--lumiverse-border, rgba(255, 255, 255, 0.1));
      --ll-border-hover: var(--lumiverse-border-hover, rgba(255, 255, 255, 0.24));
      --ll-radius: var(--lumiverse-radius, 12px);
      --ll-danger: #ef4444;
      --ll-success: #22c55e;
      --ll-gold: #facc15;
      color: var(--ll-text);
      font-size: 14px;
      line-height: 1.45;
      box-sizing: border-box;
    }
    .ll-root *, .ll-qv *, .ll-chat-picker *, .ll-tinder-modal * { box-sizing: border-box; }

    .ll-root {
      height: 100%;
      overflow-y: auto;
      scrollbar-gutter: stable;
      -webkit-overflow-scrolling: touch;
    }
    .ll-page {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px;
      min-height: 100%;
    }
    .ll-page[hidden], .ll-page-body[hidden] { display: none; }
    .ll-page-body { display: flex; flex-direction: column; gap: 14px; flex: 1; min-width: 0; }
    .ll-page-lead {
      margin: -4px 0 0;
      color: var(--ll-dim);
      font-size: 13px;
      line-height: 1.45;
    }

    .ll-hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 6px;
      padding: 18px 8px 8px;
    }
    .ll-hero-avatar {
      position: relative;
      width: 112px;
      height: 112px;
      margin-bottom: 8px;
    }
    .ll-hero-avatar::before {
      content: '';
      position: absolute;
      inset: -10px;
      border-radius: 50%;
      background: radial-gradient(circle, color-mix(in srgb, var(--ll-accent) 55%, transparent) 0%, transparent 70%);
    }
    .ll-hero-avatar .ll-avatar {
      position: relative;
      width: 112px;
      height: 112px;
      border-width: 3px;
    }
    .ll-hero-name { font-size: 24px; font-weight: 800; letter-spacing: -0.01em; }
    .ll-hero-sub { color: var(--ll-dim); font-size: 13px; max-width: 280px; }

    .ll-menu { display: flex; flex-direction: column; gap: 10px; }
    .ll-menu-item {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      padding: 14px;
      text-align: left;
      color: var(--ll-text);
      font: inherit;
      cursor: pointer;
      background: var(--ll-fill-subtle);
      border: 1px solid var(--ll-border);
      border-radius: calc(var(--ll-radius) + 4px);
      transition: border-color 0.15s ease, background-color 0.15s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .ll-menu-item:hover, .ll-menu-item:active {
      border-color: color-mix(in srgb, var(--ll-accent) 60%, transparent);
      background: color-mix(in srgb, var(--ll-accent) 10%, var(--ll-fill-subtle));
    }
    .ll-menu-icon {
      flex-shrink: 0;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 14px;
      color: var(--ll-accent);
      background: color-mix(in srgb, var(--ll-accent) 16%, transparent);
      border: 1px solid color-mix(in srgb, var(--ll-accent) 30%, transparent);
    }
    .ll-menu-text { flex: 1; min-width: 0; }
    .ll-menu-title { font-weight: 700; font-size: 15px; }
    .ll-menu-desc { color: var(--ll-dim); font-size: 12px; margin-top: 2px; }
    .ll-menu-chev { color: var(--ll-dim); display: flex; }
    .ll-foot { margin-top: auto; text-align: center; color: var(--ll-dim); font-size: 11px; padding-top: 8px; }

    .ll-topbar { display: flex; align-items: center; gap: 10px; }
    .ll-topbar-title { flex: 1; font-size: 17px; font-weight: 800; min-width: 0; }
    .ll-icon-btn {
      display: inline-grid;
      place-items: center;
      width: 38px;
      height: 38px;
      flex-shrink: 0;
      padding: 0;
      color: var(--ll-text);
      cursor: pointer;
      background: var(--ll-fill-subtle);
      border: 1px solid var(--ll-border);
      border-radius: 12px;
      -webkit-tap-highlight-color: transparent;
    }
    .ll-icon-btn:hover { border-color: var(--ll-border-hover); }
    .ll-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .ll-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      background: var(--ll-fill);
      border: 2px solid color-mix(in srgb, var(--ll-accent) 60%, transparent);
    }
    .ll-avatar-sm { width: 30px; height: 30px; border-width: 1.5px; }
    .ll-avatar-lg { width: 88px; height: 88px; border-width: 3px; }
    .ll-avatar-placeholder {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      color: var(--ll-accent);
    }

    .ll-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 16px;
      font: inherit;
      font-size: 13px;
      font-weight: 650;
      color: var(--ll-text);
      cursor: pointer;
      background: var(--ll-fill);
      border: 1px solid var(--ll-border);
      border-radius: 12px;
      transition: border-color 0.15s ease, transform 0.1s ease, opacity 0.15s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .ll-btn:hover { border-color: var(--ll-border-hover); }
    .ll-btn:active { transform: scale(0.98); }
    .ll-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .ll-btn[hidden] { display: none; }
    .ll-btn-primary {
      color: var(--ll-accent-fg);
      background: var(--ll-accent);
      border-color: transparent;
    }
    .ll-btn-ghost { background: transparent; }
    .ll-btn-block { width: 100%; }
    .ll-btn-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .ll-btn-row > .ll-btn { flex: 1 1 auto; }

    .ll-hero-btn {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      padding: 16px;
      text-align: left;
      font: inherit;
      color: var(--ll-accent-fg);
      cursor: pointer;
      border: 0;
      border-radius: calc(var(--ll-radius) + 6px);
      background: linear-gradient(135deg, var(--ll-accent), color-mix(in srgb, var(--ll-accent) 55%, #000));
      box-shadow: 0 6px 16px color-mix(in srgb, var(--ll-accent) 30%, transparent);
      transition: filter 0.15s ease;
    }
    .ll-hero-btn:hover { filter: brightness(1.08); }
    .ll-hero-btn:disabled { opacity: 0.6; cursor: wait; }
    .ll-hero-btn-icon {
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      flex-shrink: 0;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.2);
    }
    .ll-hero-btn-title { font-weight: 800; font-size: 16px; }
    .ll-hero-btn-desc { font-size: 12px; opacity: 0.85; margin-top: 2px; }

    .ll-divider {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--ll-dim);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .ll-divider::before, .ll-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--ll-border);
    }

    .ll-field-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 11px;
      font-weight: 750;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ll-accent);
    }
    .ll-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .ll-chip {
      padding: 6px 12px;
      font: inherit;
      font-size: 12px;
      color: var(--ll-dim);
      cursor: pointer;
      background: var(--ll-fill-subtle);
      border: 1px solid var(--ll-border);
      border-radius: 999px;
      transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .ll-chip:hover { color: var(--ll-text); border-color: var(--ll-border-hover); }
    .ll-chip[data-active="true"] {
      color: var(--ll-accent-fg);
      font-weight: 650;
      background: var(--ll-accent);
      border-color: transparent;
    }

    .ll-textarea, .ll-select {
      width: 100%;
      padding: 10px 12px;
      font: inherit;
      font-size: 13px;
      color: var(--ll-text);
      background: var(--ll-fill);
      border: 1px solid var(--ll-border);
      border-radius: 12px;
      outline: none;
    }
    .ll-textarea:focus, .ll-select:focus { border-color: var(--ll-accent); }
    .ll-textarea { min-height: 76px; resize: vertical; }

    .ll-form { display: flex; flex-direction: column; gap: 14px; }
    .ll-card-panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px;
      background: var(--ll-fill-subtle);
      border: 1px solid var(--ll-border);
      border-radius: calc(var(--ll-radius) + 4px);
    }
    .ll-panel-title { font-weight: 750; font-size: 14px; }
    .ll-switch-label { font-weight: 650; font-size: 13px; }
    .ll-collapse { gap: 0; }
    .ll-collapse-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      width: 100%;
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .ll-collapse-chevron {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      color: var(--ll-dim);
      transition: transform 0.18s ease;
    }
    .ll-collapse[data-open="true"] .ll-collapse-chevron {
      transform: rotate(90deg);
    }
    .ll-collapse-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 12px;
    }
    .ll-collapse[data-open="false"] .ll-collapse-body { display: none; }
    .ll-subcat {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid var(--ll-border);
      border-radius: calc(var(--ll-radius) + 2px);
      background: color-mix(in srgb, var(--ll-fill) 55%, transparent);
    }
    .ll-subcat-title {
      font-size: 11px;
      font-weight: 750;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--ll-dim);
    }
    .ll-conn-actions, .ll-conn-shared {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ll-conn-actions[hidden] { display: none; }
    .ll-conn-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .ll-conn-label {
      font-size: 12px;
      font-weight: 650;
      color: var(--ll-dim);
    }

    .ll-switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      cursor: pointer;
    }
    .ll-switch {
      appearance: none;
      -webkit-appearance: none;
      position: relative;
      flex-shrink: 0;
      width: 46px;
      height: 26px;
      margin: 0;
      cursor: pointer;
      border-radius: 999px;
      background: var(--ll-fill);
      border: 1px solid var(--ll-border);
      transition: background 0.18s ease;
    }
    .ll-switch::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--ll-text);
      transition: transform 0.18s ease;
    }
    .ll-switch:checked { background: var(--ll-accent); border-color: transparent; }
    .ll-switch:checked::after { transform: translateX(20px); background: var(--ll-accent-fg); }

    .ll-muted { color: var(--ll-dim); font-size: 12px; }
    .ll-center { text-align: center; }
    .ll-warn { font-size: 12px; color: var(--ll-gold); }
    .ll-error {
      padding: 12px;
      font-size: 13px;
      color: var(--ll-text);
      border-radius: 12px;
      background: color-mix(in srgb, var(--ll-danger) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--ll-danger) 40%, transparent);
    }
    .ll-empty { padding: 28px 12px; text-align: center; color: var(--ll-dim); }
    .ll-status { min-height: 1.2em; font-size: 12px; color: var(--ll-dim); text-align: center; }

    .ll-tags { display: flex; flex-wrap: wrap; gap: 4px; }
    .ll-tag {
      padding: 2px 8px;
      font-size: 11px;
      color: var(--ll-dim);
      background: var(--ll-fill);
      border: 1px solid var(--ll-border);
      border-radius: 999px;
    }

    .ll-art-fallback {
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 28px;
      color: var(--ll-accent);
      background: linear-gradient(135deg, color-mix(in srgb, var(--ll-accent) 25%, transparent), var(--ll-fill));
    }

    .ll-results { display: flex; flex-direction: column; gap: 12px; }
    .ll-rcard {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 12px;
      background: var(--ll-fill-subtle);
      border: 1px solid var(--ll-border);
      border-radius: calc(var(--ll-radius) + 4px);
      animation: ll-pop 0.25s ease backwards;
    }
    .ll-rcard-top { display: flex; gap: 12px; align-items: flex-start; }
    .ll-rcard-art {
      width: 76px;
      height: 76px;
      object-fit: cover;
      flex-shrink: 0;
      border-radius: 14px;
      border: 1px solid var(--ll-border);
    }
    .ll-rcard-body { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 6px; }
    .ll-rcard-name { font-size: 16px; font-weight: 800; overflow-wrap: anywhere; }
    .ll-results-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .ll-results-bar-text { font-size: 13px; font-weight: 700; color: var(--ll-dim); }
    .ll-intro { display: flex; align-items: center; gap: 10px; padding: 4px 2px 2px; }
    .ll-intro-text { font-size: 14px; font-weight: 600; line-height: 1.4; }
    .ll-pitch {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding: 10px 12px;
      border-radius: 14px;
      background: var(--ll-fill);
      border: 1px solid var(--ll-border);
      margin: 10px 0;
    }
    .ll-pitch-text { flex: 1; min-width: 0; font-size: 14px; line-height: 1.55; white-space: pre-wrap; }
    .ll-pitch-wait { color: var(--ll-dim); font-style: italic; animation: ll-fade-pulse 1.6s ease-in-out infinite; }
    .ll-bio-regen { flex-shrink: 0; width: 28px; height: 28px; align-self: flex-start; }
    .ll-bio-regen:disabled { opacity: 0.5; cursor: wait; }
    .ll-launch { display: flex; flex-direction: column; gap: 12px; }
    .ll-launch-text { font-size: 14px; line-height: 1.5; color: var(--ll-dim); margin: 0; }
    .ll-tinder-modal { padding: 4px 2px 8px; }
    .ll-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 28px 12px;
      text-align: center;
    }
    .ll-loading-avatar { position: relative; display: grid; place-items: center; }
    .ll-loading-halo {
      position: absolute;
      inset: -12px;
      border-radius: 50%;
      background: radial-gradient(circle, color-mix(in srgb, var(--ll-accent) 50%, transparent) 0%, transparent 70%);
      animation: ll-halo 2.2s ease-in-out infinite;
    }
    .ll-loading-avatar .ll-avatar { position: relative; }
    .ll-loading-title { font-size: 16px; font-weight: 700; max-width: 280px; }
    .ll-shimmer {
      position: relative;
      width: 160px;
      height: 3px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--ll-fill);
    }
    .ll-shimmer span {
      position: absolute;
      inset: 0 auto 0 0;
      width: 50%;
      border-radius: 999px;
      background: linear-gradient(90deg, transparent, var(--ll-accent), transparent);
      animation: ll-shimmer 1.4s ease-in-out infinite;
    }

    .ll-tinder { display: flex; flex-direction: column; gap: 10px; align-items: stretch; }
    .ll-seg {
      flex: 1;
      display: flex;
      gap: 4px;
      padding: 4px;
      background: var(--ll-fill-subtle);
      border: 1px solid var(--ll-border);
      border-radius: 14px;
    }
    .ll-seg-btn {
      flex: 1;
      padding: 8px 10px;
      font: inherit;
      font-size: 13px;
      font-weight: 650;
      color: var(--ll-dim);
      cursor: pointer;
      background: transparent;
      border: none;
      border-radius: 10px;
      transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
    }
    .ll-seg-btn[data-active="true"] {
      color: var(--ll-accent-fg);
      background: var(--ll-accent);
    }
    .ll-progress { display: flex; flex-direction: column; gap: 6px; }
    .ll-progress-text { display: flex; justify-content: space-between; font-size: 12px; color: var(--ll-dim); }
    .ll-bar { height: 4px; overflow: hidden; border-radius: 999px; background: var(--ll-fill); }
    .ll-bar span {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: var(--ll-accent);
      transition: width 0.3s ease;
    }
    .ll-deck {
      position: relative;
      width: 100%;
      max-width: 360px;
      flex: 1 1 auto;
      min-height: clamp(380px, 60dvh, 720px);
      margin: 0 auto;
    }
    @media (min-width: 641px) {
      .ll-tinder > .ll-deck { margin-top: 14px; }
    }
    @media (max-width: ${MOBILE_MAX_WIDTH}px) {
      .ll-deck {
        max-width: none;
        min-height: 0;
      }
      .ll-tinder { gap: 8px; overflow: hidden; }
      .ll-tinder-modal { overflow: hidden; overscroll-behavior: none; }
      .ll-tactions { padding-top: 2px; flex-shrink: 0; }
      .ll-progress { flex-shrink: 0; }
      .ll-hint { display: none; }
      .ll-status { flex-shrink: 0; }
    }
    .ll-tinder-modal { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
    .ll-tinder-modal .ll-tinder { flex: 1 1 auto; min-height: 0; }
    .ll-ghost {
      position: absolute;
      inset: 0;
      border-radius: 24px;
      background: color-mix(in srgb, var(--ll-fill) 80%, #000);
      border: none;
      box-shadow: none;
    }
    .ll-ghost-1 { transform: translateY(10px) scale(0.96); opacity: 0.55; }
    .ll-ghost-2 { transform: translateY(18px) scale(0.92); opacity: 0.3; }
    .ll-tcard {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      overflow: hidden;
      color: #fff;
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
      will-change: transform;
      border-radius: 24px;
      background: #141018;
      box-shadow: 0 18px 44px rgba(0, 0, 0, 0.5);
    }
    .ll-tcard:active { cursor: grabbing; }
    .ll-tcard:focus { outline: none; }
    .ll-tcard:focus-visible { outline: 2px solid color-mix(in srgb, var(--ll-accent) 70%, transparent); outline-offset: -2px; }
    .ll-tcard-img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
    }
    .ll-tcard-img.ll-art-fallback { font-size: 96px; }
    .ll-tcard-fade {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: linear-gradient(to top, rgba(8, 6, 14, 0.97) 0%, rgba(8, 6, 14, 0.82) 36%, rgba(8, 6, 14, 0) 72%);
    }
    .ll-tcard-info {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 64%;
      padding: 18px;
    }
    .ll-tcard-name {
      font-size: 28px;
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -0.01em;
      overflow-wrap: anywhere;
    }
    .ll-tcard .ll-tag { color: #fff; background: rgba(255, 255, 255, 0.16); border-color: transparent; }
    .ll-tcard-bio {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      min-height: 0;
      overflow-y: auto;
      touch-action: pan-y;
      padding: 10px 12px;
      font-size: 13px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.12);
      -webkit-backdrop-filter: blur(8px);
      backdrop-filter: blur(8px);
    }
    .ll-tcard-bio-text { flex: 1; min-width: 0; white-space: pre-wrap; }
    .ll-tcard-bio:has(.ll-bio-dots) { align-items: center; }
    .ll-tcard-bio-text:has(.ll-bio-dots) {
      display: flex;
      align-items: center;
      min-height: 30px;
    }
    .ll-bio-dots {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 6px;
    }
    .ll-bio-dots span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.45;
      animation: ll-bio-dot 1.2s ease-in-out infinite;
    }
    .ll-bio-dots span:nth-child(2) { animation-delay: 0.15s; }
    .ll-bio-dots span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes ll-bio-dot {
      0%, 80%, 100% { opacity: 0.35; transform: translateY(0); }
      40% { opacity: 1; transform: translateY(-3px); }
    }
    .ll-stamp {
      position: absolute;
      top: 28px;
      padding: 2px 12px;
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      border: 4px solid;
      border-radius: 12px;
      opacity: 0;
      pointer-events: none;
    }
    .ll-stamp-right { left: 20px; color: var(--ll-success); transform: rotate(-14deg); }
    .ll-stamp-left { right: 20px; color: var(--ll-danger); transform: rotate(14deg); }
    .ll-tactions { display: flex; align-items: center; justify-content: center; gap: 16px; padding-top: 6px; }
    .ll-round {
      display: grid;
      place-items: center;
      width: 60px;
      height: 60px;
      padding: 0;
      cursor: pointer;
      background: var(--ll-fill-subtle);
      border: 2px solid currentColor;
      border-radius: 50%;
      transition: transform 0.12s ease, background 0.15s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .ll-round:hover { background: color-mix(in srgb, currentColor 14%, transparent); }
    .ll-round:active { transform: scale(0.92); }
    .ll-round:disabled { opacity: 0.35; cursor: not-allowed; }
    .ll-round-sm { width: 44px; height: 44px; }
    .ll-round-nope { color: var(--ll-danger); }
    .ll-round-like { color: var(--ll-success); }
    .ll-round-undo { color: var(--ll-gold); }
    .ll-round-info { color: var(--ll-accent); }
    .ll-hint { text-align: center; font-size: 11px; color: var(--ll-dim); letter-spacing: 0.04em; }

    .ll-qv {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-height: 100%;
      padding: 4px 2px 10px;
    }
    .ll-qv-head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--ll-border);
    }
    .ll-qv-art {
      width: 64px;
      height: 64px;
      object-fit: cover;
      flex-shrink: 0;
      border-radius: 16px;
      border: 1px solid var(--ll-border);
    }
    .ll-qv-art.ll-art-fallback { font-size: 26px; }
    .ll-qv-meta { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 5px; }
    .ll-qv-name { font-size: 19px; font-weight: 800; overflow-wrap: anywhere; }
    .ll-qv-title { font-size: 22px; font-weight: 800; line-height: 1.2; margin: 2px 0 0; }
    .ll-qv-sub { margin: 0; color: var(--ll-dim); font-size: 13px; }
    .ll-header-btn {
      display: inline-grid;
      place-items: center;
      width: 32px;
      height: 32px;
      margin-right: 6px;
      padding: 0;
      cursor: pointer;
      color: var(--lumiverse-text-dim, rgba(255, 255, 255, 0.7));
      background: transparent;
      border: 0;
      border-radius: 8px;
    }
    .ll-header-btn:hover { color: var(--lumiverse-text, #f1f5f9); background: var(--lumiverse-fill-subtle, rgba(255, 255, 255, 0.08)); }
    .ll-qv-name-hl { color: var(--ll-accent); }
    .ll-page.ll-page-results > .ll-topbar { display: none; }
    .ll-qv-ask { display: flex; flex-direction: column; gap: 8px; margin: 18px 0 6px; }
    .ll-qv-ask .ll-qv-title, .ll-qv-ask .ll-qv-sub { margin: 0; }
    .ll-choices {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .ll-choice {
      display: flex;
      gap: 14px;
      width: 100%;
      padding: 14px;
      text-align: left;
      font: inherit;
      color: var(--ll-text);
      cursor: pointer;
      background: var(--ll-fill-subtle);
      border: 1px solid var(--ll-border);
      border-radius: calc(var(--ll-radius) + 4px);
      transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .ll-choice:hover, .ll-choice:active {
      border-color: color-mix(in srgb, var(--ll-accent) 60%, transparent);
      background: color-mix(in srgb, var(--ll-accent) 10%, var(--ll-fill-subtle));
    }
    .ll-choice-icon {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      flex-shrink: 0;
      border-radius: 14px;
      color: var(--ll-accent);
      background: color-mix(in srgb, var(--ll-accent) 16%, transparent);
    }
    .ll-choice-title { font-weight: 800; font-size: 15px; margin-bottom: 3px; }
    .ll-choice-desc { color: var(--ll-dim); font-size: 12.5px; margin-bottom: 8px; }
    .ll-ari-block {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 14px;
      background: var(--ll-fill-subtle);
      border: 1px solid var(--ll-border);
      border-radius: calc(var(--ll-radius) + 4px);
    }
    .ll-ari-text { flex: 1; min-width: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
    .ll-ari-text.ll-md { white-space: normal; }
    .ll-ari-text.ll-md h2 {
      margin: 16px 0 6px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ll-accent);
    }
    .ll-ari-text.ll-md h2:first-child { margin-top: 0; }
    .ll-ari-text.ll-md p { margin: 0 0 8px; }

    .ll-lens-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--lumiverse-btn-icon, 28px);
      height: var(--lumiverse-btn-icon, 28px);
      padding: 0;
      margin: 0;
      overflow: hidden;
      flex-shrink: 0;
      cursor: pointer;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #fff;
      box-shadow: none;
      z-index: 2;
      transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                  background 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                  border-color 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                  transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .ll-lens-mount {
      position: absolute;
      top: calc(8px + var(--lumiverse-btn-icon, 28px) + 6px);
      right: 8px;
      opacity: 0;
    }
    *:has(> [data-spindle-mount="character_browser_card_actions"]):hover .ll-lens-mount,
    .ll-lens-mount:hover,
    .ll-lens-mount:focus-visible {
      opacity: 1;
    }
    .ll-lens-btn:hover {
      background: rgba(0, 0, 0, 0.7);
      border-color: rgba(167, 139, 250, 0.55);
      transform: scale(1.1);
    }
    .ll-lens-avatar { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 50%; }
    .ll-lens-avatar-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 800;
      color: #c4b5fd;
    }

    .ll-chat-picker { display: flex; flex-direction: column; gap: 8px; }
    .ll-chat-choice {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      text-align: left;
      font: inherit;
      color: var(--ll-text);
      cursor: pointer;
      background: var(--ll-fill-subtle);
      border: 1px solid var(--ll-border);
      border-radius: var(--ll-radius);
    }
    .ll-chat-choice:hover { border-color: var(--ll-border-hover); }
    .ll-chat-choice:disabled { opacity: 0.6; cursor: wait; }
    .ll-chat-choice-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .ll-chat-choice-label { font-weight: 650; font-size: 13px; }
    .ll-chat-choice-badge {
      padding: 2px 6px;
      font-size: 10px;
      color: var(--ll-dim);
      background: var(--ll-fill);
      border-radius: 4px;
    }
    .ll-chat-choice-meta, .ll-chat-choice-preview {
      max-height: 72px;
      overflow: hidden;
      font-size: 12px;
      color: var(--ll-dim);
      white-space: pre-wrap;
    }
    .ll-chat-picker-error { min-height: 1em; font-size: 12px; color: var(--ll-text); }
    @keyframes ll-halo {
      0%, 100% { transform: scale(1); opacity: 0.45; }
      50% { transform: scale(1.18); opacity: 0.9; }
    }
    @keyframes ll-fade-pulse {
      0%, 100% { opacity: 0.55; }
      50% { opacity: 1; }
    }
    @keyframes ll-shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(260%); }
    }
    @keyframes ll-pop {
      0% { opacity: 0; transform: scale(0.96) translateY(6px); }
      100% { opacity: 1; transform: none; }
    }
  `)
}
