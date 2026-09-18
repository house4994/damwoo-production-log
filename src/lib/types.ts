export interface ProductCategory {
  id: string;
  name: string;
  sort_order?: number;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  capacity: number; // 1개당 용량 (예: 250)
  unit: string;     // 단위 (g, kg 등)
  category_id?: string | null;
  category_name?: string;
  created_at?: string;
  updated_at?: string;
  ingredients?: ProductIngredient[];
}

export interface ProductIngredient {
  id?: string;
  product_id?: string;
  ingredient_name: string; // 원재료명 (예: 국내산 쌀, 곤드레나물 등)
  ratio: number;           // 배합 비율 (%)
  unit: string;            // 수불 단위 (g, kg 등)
  remarks?: string;        // 비고
  sort_order?: number;
}

export interface ProductionLog {
  id: string;
  log_date: string;         // 작성일 (YYYY-MM-DD)
  product_id?: string | null;
  product_name: string;     // 제품명
  product_capacity: number; // 포장 규격
  product_unit: string;     // 제품 단위
  quantity: number;         // 완제품 생산량 (개/봉 등)
  notes: string;            // 특이사항
  created_at?: string;
  updated_at?: string;
  materials?: ProductionLogMaterial[];
}

export interface ProductionLogMaterial {
  id?: string;
  log_id?: string;
  ingredient_name: string; // 품명
  unit: string;            // 단위 (g, kg 등)
  in_quantity: number;     // 입고량
  out_quantity: number;    // 사용량
  remarks: string;         // 비고
}
