'use client';

import React from 'react';
import { ProductionLogMaterial } from '@/lib/types';
import { formatNum } from '@/lib/calculator';

interface ProductionSheetDocumentProps {
  logDate: string;
  productName: string;
  productUnit: string;
  quantity: number | string;
  materials: ProductionLogMaterial[];
  notes?: string;
  isPrintOnly?: boolean;
}

export default function ProductionSheetDocument({
  logDate,
  productName,
  productUnit,
  quantity,
  materials,
  notes = '',
  isPrintOnly = false,
}: ProductionSheetDocumentProps) {
  // 날짜 포맷 (YYYY-MM-DD -> YYYY년 MM월 DD일)
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '년   월   일';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[0]}년  ${parts[1]}월  ${parts[2]}일`;
    }
    return dateStr;
  };

  // 1. 생산일보 행 (8행 고정)
  const rowCount1 = 8;
  const prodRows = Array.from({ length: rowCount1 }, (_, idx) => {
    if (idx === 0 && productName) {
      return {
        left: {
          name: productName,
          unit: productUnit || '개',
          quantity: formatNum(quantity),
        },
        right: { name: '', unit: '', quantity: '' },
      };
    }
    return {
      left: { name: '', unit: '', quantity: '' },
      right: { name: '', unit: '', quantity: '' },
    };
  });

  // 2. 원료수불부 행 (20행 고정)
  const rowCount2 = 20;
  const matRows = Array.from({ length: rowCount2 }, (_, idx) => {
    if (idx < materials.length) {
      const m = materials[idx];
      return {
        name: m.ingredient_name,
        unit: m.unit || 'kg',
        in_qty: formatNum(m.in_quantity),
        out_qty: formatNum(m.out_quantity),
        remarks: m.remarks || '',
      };
    }
    return {
      name: '',
      unit: '',
      in_qty: '',
      out_qty: '',
      remarks: '',
    };
  });

  return (
    <div
      className={`production-sheet-container bg-white text-black font-sans leading-tight ${
        isPrintOnly ? 'print-only-sheet' : ''
      }`}
      style={{
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '210mm',
        minHeight: '297mm',
        margin: '0 auto',
        padding: '16mm 14mm',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: "'Pretendard', 'Malgun Gothic', '맑은 고딕', sans-serif",
      }}
    >
      {/* 상단 헤더: 제목 및 결재란 */}
      <div className="flex justify-between items-stretch mb-3">
        {/* 중앙 제목 */}
        <div className="flex-1 flex items-center justify-center pl-24">
          <h1
            className="text-2xl md:text-3xl font-bold tracking-widest text-center"
            style={{ letterSpacing: '0.18em' }}
          >
            생산일지 / 원료수불부
          </h1>
        </div>

        {/* 결재란 (작성 / 승인) */}
        <div className="w-40 border-2 border-black border-collapse text-xs">
          <table className="w-full h-full border-collapse text-center">
            <tbody>
              <tr>
                <td
                  rowSpan={2}
                  className="w-8 border-r border-black font-semibold py-1 bg-neutral-50"
                  style={{ writingMode: 'vertical-rl', textOrientation: 'upright', letterSpacing: '0.3em' }}
                >
                  결재
                </td>
                <td className="w-16 border-b border-r border-black font-semibold py-1 bg-neutral-50">
                  작 성
                </td>
                <td className="w-16 border-b border-black font-semibold py-1 bg-neutral-50">
                  승 인
                </td>
              </tr>
              <tr style={{ height: '48px' }}>
                <td className="border-r border-black"></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 작성일 */}
      <div className="mb-2 text-sm font-medium flex items-center">
        <span className="font-semibold mr-2">작성일 :</span>
        <span>{formatDateDisplay(logDate)}</span>
      </div>

      {/* 1. 생산일보 */}
      <div className="mb-4">
        <h2 className="text-sm font-bold mb-1 tracking-wide">1. 생산일보</h2>
        <table className="w-full border-collapse border-2 border-black text-center text-xs">
          <thead>
            <tr className="bg-neutral-100 font-semibold border-b border-black" style={{ height: '24px' }}>
              <th className="border-r border-black w-[22%] py-1">제 품 명</th>
              <th className="border-r border-black w-[10%] py-1">단 위</th>
              <th className="border-r-2 border-black w-[18%] py-1">생 산 량</th>
              <th className="border-r border-black w-[22%] py-1">제 품 명</th>
              <th className="border-r border-black w-[10%] py-1">단 위</th>
              <th className="w-[18%] py-1">생 산 량</th>
            </tr>
          </thead>
          <tbody>
            {prodRows.map((row, i) => (
              <tr
                key={`prod-${i}`}
                className="border-b border-black last:border-b-0"
                style={{ height: '22px' }}
              >
                <td className="border-r border-black px-1 text-left truncate">{row.left.name}</td>
                <td className="border-r border-black">{row.left.unit}</td>
                <td className="border-r-2 border-black font-medium text-right pr-2">{row.left.quantity}</td>
                <td className="border-r border-black px-1 text-left truncate">{row.right.name}</td>
                <td className="border-r border-black">{row.right.unit}</td>
                <td className="font-medium text-right pr-2">{row.right.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2. 원료수불부 */}
      <div className="mb-3">
        <h2 className="text-sm font-bold mb-1 tracking-wide">2. 원료수불부</h2>
        <table className="w-full border-collapse border-2 border-black text-center text-xs">
          <thead>
            <tr className="bg-neutral-100 font-semibold border-b border-black" style={{ height: '24px' }}>
              <th className="border-r border-black w-[26%] py-1">품 명</th>
              <th className="border-r border-black w-[10%] py-1">단 위</th>
              <th className="border-r border-black w-[20%] py-1">입 고 량</th>
              <th className="border-r border-black w-[20%] py-1">사 용 량</th>
              <th className="w-[24%] py-1">비 고</th>
            </tr>
          </thead>
          <tbody>
            {matRows.map((row, i) => (
              <tr
                key={`mat-${i}`}
                className="border-b border-black last:border-b-0"
                style={{ height: '21px' }}
              >
                <td className="border-r border-black px-2 text-left truncate font-medium">{row.name}</td>
                <td className="border-r border-black">{row.unit}</td>
                <td className="border-r border-black text-right pr-3">{row.in_qty}</td>
                <td className="border-r border-black text-right pr-3 font-semibold">{row.out_qty}</td>
                <td className="px-2 text-left truncate text-neutral-700">{row.remarks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 특이사항 */}
      <div className="border-2 border-black p-2 min-h-[75px] text-xs">
        <div className="font-bold mb-1 flex items-center">
          <span className="inline-block w-3.5 h-3.5 border border-black mr-1 text-[10px] text-center leading-3">✓</span>
          <span>특이사항</span>
        </div>
        <div className="whitespace-pre-wrap text-neutral-800 pl-4 min-h-[40px]">
          {notes || ''}
        </div>
      </div>
    </div>
  );
}
