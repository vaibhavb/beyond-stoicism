// Simple Markdown Parser for Beyond Stoicism
class MarkdownParser {
    constructor() {
        this.rules = [
            // Headers with auto-generated IDs (order matters - start with most specific)
            { 
                pattern: /^#### (.*$)/gim, 
                replacement: (match, text) => `<h4>${text}</h4>` 
            },
            { 
                pattern: /^### (.*$)/gim, 
                replacement: (match, text) => `<h3>${text}</h3>` 
            },
            { 
                pattern: /^## (.*$)/gim, 
                replacement: (match, text) => {
                    const id = this.generateId(text);
                    return `<h2 id="${id}">${text}</h2>`;
                }
            },
            { 
                pattern: /^# (.*$)/gim, 
                replacement: (match, text) => `<h1>${text}</h1>` 
            },
            
            // Bold and Italic
            { pattern: /\*\*\*(.*)\*\*\*/gim, replacement: '<strong><em>$1</em></strong>' },
            { pattern: /\*\*(.*)\*\*/gim, replacement: '<strong>$1</strong>' },
            { pattern: /\*(.*)\*/gim, replacement: '<em>$1</em>' },
            
            // Links
            { pattern: /\[([^\]]*)\]\(([^\)]*)\)/gim, replacement: '<a href="$2" target="_blank">$1</a>' },
            
            // Lists (unordered)
            { pattern: /^\s*[\*\-\+]\s+(.*)$/gim, replacement: '<li>$1</li>' },
            
            // Lists (ordered)
            { pattern: /^\s*\d+\.\s+(.*)$/gim, replacement: '<li>$1</li>' },
            
            // Code blocks with language support
            { 
                pattern: /```(\w+)?\s*\n([\s\S]*?)```/gim, 
                replacement: (match, lang, code) => {
                    const langClass = lang ? ` class="language-${lang}"` : '';
                    return `<pre><code${langClass}>${code.trim()}</code></pre>`;
                }
            },
            
