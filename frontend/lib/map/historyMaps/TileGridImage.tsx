interface TileGridImageProps {
  tiles: string[]; // row-major, expected to be a perfect square (3x3, 5x5, ...)
  alt: string;
  className?: string;
}

/**
 * Lays tiles out edge-to-edge in a CSS grid so they read as one stitched
 * image. Deliberately avoids drawing to <canvas> — Esri's tile endpoints
 * don't send CORS headers, so a canvas would be pixel-tainted and unusable
 * for getImageData()/toDataURL(). Plain <img> tags have no such
 * restriction, so this is the safe way to composite them client-side.
 */
export function TileGridImage({ tiles, alt, className }: TileGridImageProps) {
  const size = Math.round(Math.sqrt(tiles.length));

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        gridTemplateRows: `repeat(${size}, 1fr)`,
        width: '100%',
        height: '100%',
      }}
    >
      {tiles.map((url, i) => (
        <img
          key={i}
          src={url}
          alt={i === Math.floor(tiles.length / 2) ? alt : ''}
          className="h-full w-full object-cover"
          style={{ display: 'block' }}
          draggable={false}
          loading={i === Math.floor(tiles.length / 2) ? 'eager' : 'lazy'}
        />
      ))}
    </div>
  );
}
