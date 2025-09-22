// Notification Manager for Sahab Budget
class NotificationManager {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Create notification container if it doesn't exist
        if (!document.getElementById('notificationContainer')) {
            this.container = document.createElement('div');
            this.container.id = 'notificationContainer';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('notificationContainer');
        }
    }

    show(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;

        // Add icon based on type
        const icon = this.getIcon(type);

        notification.innerHTML = `
            <span class="notification-icon">${icon}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;

        // Add to container
        this.container.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add('show'), 10);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }

        return notification;
    }

    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ',
        };
        return icons[type] || icons.info;
    }

    confirm(message, onConfirm, onCancel) {
        const dialog = document.createElement('div');
        dialog.className = 'notification-dialog';

        dialog.innerHTML = `
            <div class="dialog-content">
                <p>${message}</p>
                <div class="dialog-actions">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-confirm">Confirm</button>
                </div>
            </div>
        `;

        // Add event listeners
        dialog.querySelector('.btn-cancel').addEventListener('click', () => {
            dialog.remove();
            if (onCancel) onCancel();
        });

        dialog.querySelector('.btn-confirm').addEventListener('click', () => {
            dialog.remove();
            if (onConfirm) onConfirm();
        });

        document.body.appendChild(dialog);

        // Animate in
        setTimeout(() => dialog.classList.add('show'), 10);
    }

    showProgress(message) {
        const notification = this.show(message, 'info', 0);
        notification.classList.add('notification-progress');

        // Add progress bar
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.innerHTML = '<div class="progress-fill"></div>';
        notification.appendChild(progressBar);

        return {
            element: notification,
            update: (progress, newMessage) => {
                if (newMessage) {
                    notification.querySelector('.notification-message').textContent = newMessage;
                }
                notification.querySelector('.progress-fill').style.width = `${progress}%`;
            },
            close: () => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            },
        };
    }
}

// Create global instance
const notificationManager = new NotificationManager();
