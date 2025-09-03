/**
 * Novel Reader Application
 * A professional HTML novel reader with theme support and reading progress tracking
 *
 * @author Novel Reader Team
 * @version 2.0.0
 */

'use strict';

// Configuration constants
const CONFIG = {
    STORAGE_KEYS: {
        SETTINGS: 'novelReaderSettings',
        PROGRESS: 'novelReaderProgress',
        BOOKMARKS: 'novelReaderBookmarks'
    },
    SELECTORS: [
        'section[class*="chapter"]',
        'div[class*="chapter"]',
        'section[id*="chapter"]',
        'div[id*="chapter"]',
        'article',
        'section',
        '#content section',
        '#main section'
    ],
    THEMES: ['light', 'dark', 'sepia'],
    FONTS: ['serif', 'sans', 'mono'],
    DEBOUNCE_DELAY: 200,
    NOTIFICATION_DURATION: 3000
};

const MESSAGES = {
    FILE_TYPE_ERROR: 'Please select an HTML file.',
    PARSE_ERROR: 'Error processing the HTML file. Please make sure it\'s a valid HTML document.',
    BOOKMARK_ADDED: 'Bookmark added',
    BOOKMARK_REMOVED: 'Bookmark removed',
    SEARCH_NOT_IMPLEMENTED: 'Search not yet implemented',
    NO_NOVEL_LOADED: 'No novel loaded',
    EXPORT_SUCCESS: 'Novel exported successfully!',
    EXPORT_FAILED: 'Export failed'
};

class NovelReader {
    /**
     * Initialize the Novel Reader application
     */
    constructor() {
        this.novelData = null;
        this.currentChapter = 0;
        this.currentPosition = 0;
        this.bookmarks = [];
        this.searchTerm = '';
        this.settings = this.loadSettings();
        this.domElements = this.cacheDOMElements();
        this.scrollTimeout = null;
        this.isInitialized = false;

        this.init();
    }

