// Local Storage Management
class StorageManager {
    constructor() {
        this.storagePrefix = 'beyond-stoicism-';
    }

    // Progress tracking
    setProgress(contentId, completed) {
        const key = this.storagePrefix + 'progress-' + contentId;
        localStorage.setItem(key, completed.toString());
    }

    getProgress(contentId) {
        const key = this.storagePrefix + 'progress-' + contentId;
        return localStorage.getItem(key) === 'true';
    }

    // Text content saving
    saveText(saveKey, content) {
        const key = this.storagePrefix + 'text-' + saveKey;
        localStorage.setItem(key, content);
    }

    getText(saveKey) {
        const key = this.storagePrefix + 'text-' + saveKey;
        return localStorage.getItem(key) || '';
    }

    // Export all data
    exportData() {
        const data = {};
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.storagePrefix)) {
                data[key] = localStorage.getItem(key);
            }
        }
        
        return JSON.stringify(data, null, 2);
    }

    // Import data
    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            for (const [key, value] of Object.entries(data)) {
                if (key.startsWith(this.storagePrefix)) {
                    localStorage.setItem(key, value);
                }
            }
            
            return true;
        } catch (error) {
            console.error('Failed to import data:', error);
            return false;
        }
    }

    // Clear all workbook data
    clearAllData() {
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.storagePrefix)) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }

    // Get completion statistics
    getCompletionStats() {
        const contentIds = [
            'timeline', 'chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 
            'chapter-5', 'chapter-6', 'chapter-7', 'chapter-8', 'chapter-9',
            'chapter-10', 'chapter-11', 'chapter-12', 'chapter-13', 'epilogue', 'bibliography'
        ];
        
        const completed = contentIds.filter(id => this.getProgress(id));
        
        return {
            total: contentIds.length,
            completed: completed.length,
            percentage: Math.round((completed.length / contentIds.length) * 100),
            completedIds: completed
        };
    }

    // Backup data to downloadable file
    downloadBackup() {
        const data = this.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `beyond-stoicism-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    // Restore from backup file
    async restoreFromBackup(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const success = this.importData(e.target.result);
                    resolve(success);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
}

// Create global storage manager instance
window.storageManager = new StorageManager();