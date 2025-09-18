// Main Application Logic
class BeyondStoicismApp {
    constructor() {
        this.currentContent = 'welcome';
        this.contentLoader = new ContentLoader();
        this.chapterNamesOverride = null; // from frontmatter if provided
        this.pendingAnchor = null; // anchor to scroll to after load
        this.init();
    }


    init() {
        this.setupEventListeners();
        this.initializeNavigation();
        // Load chapter metadata from content/index.md and build nav dynamically
        this.loadChaptersMetaAndBuildNav();
        this.loadProgress();
        this.updateProgressDisplay();
        // Enable path-based routing (History API) for bookmarking
        window.addEventListener('popstate', () => this.routeFromLocation());
    }

    async loadChaptersMetaAndBuildNav() {
        try {
            const res = await fetch(`${this.getBasePath()}content/index.md?t=${Date.now()}`);
            if (!res.ok) throw new Error('Failed to fetch index.md');
            const raw = await res.text();
            const { frontmatter } = this.extractFrontmatter(raw);
            if (frontmatter && frontmatter.chapters) {
                // Expect mapping of number string -> name
                this.chapterNamesOverride = frontmatter.chapters;
            }
            if (frontmatter && frontmatter.slugs) {
                this.chapterSlugsOverride = frontmatter.slugs; // map number -> slug
            }
            // Save static labels
            this.staticLabels = {
                home: frontmatter?.home_label || 'Home',
                timeline: frontmatter?.timeline_label || 'Timeline: Philosophers & Events',
                epilogue: frontmatter?.epilogue_label || 'Epilogue',
                bibliography: frontmatter?.bibliography_label || 'Bibliography'
            };
        } catch (e) {
            console.warn('No frontmatter chapters found; using defaults.', e);
            this.staticLabels = {
                home: 'Home',
                timeline: 'Timeline: Philosophers & Events',
                epilogue: 'Epilogue',
                bibliography: 'Bibliography'
            };
        }
        this.buildStaticNav();
        this.buildChaptersNav();
        // Route based on current path (or default to Home)
        this.routeFromLocation(true);
    }

    extractFrontmatter(raw) {
        // Minimal YAML-like frontmatter extractor for simple key:value and nested mapping
        // Returns { frontmatter: Object|null, body: string }
        if (!raw.startsWith('---')) return { frontmatter: null, body: raw };
        const parts = raw.split('\n');
        let i = 1;
        const fmLines = [];
        for (; i < parts.length; i++) {
            if (parts[i].trim() === '---') { i++; break; }
            fmLines.push(parts[i]);
        }
        const body = parts.slice(i).join('\n');
        const frontmatter = this.parseSimpleYAML(fmLines.join('\n'));
        return { frontmatter, body };
    }

