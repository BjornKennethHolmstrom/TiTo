// ui/components/TimeEntries/index.js
class TimeEntries {
    constructor(timeEntryManager, stateManager, translationManager, container) {
        // Validate dependencies
        if (!timeEntryManager) {
            throw new Error('Time Entry Manager is required');
        }
        if (!stateManager) {
            throw new Error('State Manager is required');
        }
        if (!translationManager) {
            throw new Error('Translation Manager is required');
        }

        // Store references
        this.timeEntryManager = timeEntryManager;
        this.state = stateManager;
        this.translator = translationManager;
        this.container = container instanceof HTMLElement ? 
            container : 
            document.getElementById(container);

        if (!this.container) {
            throw new Error(`Time entries container not found: ${container}`);
        }

        // Initialize element references
        this.elements = {
            entriesList: null,
            addButton: null,
            addForm: null,
            pagination: null,
            entriesPerPage: null,
            sortButton: null,
            errorMessage: null,
            pageInput: null,
            totalPages: null
        };

        // Initialize the component
        this.initialize();
    }

    initialize() {
        try {
            // Create component structure
            this.container.innerHTML = this.createTemplate();
            
            // Cache element references
            this.cacheElements();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Subscribe to state changes
            this.subscribeToStateChanges();

            // Set initial values
            this.setDefaultFormTimes();

            // Initialize drag and drop
            this.setupDragAndDrop();

        } catch (error) {
            console.error('Error initializing TimeEntries:', error);
            throw error;
        }
    }

    cacheElements() {
        this.elements.entriesList = this.container.querySelector('.time-entries-list');
        this.elements.addButton = this.container.querySelector('.add-entry-button');
        this.elements.addForm = this.container.querySelector('.add-entry-form');
        this.elements.pagination = this.container.querySelector('.pagination');
        this.elements.entriesPerPage = this.container.querySelector('.entries-select');
        this.elements.sortButton = this.container.querySelector('.sort-button');
        this.elements.errorMessage = this.container.querySelector('.error-message');
        this.elements.pageInput = this.container.querySelector('.page-input');
        this.elements.totalPages = this.container.querySelector('.total-pages');

        // Validate essential elements
        if (!this.elements.entriesList) throw new Error('Time entries list container not found');
        if (!this.elements.addButton) throw new Error('Add entry button not found');
        if (!this.elements.addForm) throw new Error('Add entry form not found');
    }

