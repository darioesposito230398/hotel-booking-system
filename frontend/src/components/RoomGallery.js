import React, { useEffect, useState } from 'react';

const RoomGallery = ({ photos, name }) => {
  const images = photos && photos.length > 0 ? photos : [null];
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setActive(0);
  }, [images.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowRight') setActive(a => (a + 1) % images.length);
      if (e.key === 'ArrowLeft') setActive(a => (a - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, images.length]);

  if (images.length === 1 && !images[0]) return null;

  const renderImage = (src, className, alt) => (
    src ? (
      <img src={src} alt={alt} className={className} />
    ) : (
      <div className={`${className} room-gallery-empty`}>{name || 'Camera'}</div>
    )
  );

  return (
    <>
      <div className="room-gallery">
        <button
          type="button"
          className="room-gallery-main"
          onClick={() => setOpen(true)}
          aria-label="Apri galleria foto"
        >
          {renderImage(images[active], 'room-gallery-img', name)}
        </button>
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
                {src ? (
                  <img src={src} alt={`${name} ${i + 1}`} />
                ) : (
                  <span>{name || 'Camera'}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div
          className="room-lightbox"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Galleria foto"
        >
          <button
            type="button"
            className="room-lightbox-close"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            aria-label="Chiudi"
          >
            ×
          </button>
          <div className="room-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            {images.length > 1 && (
              <button
                type="button"
                className="room-lightbox-nav prev"
                onClick={(e) => { e.stopPropagation(); setActive(a => (a - 1 + images.length) % images.length); }}
                aria-label="Precedente"
              >
                ‹
              </button>
            )}
            {renderImage(images[active], 'room-lightbox-img', name)}
            {images.length > 1 && (
              <button
                type="button"
                className="room-lightbox-nav next"
                onClick={(e) => { e.stopPropagation(); setActive(a => (a + 1) % images.length); }}
                aria-label="Successiva"
              >
                ›
              </button>
            )}
            {images.length > 1 && (
              <div className="room-lightbox-count">{active + 1} / {images.length}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default RoomGallery;
