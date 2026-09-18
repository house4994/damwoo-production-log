import { Product, ProductIngredient, ProductionLogMaterial } from './types';

/**
 * 고정 소수점 반올림 (부동 소수점 오차 방지)
 */
export function roundFixed(val: number, decimals: number = 2): number {
  if (isNaN(val) || !isFinite(val)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * 배합 비율(%) 합계 계산 (부동소수점 오차 방지: 100.00000000003% 현상 방지)
 */
export function sumRatios(ratios: (number | string | undefined | null)[]): number {
  const totalScaled = ratios.reduce<number>((acc, r) => {
    if (r === undefined || r === null || r === '') return acc;
    const num = typeof r === 'string' ? parseFloat(r) || 0 : r || 0;
    // 소수점 4자리 기준 정수 스케일링 후 합산
    return acc + Math.round((num + Number.EPSILON) * 10000);
  }, 0);

  return roundFixed(totalScaled / 10000, 2);
}

/**
 * 완제품 생산량과 제품 배합비에 따라 원료수불부(입고량, 사용량) 자동 계산
 * 
 * - 원재료 단위(g 또는 kg)에 맞추어 정확하게 환산 계산
 * - 예: 제품 250g × 1,000개 = 총 250,000g (250kg)
 *   - 원재료 단위가 'kg'인 경우: 250kg × 함량%
 *   - 원재료 단위가 'g'인 경우: 250,000g × 함량%
 * - 입고량 = 사용량 동일 채움 (당일 입고-당일 소진)
 */
export function calculateMaterials(
  product: Product,
  quantity: number
): ProductionLogMaterial[] {
  if (!product || !product.ingredients || product.ingredients.length === 0 || quantity <= 0) {
    return [];
  }

  // 제품 총 중량 (g 단위 기준)
  const prodUnit = (product.unit || 'g').trim().toLowerCase();
  let totalProductGrams = 0;

  if (prodUnit === 'kg') {
    totalProductGrams = product.capacity * 1000 * quantity;
  } else {
    // 기본 g
    totalProductGrams = product.capacity * quantity;
  }

  return product.ingredients.map((ing: ProductIngredient) => {
    const ingUnit = (ing.unit || 'kg').trim().toLowerCase();
    const ratio = Number(ing.ratio) || 0;

    let requiredQty = 0;
    if (ingUnit === 'g') {
      // g 단위로 산출
      requiredQty = totalProductGrams * (ratio / 100);
    } else {
      // 기본 kg 단위로 산출 (g -> kg)
      requiredQty = (totalProductGrams / 1000) * (ratio / 100);
    }

    const finalQty = roundFixed(requiredQty, 2);

    return {
      ingredient_name: ing.ingredient_name,
      unit: ing.unit || 'kg',
      in_quantity: finalQty,
      out_quantity: finalQty,
      remarks: ing.remarks || '',
    };
  });
}

/**
 * 숫자 표시 포맷 (천단위 콤마 및 고정 소수점)
 */
export function formatNum(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '';
  
  // 소수점 2자리 반올림 후 천단위 콤마 표시
  const rounded = roundFixed(num, 2);
  return rounded.toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
