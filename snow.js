(function() {
    'use strict';
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSnow);
    } else {
        initSnow();
    }
    
    function initSnow() {
        const container = document.createElement('div');
        container.id = 'snowContainer';
        container.className = 'snow-container';
        container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:hidden;';
        document.body.appendChild(container);
        
        const config = {
            maxParticles: 20,
            minSize: 8,
            maxSize: 16,
            minSpeed: 0.8,
            maxSpeed: 2.5,
            minOpacity: 0.4,
            maxOpacity: 0.85,
            windStrength: 0.4
        };
        
        const colors = ['#f2a603', '#e69500', '#ffb31a'];
        
        const starSvg = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M13.9776 1.12252C13.4334 -0.374181 11.3166 -0.374166 10.7724 1.12252L8.29909 7.92408L1.49752 10.3974C0.000818759 10.9416 0.000834286 13.0584 1.49752 13.6026L8.29909 16.0759L10.7724 22.8775C11.3166 24.3741 13.4334 24.3741 13.9776 22.8775L16.4509 16.0759L23.2525 13.6026C24.7492 13.0584 24.7492 10.9416 23.2525 10.3974L16.4509 7.92408L13.9776 1.12252Z"/></svg>`;
        
        let particles = [];
        let animationId;
        
        class Particle {
            constructor() {
                this.el = document.createElement('div');
                this.el.innerHTML = starSvg;
                this.el.style.cssText = 'position:absolute;will-change:transform;';
                container.appendChild(this.el);
                this.reset();
                this.y = Math.random() * window.innerHeight;
                this.updateStyle();
            }
            
            reset() {
                this.x = Math.random() * window.innerWidth;
                this.y = -30;
                this.size = Math.random() * (config.maxSize - config.minSize) + config.minSize;
                this.speed = Math.random() * (config.maxSpeed - config.minSpeed) + config.minSpeed;
                this.opacity = Math.random() * (config.maxOpacity - config.minOpacity) + config.minOpacity;
                this.wind = (Math.random() - 0.5) * config.windStrength;
                this.rotation = Math.random() * 360;
                this.rotationSpeed = (Math.random() - 0.5) * 2;
                this.color = colors[Math.floor(Math.random() * colors.length)];
                
                this.el.style.width = this.size + 'px';
                this.el.style.height = this.size + 'px';
                this.el.querySelector('path').setAttribute('fill', this.color);
            }
            
            update() {
                this.y += this.speed;
                this.x += this.wind + Math.sin(this.y * 0.01) * 0.5;
                this.rotation += this.rotationSpeed;
                
                if (this.y > window.innerHeight + 30 || this.x < -30 || this.x > window.innerWidth + 30) {
                    this.reset();
                }
                
                this.updateStyle();
            }
            
            updateStyle() {
                this.el.style.transform = `translate(${this.x}px, ${this.y}px) rotate(${this.rotation}deg)`;
                this.el.style.opacity = this.opacity;
            }
        }
        
        function createParticles() {
            for (let i = 0; i < config.maxParticles; i++) {
                particles.push(new Particle());
            }
        }
        
        function animate() {
            for (let p of particles) {
                p.update();
            }
            animationId = requestAnimationFrame(animate);
        }
        
        createParticles();
        animate();
        
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                cancelAnimationFrame(animationId);
            } else {
                animate();
            }
        });
    }
})();
