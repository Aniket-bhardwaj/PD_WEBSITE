const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const stage = document.querySelector<HTMLElement>('[data-system-stage]');
const caption = document.querySelector<HTMLElement>('[data-system-caption]');
const replayButton = document.querySelector<HTMLButtonElement>('[data-replay]');
let pendingFrame = 0;

function replayRoute(): void {
  const drawing = stage?.querySelector('svg');
  if (!drawing || reducedMotion.matches || document.hidden) return;
  window.cancelAnimationFrame(pendingFrame);
  drawing.classList.remove('draw-play');
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = requestAnimationFrame(() => drawing.classList.add('draw-play'));
  });
}

if (stage && caption && replayButton) {
  stage.closest('.hero-art')?.classList.add('interactive');
  const pathButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-path-select]')];
  pathButtons.forEach((button) =>
    button.addEventListener('click', () => {
      const path = button.dataset.pathSelect;
      if (path !== 'public' && path !== 'private') return;
      stage.dataset.path = path;
      pathButtons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
      caption.textContent =
        path === 'public'
          ? 'Public requests reach Phoenix through a Cloudflare Tunnel. Administrative access follows a separate private path.'
          : 'Administrative services are reached through the private Tailscale mesh, separately from public web traffic.';
      replayRoute();
    }),
  );
  replayButton.addEventListener('click', replayRoute);
  if (!reducedMotion.matches) {
    document.body.classList.add('studio-enter');
    replayRoute();
  }
}

let observer: IntersectionObserver | undefined;
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  document.body.classList.add('reveal-ready');
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer?.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll('.reveal').forEach((element) => observer?.observe(element));
}

function stopMotion(): void {
  window.cancelAnimationFrame(pendingFrame);
  stage?.querySelector('svg')?.classList.remove('draw-play');
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopMotion();
});
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    document.body.classList.remove('studio-enter', 'reveal-ready');
    observer?.disconnect();
    stopMotion();
  }
});

document.querySelectorAll<HTMLDetailsElement>('details.mobile-nav').forEach((menu) => {
  menu.querySelectorAll<HTMLAnchorElement>('a').forEach((link) => {
    link.addEventListener('click', () => {
      menu.open = false;
    });
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }
  });
});
