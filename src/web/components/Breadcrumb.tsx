import { ArrowUp, House } from 'lucide-react';

interface Crumb {
  label: string;
  path: string;
}

function buildCrumbs(path: string, home: string | undefined): Crumb[] {
  if (path === '~') return [{ label: '~', path: '~' }];

  const parts = path.split('/').filter(Boolean);
  const crumbs: Crumb[] = [];
  let cur = '';
  for (const p of parts) {
    cur += `/${p}`;
    crumbs.push({ label: p, path: cur });
  }

  if (home && (path === home || path.startsWith(`${home}/`))) {
    const homeDepth = home.split('/').filter(Boolean).length;
    return [{ label: '~', path: home }, ...crumbs.slice(homeDepth)];
  }
  return [{ label: '/', path: '/' }, ...crumbs];
}

export function Breadcrumb({
  path,
  home,
  parent,
  onNavigate,
}: {
  path: string;
  home: string | undefined;
  parent: string | null;
  onNavigate: (path: string) => void;
}) {
  const crumbs = buildCrumbs(path, home);

  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto font-mono text-[10.5px] text-dim [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={c.path} className="flex shrink-0 items-center gap-1">
              {i > 0 && <span className="text-[#46484d]">/</span>}
              <button
                type="button"
                disabled={last}
                onClick={() => onNavigate(c.path)}
                className={last ? 'text-muted' : 'transition-colors hover:text-fg'}
              >
                {c.label}
              </button>
            </span>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="Home"
        onClick={() => onNavigate('~')}
        className="grid size-[26px] shrink-0 place-items-center rounded-md border border-line text-dim transition-colors hover:text-fg"
      >
        <House size={13} />
      </button>
      <button
        type="button"
        aria-label="Go up"
        disabled={!parent}
        onClick={() => parent && onNavigate(parent)}
        className="grid size-[26px] shrink-0 place-items-center rounded-md border border-line text-dim transition-colors hover:text-fg disabled:opacity-40"
      >
        <ArrowUp size={13} />
      </button>
    </div>
  );
}
