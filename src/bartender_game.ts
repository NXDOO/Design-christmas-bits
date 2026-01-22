type Recipe = { name: string; ingredients: string[] };

export class BartenderGame {
  overlay: HTMLDivElement;
  recipes: Recipe[];
  madeCounts: Record<string, number> = {};
  listEl: HTMLDivElement | null = null;
  updateCounts: () => void = () => {};

  constructor() {
    this.recipes = [
      { name: 'A', ingredients: ['Juice', 'Ice'] },
      { name: 'B', ingredients: ['Soda', 'Lemon'] },
      { name: 'C', ingredients: ['Coffee', 'Milk'] },
    ];

    this.overlay = document.createElement('div');
    this.overlay.className = 'fullscreen-overlay hidden';

    // Create a Window Container for the game
    const windowEl = document.createElement('div');
    windowEl.className = 'mini-window';
    windowEl.style.backgroundColor = '#111'; // Black background
    windowEl.style.padding = '8px'; 
    windowEl.style.border = '4px solid #fff'; // White border
    windowEl.style.boxShadow = '8px 8px 0 rgba(0,0,0,0.5)';
    windowEl.style.color = '#fff'; // White text
    windowEl.style.display = 'block'; 
    windowEl.style.width = '600px'; 
    windowEl.style.maxWidth = '90vw'; 
    windowEl.style.position = 'relative';

    const header = document.createElement('div');
    header.className = 'mini-header';
    header.textContent = 'Mix Drinks';
    header.style.background = '#00b894'; // Samuel Green
    header.style.color = '#fff';
    header.style.padding = '10px';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '12px';

    // Close Button (Pixel Art Style)
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.style.width = '24px';
    closeBtn.style.height = '24px';
    closeBtn.style.lineHeight = '20px'; 
    closeBtn.style.padding = '0';
    closeBtn.style.textAlign = 'center';
    closeBtn.style.background = '#e74c3c';
    closeBtn.style.color = '#fff';
    closeBtn.style.border = '2px solid #fff'; // White border for dark theme
    closeBtn.style.boxShadow = '2px 2px 0px #000'; 
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '10px';
    
    closeBtn.addEventListener('click', () => {
      this.hide();
      if ((this as any)._resolve) (this as any)._resolve(false);
    });
    header.appendChild(closeBtn);
    windowEl.appendChild(header);

    const instruction = document.createElement('div');
    instruction.innerHTML = 'Mix <span style="color:#e74c3c; font-weight:bold; font-size:14px;">2</span> of each drink using correct recipes.';
    instruction.className = 'mini-footer'; // Reuse style but placed top
    instruction.style.marginBottom = '12px';
    instruction.style.fontSize = '12px'; // Adjust font size
    instruction.style.textAlign = 'center';
    windowEl.appendChild(instruction);

    const container = document.createElement('div');
    container.className = 'mini-container';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.gap = '12px';
    this.listEl = list;

    for (const r of this.recipes) {
      const card = document.createElement('div');
      card.style.padding = '8px';
      card.style.background = '#333';
      card.style.color = '#fff';
      card.style.minWidth = '160px';
      card.style.fontSize = '10px';
      card.style.lineHeight = '2'; // 2x line height as requested
      
      // Title and recipe
      const title = document.createElement('div');
      title.innerHTML = `<b>Drink ${r.name}</b><br/>${r.ingredients.join(' + ')}`;
      
      // Visual feedback container
      const resultContainer = document.createElement('div');
      resultContainer.className = 'made-visuals';
      resultContainer.style.marginTop = '8px';
      resultContainer.style.height = '50px'; // Height for larger icons
      resultContainer.style.display = 'flex';
      resultContainer.style.alignItems = 'center'; // Vertical center
      resultContainer.style.gap = '8px';
      
      card.appendChild(title);
      card.appendChild(resultContainer);
      list.appendChild(card);
      this.madeCounts[r.name] = 0;
    }

    const controls = document.createElement('div');
    controls.style.marginTop = '20px'; // More space
    controls.style.width = '100%'; // Full width
    
    // Ingredients Container
    const ingContainer = document.createElement('div');
    ingContainer.style.display = 'flex';
    ingContainer.style.flexWrap = 'wrap';
    ingContainer.style.gap = '15px'; // Larger gap
    ingContainer.style.justifyContent = 'space-between'; // Spread out
    ingContainer.style.padding = '0 20px'; // Side padding

    // Mixed order as requested
    const ingredients = [
        { name: 'Coffee', file: 'Coffee.png' },
        { name: 'Ice', file: 'ice.png' },
        { name: 'Lemon', file: 'lemon.png' },
        { name: 'Milk', file: 'Milk.png' },
        { name: 'Soda', file: 'soda.png' },
        { name: 'Juice', file: 'Juice.png' }
    ];

    const selection = document.createElement('div');
    selection.textContent = 'Selected: ';
    selection.style.marginTop = '15px';
    selection.style.marginBottom = '10px';
    selection.style.fontSize = '12px'; // Smaller font size
    selection.style.textAlign = 'left'; // Left align
    selection.style.paddingLeft = '20px'; // Align with ingredients since they have padding
    
    const makeBtn = document.createElement('button');
    makeBtn.textContent = 'Mix Drink!';
    makeBtn.style.padding = '8px 16px';
    makeBtn.style.fontSize = '12px';
    makeBtn.style.background = '#e74c3c';
    makeBtn.style.border = '2px solid #fff';
    makeBtn.style.color = '#fff';
    makeBtn.style.cursor = 'pointer';
    makeBtn.style.marginLeft = '20px'; // Align with left padding

    const chosen: string[] = [];
    
    ingredients.forEach(ing => {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.alignItems = 'center';
      wrapper.style.cursor = 'pointer';
      
      const img = document.createElement('img');
      img.src = import.meta.env.BASE_URL + ing.file;
      img.style.width = '48px';
      img.style.height = '48px';
      img.style.objectFit = 'contain'; // Ensure pixel art scales nicely or stays contained
      img.style.imageRendering = 'pixelated';
      img.style.border = '2px solid #fff';
      img.style.backgroundColor = '#333';
      img.style.padding = '4px';
      
      // Hover effect
      wrapper.onmouseenter = () => img.style.borderColor = '#f1c40f';
      wrapper.onmouseleave = () => img.style.borderColor = '#fff';

      const label = document.createElement('span');
      label.textContent = ing.name;
      label.style.fontSize = '10px';
      label.style.marginTop = '4px';
      label.style.color = '#fff';

      wrapper.appendChild(img);
      wrapper.appendChild(label);

      wrapper.addEventListener('click', () => {
        chosen.push(ing.name);
        selection.textContent = 'Selected: ' + chosen.join(', ');
        
        // Click feedback
        img.style.backgroundColor = '#555';
        setTimeout(() => img.style.backgroundColor = '#333', 100);
      });
      
      ingContainer.appendChild(wrapper);
    });

    controls.appendChild(ingContainer);
    
    const actionArea = document.createElement('div');
    actionArea.style.display = 'flex';
    actionArea.style.flexDirection = 'column';
    actionArea.style.alignItems = 'flex-start'; // Align content to left
    actionArea.style.width = '100%';
    
    actionArea.appendChild(selection);
    actionArea.appendChild(makeBtn);
    
    controls.appendChild(actionArea);

    container.appendChild(list);
    container.appendChild(controls);

    const footer = document.createElement('div');
    footer.className = 'mini-footer';
    // Removed text from footer as it is moved to top

    windowEl.appendChild(container);
    windowEl.appendChild(footer);
    this.overlay.appendChild(windowEl);
    document.body.appendChild(this.overlay);

    this.updateCounts = () => {
      if (!this.listEl) return;
      const drinkIcons: Record<string, string> = {
          'A': 'icejuice.png',
          'B': 'lemonsoda.png',
          'C': 'milkcoffee.png'
      };

      for (let i = 0; i < this.recipes.length; i++) {
        const r = this.recipes[i];
        const card = this.listEl.children[i] as HTMLElement;
        const visualContainer = card.querySelector('.made-visuals') as HTMLElement;
        
        if (visualContainer) {
            visualContainer.innerHTML = '';
            const count = this.madeCounts[r.name] ?? 0;
            const target = 2;
            
            for (let c = 0; c < target; c++) {
                if (c < count) {
                     // Filled Slot
                    const img = document.createElement('img');
                    img.src = import.meta.env.BASE_URL + (drinkIcons[r.name] || 'Coffee.png');
                    img.style.width = '32px'; 
                    img.style.height = '32px';
                    img.style.objectFit = 'contain';
                    img.style.imageRendering = 'pixelated';
                    visualContainer.appendChild(img);
                } else {
                    // Empty Slot
                    const empty = document.createElement('div');
                    empty.style.width = '32px';
                    empty.style.height = '32px';
                    empty.style.border = '2px dashed #7f8c8d';
                    empty.style.background = 'rgba(0,0,0,0.3)';
                    empty.style.boxSizing = 'border-box';
                    visualContainer.appendChild(empty);
                }
            }

            // Green 8-bit Checkmark if complete
            if (count >= 2) {
                const check = document.createElement('div');
                check.style.marginLeft = '12px';
                // SVG Pixel Art Checkmark
                check.innerHTML = `
                <svg width="24" height="20" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg" style="image-rendering: pixelated; display: block;">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M10 0H12V2H10V0ZM8 2H10V4H8V2ZM6 4H8V6H6V4ZM4 6H6V8H4V6ZM0 4H2V6H0V4ZM2 6H4V8H2V6Z" fill="#2ecc71"/>
                </svg>
                `;
                visualContainer.appendChild(check);
            }
        }
      }
    };

    // initial counts
    this.updateCounts();

    makeBtn.addEventListener('click', () => {
      // check chosen against recipes
      const sortedChosen = [...chosen].sort();
      for (const r of this.recipes) {
        const sortedRecipe = [...r.ingredients].sort();
        if (arraysEqual(sortedRecipe, sortedChosen)) {
          this.madeCounts[r.name] = (this.madeCounts[r.name] || 0) + 1;
          this.updateCounts();
          chosen.length = 0;
          selection.textContent = 'Selected: ';
          // check if all done
          if (Object.values(this.madeCounts).every(v => v >= 2)) {
            setTimeout(() => {
              this.hide();
              if ((this as any)._resolve) (this as any)._resolve(true);
            }, 400);
          }
          return;
        }
      }
      // wrong combination: just clear
      chosen.length = 0;
      selection.textContent = 'Selected: ';
    });
  }

  start() {
    for (const k of Object.keys(this.madeCounts)) this.madeCounts[k] = 0;
    this.updateCounts();
    this.overlay.classList.remove('hidden');
    return new Promise<boolean>((resolve) => {
      (this as any)._resolve = resolve;
    });
  }

  hide() {
    this.overlay.classList.add('hidden');
  }
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export default BartenderGame;
