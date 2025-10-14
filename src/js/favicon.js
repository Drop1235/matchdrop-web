// Create a favicon dynamically
(function() {
  // Create a canvas element
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  
  // Get the canvas context
  const ctx = canvas.getContext('2d');
  
  // Draw a tennis court background (green)
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(0, 0, 32, 32);
  
  // Draw court lines (white)
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1;
  ctx.strokeRect(2, 2, 28, 28);
  
  // Draw net (white)
  ctx.beginPath();
  ctx.moveTo(16, 2);
  ctx.lineTo(16, 30);
  ctx.stroke();
  
  // Draw tennis ball (yellow)
  ctx.fillStyle = '#FFEB3B';
  ctx.beginPath();
  ctx.arc(16, 16, 6, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw tennis ball seam (white)
  ctx.strokeStyle = 'white';
  ctx.beginPath();
  ctx.arc(16, 16, 6, 0, Math.PI * 2);
  ctx.stroke();
  
  // Convert canvas to favicon
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/x-icon';
  link.href = canvas.toDataURL('image/png');
  
  // Add to document head
  document.head.appendChild(link);
})();
