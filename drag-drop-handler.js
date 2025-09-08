// Drag and Drop Handler for moving transactions between categories
class DragDropHandler {
    constructor() {
        this.draggedElement = null;
        this.draggedData = null;
        this.sourceCategory = null;
        this.pendingDelete = null;
        this.scrollInterval = null;
        this.scrollSpeed = 0;
    }

    initializeDragDrop() {
        // Add event listeners to all draggable items
        document.querySelectorAll('.transaction-item').forEach(item => {
            this.makeItemDraggable(item);
        });

        // Add drop zones to all category cards
        document.querySelectorAll('.category-card').forEach(card => {
            this.makeCardDroppable(card);
        });
    }

    makeItemDraggable(item) {
        item.draggable = true;
        
        item.addEventListener('dragstart', (e) => {
            this.draggedElement = item;
            this.sourceCategory = item.closest('.category-card').dataset.category;
            this.draggedData = {
                name: item.querySelector('.transaction-name').textContent,
                amount: parseFloat(item.dataset.amount),
                date: item.dataset.date,
                isReturn: item.classList.contains('is-return')
            };
            
            e.dataTransfer.effectAllowed = 'move';
            item.classList.add('dragging');
            this.startAutoScroll();
        });

        item.addEventListener('dragend', (e) => {
            item.classList.remove('dragging');
            this.stopAutoScroll();
            this.clearDropIndicators();
        });
    }