    parseSimpleYAML(yamlText) {
        // Very small parser sufficient for our frontmatter structure
        // Supports: key: value, key: (newline) indented mapping of "subkey: value"
        const lines = yamlText.split(/\r?\n/);
        const obj = {};
        let currentKey = null;
        let inMap = false;
        obj.chapters = undefined;
        for (let line of lines) {
            if (!line.trim()) continue;
            const topMatch = line.match(/^(\w+):\s*(.*)$/);
            if (topMatch && !line.startsWith(' ')) {
                currentKey = topMatch[1];
                const val = topMatch[2];
                if (val) {
                    obj[currentKey] = this.stripQuotes(val.trim());
                    inMap = false;
                } else {
                    // Maybe a nested mapping follows
                    obj[currentKey] = {};
                    inMap = true;
                }
                continue;
            }
            if (inMap && currentKey && line.startsWith('  ')) {
                const mapMatch = line.trim().match(/^["']?(\d+)["']?\s*:\s*(.*)$/);
                if (mapMatch) {
                    const k = mapMatch[1];
                    let v = mapMatch[2];
                    obj[currentKey][k] = this.stripQuotes(v.trim());
                }
            }
        }
        return obj;
    }

    stripQuotes(s) {
        if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
            return s.slice(1, -1);
        }
        return s;
    }

    // Routing helpers (path-based)
    routeFromLocation(isInitial = false) {
        const path = window.location.pathname;
        const hash = (window.location.hash || '').replace(/^#/, '') || null;
        const segments = path.split('/').filter(Boolean);
        const baseSegments = segments.slice(0, -1);
        const last = segments[segments.length - 1] || '';

        // Determine contentId from last path segment
        let contentId = 'welcome';
        if (!last || last === 'index' || last === 'index.html') {
            contentId = 'welcome';
        } else if (last === 'timeline' || last === 'epilogue' || last === 'bibliography') {
            contentId = last;
        } else {
            // Try to match a chapter slug
            const slugMap = this.getChapterSlugMap(); // slug -> number
            if (slugMap[last]) {
                contentId = `chapter-${slugMap[last]}`;
            } else {
                // Not recognized; default to home
                contentId = 'welcome';
            }
        }

        this._loadContentInternal(contentId, hash, /*fromRouter*/ true);

        // Set active item
        const selector = contentId === 'welcome'
            ? '#staticList .nav-item[data-content="welcome"]'
            : `.nav-item[data-content="${contentId}"]`;
        const item = document.querySelector(selector);
        if (item) this.setActiveNavItem(item);
    }

    navigatePath(contentId, anchor = null, replace = false) {
        const base = this.getBasePath();
        let slug = '';
        if (contentId === 'welcome') slug = '';
        else if (contentId === 'timeline' || contentId === 'epilogue' || contentId === 'bibliography') slug = contentId;
        else if (contentId.startsWith('chapter-')) {
            const num = contentId.split('-')[1];
            slug = this.slugify(this.getChapterNames()[num] || contentId);
        }
        let newPath = base + (slug ? (base.endsWith('/') ? '' : '/') + slug : '');
        if (!newPath) newPath = '/';
        const url = newPath + (anchor ? '#' + anchor : '');
        if (replace) history.replaceState(null, '', url); else history.pushState(null, '', url);
        this._loadContentInternal(contentId, anchor, /*fromRouter*/ true);
    }

    getBasePath() {
        const p = window.location.pathname;
        const idx = p.lastIndexOf('/');
        if (idx === -1) return '/';
        const base = p.substring(0, idx + 1);
        return base || '/';
    }

    buildChaptersNav() {
        const names = this.getChapterNames();
        const container = document.getElementById('chaptersList');
        if (!container) return;
        container.innerHTML = '';
        // Update dynamic header count
        const header = document.getElementById('chaptersHeader');
        if (header) {
            const count = Object.keys(names).length;
            header.textContent = `Chapters (${count})`;
        }
        Object.keys(names)
            .sort((a,b) => Number(a)-Number(b))
            .forEach(num => {
                const item = document.createElement('div');
                item.className = 'nav-item';
                item.dataset.content = `chapter-${num}`;
                const span = document.createElement('span');
                span.className = 'progress-indicator';
                span.id = `progress-ch${num}`;
                span.textContent = '○';
                item.appendChild(span);
                item.appendChild(document.createTextNode(` ${num}. ${names[num]}`));
                // Attach click handler
                item.addEventListener('click', (e) => {
                    const contentId = item.dataset.content;
                    if (contentId) {
                        this.navigatePath(contentId);
                        this.setActiveNavItem(item);
                    }
                    if (window.innerWidth <= 768) {
                        const overlay = document.getElementById('sidebarOverlay');
                        const sidebar = document.getElementById('sidebar');
                        sidebar.classList.remove('open');
                        overlay.classList.remove('active');
                    }
                });
                container.appendChild(item);
            });
        // Update indicators after building
        this.loadProgress();
    }

    buildStaticNav() {
        // Top: Home and Timeline
        const top = document.getElementById('staticList');
        if (top) {
            top.innerHTML = '';
            // Home item
            const homeItem = document.createElement('div');
            homeItem.className = 'nav-item';
            homeItem.dataset.content = 'welcome';
            const homeLabel = this.staticLabels?.home || 'Home';
            const homeSpan = document.createElement('span');
            homeSpan.className = 'progress-indicator';
            homeSpan.textContent = ' '; // spacer for alignment; no progress for Home
            homeItem.appendChild(homeSpan);
            homeItem.appendChild(document.createTextNode(' ' + homeLabel));
            homeItem.addEventListener('click', () => {
                this.navigatePath('welcome');
                this.setActiveNavItem(homeItem);
                if (window.innerWidth <= 768) {
                    const overlay = document.getElementById('sidebarOverlay');
                    const sidebar = document.getElementById('sidebar');
                    sidebar.classList.remove('open');
                    overlay.classList.remove('active');
                }
            });
            top.appendChild(homeItem);

            // Timeline item
            const id = 'timeline';
            const label = this.staticLabels?.timeline || 'Timeline: Philosophers & Events';
            const item = document.createElement('div');
            item.className = 'nav-item';
            item.dataset.content = id;
            const span = document.createElement('span');
            span.className = 'progress-indicator';
            span.id = `progress-${id}`;
            span.textContent = '○';
            item.appendChild(span);
            item.appendChild(document.createTextNode(' ' + label));
            item.addEventListener('click', () => {
                this.navigatePath(id);
                this.setActiveNavItem(item);
                if (window.innerWidth <= 768) {
                    const overlay = document.getElementById('sidebarOverlay');
                    const sidebar = document.getElementById('sidebar');
                    sidebar.classList.remove('open');
                    overlay.classList.remove('active');
                }
            });
            top.appendChild(item);
        }

        // Bottom: Epilogue and Bibliography
        const bottom = document.getElementById('endList');
        if (bottom) {
            bottom.innerHTML = '';
            [
                { id: 'epilogue', label: this.staticLabels?.epilogue || 'Epilogue' },
                { id: 'bibliography', label: this.staticLabels?.bibliography || 'Bibliography' }
            ].forEach(({ id, label }) => {
                const item = document.createElement('div');
                item.className = 'nav-item';
                item.dataset.content = id;
                const span = document.createElement('span');
                span.className = 'progress-indicator';
                span.id = `progress-${id}`;
                span.textContent = '○';
                item.appendChild(span);
                item.appendChild(document.createTextNode(' ' + label));
                item.addEventListener('click', () => {
                    this.navigatePath(id);
                    this.setActiveNavItem(item);
                    if (window.innerWidth <= 768) {
                        const overlay = document.getElementById('sidebarOverlay');
                        const sidebar = document.getElementById('sidebar');
                        sidebar.classList.remove('open');
                        overlay.classList.remove('active');
                    }
                });
                bottom.appendChild(item);
            });
        }
        // Update indicators for static items
        ['timeline','epilogue','bibliography'].forEach(cid => this.updateProgressIndicator(cid));
    }

    setupEventListeners() {
        // Toggle sidebar with overlay
        const toggleBtn = document.getElementById('toggleBtn');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        
        const toggleSidebar = () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
        };
        
        const closeSidebar = () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        };
        
        toggleBtn.addEventListener('click', toggleSidebar);
        overlay.addEventListener('click', closeSidebar);
        
        // Close sidebar on navigation (mobile)
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    closeSidebar();
                }
            });
        });


        // Navigation items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const contentId = e.currentTarget.dataset.content;
                if (contentId) {
                    this.loadContent(contentId);
                    this.setActiveNavItem(e.currentTarget);
                }
            });
        });

        // Complete button
        const completeBtn = document.getElementById('completeBtn');
        completeBtn.addEventListener('click', () => {
            this.toggleCompletion();
        });

        // Print button
        const printBtn = document.getElementById('printBtn');
        printBtn.addEventListener('click', () => {
            this.printCurrentChapter();
        });

        // Save button
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.addEventListener('click', () => {
            this.manualSave();
        });

        // Export button
        const exportBtn = document.getElementById('exportBtn');
        exportBtn.addEventListener('click', () => {
            this.exportToMarkdown();
        });

        // Import button
        const importBtn = document.getElementById('importBtn');
        const fileInput = document.getElementById('fileInput');
        
        importBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importFromMarkdown(e.target.files[0]);
            }
        });

        // Auto-save for elements with data-save-key with logging
        document.addEventListener('input', (e) => {
            if (e.target.hasAttribute('data-save-key')) {
                this.showSaveStatus('saving', 'Saving...');
                
                // Debounce the save operation
                clearTimeout(this.saveTimeout);
                this.saveTimeout = setTimeout(() => {
                    this.autoSave(e.target);
                    this.showSaveStatus('saved', 'Auto-saved');
                    
                    this.logUserAction('text_input', {
                        saveKey: e.target.dataset.saveKey,
                        contentLength: e.target.value.length,
                        timestamp: new Date().toISOString()
                    });
                }, 1000); // Save after 1 second of no typing
            }
        });

        // Check for Apple device and auto-import capability
        if (this.isAppleDevice()) {
            this.checkForCloudSync();
        }
    }

    initializeNavigation() {
        // Chapters are now shown by default, no initialization needed
    }

    loadContent(contentId, anchor = null, fromHash = false) {
        // Backwards compatibility: support old call signatures
        return this._loadContentInternal(contentId, anchor, fromHash);
    }

    _loadContentInternal(contentId, anchor = null, fromRouter = false) {
        this.currentContent = contentId;
        this.pendingAnchor = anchor;
        const contentTitle = document.getElementById('contentTitle');
        const contentBody = document.getElementById('contentBody');
        const completeBtn = document.getElementById('completeBtn');

        // Update title and show/hide complete button
        const titles = {
            'welcome': 'Welcome to Beyond Stoicism',
            'timeline': 'Timeline of Philosophers and Events',
            'chapter-1': 'Chapter 1: Cyrenaicism',
            'chapter-2': 'Chapter 2: Epicureanism',
            'chapter-3': 'Chapter 3: Aristotelianism',
            'chapter-4': 'Chapter 4: Stoicism',
            'chapter-5': 'Chapter 5: Cynicism',
            'chapter-6': 'Chapter 6: Political Platonism',
            'chapter-7': 'Chapter 7: Socraticism',
            'chapter-8': 'Chapter 8: Sophism',
            'chapter-9': 'Chapter 9: Academic Skepticism',
            'chapter-10': 'Chapter 10: Pyrrhonism',
            'chapter-11': 'Chapter 11: Pythagoreanism',
            'chapter-12': 'Chapter 12: Megarianism',
            'chapter-13': 'Chapter 13: Neoplatonism',
            'epilogue': 'Epilogue: Reflection and Integration',
            'bibliography': 'Bibliography and Further Reading'
        };

        contentTitle.textContent = titles[contentId] || 'Content';
        
        // Show/hide buttons based on content type
        const saveBtn = document.getElementById('saveBtn');
        const exportBtn = document.getElementById('exportBtn');
        const importBtn = document.getElementById('importBtn');
        
        if (contentId === 'welcome') {
            completeBtn.style.display = 'none';
            saveBtn.style.display = 'none';
            exportBtn.style.display = 'inline-flex';
            importBtn.style.display = 'inline-flex';
        } else {
            completeBtn.style.display = 'inline-flex';
            saveBtn.style.display = 'inline-flex';
            exportBtn.style.display = 'inline-flex';
            importBtn.style.display = 'inline-flex';
            this.updateCompleteButton();
        }
        
        // Initialize save status
        this.showSaveStatus('saved', 'Auto-saved');

        // URL already updated by navigatePath or popstate

        // Load content based on type
        if (contentId === 'welcome') {
            this.loadWelcomeContent();
        } else if (contentId === 'timeline') {
            this.loadTimelineContent();
        } else if (contentId.startsWith('chapter-')) {
            this.loadChapterContent(contentId);
        } else if (contentId === 'epilogue') {
            this.loadEpilogueContent();
        } else if (contentId === 'bibliography') {
            this.loadBibliographyContent();
        }
    }

    async loadWelcomeContent() {
        const contentBody = document.getElementById('contentBody');
        contentBody.innerHTML = '<div class="loading">Loading...</div>';
        try {
            const res = await fetch(`${this.getBasePath()}content/index.md?t=${Date.now()}`);
            if (!res.ok) throw new Error('Failed to load index.md');
            const raw = await res.text();
            const { frontmatter, body } = this.extractFrontmatter(raw);
            const html = this.contentLoader.parser.parse(body);
            contentBody.innerHTML = `
                <div class="welcome-content">${html}</div>
            `;
            // Update title from frontmatter if present
            const contentTitle = document.getElementById('contentTitle');
            if (frontmatter?.title && contentTitle) {
                contentTitle.textContent = frontmatter.title;
            }
            this.scrollToPendingAnchor();
        } catch (e) {
            console.error('Error loading welcome content', e);
            contentBody.innerHTML = '<div class="welcome-content"><p><em>Welcome content not available.</em></p></div>';
        }
    }

    async loadTimelineContent() {
        const contentBody = document.getElementById('contentBody');
        contentBody.innerHTML = '<div class="loading">Loading timeline content...</div>';
        
        try {
            const htmlContent = await this.contentLoader.loadContent(`${this.getBasePath()}content/timeline.md`);
            contentBody.innerHTML = `
                <div class="chapter-content">
                    ${htmlContent}
                    
                    <div class="exercise-section">
                        <h3>Timeline Reflection</h3>
                        <p>As you review the timeline, consider how these philosophical schools emerged and influenced each other:</p>
                        <textarea class="reflection-area" data-save-key="timeline-reflection-1" placeholder="Write your thoughts about the historical development of these philosophical schools..."></textarea>
                    </div>
                </div>
            `;
            this.loadSavedContent();
            this.scrollToPendingAnchor();
        } catch (error) {
            console.error('Error loading timeline content:', error);
            contentBody.innerHTML = `
                <div class="chapter-content">
                    <h1>Timeline of Philosophers and Events</h1>
                    <p><em>Content is being prepared. Please check back later.</em></p>
                    
                    <div class="exercise-section">
                        <h3>Timeline Reflection</h3>
                        <p>As you review the timeline, consider how these philosophical schools emerged and influenced each other:</p>
                        <textarea class="reflection-area" data-save-key="timeline-reflection-1" placeholder="Write your thoughts about the historical development of these philosophical schools..."></textarea>
                    </div>
                </div>
            `;
            this.loadSavedContent();
            this.scrollToPendingAnchor();
        }
    }

    async loadChapterContent(chapterId) {
        const chapterNumber = chapterId.split('-')[1];
        const chapterNames = this.getChapterNames();

        const contentBody = document.getElementById('contentBody');
        contentBody.innerHTML = '<div class="loading">Loading chapter content...</div>';
        
        // Clear cache to ensure fresh content
        this.contentLoader.clearCache();
        
        try {
            const fileSlug = this.getChapterSlugByNumber(chapterNumber, chapterNames[chapterNumber]);
            const chapterFile = `${this.getBasePath()}content/chapters/${chapterNumber.padStart(2, '0')}-${fileSlug}.md`;
            const htmlContent = await this.contentLoader.loadContent(chapterFile);
            
            contentBody.innerHTML = `
                <div class="chapter-content">
                    ${htmlContent}
                </div>
            `;
            
            // Process response area markers after content is loaded
            this.processResponseAreas();
            
            // Handle internal chapter navigation links
            this.setupInternalNavigation();
            
            this.loadSavedContent();
            this.scrollToPendingAnchor();
        } catch (error) {
            console.error(`Error loading chapter ${chapterNumber} content:`, error);
            contentBody.innerHTML = `
                <div class="chapter-content">
                    <h1>Chapter ${chapterNumber}: ${chapterNames[chapterNumber]}</h1>
                    <p><em>This content is being prepared. Please check back later.</em></p>
                </div>
            `;
            this.loadSavedContent();
        }
    }

    processResponseAreas() {
        const contentBody = document.getElementById('contentBody');
        
        // Process both old [x.y.z] patterns and new ```qa blocks
        this.processInteractiveElements(contentBody);
        this.processQABlocks(contentBody);
    }
    
    processInteractiveElements(element) {
        // Process text nodes for [x.y.z] pattern (back to simple approach)
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.includes('[') && node.textContent.includes(']')) {
                textNodes.push(node);
            }
        }
        
        textNodes.forEach(textNode => {
            const text = textNode.textContent;
            // Match pattern: [chapter.day.item] or [chapter.item] Label text
            const regex = /\[(\d+\.(?:\d+\.)?\w+)\]\s*(.+?)(?=\[|\n|$)/g;
            let match;
            let lastIndex = 0;
            const fragments = [];
            
            while ((match = regex.exec(text)) !== null) {
                // Add text before match
                if (match.index > lastIndex) {
                    fragments.push(document.createTextNode(text.slice(lastIndex, match.index)));
                }
                
                const fieldId = match[1];
                const labelText = match[2].trim();
                
                // Create interactive element
                const container = this.createInteractiveElement(fieldId, labelText);
                fragments.push(container);
                
                lastIndex = regex.lastIndex;
            }
            
            // Add remaining text
            if (lastIndex < text.length) {
                fragments.push(document.createTextNode(text.slice(lastIndex)));
            }
            
            // Replace the text node with fragments
            if (fragments.length > 0) {
                const parent = textNode.parentNode;
                fragments.forEach(fragment => {
                    parent.insertBefore(fragment, textNode);
                });
                parent.removeChild(textNode);
            }
        });
    }
    
    createInteractiveElement(fieldId, labelText) {
        // Detect interaction type based on label content
        const isBlankFill = labelText.includes('_____') || labelText.match(/would be a\s*_+\s*desire/);
        const isTablePrompt = labelText.toLowerCase().includes('record') && (labelText.includes('table') || labelText.includes('throughout the day'));
        
        if (isBlankFill) {
            return this.createFillInBlankElement(fieldId, labelText);
        } else if (isTablePrompt) {
            return this.createTableElement(fieldId, labelText);
        } else {
            return this.createTextAreaElement(fieldId, labelText);
        }
    }
    
    createFillInBlankElement(fieldId, labelText) {
        // Replace blanks with input fields
        const parts = labelText.split(/(_+)/);
        const container = document.createElement('div');
        container.className = 'exercise-response fill-in-blank';
        
        // Create label
        const label = document.createElement('label');
        label.className = 'fill-blank-label';
        
        parts.forEach((part, index) => {
            if (part.match(/^_+$/)) {
                // This is a blank - create input field
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'blank-input';
                input.setAttribute('data-save-key', `${fieldId}-blank-${Math.floor(index/2)}`);
                input.placeholder = '...';
                label.appendChild(input);
            } else if (part.trim()) {
                // This is text
                const span = document.createElement('span');
                span.textContent = part;
                label.appendChild(span);
            }
        });
        
        container.appendChild(label);
        return container;
    }
    
    createTableElement(fieldId, labelText) {
        const container = document.createElement('div');
        container.className = 'exercise-response table-response';
        
        // Create label
        const label = document.createElement('label');
        label.textContent = labelText;
        container.appendChild(label);
        
        // Create table for desires/pleasures recording
        const table = document.createElement('table');
        table.className = 'response-table';
        
        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        const headers = ['Desire or pleasure', 'Type of desire (natural/unnatural + necessary/unnecessary) or type of pleasure (kinetic/katastematic)'];
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create body with editable rows
        const tbody = document.createElement('tbody');
        
        // Add 5 initial rows
        for (let i = 0; i < 5; i++) {
            const row = document.createElement('tr');
            
            // First column - desire/pleasure
            const cell1 = document.createElement('td');
            const input1 = document.createElement('textarea');
            input1.className = 'reflection-area table-input';
            input1.setAttribute('data-save-key', `${fieldId}-desire-${i}`);
            input1.rows = 2;
            input1.placeholder = 'Enter desire or pleasure...';
            cell1.appendChild(input1);
            row.appendChild(cell1);
            
            // Second column - type
            const cell2 = document.createElement('td');
            const input2 = document.createElement('textarea');
            input2.className = 'reflection-area table-input';
            input2.setAttribute('data-save-key', `${fieldId}-type-${i}`);
            input2.rows = 2;
            input2.placeholder = 'Enter type...';
            cell2.appendChild(input2);
            row.appendChild(cell2);
            
            tbody.appendChild(row);
        }
        
        table.appendChild(tbody);
        container.appendChild(table);
        
        return container;
    }
    
    createTextAreaElement(fieldId, labelText) {
        // Create textarea element (original behavior)
        const textarea = document.createElement('textarea');
        textarea.id = fieldId;
        textarea.name = fieldId;
        textarea.className = 'reflection-area';
        textarea.setAttribute('data-save-key', fieldId);
        textarea.placeholder = 'Enter your response...';
        textarea.rows = 4;
        
        // Create label element
        const label = document.createElement('label');
        label.setAttribute('for', fieldId);
        label.textContent = labelText;
        
        // Create container div
        const container = document.createElement('div');
        container.className = 'exercise-response';
        container.appendChild(label);
        container.appendChild(textarea);
        
        return container;
    }
    
    processQABlocks(contentBody) {
        // Find all code blocks with 'qa' language
        const qaBlocks = contentBody.querySelectorAll('pre code.language-qa, code.language-qa');
        
        qaBlocks.forEach(block => {
            try {
                const jsonContent = block.textContent.trim();
                const qaData = JSON.parse(jsonContent);
                
                // Create interactive element based on type
                const interactiveElement = this.createQAElement(qaData);
                
                // Replace the code block with the interactive element
                const preElement = block.closest('pre') || block;
                preElement.parentNode.replaceChild(interactiveElement, preElement);
                
            } catch (error) {
                console.error('Error parsing QA block:', error, block.textContent);
            }
        });
    }
    
    createQAElement(qaData) {
        const { id, type, prompt, context, columns, rows } = qaData;
        
        switch (type) {
            case 'fill_in_blank':
                return this.createQAFillInBlank(id, prompt, context);
            case 'table':
                return this.createQATable(id, prompt, columns, rows || 5);
            case 'textarea':
            default:
                return this.createQATextArea(id, prompt);
        }
    }
    
    createQAFillInBlank(id, prompt, context) {
        const container = document.createElement('div');
        container.className = 'exercise-response qa-fill-blank';
        
        // Add context if provided
        if (context) {
            const contextEl = document.createElement('div');
            contextEl.className = 'qa-context';
            contextEl.textContent = context;
            container.appendChild(contextEl);
        }
        
        // Create the fill-in-blank
        const parts = prompt.split(/(_+)/);
        const label = document.createElement('label');
        label.className = 'fill-blank-label';
        
        parts.forEach((part, index) => {
            if (part.match(/^_+$/)) {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'blank-input';
                input.setAttribute('data-save-key', `${id}-blank-${Math.floor(index/2)}`);
                input.placeholder = '...';
                label.appendChild(input);
            } else if (part.trim()) {
                const span = document.createElement('span');
                span.textContent = part;
                label.appendChild(span);
            }
        });
        
        container.appendChild(label);
        return container;
    }
    
    createQATable(id, prompt, columns, rows) {
        const container = document.createElement('div');
        container.className = 'exercise-response qa-table';
        
        // Create label
        const label = document.createElement('label');
        label.textContent = prompt;
        container.appendChild(label);
        
        // Create table
        const table = document.createElement('table');
        table.className = 'response-table';
        
        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        columns.forEach(columnText => {
            const th = document.createElement('th');
            th.textContent = columnText;
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create body with editable rows
        const tbody = document.createElement('tbody');
        
        for (let i = 0; i < rows; i++) {
            const row = document.createElement('tr');
            
            columns.forEach((_, colIndex) => {
                const cell = document.createElement('td');
                const input = document.createElement('textarea');
                input.className = 'reflection-area table-input';
                input.setAttribute('data-save-key', `${id}-row-${i}-col-${colIndex}`);
                input.rows = 2;
                input.placeholder = `Enter ${columns[colIndex].toLowerCase()}...`;
                cell.appendChild(input);
                row.appendChild(cell);
            });
            
            tbody.appendChild(row);
        }
        
        table.appendChild(tbody);
        container.appendChild(table);
        
        return container;
    }
    
    createQATextArea(id, prompt) {
        const container = document.createElement('div');
        container.className = 'exercise-response qa-textarea';
        
        const label = document.createElement('label');
        label.setAttribute('for', id);
        label.textContent = prompt;
        
        const textarea = document.createElement('textarea');
        textarea.id = id;
        textarea.className = 'reflection-area';
        textarea.setAttribute('data-save-key', id);
        textarea.placeholder = 'Enter your response...';
        textarea.rows = 4;
        
        container.appendChild(label);
        container.appendChild(textarea);
        
        return container;
    }

    setupInternalNavigation() {
        // Find all links and set up simple anchor scrolling
        const contentBody = document.getElementById('contentBody');
        const links = contentBody.querySelectorAll('a[href]');
        
        links.forEach(link => {
            const href = link.getAttribute('href');
            
            // Handle internal chapter links (both "#day-1" and "cyrenaicism#day-1" formats)
            if (href.includes('#')) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Extract anchor from href (handle both formats)
                    const anchor = href.startsWith('#') ? href.substring(1) : href.split('#')[1];
                    // Update only the hash (keep path for bookmarking)
                    const path = window.location.pathname;
                    history.replaceState(null, '', path + '#' + anchor);
                    // Smooth scroll immediately
                    const targetElement = document.getElementById(anchor);
                    if (targetElement) {
                        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            }
        });
    }

    getChapterNames() {
        // Allows override from frontmatter; falls back to defaults
        if (this.chapterNamesOverride) return this.chapterNamesOverride;
        return {
            '1': 'Cyrenaicism',
            '2': 'Epicureanism', 
            '3': 'Aristotelianism',
            '4': 'Stoicism',
            '5': 'Cynicism',
            '6': 'Political Platonism',
            '7': 'Socraticism',
            '8': 'Sophism',
            '9': 'Academic Skepticism',
            '10': 'Pyrrhonism',
            '11': 'Pythagoreanism',
            '12': 'Megarianism',
            '13': 'Neoplatonism'
        };
    }

    slugify(name) {
        return (name || '')
            .toString()
            .trim()
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    getChapterSlugMap() {
        // Prefer explicit slugs if provided in frontmatter
        if (this.chapterSlugsOverride) {
            const map = {};
            Object.keys(this.chapterSlugsOverride).forEach(num => {
                map[this.chapterSlugsOverride[num]] = num;
            });
            return map;
        } else {
            const names = this.getChapterNames();
            const map = {};
            Object.keys(names).forEach(num => {
                map[this.slugify(names[num])] = num;
            });
            return map;
        }
    }

    getChapterSlugByNumber(num, fallbackName) {
        if (this.chapterSlugsOverride && this.chapterSlugsOverride[num]) {
            return this.chapterSlugsOverride[num];
        }
        return this.slugify(fallbackName || 'chapter-' + num);
    }

    scrollToPendingAnchor() {
        if (!this.pendingAnchor) return;
        const target = document.getElementById(this.pendingAnchor);
        if (target) {
            try {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (_) {
                target.scrollIntoView();
            }
        }
        this.pendingAnchor = null;
    }

    generateContentTitles() {
        const chapterNames = this.getChapterNames();
        const titles = {
            'welcome': 'Welcome to Beyond Stoicism',
            'timeline': 'Timeline of Philosophers and Events',
            'epilogue': 'Epilogue: Reflection and Integration',
            'bibliography': 'Bibliography and Further Reading'
        };

        // Generate chapter titles dynamically
        Object.entries(chapterNames).forEach(([number, name]) => {
            const chapterSlug = name.toLowerCase().replace(/\s+/g, '-');
            titles[chapterSlug] = `Chapter ${number}: ${name}`;
        });

        return titles;
    }

    isChapterName(contentId) {
        const chapterNames = this.getChapterNames();
        const chapterSlugs = Object.values(chapterNames).map(name => 
            name.toLowerCase().replace(/\s+/g, '-')
        );
        return chapterSlugs.includes(contentId);
    }

    getChapterNumberFromName(chapterSlug) {
        const chapterNames = this.getChapterNames();
        for (const [number, name] of Object.entries(chapterNames)) {
            const slug = name.toLowerCase().replace(/\s+/g, '-');
            if (slug === chapterSlug) {
                return number;
            }
        }
        return null;
    }

    async loadEpilogueContent() {
        const contentBody = document.getElementById('contentBody');
        contentBody.innerHTML = '<div class="loading">Loading epilogue content...</div>';
        
        try {
            const htmlContent = await this.contentLoader.loadContent(`${this.getBasePath()}content/epilogue.md`);
            contentBody.innerHTML = `
                <div class="chapter-content">
                    ${htmlContent}
                    
                    <div class="exercise-section">
                        <h3>Overall Reflection</h3>
                        <p>Looking back on your journey through these philosophical schools, what insights have you gained?</p>
                        <textarea class="reflection-area" data-save-key="epilogue-overall-reflection" placeholder="Write your overall reflections..."></textarea>
                    </div>
                </div>
            `;
            this.loadSavedContent();
            this.scrollToPendingAnchor();
        } catch (error) {
            console.error('Error loading epilogue content:', error);
            contentBody.innerHTML = `
                <div class="chapter-content">
                    <h1>Epilogue: Reflection and Integration</h1>
                    <p><em>This content is being prepared. Please check back later.</em></p>
                    
                    <div class="exercise-section">
                        <h3>Overall Reflection</h3>
                        <p>Looking back on your journey through these philosophical schools, what insights have you gained?</p>
                        <textarea class="reflection-area" data-save-key="epilogue-overall-reflection" placeholder="Write your overall reflections..."></textarea>
                    </div>
                </div>
            `;
            this.loadSavedContent();
            this.scrollToPendingAnchor();
        }
    }

    async loadBibliographyContent() {
        const contentBody = document.getElementById('contentBody');
        contentBody.innerHTML = '<div class="loading">Loading bibliography content...</div>';
        
        try {
            const htmlContent = await this.contentLoader.loadContent(`${this.getBasePath()}content/bibliography.md`);
            contentBody.innerHTML = `
                <div class="chapter-content">
                    ${htmlContent}
                    
                    <div class="exercise-section">
                        <h3>Reading Notes</h3>
                        <p>Track books or articles you'd like to explore further:</p>
                        <textarea class="reflection-area" data-save-key="bibliography-reading-notes" placeholder="Note down resources you want to explore..."></textarea>
                    </div>
                </div>
            `;
            this.loadSavedContent();
            this.scrollToPendingAnchor();
        } catch (error) {
            console.error('Error loading bibliography content:', error);
            contentBody.innerHTML = `
                <div class="chapter-content">
                    <h1>Bibliography and Further Reading</h1>
                    <p><em>This content is being prepared. Please check back later.</em></p>
                    
                    <div class="exercise-section">
                        <h3>Reading Notes</h3>
                        <p>Track books or articles you'd like to explore further:</p>
                        <textarea class="reflection-area" data-save-key="bibliography-reading-notes" placeholder="Note down resources you want to explore..."></textarea>
                    </div>
                </div>
            `;
            this.loadSavedContent();
            this.scrollToPendingAnchor();
        }
    }

    setActiveNavItem(item) {
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(navItem => {
            navItem.classList.remove('active');
        });
        
        // Add active class to current item
        item.classList.add('active');
    }

    toggleCompletion() {
        if (this.currentContent === 'welcome') return;
        
        const isCompleted = this.isContentCompleted(this.currentContent);
        this.setContentCompletion(this.currentContent, !isCompleted);
        this.updateCompleteButton();
        this.updateProgressDisplay();
        this.updateProgressIndicator(this.currentContent);
    }

    updateCompleteButton() {
        const completeBtn = document.getElementById('completeBtn');
        const isCompleted = this.isContentCompleted(this.currentContent);
        
        if (isCompleted) {
            completeBtn.textContent = 'Mark Incomplete';
            completeBtn.classList.add('completed');
        } else {
            completeBtn.textContent = 'Mark Complete';
            completeBtn.classList.remove('completed');
        }
    }

    updateProgressIndicator(contentId) {
        const progressId = this.getProgressId(contentId);
        const indicator = document.getElementById(progressId);
        
        if (indicator) {
            const isCompleted = this.isContentCompleted(contentId);
            indicator.textContent = isCompleted ? '●' : '○';
            indicator.className = 'progress-indicator' + (isCompleted ? ' completed' : '');
        }
    }

    updateProgressDisplay() {
        const totalItems = 16; // 13 chapters + timeline + epilogue + bibliography
        const completedItems = this.getCompletedCount();
        
        const progressFill = document.getElementById('progressFill');
        const progressCount = document.getElementById('progressCount');
        
        const percentage = (completedItems / totalItems) * 100;
        progressFill.style.width = percentage + '%';
        progressCount.textContent = completedItems;
    }

    getProgressId(contentId) {
        const mapping = {
            'timeline': 'progress-timeline',
            'epilogue': 'progress-epilogue',
            'bibliography': 'progress-bibliography'
        };
        
        if (contentId.startsWith('chapter-')) {
            const chapterNum = contentId.split('-')[1];
            return `progress-ch${chapterNum}`;
        }
        
        return mapping[contentId];
    }

    loadProgress() {
        // Load completion status for all items
        const contentIds = [
            'timeline', 'chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 
            'chapter-5', 'chapter-6', 'chapter-7', 'chapter-8', 'chapter-9',
            'chapter-10', 'chapter-11', 'chapter-12', 'chapter-13', 'epilogue', 'bibliography'
        ];
        
        contentIds.forEach(contentId => {
            this.updateProgressIndicator(contentId);
        });
    }

    loadSavedContent() {
        // Load saved text area content
        document.querySelectorAll('[data-save-key]').forEach(textarea => {
            const saveKey = textarea.dataset.saveKey;
            const savedContent = localStorage.getItem(saveKey);
            if (savedContent) {
                textarea.value = savedContent;
            }
        });
    }

    autoSave(textarea) {
        const saveKey = textarea.dataset.saveKey;
        if (saveKey) {
            localStorage.setItem(saveKey, textarea.value);
            localStorage.setItem(saveKey + '-timestamp', new Date().toISOString());
        }
    }

    manualSave() {
        this.showSaveStatus('saving', 'Saving...');
        
        // Save all current elements with data-save-key
        const textAreas = document.querySelectorAll('[data-save-key]');
        let savedCount = 0;
        
        textAreas.forEach(textarea => {
            const saveKey = textarea.dataset.saveKey;
            if (saveKey && textarea.value.trim()) {
                localStorage.setItem(saveKey, textarea.value);
                localStorage.setItem(saveKey + '-timestamp', new Date().toISOString());
                savedCount++;
            }
        });
        
        // Show success message
        setTimeout(() => {
            this.showSaveStatus('saved', `Saved ${savedCount} responses`);
            this.logUserAction('manual_save', {
                savedCount,
                timestamp: new Date().toISOString()
            });
        }, 500);
    }

    showSaveStatus(status, message) {
        const saveStatus = document.getElementById('saveStatus');
        const saveIndicator = document.getElementById('saveIndicator');
        const saveText = document.getElementById('saveText');
        
        if (!saveStatus) return;
        
        // Remove all status classes
        saveStatus.classList.remove('saving', 'saved', 'error');
        
        // Add current status
        saveStatus.classList.add(status);
        
        // Update text and icon
        saveText.textContent = message;
        
        switch(status) {
            case 'saving':
                saveIndicator.textContent = '⏳';
                break;
            case 'saved':
                saveIndicator.textContent = '✅';
                break;
            case 'error':
                saveIndicator.textContent = '❌';
                break;
            default:
                saveIndicator.textContent = '💾';
        }
        
        // Auto-hide success message after 3 seconds
        if (status === 'saved') {
            setTimeout(() => {
                this.showSaveStatus('default', 'Auto-save enabled');
            }, 3000);
        }
    }

    isContentCompleted(contentId) {
        return localStorage.getItem(`completed-${contentId}`) === 'true';
    }

    setContentCompletion(contentId, completed) {
        localStorage.setItem(`completed-${contentId}`, completed.toString());
    }

    getCompletedCount() {
        const contentIds = [
            'timeline', 'chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 
            'chapter-5', 'chapter-6', 'chapter-7', 'chapter-8', 'chapter-9',
            'chapter-10', 'chapter-11', 'chapter-12', 'chapter-13', 'epilogue', 'bibliography'
        ];
        
        return contentIds.filter(id => this.isContentCompleted(id)).length;
    }

    printCurrentChapter() {
        if (this.currentContent === 'welcome') {
            alert('Please select a chapter to print.');
            return;
        }
        
        window.print();
    }

    // Export progress to markdown format
    exportToMarkdown() {
        const timestamp = new Date().toISOString();
        const stats = this.getCompletionStats();
        
        let markdown = `# Beyond Stoicism - Progress Export\n\n`;
        markdown += `**Export Date:** ${new Date().toLocaleDateString()}\n`;
        markdown += `**Progress:** ${stats.completed}/${stats.total} chapters completed (${stats.percentage}%)\n\n`;
        
        // Add completion status
        markdown += `## Completion Status\n\n`;
        const contentIds = [
            'timeline', 'chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 
            'chapter-5', 'chapter-6', 'chapter-7', 'chapter-8', 'chapter-9',
            'chapter-10', 'chapter-11', 'chapter-12', 'chapter-13', 'epilogue', 'bibliography'
        ];
        
        contentIds.forEach(contentId => {
            const isCompleted = this.isContentCompleted(contentId);
            const title = this.getContentTitle(contentId);
            markdown += `- [${isCompleted ? 'x' : ' '}] ${title}\n`;
        });
        
        markdown += `\n## Reflections and Responses\n\n`;
        
        // Organize responses by chapter
        const chapterResponses = {};
        const otherResponses = {};
        
        // Collect all saved text content
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && !key.startsWith('completed-') && !key.endsWith('-timestamp') && !key.startsWith('user-action-log')) {
                const content = localStorage.getItem(key);
                const timestamp = localStorage.getItem(key + '-timestamp');
                
                if (content && content.trim()) {
                    const responseData = {
                        content: content.trim(),
                        timestamp: timestamp || 'Unknown',
                        key: key
                    };
                    
                    // Categorize by chapter using new flexible format
                    const chapterMatch = key.match(/^(\d+)\./); // Match chapter.day.item format
                    if (chapterMatch) {
                        const chapterNum = chapterMatch[1];
                        if (!chapterResponses[chapterNum]) {
                            chapterResponses[chapterNum] = [];
                        }
                        chapterResponses[chapterNum].push(responseData);
                    } else if (key.includes('chapter-')) {
                        // Legacy format support
                        const legacyMatch = key.match(/chapter-(\d+)/);
                        if (legacyMatch) {
                            const chapterNum = legacyMatch[1];
                            if (!chapterResponses[chapterNum]) {
                                chapterResponses[chapterNum] = [];
                            }
                            chapterResponses[chapterNum].push(responseData);
                        }
                    } else {
                        otherResponses[key] = responseData;
                    }
                }
            }
        }
        
        // Export chapter responses in order
        for (let i = 1; i <= 13; i++) {
            const chapterNum = i.toString();
            if (chapterResponses[chapterNum]) {
                const chapterNames = this.getChapterNames();
                
                markdown += `### Chapter ${chapterNum}: ${chapterNames[chapterNum]}\n\n`;
                
                chapterResponses[chapterNum].forEach(response => {
                    const responseType = this.getResponseType(response.key);
                    markdown += `**${responseType}** _(Last updated: ${new Date(response.timestamp).toLocaleDateString()})_\n\n`;
                    markdown += `${response.content}\n\n`;
                    markdown += `---\n\n`;
                });
            }
        }
        
        // Export other responses (timeline, epilogue, bibliography)
        Object.values(otherResponses).forEach(response => {
            const sectionTitle = this.formatSectionTitle(response.key);
            markdown += `### ${sectionTitle}\n\n`;
            markdown += `_(Last updated: ${new Date(response.timestamp).toLocaleDateString()})_\n\n`;
            markdown += `${response.content}\n\n`;
            markdown += `---\n\n`;
        });
        
        // Add user action log
        const actionLog = JSON.parse(localStorage.getItem('user-action-log') || '[]');
        if (actionLog.length > 0) {
            markdown += `## Activity Log\n\n`;
            actionLog.slice(-10).forEach(action => {
                markdown += `- **${action.timestamp}**: ${action.type} - ${JSON.stringify(action.data)}\n`;
            });
        }
        
        // Download the markdown file
        this.downloadFile(markdown, `beyond-stoicism-progress-${new Date().toISOString().split('T')[0]}.md`, 'text/markdown');
    }

    // Import progress from markdown file
    async importFromMarkdown(file) {
        try {
            const content = await this.readFile(file);
            
            // Show confirmation dialog
            const shouldImport = confirm(
                `Import progress from "${file.name}"?\n\n` +
                `This will merge with your current progress. ` +
                `Existing responses will be preserved unless specifically overwritten.`
            );
            
            if (!shouldImport) return;
            
            this.parseMarkdownImport(content);
            
            // Refresh the current view
            this.loadProgress();
            this.updateProgressDisplay();
            this.loadSavedContent();
            
            alert('Progress imported successfully!');
            
            this.logUserAction('import', {
                filename: file.name,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Import failed:', error);
            alert('Failed to import file. Please check the file format.');
        }
    }

    parseMarkdownImport(content) {
        const lines = content.split('\n');
        let currentSection = null;
        let currentContent = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Detect section headers - handle new flexible format (### x.y.z)
            if (line.startsWith('### ') && /\d+\.\d+\.\w+/.test(line)) {
                // Save previous section
                if (currentSection && currentContent.trim()) {
                    localStorage.setItem(currentSection, currentContent.trim());
                }
                
                // Extract the field ID from the header
                const fieldMatch = line.match(/### (\d+\.\d+\.\w+)/);
                if (fieldMatch) {
                    currentSection = fieldMatch[1];
                    currentContent = '';
                }
            } else if ((line.startsWith('### ') && line.includes('chapter-')) || 
                      (line.startsWith('### ') && /day\d+|final-reflection/.test(line))) {
                // Legacy format support
                if (currentSection && currentContent.trim()) {
                    localStorage.setItem(currentSection, currentContent.trim());
                }
                currentSection = line.substring(4).trim().toLowerCase().replace(/\s+/g, '-');
                currentContent = '';
            } else if (line === '---') {
                // End of section
                if (currentSection && currentContent.trim()) {
                    localStorage.setItem(currentSection, currentContent.trim());
                }
                currentSection = null;
                currentContent = '';
            } else if (currentSection) {
                currentContent += line + '\n';
            }
            
            // Parse completion status
            if (line.includes('[x]') || line.includes('[X]')) {
                const match = line.match(/\[x\]\s*(.+)/i);
                if (match) {
                    const contentId = this.titleToContentId(match[1].trim());
                    if (contentId) {
                        this.setContentCompletion(contentId, true);
                    }
                }
            }
        }
    }

    titleToContentId(title) {
        const mapping = {
            'Timeline of Philosophers and Events': 'timeline',
            'Chapter 1: Cyrenaicism': 'chapter-1',
            'Chapter 2: Epicureanism': 'chapter-2',
            'Chapter 3: Aristotelianism': 'chapter-3',
            'Chapter 4: Stoicism': 'chapter-4',
            'Chapter 5: Cynicism': 'chapter-5',
            'Chapter 6: Political Platonism': 'chapter-6',
            'Chapter 7: Socraticism': 'chapter-7',
            'Chapter 8: Sophism': 'chapter-8',
            'Chapter 9: Academic Skepticism': 'chapter-9',
            'Chapter 10: Pyrrhonism': 'chapter-10',
            'Chapter 11: Pythagoreanism': 'chapter-11',
            'Chapter 12: Megarianism': 'chapter-12',
            'Chapter 13: Neoplatonism': 'chapter-13',
            'Epilogue: Reflection and Integration': 'epilogue',
            'Bibliography and Further Reading': 'bibliography'
        };
        return mapping[title];
    }

    getContentTitle(contentId) {
        const titles = {
            'timeline': 'Timeline of Philosophers and Events',
            'chapter-1': 'Chapter 1: Cyrenaicism',
            'chapter-2': 'Chapter 2: Epicureanism',
            'chapter-3': 'Chapter 3: Aristotelianism',
            'chapter-4': 'Chapter 4: Stoicism',
            'chapter-5': 'Chapter 5: Cynicism',
            'chapter-6': 'Chapter 6: Political Platonism',
            'chapter-7': 'Chapter 7: Socraticism',
            'chapter-8': 'Chapter 8: Sophism',
            'chapter-9': 'Chapter 9: Academic Skepticism',
            'chapter-10': 'Chapter 10: Pyrrhonism',
            'chapter-11': 'Chapter 11: Pythagoreanism',
            'chapter-12': 'Chapter 12: Megarianism',
            'chapter-13': 'Chapter 13: Neoplatonism',
            'epilogue': 'Epilogue: Reflection and Integration',
            'bibliography': 'Bibliography and Further Reading'
        };
        return titles[contentId] || contentId;
    }

    getResponseType(saveKey) {
        if (saveKey.includes('reflection')) return 'Reflection Exercise';
        if (saveKey.includes('application')) return 'Practical Application';
        if (saveKey.includes('integration')) return 'Personal Integration';
        if (saveKey.includes('overall-reflection')) return 'Overall Reflection';
        if (saveKey.includes('reading-notes')) return 'Reading Notes';
        return 'Response';
    }

    formatSectionTitle(key) {
        if (key.includes('timeline')) return 'Timeline Reflection';
        if (key.includes('epilogue')) return 'Epilogue Reflection';
        if (key.includes('bibliography')) return 'Bibliography Notes';
        
        // Clean up the key for display
        return key.replace(/[^a-zA-Z0-9\s]/g, ' ')
                  .split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')
                  .trim();
    }

    // Apple device detection
    isAppleDevice() {
        return /iPad|iPhone|iPod|Mac/.test(navigator.userAgent);
    }

    // Check for cloud sync opportunity
    checkForCloudSync() {
        // Check if there are any existing saves
        const hasLocalData = this.getCompletedCount() > 0;
        
        if (!hasLocalData) {
            // Show import suggestion for new users on Apple devices
            setTimeout(() => {
                if (confirm(
                    'Welcome to Beyond Stoicism!\n\n' +
                    'If you have previous progress saved on another Apple device, ' +
                    'you can import it now using the Import button.'
                )) {
                    document.getElementById('importBtn').click();
                }
            }, 2000);
        }
    }

    // User action logging
    logUserAction(type, data) {
        const actionLog = JSON.parse(localStorage.getItem('user-action-log') || '[]');
        actionLog.push({
            type,
            data,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 100 actions
        if (actionLog.length > 100) {
            actionLog.shift();
        }
        
        localStorage.setItem('user-action-log', JSON.stringify(actionLog));
    }

    // File utilities
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    getCompletionStats() {
        const contentIds = [
            'timeline', 'chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 
            'chapter-5', 'chapter-6', 'chapter-7', 'chapter-8', 'chapter-9',
            'chapter-10', 'chapter-11', 'chapter-12', 'chapter-13', 'epilogue', 'bibliography'
        ];
        
        const completed = contentIds.filter(id => this.isContentCompleted(id));
        
        return {
            total: contentIds.length,
            completed: completed.length,
            percentage: Math.round((completed.length / contentIds.length) * 100),
            completedIds: completed
        };
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BeyondStoicismApp();
});
