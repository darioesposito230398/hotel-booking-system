import React, { useEffect, useState } from 'react';

const RoomGallery = ({ photos, name }) => {
  const images = photos && photos.length > 0 ? photos : [null];
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
  }, [images.length]);

  if (images.length === 1 && !images[0]) return null;

  const current = images[active];

  return (
    <div className="room-gallery">
      {current ? (
        <a
          className="room-gallery-main"
          href={current}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Apri la foto a schermo intero ${name || ''}`}
        >
          <img src={current} alt={name} className="room-gallery-img" />
        </a>
      ) : (
        <div className="room-gallery-img room-gallery-empty">{name || 'Camera'}</div>
      )}
      {images.length > 1 && (
        <div className="room-gallery-thumbs">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              className={`room-gallery-thumb ${i === active ? 'active' : ''}`}
              onClick={() => setActive(i)}
              aria-label={`Foto ${i + 1}`}
            >
              {src ? <img src={src} alt={`${name} ${i + 1}`} /> : <span>{name || 'Camera'}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoomGallery;