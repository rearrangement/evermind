// evermind - Student Assignment Reminder App

class evermind {
    constructor() {
        this.assignments = [];
        this.notificationsEnabled = JSON.parse(localStorage.getItem('evermind-notifications')) || false;
        this.currentWeekStart = this.getWeekStart(new Date());
    }

    async init() {
        // Check if user is authenticated before loading assignments
        let isAuthenticated = false;
        try {
            const userRes = await fetch('/api/user', { credentials: 'include' });
            const userData = await userRes.json();
            isAuthenticated = userData && userData.id;
        } catch (e) {
            isAuthenticated = false;
        }
        if (isAuthenticated) {
            await this.loadAssignmentsFromBackend();
        }
        this.setupEventListeners();
        this.displayCurrentDate();
        this.displayTodayAssignments();
        this.displayAllAssignments();
        this.displayWeekView();
        this.checkNotificationPermission();
        this.scheduleNotifications();
    }

    setupEventListeners() {
        // Add assignment button (show modal)
        document.getElementById('add-assignment-btn').addEventListener('click', () => {
            this.showAddAssignmentModal();
        });
        // ...existing code for other event listeners...
    }

    async saveAssignmentsToBackend() {
        try {
            console.log('[DEBUG] Sending events to backend:', this.assignments);
            const response = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ events: this.assignments }),
                credentials: 'include'
            });
            const result = await response.json();
            console.log('[DEBUG] Backend response:', result);
            if (!response.ok) {
                this.showMessage('Failed to sync events: ' + (result.error || response.statusText), 'error');
            }
        } catch (err) {
            console.error('[DEBUG] Error syncing events:', err);
            this.showMessage('Error syncing events: ' + err, 'error');
        }
    }

    async loadAssignmentsFromBackend() {
        try {
            const response = await fetch('/api/userdata', { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to load events');
            const data = await response.json();
            if (data && data.events && Array.isArray(data.events)) {
                this.assignments = data.events;
                localStorage.setItem('evermind-assignments', JSON.stringify(this.assignments));
                this.displayTodayAssignments();
                this.displayAllAssignments();
                this.displayWeekView();
            }
        } catch (err) {
            // Optionally show a message, but fail silently for now
            // this.showMessage('Could not load events: ' + err, 'error');
        }
    }

    setupEventListeners() {
        // Add assignment button (show modal)
        document.getElementById('add-assignment-btn').addEventListener('click', () => {
            this.showAddAssignmentModal();
        });
        // Cancel assignment button (hide modal)
        document.getElementById('cancel-assignment-btn').addEventListener('click', () => {
            this.hideAddAssignmentModal();
        });
        // Assignment form submission
        document.getElementById('assignment-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addAssignment();
        });
        // Assignment filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterAssignments(e.target.dataset.filter);
            });
        });
        // Notification prompt (if exists)
        const enableNotifications = document.getElementById('enable-notifications');
        const disableNotifications = document.getElementById('disable-notifications');
        if (enableNotifications) {
            enableNotifications.addEventListener('click', () => {
                this.enableNotifications();
            });
        }
        if (disableNotifications) {
            disableNotifications.addEventListener('click', () => {
                this.hideNotificationPrompt();
            });
        }
        // Week navigation
        const prevWeekBtn = document.getElementById('prev-week');
        const nextWeekBtn = document.getElementById('next-week');
        if (prevWeekBtn) {
            prevWeekBtn.addEventListener('click', () => {
                this.navigateWeek(-1);
            });
        }
        if (nextWeekBtn) {
            nextWeekBtn.addEventListener('click', () => {
                this.navigateWeek(1);
            });
        }
    }

    displayCurrentDate() {
        const currentDateElement = document.getElementById('current-date');
        if (currentDateElement) {
            const today = new Date();
            const options = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            };
            currentDateElement.textContent = today.toLocaleDateString('en-US', options);
        }
    }

    addAssignment() {
        const title = document.getElementById('assignment-title').value.trim();
        const course = document.getElementById('assignment-course').value.trim();
        const description = document.getElementById('assignment-description').value.trim();
        const dueDate = document.getElementById('assignment-due-date').value;
        const dueTime = document.getElementById('assignment-due-time').value;
        const priority = document.getElementById('assignment-priority').value;

        if (!title || !course || !dueDate) {
            this.showMessage('please fill in all required fields.', 'error');
            return;
        }

        const assignment = {
            id: Date.now().toString(),
            title,
            course,
            description,
            dueDate,
            dueTime,
            priority,
            completed: false,
            createdAt: new Date().toISOString()
        };

    this.assignments.push(assignment);
    this.saveAssignments();
    this.showMessage('assignment added successfully!', 'success');
        
        // Reset form and hide modal
        document.getElementById('assignment-form').reset();
        document.getElementById('assignment-due-time').value = '23:59';
        this.hideAddAssignmentModal();
        
        // Refresh displays
        this.displayTodayAssignments();
        this.displayAllAssignments();
        this.displayWeekView();
    }

    showAddAssignmentModal() {
        const modal = document.getElementById('add-assignment-modal');
        modal.classList.add('active');
        
        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop active';
        backdrop.addEventListener('click', () => this.hideAddAssignmentModal());
        document.body.appendChild(backdrop);
    }

    hideAddAssignmentModal() {
        const modal = document.getElementById('add-assignment-modal');
        modal.classList.remove('active');
        
        // Remove backdrop
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.remove();
        }
        
        // Reset form
        document.getElementById('assignment-form').reset();
        document.getElementById('assignment-due-time').value = '23:59';
        this.scheduleNotifications();
    }

    completeAssignment(id) {
        const assignment = this.assignments.find(a => a.id === id);
        if (assignment) {
            assignment.completed = !assignment.completed;
            this.saveAssignments();
            this.displayTodayAssignments();
            this.displayAllAssignments();
            this.displayWeekView();
        }
    }

    deleteAssignment(id) {
        this.showDeleteAssignmentModal(id);
    }

    showDeleteAssignmentModal(id) {
        // Remove any existing modal/backdrop
        this.hideDeleteAssignmentModal();

        // Create blurred backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'delete-assignment-backdrop';
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100vw';
        backdrop.style.height = '100vh';
        backdrop.style.background = 'rgba(0,0,0,0.18)';
        backdrop.style.backdropFilter = 'blur(6px)';
        backdrop.style.zIndex = 1201;
        backdrop.addEventListener('click', () => this.hideDeleteAssignmentModal());
        document.body.appendChild(backdrop);

        // Create modal element
        const modal = document.createElement('div');
        modal.id = 'delete-assignment-modal';
        modal.className = 'add-assignment active';
        modal.style.zIndex = 1202;
        modal.style.background = '#232336'; // match other elements
        modal.style.borderRadius = '14px'; // match add-assignment modal
        modal.style.border = '1.5px solid rgba(255,255,255,0.10)'; // match add-assignment modal
        modal.innerHTML = `
            <h2 style="text-align:center;">Delete Assignment</h2>
            <p style="text-align:center;">Are you sure you want to delete this assignment?</p>
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 18px;">
                <button id="delete-assignment-confirm-btn" style="background: #e74c3c;">Delete</button>
                <button id="delete-assignment-cancel-btn" style="background: #666;">Cancel</button>
            </div>
        `;
        modal.style.paddingTop = '22px';
        modal.style.paddingBottom = '22px';

        // Add modal to body
        document.body.appendChild(modal);

        // Add event listeners
        document.getElementById('delete-assignment-confirm-btn').addEventListener('click', () => {
            this.assignments = this.assignments.filter(a => a.id !== id);
            this.saveAssignments();
            this.displayTodayAssignments();
            this.displayAllAssignments();
            this.displayWeekView();
            this.hideDeleteAssignmentModal();
        });
        document.getElementById('delete-assignment-cancel-btn').addEventListener('click', () => {
            this.hideDeleteAssignmentModal();
        });
    }

    hideDeleteAssignmentModal() {
        const modal = document.getElementById('delete-assignment-modal');
        if (modal) {
            modal.remove();
        }
        const backdrop = document.getElementById('delete-assignment-backdrop');
        if (backdrop) {
            backdrop.remove();
        }
    }

    editAssignment(id) {
        const assignment = this.assignments.find(a => a.id === id);
        if (!assignment) return;
        this.showEditAssignmentModal(assignment);
    }

    showEditAssignmentModal(assignment) {
        this.hideEditAssignmentModal();

        // Create blurred backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'edit-assignment-backdrop';
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100vw';
        backdrop.style.height = '100vh';
        backdrop.style.background = 'rgba(0,0,0,0.18)';
        backdrop.style.backdropFilter = 'blur(6px)';
        backdrop.style.zIndex = 1201;
        backdrop.addEventListener('click', () => this.hideEditAssignmentModal());
        document.body.appendChild(backdrop);

        // Create modal element
        const modal = document.createElement('div');
        modal.id = 'edit-assignment-modal';
        modal.className = 'add-assignment active';
        modal.style.zIndex = 1202;
        modal.style.background = 'rgba(102,126,234,0.10)';
        modal.style.borderRadius = '14px';
        modal.style.border = '1.5px solid rgba(255,255,255,0.10)';
        modal.style.paddingTop = '22px';
        modal.style.paddingBottom = '22px';
        modal.innerHTML = `
            <h2 style="text-align:center;">Edit Assignment</h2>
            <p style="text-align:center;">Do you want to edit this assignment? It will be deleted and a new one will be created with the same details.</p>
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 18px;">
                <button id="edit-assignment-confirm-btn" style="background: #3498db;">Edit</button>
                <button id="edit-assignment-cancel-btn" style="background: #666;">Cancel</button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('edit-assignment-confirm-btn').addEventListener('click', () => {
            // Delete the old assignment
            this.assignments = this.assignments.filter(a => a.id !== assignment.id);
            this.saveAssignments();
            this.displayTodayAssignments();
            this.displayAllAssignments();
            this.displayWeekView();
            this.hideEditAssignmentModal();
            // Pre-fill the add-assignment modal
            document.getElementById('assignment-title').value = assignment.title;
            document.getElementById('assignment-course').value = assignment.course;
            document.getElementById('assignment-description').value = assignment.description;
            document.getElementById('assignment-due-date').value = assignment.dueDate;
            document.getElementById('assignment-due-time').value = assignment.dueTime;
            document.getElementById('assignment-priority').value = assignment.priority;
            this.showAddAssignmentModal();
            // Scroll to form
            document.querySelector('.add-assignment').scrollIntoView({ behavior: 'smooth' });
        });
        document.getElementById('edit-assignment-cancel-btn').addEventListener('click', () => {
            this.hideEditAssignmentModal();
        });
    }

    hideEditAssignmentModal() {
        const modal = document.getElementById('edit-assignment-modal');
        if (modal) modal.remove();
        const backdrop = document.getElementById('edit-assignment-backdrop');
        if (backdrop) backdrop.remove();
    }

    displayTodayAssignments() {
        const today = new Date().toISOString().split('T')[0];
        const todayAssignments = this.assignments.filter(a => a.dueDate === today);
        
        const container = document.getElementById('today-assignments');
        
        if (todayAssignments.length === 0) {
            container.innerHTML = '<div class="empty-state"><h4>no assignments are due today</h4><p>go kick back and relax (or work on other assignments)</p></div>';
            return;
        }

        container.innerHTML = todayAssignments
            .sort((a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority))
            .map(assignment => this.createAssignmentHTML(assignment))
            .join('');
    }

    displayAllAssignments(filter = 'all') {
        const container = document.getElementById('all-assignments-list');
        let filteredAssignments = [...this.assignments];

        switch (filter) {
            case 'pending':
                filteredAssignments = filteredAssignments.filter(a => !a.completed);
                break;
            case 'completed':
                filteredAssignments = filteredAssignments.filter(a => a.completed);
                break;
            case 'overdue':
                const today = new Date().toISOString().split('T')[0];
                filteredAssignments = filteredAssignments.filter(a => !a.completed && a.dueDate < today);
                break;
        }

        if (filteredAssignments.length === 0) {
            container.innerHTML = '<div class="empty-state"><h4>no assignments found</h4><p>add your first assignment above to get started.</p></div>';
            return;
        }

        // Sort by due date, then by priority
        filteredAssignments.sort((a, b) => {
            const dateA = new Date(a.dueDate + 'T' + a.dueTime);
            const dateB = new Date(b.dueDate + 'T' + b.dueTime);
            if (dateA.getTime() !== dateB.getTime()) {
                return dateA - dateB;
            }
            return this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority);
        });

        container.innerHTML = filteredAssignments
            .map(assignment => this.createAssignmentHTML(assignment))
            .join('');
    }

    createAssignmentHTML(assignment) {
        const dueDateTime = new Date(assignment.dueDate + 'T' + assignment.dueTime);
        const now = new Date();
        const isOverdue = !assignment.completed && dueDateTime < now;
        const isDueToday = assignment.dueDate === now.toISOString().split('T')[0];
        const isDueSoon = !assignment.completed && dueDateTime > now && dueDateTime <= new Date(now.getTime() + 24 * 60 * 60 * 1000);

        let dueDateClass = '';
        if (isDueToday) dueDateClass = 'due-today';
        else if (isDueSoon) dueDateClass = 'due-soon';

        const assignmentClass = `assignment-item ${assignment.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`;

        return `
            <div class="${assignmentClass}">
                <div class="assignment-header">
                    <div>
                        <div class="assignment-title">${this.escapeHtml(assignment.title)}</div>
                        <div class="assignment-course">${this.escapeHtml(assignment.course)}</div>
                    </div>
                    <div class="assignment-priority priority-${assignment.priority}">
                        ${assignment.priority.charAt(0).toUpperCase() + assignment.priority.slice(1)} Priority
                    </div>
                </div>
                
                ${assignment.description ? `<div class="assignment-description">${this.escapeHtml(assignment.description)}</div>` : ''}
                
                <div class="assignment-due ${dueDateClass}">
                    Due: ${dueDateTime.toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                    })} at ${dueDateTime.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit' 
                    })}
                    ${isOverdue ? ' - LATE!' : ''}
                    ${isDueToday ? ' - DUE TODAY!' : ''}
                    ${isDueSoon ? ' - DUE SOON!' : ''}
                </div>
                
                <div class="assignment-actions">
                    <button class="complete-btn" onclick="app.completeAssignment('${assignment.id}')">
                        ${assignment.completed ? '[↶] mark pending' : '[✓] mark complete'}
                    </button>
                    <button class="edit-btn" onclick="app.editAssignment('${assignment.id}')">
                        [✏] edit
                    </button>
                    <button class="delete-btn" onclick="app.deleteAssignment('${assignment.id}')">
                        [🗑] delete
                    </button>
                </div>
            </div>
        `;
    }

    filterAssignments(filter) {
        this.displayAllAssignments(filter);
    }

    checkNotificationPermission() {
        if ('Notification' in window && !this.notificationsEnabled) {
            if (Notification.permission === 'default') {
                document.getElementById('notification-prompt').style.display = 'flex';
            }
        }
    }

    enableNotifications() {
        if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.notificationsEnabled = true;
                    localStorage.setItem('evermind-notifications', 'true');
                    this.showMessage('Notifications enabled! You\'ll receive reminders for upcoming assignments.', 'success');
                    this.scheduleNotifications();
                }
                this.hideNotificationPrompt();
            });
        }
    }

    hideNotificationPrompt() {
        document.getElementById('notification-prompt').style.display = 'none';
    }

    scheduleNotifications() {
        if (!this.notificationsEnabled || Notification.permission !== 'granted') return;

        // Clear existing timeouts (in a real app, you'd use a more sophisticated approach)
        const now = new Date();
        const pendingAssignments = this.assignments.filter(a => !a.completed);

        pendingAssignments.forEach(assignment => {
            const dueDateTime = new Date(assignment.dueDate + 'T' + assignment.dueTime);
            const reminderTime = new Date(dueDateTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours before
            const timeUntilReminder = reminderTime.getTime() - now.getTime();

            if (timeUntilReminder > 0 && timeUntilReminder <= 24 * 60 * 60 * 1000) {
                setTimeout(() => {
                    new Notification('Assignment Reminder - evermind', {
                        body: `${assignment.title} for ${assignment.course} is due tomorrow!`,
                        icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjNjY3RUVBIi8+Cjwvc3ZnPgo='
                    });
                }, timeUntilReminder);
            }
        });
    }

    getPriorityValue(priority) {
        const values = { low: 1, medium: 2, high: 3 };
        return values[priority] || 0;
    }

    saveAssignments() {
    localStorage.setItem('evermind-assignments', JSON.stringify(this.assignments));
    this.saveAssignmentsToBackend();
    }

    showMessage(text, type = 'success') {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());

        const message = document.createElement('div');
        message.className = `message ${type}`;
        message.textContent = text;
        
        const container = document.querySelector('.container');
        container.insertBefore(message, container.firstChild);

        // Auto-remove message after 5 seconds
        setTimeout(() => {
            if (message.parentNode) {
                message.remove();
            }
        }, 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Week View Methods
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
        return new Date(d.setDate(diff));
    }

    navigateWeek(direction) {
        const newWeekStart = new Date(this.currentWeekStart);
        newWeekStart.setDate(newWeekStart.getDate() + (direction * 7));
        this.currentWeekStart = newWeekStart;
        this.displayWeekView();
    }

    displayWeekView() {
        const weekCalendar = document.getElementById('week-calendar');
        const currentWeekRange = document.getElementById('current-week-range');
        
        if (!weekCalendar || !currentWeekRange) return;

        // Update week range display
        const weekEnd = new Date(this.currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        const startMonth = this.currentWeekStart.toLocaleDateString('en-US', { month: 'short' });
        const startDay = this.currentWeekStart.getDate();
        const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
        const endDay = weekEnd.getDate();
        
        if (startMonth === endMonth) {
            currentWeekRange.textContent = `${startMonth} ${startDay} - ${endDay}, ${this.currentWeekStart.getFullYear()}`;
        } else {
            currentWeekRange.textContent = `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${this.currentWeekStart.getFullYear()}`;
        }

        // Generate week days
        weekCalendar.innerHTML = '';
        const today = new Date();
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(this.currentWeekStart);
            dayDate.setDate(dayDate.getDate() + i);
            
            const dayElement = document.createElement('div');
            dayElement.className = 'week-day';
            
            // Check if this day is today
            if (dayDate.toDateString() === today.toDateString()) {
                dayElement.classList.add('today');
            }
            
            // Day header
            const dayHeader = document.createElement('div');
            dayHeader.className = 'week-day-header';
            dayHeader.textContent = dayNames[i];
            
            // Day date
            const dayDateElement = document.createElement('div');
            dayDateElement.className = 'week-day-date';
            dayDateElement.textContent = dayDate.getDate();
            
            // Assignments for this day
            const assignmentsContainer = document.createElement('div');
            assignmentsContainer.className = 'week-assignments';
            
            const dayDateString = dayDate.toISOString().split('T')[0];
            const dayAssignments = this.assignments.filter(a => a.dueDate === dayDateString);
            
            dayAssignments.forEach(assignment => {
                const assignmentElement = document.createElement('div');
                assignmentElement.className = `week-assignment ${assignment.priority}`;
                if (assignment.completed) {
                    assignmentElement.classList.add('completed');
                }
                
                const titleElement = document.createElement('div');
                titleElement.className = 'week-assignment-title';
                titleElement.textContent = assignment.title;
                
                const courseElement = document.createElement('div');
                courseElement.className = 'week-assignment-course';
                courseElement.textContent = assignment.course;
                
                assignmentElement.appendChild(titleElement);
                assignmentElement.appendChild(courseElement);
                assignmentsContainer.appendChild(assignmentElement);
            });
            
            dayElement.appendChild(dayHeader);
            dayElement.appendChild(dayDateElement);
            dayElement.appendChild(assignmentsContainer);
            weekCalendar.appendChild(dayElement);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    window.app = new evermind();
    await window.app.init();
});

// Service Worker Registration for PWA capabilities (optional enhancement)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}