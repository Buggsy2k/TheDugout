import axios from 'axios';
import type {
  Card,
  CreateCard,
  UpdateCard,
  CardQueryParams,
  PaginatedResult,
  CollectionStats,
  Binder,
  BinderDetail,
  CreateBinder,
  UpdateBinder,
  AiResponse,
  CardIdentificationResult,
  PageIdentificationResult,
  ConflictCheckResult,
  ExtractedCardImage,
  CardImageAssignment,
  BulkRescanResult,
} from '../types';

export const API_BASE = `http://${window.location.hostname}:5137`;

const api = axios.create({
  baseURL: `${API_BASE}/api`,
});

// Cards API
export const cardApi = {
  getCards(params: CardQueryParams): Promise<PaginatedResult<Card>> {
    return api.get('/cards', { params }).then(r => r.data);
  },

  getCard(id: number): Promise<Card> {
    return api.get(`/cards/${id}`).then(r => r.data);
  },

  createCard(data: CreateCard): Promise<Card> {
    return api.post('/cards', data).then(r => r.data);
  },

  updateCard(id: number, data: UpdateCard): Promise<Card> {
    return api.put(`/cards/${id}`, data).then(r => r.data);
  },

  deleteCard(id: number): Promise<void> {
    return api.delete(`/cards/${id}`);
  },

  uploadImage(id: number, file: File): Promise<{ imagePath: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/cards/upload-image/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  uploadBackImage(id: number, file: File): Promise<{ imagePath: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/cards/upload-back-image/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  bulkCreate(cards: CreateCard[]): Promise<Card[]> {
    return api.post('/cards/bulk', cards).then(r => r.data);
  },

  getStats(): Promise<CollectionStats> {
    return api.get('/cards/stats').then(r => r.data);
  },

  checkPageConflicts(binderNumber: number, pageNumbers: number[]): Promise<ConflictCheckResult> {
    return api.get('/cards/check-page-conflicts', {
      params: { binderNumber, pageNumbers: pageNumbers.join(',') },
    }).then(r => r.data);
  },

  checkSlotConflict(binderNumber: number, pageNumber: number, row: number, column: number): Promise<ConflictCheckResult> {
    return api.get('/cards/check-slot-conflict', {
      params: { binderNumber, pageNumber, row, column },
    }).then(r => r.data);
  },

  unassignCards(cardIds: number[]): Promise<Card[]> {
    return api.post('/cards/unassign', { cardIds }).then(r => r.data);
  },

  bulkDeleteCards(cardIds: number[]): Promise<{ deletedCount: number }> {
    return api.post('/cards/bulk-delete', { cardIds }).then(r => r.data);
  },
};

// Binders API
export const binderApi = {
  getBinders(): Promise<Binder[]> {
    return api.get('/binders').then(r => r.data);
  },

  getBinder(id: number): Promise<BinderDetail> {
    return api.get(`/binders/${id}`).then(r => r.data);
  },

  createBinder(data: CreateBinder): Promise<Binder> {
    return api.post('/binders', data).then(r => r.data);
  },

  updateBinder(id: number, data: UpdateBinder): Promise<Binder> {
    return api.put(`/binders/${id}`, data).then(r => r.data);
  },

  deleteBinder(id: number, cascade = false): Promise<void> {
    return api.delete(`/binders/${id}`, { params: { cascade } });
  },
};

// Pages API
export const pageApi = {
  getPageCards(binderNumber: number, pageNumber: number): Promise<Card[]> {
    return api.get(`/pages/${binderNumber}/${pageNumber}`).then(r => r.data);
  },

  uploadPageImage(binderNumber: number, pageNumber: number, file: File): Promise<{ imagePath: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/pages/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { binderNumber, pageNumber },
    }).then(r => r.data);
  },

  extractCards(file: File, layout: '3x3' | '6x3', binderNumber: number, pageNumber: number, side: 'front' | 'back' = 'front'): Promise<ExtractedCardImage[]> {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/pages/extract-cards', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { layout, binderNumber, pageNumber, side },
    }).then(r => r.data);
  },

  assignExtractedImages(assignments: CardImageAssignment[]): Promise<void> {
    return api.post('/pages/assign-extracted-images', { assignments }).then(r => r.data);
  },
};

// AI API
export const aiApi = {
  identifyCard(file: File, backFile?: File, cardId?: number): Promise<AiResponse<CardIdentificationResult>> {
    const formData = new FormData();
    formData.append('file', file);
    if (backFile) {
      formData.append('backFile', backFile);
    }
    return api.post('/ai/identify-card', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: cardId ? { cardId } : undefined,
    }).then(r => r.data);
  },

  identifyPage(file: File, layout: '3x3' | '6x3' = '3x3', backFile?: File): Promise<AiResponse<PageIdentificationResult>> {
    const formData = new FormData();
    formData.append('file', file);
    if (backFile) {
      formData.append('backFile', backFile);
    }
    return api.post('/ai/identify-page', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { layout },
    }).then(r => r.data);
  },

  bulkRescan(cardIds: number[]): Promise<BulkRescanResult> {
    return api.post('/ai/bulk-rescan', { cardIds }).then(r => r.data);
  },
};

export default api;