    createTemplate() {
        return `
            <div class="time-entries-section">
                <div class="section-header">
                    <h2 class="section-heading" data-i18n="timeEntries">Time Entries</h2>
                    
                    <div class="header-controls">
                        <button class="add-entry-button" data-i18n="addManualEntry">
                            Add Manual Entry
                        </button>
                        <button class="sort-button" data-i18n="sortEntries">
                            Sort: Newest First
                        </button>
                    </div>
                </div>

                <div class="entries-per-page">
                    <label data-i18n="entriesPerPage">Entries per page:</label>
                    <select class="entries-select">
                        <option value="5">5</option>
                        <option value="10" selected>10</option>
                        <option value="20">20</option>
                        <option value="30">30</option>
                        <option value="all" data-i18n="all">All</option>
                    </select>
                </div>

                <form class="add-entry-form hidden">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="entryStartDate" data-i18n="startDate">Start Date:</label>
                            <input type="date" id="entryStartDate" required>
                            <input type="time" id="entryStartTime" required>
                        </div>
                        <div class="form-group">
                            <label for="entryEndDate" data-i18n="endDate">End Date:</label>
                            <input type="date" id="entryEndDate" required>
                            <input type="time" id="entryEndTime" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="entryDescription" data-i18n="description">Description:</label>
                        <input type="text" id="entryDescription" class="description-input">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="save-button" data-i18n="add">Add</button>
                        <button type="button" class="cancel-button" data-i18n="cancel">Cancel</button>
                    </div>
                </form>

                <div class="error-message hidden"></div>

                <ul class="time-entries-list" role="list"></ul>

                <div class="pagination">
                    <button class="pagination-button" data-action="first">⟨⟨</button>
                    <button class="pagination-button" data-action="prev">⟨</button>
                    <span class="page-info">
                        Page <input type="number" class="page-input" min="1"> 
                        of <span class="total-pages">1</span>
                    </span>
                    <button class="pagination-button" data-action="next">⟩</button>
                    <button class="pagination-button" data-action="last">⟩⟩</button>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Add entry button
        this.elements.addButton.addEventListener('click', () => {
            this.elements.addForm.classList.remove('hidden');
            this.setDefaultFormTimes();
        });

        // Form submission
        this.elements.addForm.addEventListener('submit', (e) => this.handleAddEntry(e));

        // Form cancel
        this.elements.addForm.querySelector('.cancel-button').addEventListener('click', () => {
            this.elements.addForm.classList.add('hidden');
        });

        // Entries per page
        this.elements.entriesPerPage.addEventListener('change', (e) => {
            this.timeEntriesFeature.setEntriesPerPage(
                e.target.value === 'all' ? Infinity : parseInt(e.target.value)
            );
        });

        // Sort button
        this.elements.sortButton.addEventListener('click', () => {
            const newOrder = this.timeEntriesFeature.getSortOrder() === 'newest' ? 'oldest' : 'newest';
            this.timeEntriesFeature.setSortOrder(newOrder);
            this.updateSortButtonText(newOrder);
        });

        // Pagination
        this.elements.pagination.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action) {
                this.handlePaginationClick(action);
            }
        });

        // Page input
        this.elements.pageInput.addEventListener('change', (e) => {
            const page = parseInt(e.target.value);
            if (page >= 1 && page <= this.timeEntriesFeature.getTotalPages()) {
                this.timeEntriesFeature.setPage(page);
            } else {
                e.target.value = this.timeEntriesFeature.getCurrentPage();
            }
        });
    }

    subscribeToStateChanges() {
        // Update method names to match TimeEntryManager
        this.state.subscribe('timeEntries.items', entries => this.renderEntries(entries));
        this.state.subscribe('timeEntries.currentPage', () => this.updatePagination());
        this.state.subscribe('timeEntries.totalPages', () => this.updatePaginationButtons());
        this.state.subscribe('timeEntries.error', error => this.showError(error));
    }

    renderEntries(entries) {
        const list = this.elements.entriesList;
        list.innerHTML = '';

        entries.forEach(entry => {
            const li = this.createEntryElement(entry);
            list.appendChild(li);
        });
    }

    createEntryElement(entry) {
        const li = document.createElement('li');
        li.className = 'time-entry-item';
        li.id = `entry-${entry.id}`;
        li.draggable = true;

        const startDate = new Date(entry.start);
        const endDate = new Date(entry.end);

        li.innerHTML = `
            <div class="entry-content">
                <div class="entry-times">
                    <div class="time-group">
                        <input type="date" class="date-input" value="${this.formatDate(startDate)}">
                        <input type="time" class="time-input" value="${this.formatTime(startDate)}">
                    </div>
                    <span class="time-separator">→</span>
                    <div class="time-group">
                        <input type="date" class="date-input" value="${this.formatDate(endDate)}">
                        <input type="time" class="time-input" value="${this.formatTime(endDate)}">
                    </div>
                </div>
                <input type="text" class="description-input" value="${entry.description || ''}" 
                    placeholder="${this.translator.translate('enterDescription')}">
                <div class="entry-duration">${this.formatDuration(entry.duration)}</div>
                <button class="delete-button" aria-label="${this.translator.translate('deleteEntry')}">
                    🗑️
                </button>
            </div>
        `;

        // Add event listeners
        const timeInputs = li.querySelectorAll('input[type="date"], input[type="time"]');
        timeInputs.forEach(input => {
            input.addEventListener('change', () => this.handleTimeChange(entry.id, li));
        });

        const descInput = li.querySelector('.description-input');
        descInput.addEventListener('change', () => {
            this.timeEntriesFeature.updateEntry(entry.id, {
                description: descInput.value
            });
        });

        const deleteButton = li.querySelector('.delete-button');
        deleteButton.addEventListener('click', () => this.handleDeleteEntry(entry.id));

        return li;
    }

    handleTimeChange(entryId, element) {
        const startDate = element.querySelector('input[type="date"]').value;
        const startTime = element.querySelector('input[type="time"]').value;
        const endDate = element.querySelectorAll('input[type="date"]')[1].value;
        const endTime = element.querySelectorAll('input[type="time"]')[1].value;

        const start = new Date(`${startDate}T${startTime}`);
        const end = new Date(`${endDate}T${endTime}`);

        if (start >= end) {
            this.showError(this.translator.translate('invalidTimeRange'));
            this.renderEntries(this.timeEntriesFeature.getCurrentEntries());
            return;
        }

        this.timeEntriesFeature.updateEntry(entryId, { start, end });
    }

    async handleAddEntry(e) {
        e.preventDefault();

        const startDate = this.elements.addForm.querySelector('#entryStartDate').value;
        const startTime = this.elements.addForm.querySelector('#entryStartTime').value;
        const endDate = this.elements.addForm.querySelector('#entryEndDate').value;
        const endTime = this.elements.addForm.querySelector('#entryEndTime').value;
        const description = this.elements.addForm.querySelector('#entryDescription').value;

        try {
            await this.timeEntriesFeature.addEntry({
                start: new Date(`${startDate}T${startTime}`),
                end: new Date(`${endDate}T${endTime}`),
                description
            });

            this.elements.addForm.classList.add('hidden');
            this.elements.addForm.reset();
        } catch (error) {
            this.showError(error.message);
        }
    }

    async handleDeleteEntry(entryId) {
        if (confirm(this.translator.translate('confirmDeleteTimeEntry'))) {
            try {
                await this.timeEntriesFeature.deleteEntry(entryId);
            } catch (error) {
                this.showError(error.message);
            }
        }
    }

    handlePaginationClick(action) {
        const currentPage = this.timeEntryManager.getCurrentPage();
        const totalPages = this.timeEntryManager.getTotalPages();

        switch (action) {
            case 'first':
                this.timeEntryManager.setPage(1);
                break;
            case 'prev':
                if (currentPage > 1) {
                    this.timeEntryManager.setPage(currentPage - 1);
                }
                break;
            case 'next':
                if (currentPage < totalPages) {
                    this.timeEntryManager.setPage(currentPage + 1);
                }
                break;
            case 'last':
                this.timeEntryManager.setPage(totalPages);
                break;
        }
    }

    updatePagination() {
        if (!this.elements.pageInput || !this.elements.totalPages) return;

        const currentPage = this.timeEntryManager.getCurrentPage();
        const totalPages = this.timeEntryManager.getTotalPages();
        
        this.elements.pageInput.value = currentPage;
        this.elements.totalPages.textContent = totalPages;
        
        this.updatePaginationButtons();
    }

    updatePaginationButtons() {
        if (!this.elements.pagination) return;

        const currentPage = this.timeEntryManager.getCurrentPage();
        const totalPages = this.timeEntryManager.getTotalPages();
        
        const firstButton = this.elements.pagination.querySelector('[data-action="first"]');
        const prevButton = this.elements.pagination.querySelector('[data-action="prev"]');
        const nextButton = this.elements.pagination.querySelector('[data-action="next"]');
        const lastButton = this.elements.pagination.querySelector('[data-action="last"]');

        if (firstButton) firstButton.disabled = currentPage === 1;
        if (prevButton) prevButton.disabled = currentPage === 1;
        if (nextButton) nextButton.disabled = currentPage === totalPages;
        if (lastButton) lastButton.disabled = currentPage === totalPages;
    }

    updateSortButtonText(order) {
        this.elements.sortButton.textContent = 
            this.translator.translate(order === 'newest' ? 'sortNewestFirst' : 'sortOldestFirst');
    }

    setDefaultFormTimes() {
        const now = new Date();
        const formattedDate = this.formatDate(now);
        const formattedTime = this.formatTime(now);

        this.elements.addForm.querySelector('#entryStartDate').value = formattedDate;
        this.elements.addForm.querySelector('#entryStartTime').value = formattedTime;
        this.elements.addForm.querySelector('#entryEndDate').value = formattedDate;
        this.elements.addForm.querySelector('#entryEndTime').value = formattedTime;
    }

    setupDragAndDrop() {
        const timeEntryList = this.elements.entriesList;
        if (!timeEntryList) return;

        let dragSrcEl = null;

        // Handle drag start
        timeEntryList.addEventListener('dragstart', (e) => {
            const item = e.target.closest('li');
            if (!item) return;

            dragSrcEl = item;
            e.target.style.opacity = '0.4';
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.dataset.entryId);
        });

        // Handle drag over
        timeEntryList.addEventListener('dragover', (e) => {
            e.preventDefault();
            return false;
        });

        // Handle drag enter
        timeEntryList.addEventListener('dragenter', (e) => {
            const item = e.target.closest('li');
            if (item && dragSrcEl !== item) {
                item.classList.add('over');
            }
        });

        // Handle drag leave
        timeEntryList.addEventListener('dragleave', (e) => {
            const item = e.target.closest('li');
            if (item) {
                item.classList.remove('over');
            }
        });

        // Handle drop
        timeEntryList.addEventListener('drop', async (e) => {
            e.stopPropagation();
            e.preventDefault();

            const dropTarget = e.target.closest('li');
            if (!dropTarget || !dragSrcEl || dropTarget === dragSrcEl) return;

            const items = Array.from(timeEntryList.children);
            const fromIndex = items.indexOf(dragSrcEl);
            const toIndex = items.indexOf(dropTarget);

            try {
                // Update entry order through feature
                await this.timeEntriesFeature.updateEntryOrder(
                    dragSrcEl.dataset.entryId,
                    fromIndex,
                    toIndex
                );
            } catch (error) {
                this.showError(error.message);
            }

            return false;
        });

        // Handle drag end
        timeEntryList.addEventListener('dragend', (e) => {
            e.target.style.opacity = '1';
            timeEntryList.querySelectorAll('li').forEach(item => {
                item.classList.remove('over');
            });
            dragSrcEl = null;
        });
    }

    // Utility methods
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    formatTime(date) {
        return date.toTimeString().slice(0, 5);
    }

    formatDuration(ms) {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.classList.remove('hidden');
        
        setTimeout(() => {
            this.elements.errorMessage.classList.add('hidden');
        }, 5000);
    }

    destroy() {
        // Clean up event listeners
        // State manager unsubscribe would be handled here if implemented
    }

    updateTranslations() {
        // Update all text content with data-i18n attributes
        this.container.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.translator.translate(key);
        });

        // Update placeholders
        this.container.querySelectorAll('.description-input').forEach(input => {
            input.placeholder = this.translator.translate('enterDescription');
        });

        // Update sort button
        this.updateSortButtonText(this.timeEntriesFeature.getSortOrder());

        // Update aria labels
        this.container.querySelectorAll('.delete-button').forEach(button => {
            button.setAttribute('aria-label', this.translator.translate('deleteEntry'));
        });

        // Update pagination aria labels
        const paginationButtons = {
            first: 'firstPage',
            prev: 'previousPage',
            next: 'nextPage',
            last: 'lastPage'
        };

        Object.entries(paginationButtons).forEach(([action, translationKey]) => {
            const button = this.elements.pagination.querySelector(`[data-action="${action}"]`);
            if (button) {
                button.setAttribute('aria-label', this.translator.translate(translationKey));
            }
        });
    }
}