    /**
     * Cache DOM elements for better performance
     */
    cacheDOMElements() {
        return {
            novelReader: document.getElementById('novelReader'),
            uploadSection: document.getElementById('uploadSection'),
            readerSection: document.getElementById('readerSection'),
            sidebar: document.getElementById('sidebar'),
            chapterList: document.getElementById('chapterList'),
            chapterContent: document.getElementById('chapterContent'),
            chapterTitle: document.getElementById('chapterTitle'),
            fileUploadArea: document.getElementById('fileUploadArea'),
            fileInput: document.getElementById('fileInput'),
            sidebarToggle: document.getElementById('sidebarToggle'),
            prevChapter: document.getElementById('prevChapter'),
            nextChapter: document.getElementById('nextChapter'),
            exportBtn: document.getElementById('exportBtn'),
            fontSizeSlider: document.getElementById('fontSizeSlider'),
            fontSizeLabel: document.getElementById('fontSizeLabel'),
            themeButtons: document.querySelectorAll('[data-theme]'),
            fontButtons: document.querySelectorAll('[data-font]')
        };
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            this.bindEvents();
            this.applySettings();
            this.isInitialized = true;
            console.info('Novel Reader initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Novel Reader:', error);
            this.showNotification('Failed to initialize application', 5000);
        }
    }

    /**
     * Bind all event listeners
     */
    bindEvents() {
        const { fileUploadArea, fileInput, sidebarToggle, prevChapter, nextChapter,
                fontSizeSlider, chapterList, chapterContent } = this.domElements;

        // File upload events
        fileUploadArea.addEventListener('click', () => fileInput.click());
        fileUploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        fileUploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        fileUploadArea.addEventListener('drop', this.handleFileDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // Navigation events
        sidebarToggle.addEventListener('click', this.toggleSidebar.bind(this));
        prevChapter.addEventListener('click', () => this.goToChapter(this.currentChapter - 1));
        nextChapter.addEventListener('click', () => this.goToChapter(this.currentChapter + 1));

        // Settings events
        this.domElements.themeButtons.forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                this.setTheme(e.target.dataset.theme);
            });
        });

        this.domElements.fontButtons.forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                this.setFont(e.target.dataset.font);
            });
        });

        fontSizeSlider.addEventListener('input', (e) => this.setFontSize(e.target.value));

        // Other events
        this.domElements.exportBtn.addEventListener('click', this.exportNovel.bind(this));
        chapterList.addEventListener('click', this.handleChapterClick.bind(this));
        chapterContent.addEventListener('scroll', this.handleScroll.bind(this));

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboard.bind(this));
    }

    // File handling methods
    handleDragOver(event) {
        event.preventDefault();
        this.domElements.fileUploadArea.classList.add('dragover');
    }

    handleDragLeave(event) {
        event.preventDefault();
        this.domElements.fileUploadArea.classList.remove('dragover');
    }

    handleFileDrop(event) {
        event.preventDefault();
        this.domElements.fileUploadArea.classList.remove('dragover');
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    /**
     * Process uploaded HTML file
     */
    async processFile(file) {
        try {
            if (!file.type.includes('html') && !file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
                throw new Error(MESSAGES.FILE_TYPE_ERROR);
            }

            this.showLoadingState('Processing file...');

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target.result;
                    this.novelData = this.parseNovelHTML(content);

                    // Switch to reader mode
                    this.showReaderInterface();
                    // Load first chapter
                    this.displayChapter(0);
                    // Load saved progress
                    this.loadReadingProgress();

                    console.info('Novel loaded successfully:', this.novelData.title);
                } catch (error) {
                    console.error('Parse error:', error);
                    this.showNotification(MESSAGES.PARSE_ERROR);
                } finally {
                    this.hideLoadingState();
                }
            };

            reader.readAsText(file);
        } catch (error) {
            console.error('File processing error:', error);
            this.showNotification(error.message || MESSAGES.PARSE_ERROR);
            this.hideLoadingState();
        }
    }

    /**
     * Parse HTML content to extract chapters
     */
    parseNovelHTML(htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // Extract chapters from common patterns
        const chapters = [];

        for (const selector of CONFIG.SELECTORS) {
            const elements = doc.querySelectorAll(selector);
            if (elements.length > 0) {
                elements.forEach((el, index) => {
                    const title = el.querySelector('h1,h2,h3,h4')?.textContent?.trim() ||
                                  `Chapter ${index + 1}`;
                    const content = el.innerHTML;

                    if (title && content) {
                        chapters.push({
                            id: index + 1,
                            title: title,
                            content: this.sanitizeContent(content)
                        });
                    }
                });
                break; // Break after finding chapters with first matching selector
            }
        }

        // Fallback: Extract entire body content as single chapter
        if (chapters.length === 0) {
            const body = doc.body || doc.querySelector('body');
            if (body) {
                chapters.push({
                    id: 1,
                    title: doc.title?.trim() || 'Novel Content',
                    content: this.sanitizeContent(body.innerHTML)
                });
            }
        }

        return {
            title: doc.title?.trim() || 'Untitled Novel',
            chapters: chapters,
            metadata: {
                originalTitle: doc.title,
                sourceFile: 'uploaded.html',
                parsedAt: new Date().toISOString()
            }
        };
    }

    /**
     * Sanitize HTML content for safe rendering
     */
    sanitizeContent(content) {
        // Basic content sanitization - can be enhanced with DOMPurify
        return content
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .trim();
    }

    /**
     * Switch to reader interface
     */
    showReaderInterface() {
        this.domElements.uploadSection.classList.add('hidden');
        this.domElements.readerSection.classList.remove('hidden');

        // Populate table of contents
        this.buildTableOfContents();
    }

    /**
     * Build table of contents
     */
    buildTableOfContents() {
        const { chapterList } = this.domElements;
        chapterList.innerHTML = '';

        if (!this.novelData?.chapters) return;

        const fragment = document.createDocumentFragment();

        this.novelData.chapters.forEach((chapter, index) => {
            const li = document.createElement('li');
            li.className = 'chapter-item';

            const link = document.createElement('a');
            link.href = '#';
            link.className = 'chapter-link';
            link.dataset.chapter = index;
            link.textContent = chapter.title;
            link.title = chapter.title; // Tooltip for long titles

            li.appendChild(link);
            fragment.appendChild(li);
        });

        chapterList.appendChild(fragment);
    }

    /**
     * Navigate to specific chapter
     */
    goToChapter(index) {
        if (!this.novelData?.chapters) return;

        if (index >= 0 && index < this.novelData.chapters.length) {
            this.currentChapter = index;
            this.displayChapter(index);
            this.updateUI();
        }
    }

    /**
     * Display specific chapter
     */
    displayChapter(index) {
        const chapter = this.novelData.chapters[index];
        if (!chapter) return;

        this.domElements.chapterTitle.textContent = chapter.title;
        this.domElements.chapterContent.innerHTML = chapter.content;

        // Update active state in TOC
        this.updateActiveChapter(index);

        // Reset scroll position for new chapter
        this.domElements.chapterContent.scrollTop = 0;
        this.currentPosition = 0;
    }

    /**
     * Update active chapter in table of contents
     */
    updateActiveChapter(index) {
        document.querySelectorAll('.chapter-item').forEach((el, i) => {
            el.classList.toggle('active', i === index);
        });
    }

    /**
     * Update UI elements based on current state
     */
    updateUI() {
        // Update chapter progress
        if (this.chapterProgressElement && this.novelData?.chapters) {
            const progress = Math.round((this.currentChapter + 1) / this.novelData.chapters.length * 100);
            this.chapterProgressElement.style.width = progress + '%';
        }
    }

    // Event handlers
    handleChapterClick(event) {
        event.preventDefault();
        const target = event.target;
        if (target.classList.contains('chapter-link')) {
            const chapterIndex = parseInt(target.dataset.chapter);
            this.goToChapter(chapterIndex);
        }
    }

    toggleSidebar() {
        this.domElements.sidebar.classList.toggle('show');
    }

    // Theme and font settings
    setTheme(theme) {
        if (!CONFIG.THEMES.includes(theme)) return;

        this.settings.theme = theme;
        document.documentElement.classList.remove(`theme-${this.settings.theme}`);
        document.documentElement.classList.add(`theme-${theme}`);
        this.saveSettings();
    }

    setFont(font) {
        if (!CONFIG.FONTS.includes(font)) return;

        this.settings.font = font;
        document.documentElement.classList.remove(`font-${this.settings.font}`);
        document.documentElement.classList.add(`font-${font}`);
        this.saveSettings();
    }

    setFontSize(size) {
        size = Math.max(12, Math.min(24, parseInt(size)));
        this.settings.fontSize = size;
        document.documentElement.style.setProperty('--reader-font-size', `${size}px`);
        this.domElements.fontSizeLabel.textContent = `${size}px`;
        this.saveSettings();
    }

    /**
     * Apply current settings to the interface
     */
    applySettings() {
        this.setTheme(this.settings.theme);
        this.setFont(this.settings.font);
        this.setFontSize(this.settings.fontSize);

        const { fontSizeSlider, fontSizeLabel } = this.domElements;
        fontSizeSlider.value = this.settings.fontSize;
        fontSizeLabel.textContent = `${this.settings.fontSize}px`;
    }

    // Scroll and position tracking
    handleScroll(event) {
        this.debounce(this.handleScrollDebounced.bind(this), CONFIG.DEBOUNCE_DELAY);
    }

    handleScrollDebounced() {
        const { scrollTop, scrollHeight, clientHeight } = this.domElements.chapterContent;
        const progress = scrollHeight > clientHeight
            ? Math.round(scrollTop / (scrollHeight - clientHeight) * 10000) / 10000 // High precision
            : 0;

        this.currentPosition = progress;
        this.saveReadingProgress();
    }

    // Keyboard navigation
    handleKeyboard(event) {
        if (!this.novelData || event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        switch(event.key.toLowerCase()) {
            case 'arrowleft':
            case 'a':
            case 'h':
                event.preventDefault();
                this.goToChapter(this.currentChapter - 1);
                break;
            case 'arrowright':
            case 'd':
            case 'l':
                event.preventDefault();
                this.goToChapter(this.currentChapter + 1);
                break;
            case ' ':
            case 'pagedown':
            case 'j':
                event.preventDefault();
                this.scrollDown();
                break;
            case 'pageup':
            case 'k':
                event.preventDefault();
                this.scrollUp();
                break;
            case 'home':
                event.preventDefault();
                this.goToBeginning();
                break;
            case 'end':
                event.preventDefault();
                this.goToEnd();
                break;
            case 'b':
            case 'f2':
                event.preventDefault();
                this.toggleBookmark();
                break;
            case 'escape':
                event.preventDefault();
                this.closeOverlays();
                break;
            case '/':
            case 'f':
                if (!event.ctrlKey && !event.metaKey) {
                    event.preventDefault();
                    this.focusSearch();
                }
                break;
        }
    }

    scrollDown() {
        this.smoothScroll(0.8);
    }

    scrollUp() {
        this.smoothScroll(-0.8);
    }

    smoothScroll(factor) {
        const content = this.domElements.chapterContent;
        content.scrollBy({
            top: content.clientHeight * factor,
            behavior: 'smooth'
        });
    }

    goToBeginning() {
        this.domElements.chapterContent.scrollTop = 0;
        this.currentPosition = 0;
        this.saveReadingProgress();
    }

    goToEnd() {
        const content = this.domElements.chapterContent;
        content.scrollTop = content.scrollHeight - content.clientHeight;
        this.currentPosition = 1;
        this.saveReadingProgress();
    }

    toggleBookmark() {
        const bookmarkId = `${this.currentChapter}-${Date.now()}`;
        const existingBookmark = this.bookmarks.find(b =>
            b.chapter === this.currentChapter
        );

        if (existingBookmark) {
            this.bookmarks = this.bookmarks.filter(b => b.id !== existingBookmark.id);
            this.showNotification(MESSAGES.BOOKMARK_REMOVED);
        } else {
            this.bookmarks.push({
                id: bookmarkId,
                title: this.novelData.chapters[this.currentChapter].title,
                chapter: this.currentChapter,
                position: this.currentPosition,
                timestamp: new Date().toISOString()
            });
            this.showNotification(MESSAGES.BOOKMARK_ADDED);
        }

        this.saveBookmarks();
    }

    focusSearch() {
        this.showNotification(MESSAGES.SEARCH_NOT_IMPLEMENTED);
    }

    closeOverlays() {
        this.domElements.sidebar.classList.remove('show');
    }

    // Export functionality
    exportNovel() {
        if (!this.novelData) {
            this.showNotification(MESSAGES.NO_NOVEL_LOADED);
            return;
        }

        try {
            const exportData = this.generateExportHTML();
            const blob = new Blob([exportData], { type: 'text/html' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.novelData.title.replace(/[^a-z0-9]/gi, '_')}_enhanced.html`;
            a.click();

            URL.revokeObjectURL(url);
            this.showNotification(MESSAGES.EXPORT_SUCCESS);
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification(MESSAGES.EXPORT_FAILED);
        }
    }

    generateExportHTML() {
        if (!this.novelData?.chapters) return;

        const chapterCount = this.novelData.chapters.length;
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.novelData.title} - Enhanced Reading</title>
    <style>
        body { max-width: 800px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; line-height: 1.6; }
        .chapter { margin: 2rem 0; }
        .chapter h2 { margin-top: 0; color: #333; }
        .chapter div { margin: 1rem 0; }
        hr { border: none; border-top: 1px solid #ccc; margin: 2rem 0; }
        .nav { text-align: center; margin: 2rem 0; }
        .nav button { margin: 0 1rem; padding: 0.5rem 1rem; }
    </style>
</head>
<body>
    <h1 style="text-align: center;">${this.novelData.title}</h1>
    <div style="text-align: center; margin: 1rem 0; color: #666;"><em>Enhanced for reading by Novel Reader</em><br>Export date: ${new Date().toLocaleDateString()}</div>`;

        this.novelData.chapters.forEach((chapter, i) => {
            html += `
    <div class="chapter" id="chapter-${i+1}">
        <h2>${chapter.title}</h2>
        <div style="font-size: ${this.settings.fontSize}px;">${chapter.content}</div>`;
            if (i < chapterCount - 1) {
                html += `\n        <hr>`;
            }
            html += `\n    </div>`;
        });

        html += `
    <div class="nav">
        <button onclick="scrollToChapter(-1)">Previous</button>
        <span id="current-chapter"> Chapter 1 of ${chapterCount} </span>
        <button onclick="scrollToChapter(1)">Next</button>
    </div>
    <script>
let currentChapterIndex = 0;
const chapters = document.querySelectorAll(".chapter");
function scrollToChapter(direction) {
    const newIndex = currentChapterIndex + direction;
    if (newIndex >= 0 && newIndex < chapters.length) {
        currentChapterIndex = newIndex;
        chapters[currentChapterIndex].scrollIntoView({ behavior: "smooth" });
        document.getElementById("current-chapter").textContent = " Chapter " + (currentChapterIndex + 1) + " of " + chapters.length + " ";
    }
}
document.getElementById("current-chapter").textContent = " Chapter 1 of " + chapters.length + " ";
    </script>
</body>
</html>`;

        return html;
    }

    // Storage methods
    loadSettings() {
        const defaultSettings = {
            theme: 'light',
            font: 'serif',
            fontSize: 18
        };

        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.SETTINGS);
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch (error) {
            console.warn('Failed to load settings:', error);
            return defaultSettings;
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    saveReadingProgress() {
        if (!this.novelData) return;

        const progress = {
            novel: this.novelData.title,
            chapter: this.currentChapter,
            position: this.currentPosition,
            timestamp: new Date().toISOString()
        };

        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
        } catch (error) {
            console.error('Failed to save reading progress:', error);
        }
    }

    loadReadingProgress() {
        try {
            const progress = localStorage.getItem(CONFIG.STORAGE_KEYS.PROGRESS);
            if (progress) {
                const data = JSON.parse(progress);
                if (data.novel === this.novelData?.title) {
                    this.currentChapter = data.chapter || 0;
                    this.currentPosition = data.position || 0;
                    this.goToChapter(this.currentChapter);
                    if (this.currentPosition > 0) {
                        this.restoreScrollPosition();
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to load reading progress:', error);
        }
    }

    restoreScrollPosition() {
        if (this.currentPosition > 0) {
            const content = this.domElements.chapterContent;
            const maxScroll = content.scrollHeight - content.clientHeight;
            content.scrollTop = maxScroll * this.currentPosition;
        }
    }

    saveBookmarks() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.BOOKMARKS, JSON.stringify(this.bookmarks));
        } catch (error) {
            console.error('Failed to save bookmarks:', error);
        }
    }

    loadBookmarks() {
        try {
            const bookmarks = localStorage.getItem(CONFIG.STORAGE_KEYS.BOOKMARKS);
            this.bookmarks = bookmarks ? JSON.parse(bookmarks) : [];
        } catch (error) {
            console.warn('Failed to load bookmarks:', error);
            this.bookmarks = [];
        }
    }

    // Utility methods
    showLoadingState(message = 'Processing...') {
        // Show loading indicator
        const progressContainer = document.querySelector('.progress-container');
        const progressText = document.getElementById('progressText');
        if (progressContainer) {
            progressContainer.classList.add('show');
        }
        if (progressText) {
            progressText.textContent = message;
        }
        console.info('Loading state:', message);
    }

    hideLoadingState() {
        const progressContainer = document.querySelector('.progress-container');
        if (progressContainer) {
            progressContainer.classList.remove('show');
        }
    }

    showNotification(message, duration = CONFIG.NOTIFICATION_DURATION) {
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }

    debounce(func, wait) {
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(func, wait);
    }

    // Error handling
    handleError(error, context = 'Unknown') {
        console.error(`Novel Reader Error [${context}]:`, error);
        this.showNotification(`An error occurred: ${error.message}`, 5000);
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.info('Novel Reader starting...');
    try {
        window.novelReader = new NovelReader();
        console.info('Novel Reader ready for use');
    } catch (error) {
        console.error('Failed to start Novel Reader:', error);
        // Fallback error handling
        document.body.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #dc3545;">
                <h2>Application Error</h2>
                <p>Sorry, the Novel Reader failed to start. Please refresh the page and try again.</p>
                <details style="margin-top: 1rem;">
                    <summary>Error Details</summary>
                    <pre style="text-align: left;">${error.stack}</pre>
                </details>
            </div>
        `;
    }
});