            // Inline code
            { pattern: /`([^`]*)`/gim, replacement: '<code>$1</code>' },
            
            // Blockquotes
            { pattern: /^> (.*)$/gim, replacement: '<blockquote>$1</blockquote>' },
            
            // Horizontal rules
            { pattern: /^---$/gim, replacement: '<hr>' },
            
            // Line breaks (two spaces at end of line)
            { pattern: /  \n/gim, replacement: '<br>\n' },
            
            // Paragraphs (convert double newlines to paragraph breaks)
            { pattern: /\n\n/gim, replacement: '</p><p>' }
        ];
    }
    
    generateId(text) {
        // Special handling for Day headings to match navigation
        const dayMatch = text.match(/^Day (\d+)/i);
        if (dayMatch) {
            return `day-${dayMatch[1]}`;
        }
        
        // Special handling for Days headings (Chapter 2 format)
        const daysMatch = text.match(/^Days (\d+) and (\d+)/i);
        if (daysMatch) {
            return `days-${daysMatch[1]}-and-${daysMatch[2]}`;
        }
        
        // Handle Final Reflection
        if (text.toLowerCase().includes('final reflection')) {
            return 'final-reflection';
        }
        
        // Default: convert to URL-friendly ID
        return text.toLowerCase()
                   .replace(/[^\w\s-]/g, '') // Remove special chars
                   .replace(/\s+/g, '-')     // Replace spaces with hyphens  
                   .replace(/--+/g, '-')     // Replace multiple hyphens
                   .trim();
    }
    
    parse(markdown) {
        if (!markdown) return '';
        
        let html = markdown;
        
        // Store existing HTML elements to preserve them
        const htmlElements = [];
        const htmlPlaceholders = [];
        
        // Extract existing HTML elements (div, textarea, label, etc.)
        html = html.replace(/<(div|textarea|label|input|button|form)[^>]*>[\s\S]*?<\/\1>/gim, (match, tag) => {
            const placeholder = `__HTML_ELEMENT_${htmlElements.length}__`;
            htmlElements.push(match);
            htmlPlaceholders.push(placeholder);
            return placeholder;
        });
        
        // Extract self-closing HTML elements
        html = html.replace(/<(br|hr|img|input)[^>]*\/?>/gim, (match) => {
            const placeholder = `__HTML_ELEMENT_${htmlElements.length}__`;
            htmlElements.push(match);
            htmlPlaceholders.push(placeholder);
            return placeholder;
        });
        
        // Apply all transformation rules
        this.rules.forEach(rule => {
            if (typeof rule.replacement === 'function') {
                html = html.replace(rule.pattern, rule.replacement.bind(this));
            } else {
                html = html.replace(rule.pattern, rule.replacement);
            }
        });
        
        // Restore HTML elements
        htmlPlaceholders.forEach((placeholder, index) => {
            html = html.replace(placeholder, htmlElements[index]);
        });
        
        // Only wrap in paragraphs if there's actual content and no major HTML structure
        if (!html.includes('<div') && !html.includes('<h1') && !html.includes('<h2') && !html.includes('<h3')) {
            html = '<p>' + html + '</p>';
        }
        
        // Clean up empty paragraphs and fix list formatting
        html = this.postProcess(html);
        
        return html;
    }
    
    postProcess(html) {
        // Fix list formatting by wrapping consecutive <li> elements in <ul> or <ol>
        html = html.replace(/(<li>.*<\/li>)/gims, (match) => {
            // Check if this is part of an ordered list (contains numbers)
            const isOrdered = /^\s*\d+\./.test(match);
            const listTag = isOrdered ? 'ol' : 'ul';
            return `<${listTag}>${match}</${listTag}>`;
        });
        
        // Merge consecutive lists of the same type
        html = html.replace(/(<\/ul>)\s*(<ul>)/gim, '');
        html = html.replace(/(<\/ol>)\s*(<ol>)/gim, '');
        
        // Clean up empty paragraphs
        html = html.replace(/<p>\s*<\/p>/gim, '');
        html = html.replace(/<p><h([1-6])>/gim, '<h$1>');
        html = html.replace(/<\/h([1-6])><\/p>/gim, '</h$1>');
        html = html.replace(/<p><ul>/gim, '<ul>');
        html = html.replace(/<\/ul><\/p>/gim, '</ul>');
        html = html.replace(/<p><ol>/gim, '<ol>');
        html = html.replace(/<\/ol><\/p>/gim, '</ol>');
        html = html.replace(/<p><blockquote>/gim, '<blockquote>');
        html = html.replace(/<\/blockquote><\/p>/gim, '</blockquote>');
        html = html.replace(/<p><pre>/gim, '<pre>');
        html = html.replace(/<\/pre><\/p>/gim, '</pre>');
        html = html.replace(/<p><hr><\/p>/gim, '<hr>');
        
        // Clean up div elements that got wrapped in paragraphs
        html = html.replace(/<p><div/gim, '<div');
        html = html.replace(/<\/div><\/p>/gim, '</div>');
        
        return html;
    }
}

// Content loader utility
class ContentLoader {
    constructor() {
        this.parser = new MarkdownParser();
        this.cache = new Map();
    }
    
    clearCache() {
        this.cache.clear();
        console.log('ContentLoader cache cleared');
    }
    
    async loadContent(contentPath) {
        // Check cache first
        if (this.cache.has(contentPath)) {
            return this.cache.get(contentPath);
        }
        
        try {
            // Add cache-busting timestamp
            const cacheBustUrl = `${contentPath}?t=${Date.now()}`;
            const response = await fetch(cacheBustUrl);
            if (!response.ok) {
                throw new Error(`Failed to load content: ${response.status}`);
            }
            
            const markdown = await response.text();
            const html = this.parser.parse(markdown);
            
            // Cache the result
            this.cache.set(contentPath, html);
            
            return html;
        } catch (error) {
            console.error('Error loading content:', error);
            return `<p><em>Error loading content from ${contentPath}. This content may not be available yet.</em></p>`;
        }
    }
    
    clearCache() {
        this.cache.clear();
    }
}