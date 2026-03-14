export interface Card {
  id: number;
  binderNumber: number;
  pageNumber: number;
  row: number;
  column: number;
  playerName: string;
  year: number;
  setName: string;
  cardNumber?: string;
  team?: string;
  manufacturer?: string;
  estimatedCondition: string;
  conditionNotes?: string;
  valueRangeLow?: number;
  valueRangeHigh?: number;
  imagePath?: string;
  backImagePath?: string;
  sourceImagePath?: string;
  notes?: string;
  tags?: string;
  isGraded: boolean;
  gradingService?: string;
  gradeValue?: string;
  createdAt: string;
  updatedAt: string;
  lastAuditedAt?: string;
}

export interface CreateCard {
  binderNumber: number;
  pageNumber: number;
  row: number;
  column: number;
  playerName: string;
  year: number;
  setName: string;
  cardNumber?: string;
  team?: string;
  manufacturer?: string;
  estimatedCondition: string;
  conditionNotes?: string;
  valueRangeLow?: number;
  valueRangeHigh?: number;
  notes?: string;
  tags?: string;
  isGraded: boolean;
  gradingService?: string;
  gradeValue?: string;
}

export interface UpdateCard extends CreateCard {}

export interface CardQueryParams {
  search?: string;
  binderNumber?: number;
  page?: number;
  year?: number;
  setName?: string;
  team?: string;
  manufacturer?: string;
  conditionMin?: string;
  conditionMax?: string;
  valueLow?: number;
  valueHigh?: number;
  tags?: string;
  isGraded?: boolean;
  isUnassigned?: boolean;
  sortBy?: string;
  sortDir?: string;
  pageNum?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  pageNum: number;
  pageSize: number;
  totalPages: number;
}

export interface CollectionStats {
  totalCards: number;
  totalValueLow?: number;
  totalValueHigh?: number;
  bySet: { setName: string; count: number }[];
  byYear: { year: number; count: number }[];
  byCondition: { condition: string; count: number }[];
  topValueCards: Card[];
  recentAdditions: Card[];
  byDecade: { decade: string; count: number }[];
}

export interface Binder {
  id: number;
  name: string;
  description?: string;
  totalPages?: number;
  createdAt: string;
  cardCount: number;
  totalValueLow?: number;
  totalValueHigh?: number;
}

export interface BinderDetail extends Binder {
  cards: Card[];
}

export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflictingCards: Card[];
  suggestion?: NextAvailableSuggestion;
}

export interface NextAvailableSuggestion {
  binderNumber: number;
  pageNumber: number;
  row?: number;
  column?: number;
}

export interface ExtractedCardImage {
  row: number;
  column: number;
  imagePath: string;
  side: 'front' | 'back';
}

export interface CardImageAssignment {
  cardId: number;
  frontImagePath?: string;
  backImagePath?: string;
}

export interface CreateBinder {
  name: string;
  description?: string;
  totalPages?: number;
}

export interface UpdateBinder extends CreateBinder {}

export const CONDITIONS = [
  { value: 'PR', label: 'Poor (PSA 1)', color: '#ef4444' },
  { value: 'FR', label: 'Fair (PSA 1.5)', color: '#ef4444' },
  { value: 'GD', label: 'Good (PSA 2-2.5)', color: '#f97316' },
  { value: 'VG', label: 'Very Good (PSA 3-3.5)', color: '#f97316' },
  { value: 'VGEX', label: 'VG-EX (PSA 4-4.5)', color: '#eab308' },
  { value: 'EX', label: 'Excellent (PSA 5-5.5)', color: '#84cc16' },
  { value: 'EXMT', label: 'EX-MT (PSA 6-6.5)', color: '#84cc16' },
  { value: 'NM', label: 'Near Mint (PSA 7-7.5)', color: '#22c55e' },
  { value: 'NMMT', label: 'NM-MT (PSA 8-8.5)', color: '#22c55e' },
  { value: 'MT', label: 'Mint (PSA 9-9.5)', color: '#8b5cf6' },
  { value: 'GEM', label: 'Gem Mint (PSA 10)', color: '#a855f7' },
  { value: 'UNKNOWN', label: 'Not Assessed', color: '#6b7280' },
] as const;

export function getConditionInfo(value: string) {
  return CONDITIONS.find(c => c.value === value) ?? CONDITIONS[CONDITIONS.length - 1];
}

export function formatCurrency(value?: number): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function formatValueRange(low?: number, high?: number): string {
  if (low == null && high == null) return '—';
  if (low != null && high != null) return `${formatCurrency(low)} – ${formatCurrency(high)}`;
  return formatCurrency(low ?? high);
}

export function formatLocation(binderNumber: number, pageNumber: number, row: number, column: number): string {
  return `B${binderNumber} / P${pageNumber} / R${row}-C${column}`;
}

// AI identification types
export interface TokenUsageInfo {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  tokensRemaining?: number;
  tokensLimit?: number;
  inputTokensRemaining?: number;
  outputTokensRemaining?: number;
}

export interface AiResponse<T> {
  result: T;
  tokenUsage: TokenUsageInfo;
}

export interface CardIdentificationResult {
  playerName: string;
  year?: number;
  setName?: string;
  cardNumber?: string;
  team?: string;
  manufacturer?: string;
  estimatedCondition?: string;
  conditionNotes?: string;
  valueRangeLow?: number;
  valueRangeHigh?: number;
  notes?: string;
  tags?: string;
  confidence: number;
}

export interface PageCardResult {
  row: number;
  column: number;
  card?: CardIdentificationResult;
  isEmpty: boolean;
}

export interface PageIdentificationResult {
  cards: PageCardResult[];
  pageNotes?: string;
}

export interface BulkRescanResult {
  updated: number;
  failed: number;
  skipped: number;
  totalTokensUsed: number;
  details: BulkRescanDetail[];
}

export interface BulkRescanDetail {
  cardId: number;
  status: string;
  message: string;
}
