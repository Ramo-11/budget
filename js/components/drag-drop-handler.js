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
        document.querySelectorAll('.transaction-item').forEach((item) => {
            this.makeItemDraggable(item);
        });

        // Add drop zones to all category cards
        document.querySelectorAll('.category-card').forEach((card) => {
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
                isReturn: item.classList.contains('is-return'),
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
                card.querySelector('.category-transactions').insertBefore(
                    this.draggedElement,
                    afterElement
                );
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
        const draggableElements = [
            ...container.querySelectorAll('.transaction-item:not(.dragging)'),
        ];

        return draggableElements.reduce(
            (closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;

                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            },
            { offset: Number.NEGATIVE_INFINITY }
        ).element;
    }

    clearDropIndicators() {
        document.querySelectorAll('.drag-over').forEach((el) => {
            el.classList.remove('drag-over');
        });
    }

    moveTransaction(fromCategory, toCategory, transactionData) {
        // Get current month data
        if (!app || !app.currentMonth || !app.monthlyData.has(app.currentMonth)) {
            notificationManager.show('No data available', 'error');
            return;
        }

        const monthData = app.monthlyData.get(app.currentMonth);

        // The transaction name in the data might be stored as "Description"
        // We need to find it by matching the description field
        const transactionIndex = monthData.transactions.findIndex((t) => {
            const description = t.Description || t.description || t.Name || t.name;
            const amount = parseFloat(t.Amount || t.amount);
            return (
                description === transactionData.name &&
                Math.abs(amount - transactionData.amount) < 0.01
            );
        });

        if (transactionIndex === -1) {
            // Try a more flexible search
            const foundTransaction = monthData.transactions.find((t) => {
                const description = t.Description || t.description || t.Name || t.name;
                return description && description.includes(transactionData.name);
            });

            if (!foundTransaction) {
                notificationManager.show('Could not find transaction to move', 'error');
                console.log('Looking for:', transactionData.name);
                console.log('Available transactions:', monthData.transactions.slice(0, 5));
                return;
            }
        }

        // Update the category keywords to include this merchant for future categorization
        const config = userManager.getCategoryConfig();

        // Extract merchant name from transaction (first significant word)
        const merchantWords = transactionData.name.split(/[\s\*#]+/);
        const merchantName = merchantWords[0].toUpperCase();

        // Add to new category's keywords if not already there
        if (config[toCategory]) {
            if (!config[toCategory].keywords) {
                config[toCategory].keywords = [];
            }
            if (!config[toCategory].keywords.includes(merchantName)) {
                config[toCategory].keywords.push(merchantName);
            }
        }

        // Remove from old category's keywords if it was there
        if (config[fromCategory] && config[fromCategory].keywords) {
            const keywordIndex = config[fromCategory].keywords.indexOf(merchantName);
            if (keywordIndex > -1) {
                config[fromCategory].keywords.splice(keywordIndex, 1);
            }
        }

        // Save the updated configuration
        userManager.setCategoryConfig(config);

        // Show success message
        notificationManager.show(
            `Moved "${transactionData.name}" from ${fromCategory} to ${toCategory}`,
            'success'
        );

        // Refresh the view to recategorize with new rules
        setTimeout(() => {
            app.switchToMonth(app.currentMonth);
        }, 500);
    }

    deleteTransaction(category, transactionElement) {
        this.pendingDelete = {
            category: category,
            element: transactionElement,
            data: {
                name: transactionElement.querySelector('.transaction-name').textContent,
                amount: parseFloat(transactionElement.dataset.amount),
            },
        };

        document.getElementById('deleteModal').style.display = 'flex';
    }

    // confirmDeleteTransaction() {
    //     if (!this.pendingDelete || !currentFileId || !loadedFiles.has(currentFileId)) return;

    //     const fileData = loadedFiles.get(currentFileId);
    //     const analyzer = fileData.analyzer;
    //     const { category, data } = this.pendingDelete;

    //     // Find and remove the transaction
    //     const categoryDetails = analyzer.categoryDetails[category];
    //     const transactionIndex = categoryDetails.findIndex(
    //         (t) => t.name === data.name && Math.abs(t.amount - data.amount) < 0.01
    //     );

    //     if (transactionIndex !== -1) {
    //         const [removedTransaction] = categoryDetails.splice(transactionIndex, 1);

    //         // Update category total
    //         analyzer.categoryTotals[category] -= removedTransaction.amount;
    //         analyzer.categoryTotals[category] =
    //             Math.round(analyzer.categoryTotals[category] * 100) / 100;

    //         // Also remove from processedData
    //         const processedIndex = analyzer.processedData.findIndex(
    //             (row) =>
    //                 row.Description === data.name &&
    //                 Math.abs(parseFloat(row.Amount) - data.amount) < 0.01
    //         );

    //         if (processedIndex !== -1) {
    //             analyzer.processedData.splice(processedIndex, 1);
    //         }

    //         analyzer.recalculateMonthlyData();

    //         // Refresh the dashboard
    //         updateDashboard(analyzer);

    //         // Show success message
    //         this.showNotification(`Deleted "${data.name}" from ${category}`);
    //         if (typeof saveDataToStorage === 'function') {
    //             saveDataToStorage();
    //         }
    //     }

    //     this.pendingDelete = null;
    //     closeDeleteModal();
    // }

    showNotification(message, type = 'info') {
        if (typeof notificationManager !== 'undefined') {
            notificationManager.show(message, type);
        } else {
            // Fallback implementation
            const notification = document.createElement('div');
            notification.className = `notification notification-${type} show`;
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }, 3000);
        }
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
    };
}

// Initialize the drag and drop handler
const dragDropHandler = new DragDropHandler();

// Global functions for modal
function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
}

// function confirmDelete() {
// dragDropHandler.confirmDeleteTransaction();
// }

// Helper function to delete a transaction (called from the delete button)
function deleteTransaction(category, button) {
    const transactionElement = button.closest('.transaction-item');
    dragDropHandler.deleteTransaction(category, transactionElement);
}