    makeCardDroppable(card) {
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            // Visual feedback
            if (!card.contains(this.draggedElement)) {
                card.classList.add('drag-over');
            }
            
            // Show drop indicator
            const afterElement = this.getDragAfterElement(card, e.clientY);
            const dropIndicator = card.querySelector('.drop-indicator');
            
            if (afterElement == null) {
                card.querySelector('.category-transactions').appendChild(this.draggedElement);
            } else {
                card.querySelector('.category-transactions').insertBefore(this.draggedElement, afterElement);
            }
        });

        card.addEventListener('dragleave', (e) => {
            if (e.target === card || !card.contains(e.relatedTarget)) {
                card.classList.remove('drag-over');
            }
        });

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            const targetCategory = card.dataset.category;
            
            if (targetCategory !== this.sourceCategory) {
                this.moveTransaction(this.sourceCategory, targetCategory, this.draggedData);
            }
            
            card.classList.remove('drag-over');
            this.clearDropIndicators();
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.transaction-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    clearDropIndicators() {
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    }

    moveTransaction(fromCategory, toCategory, transactionData) {
        if (!currentFileId || !loadedFiles.has(currentFileId)) return;
        
        const fileData = loadedFiles.get(currentFileId);
        const analyzer = fileData.analyzer;
        
        // Remove from source category
        const sourceDetails = analyzer.categoryDetails[fromCategory];
        const transactionIndex = sourceDetails.findIndex(t => 
            t.name === transactionData.name && 
            Math.abs(t.amount - transactionData.amount) < 0.01
        );
        
        if (transactionIndex !== -1) {
            const [removedTransaction] = sourceDetails.splice(transactionIndex, 1);
            
            // Update source category total
            analyzer.categoryTotals[fromCategory] -= removedTransaction.amount;
            analyzer.categoryTotals[fromCategory] = Math.round(analyzer.categoryTotals[fromCategory] * 100) / 100;
            
            // Add to target category
            if (!analyzer.categoryDetails[toCategory]) {
                analyzer.categoryDetails[toCategory] = [];
            }
            analyzer.categoryDetails[toCategory].push(removedTransaction);
            
            // Update target category total
            analyzer.categoryTotals[toCategory] = (analyzer.categoryTotals[toCategory] || 0) + removedTransaction.amount;
            analyzer.categoryTotals[toCategory] = Math.round(analyzer.categoryTotals[toCategory] * 100) / 100;

            // Update processedData to reflect the category change
            const processedIndex = analyzer.processedData.findIndex(row => 
                row.Description === removedTransaction.name && 
                Math.abs(parseFloat(row.Amount) - removedTransaction.amount) < 0.01
            );

            if (processedIndex !== -1) {
                // Update the category in processedData
                analyzer.processedData[processedIndex].Category = toCategory;
            }

            // Recalculate monthly data
            analyzer.recalculateMonthlyData();
            
            // Refresh the dashboard
            updateDashboard(analyzer);
            
            // Show success message
            this.showNotification(`Moved "${transactionData.name}" from ${fromCategory} to ${toCategory}`);
            if (typeof saveDataToStorage === 'function') {
                saveDataToStorage();
            }
        }
    }

    deleteTransaction(category, transactionElement) {
        this.pendingDelete = {
            category: category,
            element: transactionElement,
            data: {
                name: transactionElement.querySelector('.transaction-name').textContent,
                amount: parseFloat(transactionElement.dataset.amount)
            }
        };
        
        document.getElementById('deleteModal').style.display = 'flex';
    }

    confirmDeleteTransaction() {
        if (!this.pendingDelete || !currentFileId || !loadedFiles.has(currentFileId)) return;
        
        const fileData = loadedFiles.get(currentFileId);
        const analyzer = fileData.analyzer;
        const { category, data } = this.pendingDelete;
        
        // Find and remove the transaction
        const categoryDetails = analyzer.categoryDetails[category];
        const transactionIndex = categoryDetails.findIndex(t => 
            t.name === data.name && 
            Math.abs(t.amount - data.amount) < 0.01
        );
        
        if (transactionIndex !== -1) {
            const [removedTransaction] = categoryDetails.splice(transactionIndex, 1);
            
            // Update category total
            analyzer.categoryTotals[category] -= removedTransaction.amount;
            analyzer.categoryTotals[category] = Math.round(analyzer.categoryTotals[category] * 100) / 100;
            
            // Also remove from processedData
            const processedIndex = analyzer.processedData.findIndex(row => 
                row.Description === data.name && 
                Math.abs(parseFloat(row.Amount) - data.amount) < 0.01
            );
            
            if (processedIndex !== -1) {
                analyzer.processedData.splice(processedIndex, 1);
            }
            
            analyzer.recalculateMonthlyData();

            // Refresh the dashboard
            updateDashboard(analyzer);
            
            // Show success message
            this.showNotification(`Deleted "${data.name}" from ${category}`);
            if (typeof saveDataToStorage === 'function') {
                saveDataToStorage();
            }
        }
        
        this.pendingDelete = null;
        closeDeleteModal();
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    startAutoScroll() {
        if (this.scrollInterval) return;
        
        this.scrollInterval = setInterval(() => {
            if (this.scrollSpeed !== 0) {
                window.scrollBy(0, this.scrollSpeed);
            }
        }, 20);
        
        // Add mouse position tracking for auto-scroll
        document.addEventListener('dragover', this.handleDragScroll);
    }

    stopAutoScroll() {
        if (this.scrollInterval) {
            clearInterval(this.scrollInterval);
            this.scrollInterval = null;
        }
        document.removeEventListener('dragover', this.handleDragScroll);
        this.scrollSpeed = 0;
    }

    handleDragScroll = (e) => {
        const threshold = 100; // Distance from edge to trigger scroll
        const maxSpeed = 10; // Maximum scroll speed
        
        const windowHeight = window.innerHeight;
        const mouseY = e.clientY;
        
        if (mouseY < threshold) {
            // Scroll up
            this.scrollSpeed = -maxSpeed * (1 - mouseY / threshold);
        } else if (mouseY > windowHeight - threshold) {
            // Scroll down
            this.scrollSpeed = maxSpeed * (1 - (windowHeight - mouseY) / threshold);
        } else {
            this.scrollSpeed = 0;
        }
    }
}

// Initialize the drag and drop handler
const dragDropHandler = new DragDropHandler();

// Global functions for modal
function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
}

function confirmDelete() {
    dragDropHandler.confirmDeleteTransaction();
}

// Helper function to delete a transaction (called from the delete button)
function deleteTransaction(category, button) {
    const transactionElement = button.closest('.transaction-item');
    dragDropHandler.deleteTransaction(category, transactionElement);
}