'use client';

import { ChevronDown, LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TopbarProps {
  fullName: string;
  email: string;
  roleLabel: string;
  onSignOut: () => void;
}

/** Up to two initials: the first letters of the last two words of the name. */
export function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(-2)
    .map((word) => word.charAt(0).toLocaleUpperCase('vi-VN'))
    .join('');
}

export function Topbar({ fullName, email, roleLabel, onSignOut }: TopbarProps) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-end border-b border-hf-border bg-hf-bg-card px-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" aria-label={`Tài khoản của ${fullName}`}>
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-hf-control bg-hf-primary text-xs font-semibold text-hf-primary-foreground"
            >
              {initialsOf(fullName)}
            </span>
            <span className="hidden text-sm sm:inline">{fullName}</span>
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuLabel>
            <span className="block text-hf-text-heading">{fullName}</span>
            <span className="block text-xs font-normal text-hf-text-muted">
              {roleLabel} · {email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSignOut}>
            <LogOut aria-hidden="true" />
            Đăng xuất
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
