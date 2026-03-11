import { AlertTriangle } from 'lucide-react';
import type { Card, NextAvailableSuggestion } from '../types';
import { formatLocation } from '../types';

interface ConflictOverwriteDialogProps {
  mode: 'page' | 'slot';
  conflictingCards: Card[];
  suggestion?: NextAvailableSuggestion;
  onCancel: () => void;
  onUseSuggestion: (suggestion: NextAvailableSuggestion) => void;
  onOverwrite: () => void;
}

export default function ConflictOverwriteDialog({
  mode,
  conflictingCards,
  suggestion,
  onCancel,
  onUseSuggestion,
  onOverwrite,
}: ConflictOverwriteDialogProps) {
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <AlertTriangle size={24} className="dialog-icon-warning" />
          <h2>{mode === 'page' ? 'Page Already Has Cards' : 'Position Already Occupied'}</h2>
        </div>

        <div className="dialog-body">
          <p className="dialog-message">
            {mode === 'page'
              ? `${conflictingCards.length} card${conflictingCards.length !== 1 ? 's' : ''} already exist on the target page${conflictingCards.length > 0 ? ':' : '.'}`
              : 'A card already exists at this position:'}
          </p>

          <div className="dialog-card-list">
            {conflictingCards.slice(0, 9).map(card => (
              <div key={card.id} className="dialog-card-item">
                <span className="dialog-card-name">{card.playerName}</span>
                <span className="dialog-card-detail">
                  {card.year} {card.setName}
                </span>
                <span className="dialog-card-loc">
                  {formatLocation(card.binderNumber, card.pageNumber, card.row, card.column)}
                </span>
              </div>
            ))}
            {conflictingCards.length > 9 && (
              <div className="dialog-card-more">
                +{conflictingCards.length - 9} more card{conflictingCards.length - 9 !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {suggestion && (
            <div className="dialog-suggestion">
              <strong>Suggested alternative:</strong>{' '}
              {mode === 'page'
                ? `Page ${suggestion.pageNumber} (next available)`
                : `${formatLocation(suggestion.binderNumber, suggestion.pageNumber, suggestion.row!, suggestion.column!)} (next available)`}
            </div>
          )}
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          {suggestion && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onUseSuggestion(suggestion)}
            >
              Use Suggested {mode === 'page' ? 'Page' : 'Position'}
            </button>
          )}
          <button type="button" className="btn btn-danger" onClick={onOverwrite}>
            Overwrite ({conflictingCards.length} card{conflictingCards.length !== 1 ? 's' : ''} will be unassigned)
          </button>
        </div>
      </div>
    </div>
  );
}
