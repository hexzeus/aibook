interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  opacity: number;
}

const colors = [
  '#7C3AED', // brand-500
  '#A855F7', // accent-purple
  '#EC4899', // accent-pink
  '#10B981', // accent-green
  '#F59E0B', // accent-orange
  '#3B82F6', // blue
];

export function triggerConfetti(duration = 3000) {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const particles: Particle[] = [];
  const particleCount = 150;

  // Create particles
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -20,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      opacity: 1,
    });
  }

  const startTime = Date.now();
  let animationFrame: number;

  function animate() {
    if (!ctx) return;

    const elapsed = Date.now() - startTime;
    if (elapsed > duration) {
      document.body.removeChild(canvas);
      cancelAnimationFrame(animationFrame);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fade out in the last 500ms
    const fadeStart = duration - 500;
    const globalOpacity = elapsed > fadeStart ? 1 - (elapsed - fadeStart) / 500 : 1;

    particles.forEach((particle) => {
      // Update position
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.rotationSpeed;
      particle.vy += 0.1; // gravity

      // Draw particle
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate((particle.rotation * Math.PI) / 180);
      ctx.globalAlpha = particle.opacity * globalOpacity;
      ctx.fillStyle = particle.color;

      // Draw rectangle (confetti piece)
      ctx.fillRect(
        -particle.size / 2,
        -particle.size / 2,
        particle.size,
        particle.size * 0.6
      );

      ctx.restore();

      // Reset particle if it goes off screen
      if (particle.y > canvas.height) {
        particle.y = -20;
        particle.x = Math.random() * canvas.width;
      }
    });

    animationFrame = requestAnimationFrame(animate);
  }

  animate();
}
