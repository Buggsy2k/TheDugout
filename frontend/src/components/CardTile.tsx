import type { Card } from '../types';
import { formatValueRange, formatLocation, getConditionInfo } from '../types';
import ConditionBadge from './ConditionBadge';
import { useNavigate } from 'react-router-dom';

interface CardTileProps {
  card: Card;
}

const API_BASE = 'http://localhost:5137';

export default function CardTile({ card }: CardTileProps) {
  const navigate = useNavigate();

  return (
    <div className="card-tile" onClick={() => navigate(`/cards/${card.id}`)}>
      <div className="card-tile-image">
        {card.imagePath ? (
          <img
            src={`${API_BASE}${card.imagePath}`}
            alt={card.playerName}
            loading="lazy"
          />
        ) : (
          <div className="card-tile-placeholder">
            <span>⚾</span>
          </div>
        )}
      </div>
      <div className="card-tile-info">
        <h3 className="card-tile-name">{card.playerName}</h3>
        <p className="card-tile-set">{card.year} {card.setName}</p>
        {card.team && <p className="card-tile-team">{card.team}</p>}
        <div className="card-tile-meta">
          <ConditionBadge condition={card.estimatedCondition} />
          <span className="card-tile-value">{formatValueRange(card.valueRangeLow, card.valueRangeHigh)}</span>
        </div>
        <p className="card-tile-location">{formatLocation(card.binderNumber, card.pageNumber, card.row, card.column)}</p>
      </div>
    </div>
  );
}
