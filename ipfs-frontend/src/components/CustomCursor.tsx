import React, { useEffect, useState } from 'react';

export function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) return;

    let requestId: number;

    const updateCursor = (e: MouseEvent) => {
      requestId = requestAnimationFrame(() => {
        setPosition({ x: e.clientX, y: e.clientY });
        setIsVisible(true);
      });
    };

    const handleMouseEnter = () => setIsVisible(true);
    const handleMouseLeave = () => setIsVisible(false);

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive = target.tagName === 'BUTTON' || 
                           target.tagName === 'A' || 
                           target.tagName === 'INPUT' || 
                           target.tagName === 'TEXTAREA' ||
                           target.getAttribute('role') === 'button' ||
                           target.style.cursor === 'pointer' ||
                           target.closest('button') ||
                           target.closest('a') ||
                           target.closest('[role="button"]');
      
      setIsHovering(!!isInteractive);
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    document.addEventListener('mousemove', updateCursor);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', updateCursor);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      if (requestId) {
        cancelAnimationFrame(requestId);
      }
    };
  }, []);

  if (window.innerWidth <= 768 || !isVisible) return null;

  return (
    <>
      {/* Main cursor */}
      <div
        className={`custom-cursor ${isHovering ? 'hover' : ''} ${isClicking ? 'click' : ''}`}
        style={{
          left: position.x - 10,
          top: position.y - 10,
        }}
      />
      
      {/* Cursor trail effect */}
      <div
        className="fixed pointer-events-none z-[9998] transition-all duration-300 ease-out"
        style={{
          left: position.x - 5,
          top: position.y - 5,
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 255, 255, 0.3), transparent)',
          transform: `scale(${isClicking ? 0.5 : isHovering ? 2 : 1.5})`,
          opacity: isVisible ? 0.6 : 0,
        }}
      />
      
      {/* Additional glow effect */}
      <div
        className="fixed pointer-events-none z-[9997] transition-all duration-500 ease-out"
        style={{
          left: position.x - 15,
          top: position.y - 15,
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 0, 255, 0.1), transparent)',
          transform: `scale(${isClicking ? 0.3 : isHovering ? 1.5 : 1})`,
          opacity: isVisible ? 0.4 : 0,
        }}
      />
    </>
  );
}
