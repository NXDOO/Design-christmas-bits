export class Party {
  overlay: HTMLDivElement;
  resultEl: HTMLDivElement;
  giftPicked = false;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'fullscreen-overlay hidden';
    
    // Window Container for dark theme
    const windowEl = document.createElement('div');
    windowEl.className = 'mini-window';
    windowEl.style.backgroundColor = '#111';
    windowEl.style.color = '#fff'; // Ensure base text is white
    windowEl.style.padding = '8px';
    windowEl.style.border = '4px solid #fff';
    windowEl.style.boxShadow = '8px 8px 0 rgba(0,0,0,0.5)';
    windowEl.style.width = '500px';
    windowEl.style.maxWidth = '90vw';
    windowEl.style.position = 'relative';

    const header = document.createElement('div');
    header.className = 'mini-header';
    header.textContent = 'Pick a Gift! 🎁';
    header.style.background = '#e74c3c'; // Santa Red
    header.style.color = '#fff';
    header.style.padding = '10px';
    header.style.display = 'block'; // Or flex if adding close button
    header.style.marginBottom = '12px';

    const container = document.createElement('div');
    container.className = 'mini-container';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.gap = '20px';

    this.resultEl = document.createElement('div');
    this.resultEl.className = 'gift-result-text';
    this.resultEl.style.marginTop = '12px';
    this.resultEl.style.height = '80px'; // Fixed height to prevent jitter
    this.resultEl.style.display = 'flex'; // Center text vertically
    this.resultEl.style.alignItems = 'center';
    this.resultEl.style.justifyContent = 'center';
    this.resultEl.style.textAlign = 'center';
    this.resultEl.style.color = '#f1c40f'; // Darker orange for white bg
    this.resultEl.style.fontSize = '12px';
    // Line height approx 2x font size for readability
    this.resultEl.style.lineHeight = '20px'; 
    this.resultEl.style.padding = '0 10px'; // Add padding to prevent text touching edges 

    const boxes = document.createElement('div');
    boxes.id = 'gift-boxes-container';
    boxes.style.display = 'flex';
    boxes.style.gap = '20px';
    boxes.style.justifyContent = 'center';

    container.appendChild(boxes);
    container.appendChild(this.resultEl);

    // Assemble
    windowEl.appendChild(header);
    windowEl.appendChild(container);
    this.overlay.appendChild(windowEl);
    
    document.body.appendChild(this.overlay);
  }

  start(): Promise<void> {
    this.giftPicked = false;
    this.resultEl.textContent = 'Hover to see details...';
    this.overlay.classList.remove('hidden');
    
    // Re-render boxes to ensure fresh state
    const container = this.overlay.querySelector('#gift-boxes-container') as HTMLDivElement;
    if (container) {
        container.innerHTML = '';
        
        const giftData = [
            { 
                id: 1, 
                hint: "Looks like a cute teddy bear, soft and adorable!", 
                result: "It's a scented candle. Smells really good!",
                boxImg: "/fake_gift_1.png?v=2",
                realImg: "/real_gift_1.png?v=2"
            },
            { 
                id: 2, 
                hint: "What is this? A Lego head storage box? Looks familiar... I think I've seen it before.", 
                result: "It's a tub of protein powder! Health is most important!",
                boxImg: "/fake_gift_2.png?v=2",
                realImg: "/real_gift_2.png?v=2" 
            },
            { 
                id: 3, 
                hint: "Is this the world-famous Labubu? Could it be a secret edition?!", 
                result: "Not Labubu, but a bottle of red wine! Cheers!",
                boxImg: "/fake_gift_3.png?v=2",
                realImg: "/real_gift_3.png?v=2" 
            }
        ];

        return new Promise((resolve) => {
            giftData.forEach(data => {
                const wrapper = document.createElement('div');
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = 'column';
                wrapper.style.alignItems = 'center';
                wrapper.style.cursor = 'pointer';
                wrapper.style.width = '120px'; // Space for text

                // Box Image
                const img = document.createElement('img');
                img.src = data.boxImg;
                img.style.width = '100px';
                img.style.height = '100px';
                img.style.objectFit = 'contain';
                img.style.border = '4px solid #fff'; // White border for dark theme
                img.style.backgroundColor = 'rgb(227, 227, 227)';  
                img.style.transition = 'transform 0.2s';

                wrapper.appendChild(img);

                // Hover Events
                wrapper.addEventListener('mouseenter', () => {
                    if (!this.giftPicked) {
                        this.resultEl.innerHTML = data.hint;
                        img.style.transform = 'scale(1.1)';
                        img.style.border = '4px solid #f1c40f'; // Gold border on hover
                    }
                });
                wrapper.addEventListener('mouseleave', () => {
                   if (!this.giftPicked) {
                       this.resultEl.textContent = 'Pick a gift...';
                       img.style.transform = 'scale(1)';
                       img.style.border = '4px solid #fff'; // Restore white border
                   }
                });

                // Click Event
                wrapper.addEventListener('click', () => {
                    if (this.giftPicked) return;
                    this.giftPicked = true;
                    
                    // Reveal Logic
                    img.src = data.realImg; // Show real gift
                    img.style.border = '4px solid #2ecc71'; // Green for selection
                    img.style.transform = 'scale(1.2)';
                    
                    // Show Result Text
                    this.resultEl.textContent = data.result;

                    // Wait a bit then close using the same Promise
                    setTimeout(() => {
                        this.overlay.classList.add('hidden');
                        resolve();
                    }, 4000); // 4 seconds to read result
                });

                container.appendChild(wrapper);
            });
        });
    }
    return Promise.resolve();
  }
}

export default Party;
