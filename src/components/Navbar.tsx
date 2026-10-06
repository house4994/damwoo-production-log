'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Database, ListOrdered, CheckCircle2, BarChart3 } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: '생산일지 작성', icon: FileText },
    { href: '/logs', label: '생산일지 목록', icon: ListOrdered },
    { href: '/dashboard', label: '생산 통계', icon: BarChart3 },
    { href: '/products', label: '제품 및 원재료 관리', icon: Database },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-md print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 로고 & 타이틀 */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              담우
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                생산일지 / 원료수불부
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  DAMWOO
                </span>
              </div>
              <div className="text-xs text-slate-400 font-medium">
                농업회사법인 담우 통합 생산관리
              </div>
            </div>
          </Link>

          {/* 내비게이션 메뉴 */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* 상태 뱃지 */}
          <div className="hidden md:flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Supabase Cloud 연결됨</span>
          </div>
        </div>
      </div>
    </header>
  );
}
