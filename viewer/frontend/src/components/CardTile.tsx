import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import type { Card } from '../types';
import { formatLocation } from '../types';
import ConditionBadge from './ConditionBadge';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../services/api';

interface CardTileProps {
  card: Card;
}

export default function CardTile({ card }: CardTileProps) {
  const navigate = useNavigate();
  const [showBack, setShowBack] = useState(false);
  const hasBack = !!card.backImagePath;
  const currentImage = showBack ? card.backImagePath : card.imagePath;

  const handleFlip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowBack(prev => !prev);
  };

  return (
    <div className="card-tile" onClick={() => navigate(`/cards/${card.id}`)}>
      <div className="card-tile-image">
        {currentImage ? (
          <img
            src={`${API_BASE}${currentImage}`}
            alt={`${card.playerName}${showBack ? ' (back)' : ''}`}
            loading="lazy"
          />
        ) : (
          <div className="card-tile-placeholder">
            <span>⚾</span>
          </div>
        )}
        {hasBack && (
          <button
            className={`card-flip-btn${showBack ? ' flipped' : ''}`}
            onClick={handleFlip}
            title={showBack ? 'Show front' : 'Show back'}
          >
            <RotateCw size={14} />
          </button>
        )}
      </div>
      <div className="card-tile-info">
        <h3 className="card-tile-name">{card.playerName}</h3>
        <p className="card-tile-set">{card.year} {card.setName}</p>
        {card.team && <p className="card-tile-team">{card.team}</p>}
        <div className="card-tile-meta">
          <ConditionBadge condition={card.estimatedCondition} />
        </div>
        <p className="card-tile-location">{formatLocation(card.binderNumber, card.pageNumber, card.row, card.column)}</p>
      </div>
    </div>
  );
}
