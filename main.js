const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

app.disableHardwareAcceleration();

function createWindow() {
    const win = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile('index.html');
}

// Safe menu sender
function sendToFocusedWindow(channel) {
    const win = BrowserWindow.getFocusedWindow();
    if (win && !win.isDestroyed()) {
        win.webContents.send(channel);
    }
}

// Notes file helper
function getNotesFile() {
    return path.join(app.getPath('userData'), 'notes.json');
}

app.whenReady().then(() => {
    createWindow();

    const menuTemplate = [{
        label: 'File',
        submenu: [{
                label: 'New Note',
                accelerator: 'CmdOrCtrl+N',
                click: () => sendToFocusedWindow('menu-new-note')
            },
            {
                label: 'Open File',
                accelerator: 'CmdOrCtrl+O',
                click: () => sendToFocusedWindow('menu-open-file')
            },
            {
                label: 'Save',
                accelerator: 'CmdOrCtrl+S',
                click: () => sendToFocusedWindow('menu-save')
            },
            {
                label: 'Save As',
                accelerator: 'CmdOrCtrl+Shift+S',
                click: () => sendToFocusedWindow('menu-save-as')
            },
            { type: 'separator' },
            {
                label: 'Quit',
                accelerator: 'CmdOrCtrl+Q',
                click: () => app.quit()
            }
        ]
    }];

    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ---------------------------
// Notes Helpers
// ---------------------------

function loadNotes() {
    const notesFile = getNotesFile();

    if (!fs.existsSync(notesFile)) {
        return [];
    }

    try {
        return JSON.parse(fs.readFileSync(notesFile, 'utf8'));
    } catch (err) {
        console.error('Failed to parse notes.json:', err);
        return [];
    }
}

function saveNotes(notes) {
    const notesFile = getNotesFile();

    fs.writeFileSync(
        notesFile,
        JSON.stringify(notes, null, 2),
        'utf8'
    );
}

// ---------------------------
// IPC Handlers
// ---------------------------

ipcMain.handle('get-notes', async() => {
    return loadNotes();
});

ipcMain.handle('save-note-json', async(event, note) => {
    try {
        const notes = loadNotes();

        const index = notes.findIndex(n => n.id === note.id);

        const updatedNote = {
            ...note,
            updatedAt: new Date().toISOString()
        };

        if (index >= 0) {
            notes[index] = updatedNote;
        } else {
            notes.push(updatedNote);
        }

        saveNotes(notes);

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('delete-note-json', async(event, id) => {
    try {
        const notes = loadNotes().filter(n => n.id !== id);

        saveNotes(notes);

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('save-note', async(event, text) => {
    try {
        const filePath = path.join(
            app.getPath('userData'),
            'quicknote.txt'
        );

        fs.writeFileSync(filePath, text, 'utf8');

        return {
            success: true,
            filePath
        };
    } catch (err) {
        return {
            success: false,
            error: err.message
        };
    }
});

ipcMain.handle('load-note', async() => {
    try {
        const filePath = path.join(
            app.getPath('userData'),
            'quicknote.txt'
        );

        if (!fs.existsSync(filePath)) {
            return '';
        }

        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return '';
    }
});

ipcMain.handle('save-as', async(event, text) => {
    try {
        const win = BrowserWindow.fromWebContents(event.sender);

        const result = await dialog.showSaveDialog(win, {
            defaultPath: 'mynote.txt',
            filters: [{
                name: 'Text Files',
                extensions: ['txt']
            }]
        });

        if (result.canceled || !result.filePath) {
            return {
                success: false,
                canceled: true
            };
        }

        fs.writeFileSync(result.filePath, text, 'utf8');

        return {
            success: true,
            filePath: result.filePath
        };
    } catch (err) {
        return {
            success: false,
            error: err.message
        };
    }
});

ipcMain.handle('new-note', async() => {
    const result = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Discard changes', 'Cancel'],
        defaultId: 1,
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Start a new note anyway?'
    });

    return {
        confirmed: result.response === 0
    };
});

ipcMain.handle('open-file', async() => {
    try {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{
                name: 'Text Files',
                extensions: ['txt']
            }]
        });

        if (result.canceled || result.filePaths.length === 0) {
            return {
                success: false,
                canceled: true
            };
        }

        const filePath = result.filePaths[0];
        const content = fs.readFileSync(filePath, 'utf8');

        return {
            success: true,
            filePath,
            content
        };
    } catch (err) {
        return {
            success: false,
            error: err.message
        };
    }
});

ipcMain.handle('delete-note', async() => {
    try {
        const filePath = path.join(
            app.getPath('userData'),
            'quicknote.txt'
        );

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return { success: true };
    } catch (err) {
        return {
            success: false,
            error: err.message
        };
    }
});

ipcMain.handle('smart-save', async(event, text, filePath) => {
    try {
        const targetPath =
            filePath ||
            path.join(
                app.getPath('userData'),
                'quicknote.txt'
            );

        fs.writeFileSync(targetPath, text, 'utf8');

        return {
            success: true,
            filePath: targetPath
        };
    } catch (err) {
        return {
            success: false,
            error: err.message
        };
    }
});