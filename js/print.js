// Print and PDF Generation
class PrintManager {
    constructor() {
        this.setupPrintStyles();
    }

    setupPrintStyles() {
        // Ensure print styles are properly loaded
        const printLink = document.querySelector('link[href*="print.css"]');
        if (!printLink) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/print.css';
            link.media = 'print';
            document.head.appendChild(link);
        }
    }

    // Print current chapter
    printCurrentChapter() {
        // Prepare content for printing
        this.preparePrintContent();
        
        // Trigger browser print
        window.print();
    }

    // Print specific chapter by ID
    printChapter(chapterId) {
        // Store current content
        const currentContent = document.getElementById('contentBody').innerHTML;
        const currentTitle = document.getElementById('contentTitle').textContent;
        
        // Load chapter content for printing
        this.loadChapterForPrint(chapterId);
        
        // Print
        setTimeout(() => {
            window.print();
            
            // Restore original content after print dialog
            setTimeout(() => {
                document.getElementById('contentBody').innerHTML = currentContent;
                document.getElementById('contentTitle').textContent = currentTitle;
            }, 100);
        }, 100);
    }

    loadChapterForPrint(chapterId) {
        // This would load the full chapter content for printing
        // For now, using placeholder content
        const contentBody = document.getElementById('contentBody');
        const contentTitle = document.getElementById('contentTitle');
        
        const chapterTitles = {
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
        
        contentTitle.textContent = chapterTitles[chapterId] || 'Chapter';
        
        // Load print-optimized content
        contentBody.innerHTML = this.generatePrintContent(chapterId);
    }

    generatePrintContent(chapterId) {
        if (chapterId === 'timeline') {
            return `
                <div class="chapter-content">
                    <h1>Timeline of Philosophers and Events</h1>
                    <p><em>Full timeline content would be populated here from the workbook.</em></p>
                    
                    <div class="exercise-section">
                        <h3>Timeline Reflection</h3>
                        <p>As you review the timeline, consider how these philosophical schools emerged and influenced each other:</p>
                        <div class="reflection-area">${this.getSavedText('timeline-reflection') || ''}</div>
                    </div>
                </div>
            `;
        }
        
        if (chapterId.startsWith('chapter-')) {
            const chapterNumber = chapterId.split('-')[1];
            const chapterNames = {
                '1': 'Cyrenaicism', '2': 'Epicureanism', '3': 'Aristotelianism',
                '4': 'Stoicism', '5': 'Cynicism', '6': 'Political Platonism',
                '7': 'Socraticism', '8': 'Sophism', '9': 'Academic Skepticism',
                '10': 'Pyrrhonism', '11': 'Pythagoreanism', '12': 'Megarianism',
                '13': 'Neoplatonism'
            };
            
            return `
                <div class="chapter-content">
                    <h1>Chapter ${chapterNumber}: ${chapterNames[chapterNumber]}</h1>
                    <p><em>Full chapter content would be populated here from the workbook.</em></p>
                    
                    <h2>Key Concepts</h2>
                    <p>Main philosophical concepts and teachings.</p>
                    
                    <h2>Historical Context</h2>
                    <p>Background information about the time period and influences.</p>
                    
                    <div class="exercise-section">
                        <h3>Reflection Exercise</h3>
                        <p>Consider the main teachings of ${chapterNames[chapterNumber]}. How might these ideas apply to modern life?</p>
                        <div class="reflection-area">${this.getSavedText(`chapter-${chapterNumber}-reflection-1`) || ''}</div>
                    </div>
                    
                    <div class="exercise-section">
                        <h3>Practical Application</h3>
                        <p>Think of a current situation in your life where these philosophical principles might provide guidance:</p>
                        <div class="reflection-area">${this.getSavedText(`chapter-${chapterNumber}-application-1`) || ''}</div>
                    </div>
                    
                    <div class="exercise-section">
                        <h3>Personal Integration</h3>
                        <p>What aspects of ${chapterNames[chapterNumber]} resonate most with you? What aspects do you find challenging?</p>
                        <div class="reflection-area">${this.getSavedText(`chapter-${chapterNumber}-integration-1`) || ''}</div>
                    </div>
                </div>
            `;
        }
        
        if (chapterId === 'epilogue') {
            return `
                <div class="chapter-content">
                    <h1>Epilogue: Reflection and Integration</h1>
                    <p><em>Full epilogue content would be populated here from the workbook.</em></p>
                    
                    <div class="exercise-section">
                        <h3>Overall Reflection</h3>
                        <p>Looking back on your journey through these philosophical schools, what insights have you gained?</p>
                        <div class="reflection-area">${this.getSavedText('epilogue-overall-reflection') || ''}</div>
                    </div>
                </div>
            `;
        }
        
        if (chapterId === 'bibliography') {
            return `
                <div class="chapter-content">
                    <h1>Bibliography and Further Reading</h1>
                    <p><em>Full bibliography would be populated here from the workbook.</em></p>
                    
                    <div class="exercise-section">
                        <h3>Reading Notes</h3>
                        <p>Track books or articles you'd like to explore further:</p>
                        <div class="reflection-area">${this.getSavedText('bibliography-reading-notes') || ''}</div>
                    </div>
                </div>
            `;
        }
        
        return '<p>Content not found.</p>';
    }

    getSavedText(saveKey) {
        return localStorage.getItem(saveKey) || '';
    }

    preparePrintContent() {
        // Ensure all reflection areas show their saved content
        document.querySelectorAll('[data-save-key]').forEach(textarea => {
            const saveKey = textarea.dataset.saveKey;
            const savedContent = localStorage.getItem(saveKey);
            if (savedContent) {
                textarea.value = savedContent;
            }
        });
    }

    // Generate PDF-like content for download (future enhancement)
    async generatePDF(chapterId) {
        // This would use a library like jsPDF or html2pdf
        // For now, just trigger print
        this.printChapter(chapterId);
    }

    // Print all chapters (workbook compilation)
    printAllChapters() {
        const chapters = [
            'timeline', 'chapter-1', 'chapter-2', 'chapter-3', 'chapter-4',
            'chapter-5', 'chapter-6', 'chapter-7', 'chapter-8', 'chapter-9',
            'chapter-10', 'chapter-11', 'chapter-12', 'chapter-13', 'epilogue', 'bibliography'
        ];
        
        // Create combined content
        let combinedContent = '';
        chapters.forEach(chapterId => {
            combinedContent += this.generatePrintContent(chapterId);
        });
        
        // Store current content
        const currentContent = document.getElementById('contentBody').innerHTML;
        const currentTitle = document.getElementById('contentTitle').textContent;
        
        // Set combined content
        document.getElementById('contentTitle').textContent = 'Beyond Stoicism - Complete Workbook';
        document.getElementById('contentBody').innerHTML = combinedContent;
        
        // Print
        setTimeout(() => {
            window.print();
            
            // Restore original content
            setTimeout(() => {
                document.getElementById('contentBody').innerHTML = currentContent;
                document.getElementById('contentTitle').textContent = currentTitle;
            }, 100);
        }, 100);
    }
}

// Create global print manager instance
window.printManager = new PrintManager();