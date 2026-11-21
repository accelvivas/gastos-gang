import type { ExpenseWithCategory } from '@/db/types';

export type HistorySection = {
  key: string;
  title: string;
  totalCentavos: number;
  data: ExpenseWithCategory[];
};
