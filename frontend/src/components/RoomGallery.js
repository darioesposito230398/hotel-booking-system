import React, { useEffect, useRef, useState } from 'react';

const RoomGallery = ({ photos, name }) => {
  const images = photos && photos.length > 0 ? photos : [null];
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    setActive(0);
  }, [images.length]);

  useEffect(() => {
    if (!open) return;
    const d = dialogRef.current;
    if (!d) return;
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }, [open]);

  if (images.length === 1 && !images[0]) return null;

  const renderImage = (src, className, alt) =>
    src ? (
      <img src={src} alt={alt} className={className} />
    ) : (
      <div className={`${className} room-gallery-empty`}>{name || 'Camera'}</div>
    );

  const close = () => {
    const d = dialogRef.current;
    if (d && typeof d.close === 'function') d.close();
    setOpen(false);
  };

  return (
    <>
      <div className="room-gallery">
        <button
          type="button"
          className="room-gallery-main"
          onClick={() => setOpen(true)}
          aria-label={`Apri la foto a tutto schermo ${name || ''}`}
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
                {src ? <img src={src} alt={`${name} ${i + 1}`} /> : <span>{name || 'Camera'}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <dialog ref={dialogRef} className="room-lightbox" aria-label={`Foto ${name || ''}`}>
          <button type="button" className="room-lightbox-close" onClick={close} aria-label="Chiudi">
            ×
          </button>
          {images.length > 1 && (
            <button
              type="button"
              className="room-lightbox-nav prev"
              onClick={() => setActive((a) => (a - 1 + images.length) % images.length)}
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
              onClick={() => setActive((a) => (a + 1) % images.length)}
              aria-label="Successiva"
            >
              ›
            </button>
          )}
          {images.length > 1 && (
            <div className="room-lightbox-count">{active + 1} / {images.length}</div>
          )}
        </dialog>
      )}
    </>
  );
};

export default RoomGallery;