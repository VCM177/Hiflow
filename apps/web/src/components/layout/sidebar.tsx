'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { isActiveNavItem, type NavGroup } from '@/config/navigation';
import { cn } from '@/lib/utils';

interface SidebarProps {
  groups: readonly NavGroup[];
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ groups, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const toggleLabel = collapsed ? 'Mở rộng menu' : 'Thu gọn menu';

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-hf-border bg-hf-bg-surface transition-[width] duration-(--hf-duration-fast) ease-hf-standard',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center',
          collapsed ? 'justify-center' : 'justify-between pr-2 pl-4',
        )}
      >
        {!collapsed && (
          <span className="text-lg font-semibold text-hf-text-heading">
            Hiflow
          </span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={toggleLabel}
              aria-expanded={!collapsed}
              onClick={onToggle}
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{toggleLabel}</TooltipContent>
        </Tooltip>
      </div>

      <nav aria-label="Menu chính" className="flex-1 overflow-y-auto px-2 py-2">
        {groups.map((group) => (
          <div key={group.id} className="mb-4">
            {!collapsed && (
              <p className="px-2 pb-1 text-xs font-medium text-hf-text-muted">
                {group.label}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActiveNavItem(item.href, pathname);
                const Icon = item.icon;
                const link = (
                  <Link
                    href={item.href}
                    aria-label={collapsed ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-9 items-center gap-3 rounded-hf-control px-2.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-hf-ring',
                      active
                        ? 'bg-hf-bg-card text-hf-primary shadow-hf-card'
                        : 'text-hf-text-body hover:bg-hf-bg-card',
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                );
                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
