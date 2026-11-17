import React, { useCallback, useEffect, useRef, useState } from 'react';
import './preview-navigation.css';

const destinations = [
  { id: 'overview', label: 'Overview', icon: 'home' },
  { id: 'financial-overview', label: 'Funding', icon: 'coins' },
  { id: 'participants', label: 'Awards', icon: 'award' },
  { id: 'activity', label: 'Activity', icon: 'activity' },
];

const mobileQuery = '(max-width: 700px)';

function readDestination() {
  if (typeof window === 'undefined') return 'overview';
  const hash = window.location.hash.slice(1);
  return destinations.some(({ id }) => id === hash) ? hash : 'overview';
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia(mobileQuery).matches;
}

export function PreviewNavigation({ Icon, BrandMark }) {
  const [activeDestination, setActiveDestination] = useState(readDestination);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileViewport, setMobileViewport] = useState(isMobileViewport);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const currentLinkRef = useRef(null);
  const sidebarRef = useRef(null);

  const dismissDrawer = useCallback((restoreTrigger = true) => {
    setMobileOpen(false);
    if (restoreTrigger) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia(mobileQuery);
    const handleResize = (event) => {
      setMobileViewport(event.matches);
      if (!event.matches) {
        setMobileOpen(false);
        if (document.activeElement === closeRef.current) {
          window.requestAnimationFrame(() => currentLinkRef.current?.focus());
        }
      }
    };

    media.addEventListener('change', handleResize);
    return () => media.removeEventListener('change', handleResize);
  }, []);

  useEffect(() => {
    const syncHash = () => setActiveDestination(readDestination());
    window.addEventListener('hashchange', syncHash);
    window.addEventListener('popstate', syncHash);
    return () => {
      window.removeEventListener('hashchange', syncHash);
      window.removeEventListener('popstate', syncHash);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen || !mobileViewport) return undefined;

    closeRef.current?.focus();
    const drawer = sidebarRef.current;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissDrawer();
        return;
      }

      if (event.key !== 'Tab' || !drawer) return;
      const focusable = [...drawer.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dismissDrawer, mobileOpen, mobileViewport]);

  const navigate = (event, destination) => {
    event.preventDefault();
    const target = document.getElementById(destination.id);
    setActiveDestination(destination.id);
    if (window.location.hash !== `#${destination.id}`) {
      window.history.pushState(null, '', `#${destination.id}`);
    }
    if (mobileOpen) dismissDrawer(false);

    target?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
    window.requestAnimationFrame(() => target?.focus({ preventScroll: true }));
  };

  return <>
    <button
      ref={triggerRef}
      type="button"
      className="ppn-trigger"
      aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
      aria-expanded={mobileOpen}
      aria-controls="proofpay-navigation"
      onClick={() => setMobileOpen(true)}
    >
      <Icon name="menu" size={20} />
    </button>

    {mobileOpen && mobileViewport && <button
      type="button"
      className="ppn-scrim"
      aria-label="Close navigation by clicking outside"
      tabIndex={-1}
      onClick={() => dismissDrawer()}
    />}

    <aside
      ref={sidebarRef}
      id="proofpay-navigation"
      className={`ppn-sidebar${mobileOpen ? ' ppn-sidebar--open' : ''}`}
      aria-label="ProofPay navigation"
      aria-hidden={mobileViewport && !mobileOpen ? 'true' : undefined}
      aria-modal={mobileViewport && mobileOpen ? 'true' : undefined}
      role={mobileViewport && mobileOpen ? 'dialog' : undefined}
      inert={mobileViewport && !mobileOpen}
    >
      <div className="ppn-brand-row">
        <a className="ppn-brand-link" href="#overview" aria-label="ProofPay overview" onClick={(event) => navigate(event, destinations[0])}>
          <BrandMark />
          <span className="ppn-brand-word">ProofPay<span>N/</span></span>
        </a>
        <button ref={closeRef} type="button" className="ppn-close" aria-label="Close navigation" onClick={() => dismissDrawer()}>
          <Icon name="close" size={19} />
        </button>
      </div>

      <div className="ppn-program" aria-label="Community workshop program">
        <span aria-hidden="true">CW</span>
        <small>WORKSHOP</small>
      </div>

      <span className="ppn-section-label">Workspace</span>
      <nav className="ppn-links" aria-label="Program sections">
        {destinations.map((destination) => <a
          key={destination.id}
          ref={activeDestination === destination.id ? currentLinkRef : undefined}
          className={`ppn-link${activeDestination === destination.id ? ' ppn-link--active' : ''}`}
          href={`#${destination.id}`}
          aria-current={activeDestination === destination.id ? 'location' : undefined}
          onClick={(event) => navigate(event, destination)}
          title={destination.label}
        >
          <Icon name={destination.icon} size={19} />
          <span>{destination.label}</span>
        </a>)}
      </nav>

      <div className="ppn-footer">
        <div className="ppn-guide" aria-label="Workshop guide information">
          <span><Icon name="spark" size={17} /></span>
          <div><strong>Workshop guide</strong><small>Steps for participants</small></div>
        </div>
        <div className="ppn-profile" aria-label="Signed in as Sam Parker, program sponsor">
          <span className="ppn-avatar" aria-hidden="true">SP</span>
          <div><strong>Sam Parker</strong><small>Program sponsor</small></div>
        </div>
        <span className="ppn-synthetic">CONCEPT · SYNTHETIC DATA</span>
      </div>
    </aside>
  </>;
}
