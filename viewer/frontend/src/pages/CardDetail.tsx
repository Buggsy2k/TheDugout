import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCw } from 'lucide-react';
import { cardApi, API_BASE } from '../services/api';
import type { Card } from '../types';
import { formatLocation } from '../types';
import ConditionBadge from '../components/ConditionBadge';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function CardDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    cardApi.getCard(parseInt(id))
      .then(setCard)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="page">
        <LoadingSkeleton count={1} />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="page">
        <h1 className="page-title">Card Not Found</h1>
        <button className="btn btn-primary" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  const currentImage = showBack ? card.backImagePath : card.imagePath;

  return (
    <div className="page card-detail-page">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="card-detail-layout">
        <div className="card-detail-image-section">
          {currentImage ? (
            <img
              src={`${API_BASE}${currentImage}`}
              alt={`${card.playerName}${showBack ? ' (back)' : ''}`}
              className="card-detail-image"
            />
          ) : (
            <div className="card-detail-placeholder">
              <span>⚾</span>
              <p>No image</p>
            </div>
          )}
          {card.backImagePath && (
            <button
              className={`btn btn-sm${showBack ? ' btn-accent' : ''}`}
              onClick={() => setShowBack(prev => !prev)}
            >
              <RotateCw size={14} />
              {showBack ? ' Show Front' : ' Show Back'}
            </button>
          )}
        </div>

        <div className="card-detail-info-section">
          <h1 className="card-detail-name">{card.playerName}</h1>
          <p className="card-detail-set">{card.year} {card.setName}</p>

          <div className="card-detail-fields">
            {card.cardNumber && (
              <div className="card-detail-field">
                <span className="field-label">Card #</span>
                <span>{card.cardNumber}</span>
              </div>
            )}
            {card.team && (
              <div className="card-detail-field">
                <span className="field-label">Team</span>
                <span>{card.team}</span>
              </div>
            )}
            {card.manufacturer && (
              <div className="card-detail-field">
                <span className="field-label">Manufacturer</span>
                <span>{card.manufacturer}</span>
              </div>
            )}
            <div className="card-detail-field">
              <span className="field-label">Condition</span>
              <ConditionBadge condition={card.estimatedCondition} size="md" />
            </div>
            {card.conditionNotes && (
              <div className="card-detail-field">
                <span className="field-label">Condition Notes</span>
                <span>{card.conditionNotes}</span>
              </div>
            )}
            <div className="card-detail-field">
              <span className="field-label">Location</span>
              <span>{formatLocation(card.binderNumber, card.pageNumber, card.row, card.column)}</span>
            </div>
            {card.isGraded && (
              <>
                <div className="card-detail-field">
                  <span className="field-label">Grading Service</span>
                  <span>{card.gradingService || '—'}</span>
                </div>
                <div className="card-detail-field">
                  <span className="field-label">Grade</span>
                  <span>{card.gradeValue || '—'}</span>
                </div>
              </>
            )}
            {card.tags && (
              <div className="card-detail-field">
                <span className="field-label">Tags</span>
                <div className="card-detail-tags">
                  {card.tags.split(',').map(tag => (
                    <span key={tag.trim()} className="tag">{tag.trim()}</span>
                  ))}
                </div>
              </div>
            )}
            {card.notes && (
              <div className="card-detail-field">
                <span className="field-label">Notes</span>
                <span>{card.notes}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
