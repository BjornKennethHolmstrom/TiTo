// src/core/database.js
(function(window) {
    'use strict';

    class Database {
        constructor() {
            this.db = null;
            this.dbName = 'TimeTrackerDB';
            this.version = 2;
            this.ready = this.initializeDB();
        }

        async initializeDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.version);

                request.onerror = () => {
                    console.error('Failed to open IndexedDB:', request.error);
                    reject(new Error('Failed to open IndexedDB'));
                };

                request.onsuccess = (event) => {
                    this.db = event.target.result;
                    console.info('IndexedDB opened successfully');
                    resolve(this.db);
                };

                request.onupgradeneeded = (event) => {
                    this.db = event.target.result;
                    console.info('Upgrading IndexedDB schema...');
                    this.createStores(this.db);
                };
            });
        }

        createStores(db) {
            try {
                // Projects store
                if (!db.objectStoreNames.contains('projects')) {
                    const projectStore = db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
                    projectStore.createIndex('name', 'name', { unique: true });
                    console.info('Created projects store');
                }

                // Time entries store
                if (!db.objectStoreNames.contains('timeEntries')) {
                    const timeEntryStore = db.createObjectStore('timeEntries', { keyPath: 'id', autoIncrement: true });
                    timeEntryStore.createIndex('projectId', 'projectId', { unique: false });
                    timeEntryStore.createIndex('description', 'description', { unique: false });
                    console.info('Created time entries store');
                }

                // Time goals store
                if (!db.objectStoreNames.contains('timeGoals')) {
                    const timeGoalsStore = db.createObjectStore('timeGoals', { keyPath: 'id', autoIncrement: true });
                    timeGoalsStore.createIndex('projectId', 'projectId', { unique: false });
                    console.info('Created time goals store');
                }
            } catch (error) {
                console.error('Error creating stores:', error);
                throw error;
            }
        }

        async getAll(storeName) {
            await this.ready;
            return new Promise((resolve, reject) => {
                try {
                    const transaction = this.db.transaction([storeName], 'readonly');
                    const store = transaction.objectStore(storeName);
                    const request = store.getAll();

                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => {
                        console.error(`Failed to get all from ${storeName}:`, request.error);
                        reject(new Error(`Failed to get all from ${storeName}`));
                    };
                } catch (error) {
                    console.error(`Error in getAll(${storeName}):`, error);
                    reject(error);
                }
            });
        }

        async get(storeName, id) {
            await this.ready;
            return new Promise((resolve, reject) => {
                try {
                    const transaction = this.db.transaction([storeName], 'readonly');
                    const store = transaction.objectStore(storeName);
                    const request = store.get(id);

                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => {
                        console.error(`Failed to get item from ${storeName}:`, request.error);
                        reject(new Error(`Failed to get item from ${storeName}`));
                    };
                } catch (error) {
                    console.error(`Error in get(${storeName}, ${id}):`, error);
                    reject(error);
                }
            });
        }

        async add(storeName, item) {
            await this.ready;
            return new Promise((resolve, reject) => {
                try {
                    const transaction = this.db.transaction([storeName], 'readwrite');
                    const store = transaction.objectStore(storeName);
                    const request = store.add(item);

                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => {
                        console.error(`Failed to add item to ${storeName}:`, request.error);
                        reject(new Error(`Failed to add item to ${storeName}`));
                    };
                } catch (error) {
                    console.error(`Error in add(${storeName}):`, error);
                    reject(error);
                }
            });
        }

        async update(storeName, item) {
            await this.ready;
            return new Promise((resolve, reject) => {
                try {
                    const transaction = this.db.transaction([storeName], 'readwrite');
                    const store = transaction.objectStore(storeName);
                    const request = store.put(item);

                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => {
                        console.error(`Failed to update item in ${storeName}:`, request.error);
                        reject(new Error(`Failed to update item in ${storeName}`));
                    };
                } catch (error) {
                    console.error(`Error in update(${storeName}):`, error);
                    reject(error);
                }
            });
        }

        async delete(storeName, id) {
            await this.ready;
            return new Promise((resolve, reject) => {
                try {
                    const transaction = this.db.transaction([storeName], 'readwrite');
                    const store = transaction.objectStore(storeName);
                    const request = store.delete(id);

                    request.onsuccess = () => resolve();
                    request.onerror = () => {
                        console.error(`Failed to delete item from ${storeName}:`, request.error);
                        reject(new Error(`Failed to delete item from ${storeName}`));
                    };
                } catch (error) {
                    console.error(`Error in delete(${storeName}, ${id}):`, error);
                    reject(error);
                }
            });
        }

        async clear(storeName) {
            await this.ready;
            return new Promise((resolve, reject) => {
                try {
                    const transaction = this.db.transaction([storeName], 'readwrite');
                    const store = transaction.objectStore(storeName);
                    const request = store.clear();

                    request.onsuccess = () => resolve();
                    request.onerror = () => {
                        console.error(`Failed to clear ${storeName}:`, request.error);
                        reject(new Error(`Failed to clear ${storeName}`));
                    };
                } catch (error) {
                    console.error(`Error in clear(${storeName}):`, error);
                    reject(error);
                }
            });
        }

        async getByIndex(storeName, indexName, value) {
            await this.ready;
            return new Promise((resolve, reject) => {
                try {
                    const transaction = this.db.transaction([storeName], 'readonly');
                    const store = transaction.objectStore(storeName);
                    const index = store.index(indexName);
                    const request = index.getAll(value);

                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => {
                        console.error(`Failed to get items by index from ${storeName}:`, request.error);
                        reject(new Error(`Failed to get items by index from ${storeName}`));
                    };
                } catch (error) {
                    console.error(`Error in getByIndex(${storeName}, ${indexName}):`, error);
                    reject(error);
                }
            });
        }

        async exportData() {
            await this.ready;
            const data = {};
            try {
                for (const storeName of this.db.objectStoreNames) {
                    data[storeName] = await this.getAll(storeName);
                }
                console.info('Database export successful');
                return data;
            } catch (error) {
                console.error('Error exporting database:', error);
                throw new Error('Failed to export database');
            }
        }

        async importData(data) {
            await this.ready;
            try {
                const storeNames = Object.keys(data);
                const transaction = this.db.transaction(storeNames, 'readwrite');

                for (const [storeName, items] of Object.entries(data)) {
                    const store = transaction.objectStore(storeName);
                    await store.clear();
                    for (const item of items) {
                        await store.add(item);
                    }
                }

                console.info('Database import successful');
            } catch (error) {
                console.error('Error importing database:', error);
                throw new Error('Failed to import database');
            }
        }
    }

    // Create global instance
    window.titoDatabase = new Database();

})(window);
