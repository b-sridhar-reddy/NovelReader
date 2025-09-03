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
    NOTIFICATION_DURATION: 3000,
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB limit
    ALLOWED_MIME_TYPES: ['text/html', 'application/xhtml+xml'],
    SANITIZE_CONFIG: {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'strike', 'sub', 'sup',
                      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'q',
                      'ol', 'ul', 'li', 'dl', 'dt', 'dd',
                      'table', 'thead', 'tbody', 'tr', 'th', 'td',
                      'a', 'img', 'div', 'span', 'pre', 'code'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id'],
        ALLOW_DATA_ATTR: false
    }
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
        this.autoAdvanceTimeout = null;
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
            chapterProgress: document.getElementById('chapterProgress'),
            chapterProgressBar: document.getElementById('chapterProgressBar'),
            fileUploadArea: document.getElementById('fileUploadArea'),
            fileInput: document.getElementById('fileInput'),
            sidebarToggle: document.getElementById('sidebarToggle'),
            prevChapter: document.getElementById('prevChapter'),
            nextChapter: document.getElementById('nextChapter'),
            exportBtn: document.getElementById('exportBtn'),
            fontSizeSlider: document.getElementById('fontSizeSlider'),
            fontSizeLabel: document.getElementById('fontSizeLabel'),
            themeButtons: document.querySelectorAll('[data-theme]'),
            fontButtons: document.querySelectorAll('[data-font]'),
            // End-of-chapter indicator elements
            chapterEndIndicator: document.getElementById('chapterEndIndicator'),
            currentChapterInfo: document.getElementById('currentChapterInfo'),
            nextChapterInfo: document.getElementById('nextChapterInfo'),
            manualAdvanceBtn: document.getElementById('manualAdvanceBtn'),
            advanceText: document.getElementById('advanceText'),
            indicatorContent: document.querySelector('.indicator-content')
        };
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // File upload events
        this.domElements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.domElements.fileUploadArea.addEventListener('click', () => this.domElements.fileInput.click());
        this.domElements.fileUploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.domElements.fileUploadArea.addEventListener('drop', (e) => this.handleDrop(e));

        // Navigation events
        this.domElements.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        this.domElements.prevChapter.addEventListener('click', () => this.previousChapter());
        this.domElements.nextChapter.addEventListener('click', () => this.nextChapter());
        this.domElements.exportBtn.addEventListener('click', () => this.exportNovel());

        // Settings events
        this.domElements.fontSizeSlider.addEventListener('input', (e) => this.updateFontSize(e.target.value));
        this.domElements.themeButtons.forEach(button => {
            button.addEventListener('click', (e) => this.setTheme(e.target.dataset.theme));
        });
        this.domElements.fontButtons.forEach(button => {
            button.addEventListener('click', (e) => this.setFont(e.target.dataset.font));
        });

        // Scroll events
        this.domElements.chapterContent.addEventListener('scroll', () => this.handleScroll());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Window events
        window.addEventListener('beforeunload', () => this.saveProgress());
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            this.setupEventListeners();
            this.loadBookmarks();
            this.applySettings();
            this.isInitialized = true;
            console.info('Novel Reader initialized successfully');
        } catch (error) {
            this.handleError(error, 'Initialization');
        }
    }

    /**
     * Display a specific chapter
     */
    displayChapter(chapterIndex) {
        if (!this.novelData || chapterIndex < 0 || chapterIndex >= this.novelData.chapters.length) {
            return;
        }

        this.currentChapter = chapterIndex;
        const chapter = this.novelData.chapters[chapterIndex];

        // Update UI
        this.domElements.chapterTitle.textContent = chapter.title;

        // Add next chapter button to content if not last chapter
        let contentWithButton = chapter.content;
        if (this.currentChapter < this.novelData.chapters.length - 1) {
            const nextChapter = this.novelData.chapters[this.currentChapter + 1];
            const buttonHtml = `
                <div class="chapter-end-button-container">
                    <button class="chapter-end-nav-btn" id="chapterEndNavBtn">
                        <span class="chapter-end-text">Next Chapter: ${this.escapeHtml(nextChapter.title)}</span>
                        <i class="fas fa-arrow-right" aria-hidden="true"></i>
                    </button>
                </div>
            `;
            contentWithButton += buttonHtml;
        } else {
            // Last chapter - different message
            const lastChapterButton = `
                <div class="chapter-end-button-container">
                    <button class="chapter-end-nav-btn last-chapter" id="lastChapterBtn">
                        <span class="chapter-end-text">End of Book - Return to Chapters</span>
                        <i class="fas fa-list" aria-hidden="true"></i>
                    </button>
                </div>
            `;
            contentWithButton += lastChapterButton;
        }

        this.domElements.chapterContent.innerHTML = contentWithButton;

        // Add event listener to the button after content is loaded
        const navBtn = this.domElements.chapterContent.querySelector('#chapterEndNavBtn, #lastChapterBtn');
        if (navBtn) {
            navBtn.addEventListener('click', () => this.handleChapterEndNavigation());
        }

        // Update active chapter in sidebar
        document.querySelectorAll('.chapter-item').forEach((item, index) => {
            item.classList.toggle('active', index === chapterIndex);
        });

        // Restore scroll position
        this.restoreScrollPosition();

        // Update progress
        this.updateProgress();

        // Save progress
        this.saveProgress();

        // Initialize chapter end tracking
        this.checkForChapterEndButton();
    }

    /**
     * Handle navigation from chapter end button - direct DOM scrolling approach
     */
    handleChapterEndNavigation() {
        if (!this.novelData) return;

        const isLastChapter = this.currentChapter >= this.novelData.chapters.length - 1;

        if (isLastChapter) {
            // Show sidebar for last chapter
            this.showNotification('You\'ve reached the end of the book!');
            this.domElements.sidebar.classList.add('show');
        } else {
            // Advance to next chapter with guaranteed scroll-to-top
            this.nextChapterDirect();
            this.showNotification('Moved to next chapter');
        }
    }

    /**
     * Check if user is near chapter end to show additional navigation options
     */
    checkForChapterEndButton() {
        // This method could be extended for additional logic if needed
        const navBtn = this.domElements.chapterContent.querySelector('#chapterEndNavBtn, #lastChapterBtn');
        if (navBtn) {
            // Add smooth scroll to button when user gets close to bottom
            const rect = navBtn.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight && rect.bottom > 0;

            if (isVisible) {
                navBtn.style.animation = 'highlight 1s ease-in-out';
                setTimeout(() => {
                    navBtn.style.animation = '';
                }, 1000);
            }
        }
    }

    /**
     * Handle file selection
     */
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            await this.processFile(file);
        }
    }

    /**
     * Handle drag over event
     */
    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        this.domElements.fileUploadArea.classList.add('dragover');
    }

    /**
     * Handle drop event
     */
    async handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        this.domElements.fileUploadArea.classList.remove('dragover');

        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (this.validateFile(file)) {
                await this.processFile(file);
            }
        }
    }

    /**
     * Validate file type and size
     */
    validateFile(file) {
        if (!CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
            this.showNotification(MESSAGES.FILE_TYPE_ERROR);
            return false;
        }

        if (file.size > CONFIG.MAX_FILE_SIZE) {
            this.showNotification('File too large. Maximum size is 10MB.');
            return false;
        }

        return true;
    }

    /**
     * Process the uploaded file
     */
    async processFile(file) {
        try {
            this.showLoadingState('Processing novel...');
            
            const text = await this.readFileAsText(file);
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            
            if (doc.querySelector('parsererror')) {
                throw new Error('Invalid HTML format');
            }

            const chapters = this.extractChapters(doc);
            if (chapters.length === 0) {
                throw new Error('No chapters found in the file');
            }

            this.novelData = {
                title: doc.title || file.name.replace(/\.html?$/i, ''),
                chapters: chapters,
                fileName: file.name
            };

            this.currentChapter = 0;
            this.currentPosition = 0;
            
            this.populateChapterList();
            this.displayChapter(0);
            this.showReaderInterface();
            
            this.hideLoadingState();
            this.showNotification('Novel loaded successfully!');
            
        } catch (error) {
            this.hideLoadingState();
            this.handleError(error, 'File Processing');
        }
    }

    /**
     * Read file as text
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Extract chapters from HTML document
     */
    extractChapters(doc) {
        const chapters = [];
        
        // Try different selectors to find chapters
        for (const selector of CONFIG.SELECTORS) {
            const elements = doc.querySelectorAll(selector);
            if (elements.length > 0) {
                elements.forEach((element, index) => {
                    const title = this.extractChapterTitle(element, index);
                    const content = this.sanitizeContent(element.innerHTML);
                    
                    chapters.push({
                        title: title,
                        content: content,
                        element: element
                    });
                });
                
                if (chapters.length > 0) break;
            }
        }

        // If no chapters found, treat entire body as one chapter
        if (chapters.length === 0) {
            const body = doc.body || doc.querySelector('body');
            if (body) {
                chapters.push({
                    title: 'Chapter 1',
                    content: this.sanitizeContent(body.innerHTML),
                    element: body
                });
            }
        }

        return chapters;
    }

    /**
     * Extract chapter title from element
     */
    extractChapterTitle(element, index) {
        // Try to find heading elements
        const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
        if (headings.length > 0) {
            return headings[0].textContent.trim();
        }

        // Try to find title in data attributes or id
        const titleAttr = element.getAttribute('data-title') || 
                         element.getAttribute('title') ||
                         element.id;
        
        if (titleAttr) {
            return titleAttr.replace(/[-_]/g, ' ').trim();
        }

        // Default title
        return `Chapter ${index + 1}`;
    }

    /**
     * Sanitize HTML content
     */
    sanitizeContent(html) {
        if (typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(html, CONFIG.SANITIZE_CONFIG);
        }
        
        // Fallback sanitization
        const div = document.createElement('div');
        div.innerHTML = html;
        
        // Remove script tags and other potentially dangerous elements
        const dangerous = div.querySelectorAll('script, style, iframe, object, embed');
        dangerous.forEach(el => el.remove());
        
        return div.innerHTML;
    }

    /**
     * Populate the chapter list in sidebar
     */
    populateChapterList() {
        if (!this.novelData) return;

        this.domElements.chapterList.innerHTML = '';
        
        this.novelData.chapters.forEach((chapter, index) => {
            const li = document.createElement('li');
            li.className = 'chapter-item';
            li.innerHTML = `
                <a href="#" class="chapter-link" data-chapter="${index}">
                    ${this.escapeHtml(chapter.title)}
                </a>
            `;
            
            li.querySelector('.chapter-link').addEventListener('click', (e) => {
                e.preventDefault();
                this.displayChapter(index);
            });
            
            this.domElements.chapterList.appendChild(li);
        });
    }

    /**
     * Navigate to previous chapter
     */
    previousChapter() {
        if (this.currentChapter > 0) {
            this.displayChapter(this.currentChapter - 1);
        }
    }

    /**
     * Navigate to next chapter with direct DOM scrolling approach
     */
    nextChapterDirect() {
        if (!this.novelData || this.currentChapter >= this.novelData.chapters.length - 1) {
            return;
        }

        // Move to next chapter
        this.currentChapter++;

        // Display chapter with guaranteed scroll-to-top
        this.displayChapterWithScrollToTop(this.currentChapter);
    }

    /**
     * Display chapter with guaranteed scroll-to-top using reliable timing
     */
    displayChapterWithScrollToTop(chapterIndex) {
        if (!this.novelData || chapterIndex < 0 || chapterIndex >= this.novelData.chapters.length) {
            return;
        }

        this.currentChapter = chapterIndex;
        const chapter = this.novelData.chapters[chapterIndex];

        // Update UI
        this.domElements.chapterTitle.textContent = chapter.title;

        // Add next chapter button to content
        let contentWithButton = chapter.content;
        if (this.currentChapter < this.novelData.chapters.length - 1) {
            const nextChapter = this.novelData.chapters[this.currentChapter + 1];
            const buttonHtml = `
                <div class="chapter-end-button-container">
                    <button class="chapter-end-nav-btn" id="chapterEndNavBtn">
                        <span class="chapter-end-text">Next Chapter: ${this.escapeHtml(nextChapter.title)}</span>
                        <i class="fas fa-arrow-right" aria-hidden="true"></i>
                    </button>
                </div>
            `;
            contentWithButton += buttonHtml;
        } else {
            // Last chapter
            const lastChapterButton = `
                <div class="chapter-end-button-container">
                    <button class="chapter-end-nav-btn last-chapter" id="lastChapterBtn">
                        <span class="chapter-end-text">End of Book - Return to Chapters</span>
                        <i class="fas fa-list" aria-hidden="true"></i>
                    </button>
                </div>
            `;
            contentWithButton += lastChapterButton;
        }

        // Update content
        this.domElements.chapterContent.innerHTML = contentWithButton;

        // Use requestAnimationFrame + setTimeout for guaranteed DOM completion
        requestAnimationFrame(() => {
            setTimeout(() => {
                // Force scroll to top - this will override any progress loading
                this.domElements.chapterContent.scrollTop = 0;

                // Add event listener to the button
                const navBtn = this.domElements.chapterContent.querySelector('#chapterEndNavBtn, #lastChapterBtn');
                if (navBtn) {
                    navBtn.addEventListener('click', () => this.handleChapterEndNavigation());
                }

                // Update sidebar
                document.querySelectorAll('.chapter-item').forEach((item, index) => {
                    item.classList.toggle('active', index === chapterIndex);
                });

                // Update progress and save
                this.updateProgress();
                this.saveProgress();

                // Initialize chapter end tracking
                this.checkForChapterEndButton();
            }, 10);
        });
    }

    /**
     * Regular next chapter method for non-manual navigation
     */
    nextChapter() {
        if (this.novelData && this.currentChapter < this.novelData.chapters.length - 1) {
            this.displayChapter(this.currentChapter + 1);
        }
    }

    /**
     * Toggle sidebar visibility
     */
    toggleSidebar() {
        this.domElements.sidebar.classList.toggle('show');
    }

    /**
     * Update reading progress
     */
    updateProgress() {
        const content = this.domElements.chapterContent;
        if (!content) return;

        const scrollTop = content.scrollTop;
        const scrollHeight = content.scrollHeight - content.clientHeight;
        
        if (scrollHeight > 0) {
            this.currentPosition = scrollTop / scrollHeight;
            const percentage = Math.round(this.currentPosition * 100);
            
            this.domElements.chapterProgressBar.style.width = `${percentage}%`;
            this.domElements.chapterProgressBar.setAttribute('aria-valuenow', percentage);
            this.domElements.chapterProgress.style.display = 'block';
        }
    }

    /**
     * Handle scroll events
     */
    handleScroll() {
        this.debounce(() => {
            this.updateProgress();
            this.saveProgress();
            this.checkAutoAdvance();
        }, CONFIG.DEBOUNCE_DELAY);
    }

    /**
     * Check if should auto-advance to next chapter
     */
    checkAutoAdvance() {
        if (!this.novelData || this.currentChapter >= this.novelData.chapters.length - 1) {
            return; // No novel loaded or at last chapter
        }

        const content = this.domElements.chapterContent;
        const scrollTop = content.scrollTop;
        const clientHeight = content.clientHeight;
        const scrollHeight = content.scrollHeight;
        const threshold = 100; // pixels from bottom

        if (scrollTop + clientHeight >= scrollHeight - threshold) {
            // Auto-advance after a short delay to prevent accidental triggers
            if (this.autoAdvanceTimeout) {
                clearTimeout(this.autoAdvanceTimeout);
            }
            this.autoAdvanceTimeout = setTimeout(() => {
                if (this.currentChapter < this.novelData.chapters.length - 1) {
                    this.nextChapter();
                    this.showNotification('Auto-advanced to next chapter');
                }
                this.autoAdvanceTimeout = null;
            }, 500);
        } else {
            // Cancel pending auto-advance if user scrolls up
            if (this.autoAdvanceTimeout) {
                clearTimeout(this.autoAdvanceTimeout);
                this.autoAdvanceTimeout = null;
            }
        }
    }

    /**
     * Restore scroll position
     */
    restoreScrollPosition() {
        const content = this.domElements.chapterContent;

        if (this.currentPosition > 0) {
            // Restore saved scroll position for resuming reading
            setTimeout(() => {
                const maxScroll = content.scrollHeight - content.clientHeight;
                content.scrollTop = maxScroll * this.currentPosition;
            }, 10);
        }
        // If currentPosition is 0, scrollTop remains 0 (top of page)
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboard(event) {
        if (!this.novelData) return;

        // Only handle shortcuts when reader is active
        if (this.domElements.readerSection.classList.contains('hidden')) {
            return;
        }

        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                this.previousChapter();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.nextChapter();
                break;
            case 'b':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.toggleBookmark();
                }
                break;
            case 's':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.showNotification('Progress saved');
                }
                break;
        }
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            const settings = localStorage.getItem(CONFIG.STORAGE_KEYS.SETTINGS);
            return settings ? JSON.parse(settings) : {
                theme: 'light',
                font: 'serif',
                fontSize: 18
            };
        } catch (error) {
            console.warn('Failed to load settings:', error);
            return {
                theme: 'light',
                font: 'serif',
                fontSize: 18
            };
        }
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    /**
     * Apply saved settings
     */
    applySettings() {
        this.setTheme(this.settings.theme);
        this.setFont(this.settings.font);
        this.updateFontSize(this.settings.fontSize);
    }

    /**
     * Set theme
     */
    setTheme(theme) {
        if (!CONFIG.THEMES.includes(theme)) return;

        this.settings.theme = theme;
        this.domElements.novelReader.className = `novel-reader theme-${theme} font-${this.settings.font}`;
        this.saveSettings();
    }

    /**
     * Set font family
     */
    setFont(font) {
        if (!CONFIG.FONTS.includes(font)) return;

        this.settings.font = font;
        this.domElements.novelReader.className = `novel-reader theme-${this.settings.theme} font-${font}`;
        this.saveSettings();
    }

    /**
     * Update font size
     */
    updateFontSize(size) {
        this.settings.fontSize = parseInt(size);
        document.documentElement.style.setProperty('--reader-font-size', `${size}px`);
        this.domElements.fontSizeLabel.textContent = `${size}px`;
        this.saveSettings();
    }

    /**
     * Save reading progress
     */
    saveProgress() {
        if (!this.novelData) return;

        try {
            const progress = {
                novelTitle: this.novelData.title,
                currentChapter: this.currentChapter,
                currentPosition: this.currentPosition,
                timestamp: Date.now()
            };
            
            localStorage.setItem(CONFIG.STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
        } catch (error) {
            console.error('Failed to save progress:', error);
        }
    }

    /**
     * Load reading progress
     */
    loadProgress() {
        try {
            const progress = localStorage.getItem(CONFIG.STORAGE_KEYS.PROGRESS);
            if (progress) {
                const data = JSON.parse(progress);
                if (data.novelTitle === this.novelData.title) {
                    // Restore both chapter and position for normal bookmark/resume functionality
                    this.currentChapter = data.currentChapter || 0;
                    this.currentPosition = data.currentPosition || 0;
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.warn('Failed to load progress:', error);
            return false;
        }
    }

    /**
     * Save bookmarks
     */
    saveBookmarks() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.BOOKMARKS, JSON.stringify(this.bookmarks));
        } catch (error) {
            console.error('Failed to save bookmarks:', error);
        }
    }

    /**
     * Load bookmarks
     */
    loadBookmarks() {
        try {
            const bookmarks = localStorage.getItem(CONFIG.STORAGE_KEYS.BOOKMARKS);
            this.bookmarks = bookmarks ? JSON.parse(bookmarks) : [];
        } catch (error) {
            console.warn('Failed to load bookmarks:', error);
            this.bookmarks = [];
        }
    }

    /**
     * Toggle bookmark for current chapter
     */
    toggleBookmark() {
        if (!this.novelData) {
            this.showNotification(MESSAGES.NO_NOVEL_LOADED);
            return;
        }

        const bookmarkIndex = this.bookmarks.findIndex(
            b => b.novelTitle === this.novelData.title && b.chapterIndex === this.currentChapter
        );

        if (bookmarkIndex >= 0) {
            this.bookmarks.splice(bookmarkIndex, 1);
            this.showNotification(MESSAGES.BOOKMARK_REMOVED);
        } else {
            this.bookmarks.push({
                novelTitle: this.novelData.title,
                chapterIndex: this.currentChapter,
                chapterTitle: this.novelData.chapters[this.currentChapter].title,
                timestamp: Date.now()
            });
            this.showNotification(MESSAGES.BOOKMARK_ADDED);
        }

        this.saveBookmarks();
    }

    /**
     * Show reader interface
     */
    showReaderInterface() {
        this.domElements.uploadSection.classList.add('hidden');
        this.domElements.readerSection.classList.remove('hidden');
        
        // Load progress if available
        this.loadProgress();
    }

    /**
     * Export novel
     */
    exportNovel() {
        if (!this.novelData) {
            this.showNotification(MESSAGES.NO_NOVEL_LOADED);
            return;
        }

        try {
            const exportData = {
                novel: this.novelData,
                bookmarks: this.bookmarks.filter(b => b.novelTitle === this.novelData.title),
                progress: {
                    currentChapter: this.currentChapter,
                    currentPosition: this.currentPosition
                },
                exportDate: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.novelData.title}-export.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showNotification(MESSAGES.EXPORT_SUCCESS);
        } catch (error) {
            this.handleError(error, 'Export');
            this.showNotification(MESSAGES.EXPORT_FAILED);
        }
    }

    /**
     * Escape HTML entities
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Utility methods
    showLoadingState(message = 'Processing...') {
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
