import { Product, ProductIngredient, ProductionLogMaterial } from './types';

/**
 * 완제품 생산량과 제품 배합비에 따라 원료수불부(입고량, 사용량) 자동 계산
 * 
 * 공식:
 * - 총 중량 = 용량 × 완제품 생산량(개)
 * - 원재료 소요량(kg) = (총 중량(g) ÷ 1000) × (배합비(%) ÷ 100)
 * - 입고량과 사용량은 동일하게 채워짐 (당일 입고-당일 소진)
 */
export function calculateMaterials(
  product: Product,
  quantity: number
): ProductionLogMaterial[] {
  if (!product || !product.ingredients || product.ingredients.length === 0 || quantity <= 0) {
    return [];
  }

  // 기준 총 중량 (kg 단위로 통일)
  let totalWeightKg = 0;
  const unitNormalized = (product.unit || 'g').trim().toLowerCase();

  if (unitNormalized === 'g') {
    totalWeightKg = (product.capacity * quantity) / 1000;
  } else if (unitNormalized === 'kg') {
    totalWeightKg = product.capacity * quantity;
  } else {
    // 기본적으로 g 기준 처리
    totalWeightKg = (product.capacity * quantity) / 1000;
  }

  return product.ingredients.map((ing: ProductIngredient) => {
    const rawReq = totalWeightKg * (ing.ratio / 100);
    // 소수점 둘째 자리까지 깔끔하게 반올림
    const calculatedQty = Math.round((rawReq + Number.EPSILON) * 100) / 100;

    return {
      ingredient_name: ing.ingredient_name,
      unit: ing.unit || 'kg',
      in_quantity: calculatedQty,
      out_quantity: calculatedQty,
      remarks: ing.remarks || '',
    };
  });
}

/**
 * 숫자 표시 포맷 (소수점 불필요한 0 제거 및 천단위 콤마)
 */
export function formatNum(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '';
  return num.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}
