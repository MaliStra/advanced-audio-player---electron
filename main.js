const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const nodeID3 = require('node-id3');
const fs = require('fs');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        minWidth: 1000,
        minHeight: 800,
        frame: false,
        transparent: true,
        resizable: true,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
            devTools: true // Полностью отключаем инструменты разработчика
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.setMenu(null);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Обработчики для кнопок управления окном
    ipcMain.on('minimize-window', () => {
        mainWindow.minimize();
    });

    ipcMain.on('maximize-window', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });

    ipcMain.on('close-window', () => {
        mainWindow.close();
    });

    // Обработчик для диалога выбора файлов
    ipcMain.handle('show-open-dialog', async (event, options) => {
        return await dialog.showOpenDialog(mainWindow, options);
    });

    // Обработчик для выбора папки
    ipcMain.handle('show-directory-dialog', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        });
        return result;
    });

    // Обработчик для получения списка файлов из папки
    ipcMain.handle('get-folder-files', async (event, folderPath) => {
        try {
            const files = [];
            const readDir = (dir) => {
                const items = fs.readdirSync(dir, { withFileTypes: true });
                for (const item of items) {
                    const fullPath = path.join(dir, item.name);
                    if (item.isDirectory()) {
                        readDir(fullPath);
                    } else if (item.isFile() && item.name.toLowerCase().endsWith('.mp3')) {
                        files.push(fullPath);
                    }
                }
            };
            readDir(folderPath);
            return files;
        } catch (error) {
            console.error('Ошибка при чтении папки:', error);
            return [];
        }
    });

    ipcMain.handle('get-audio-metadata', async (event, filePath) => {
        try {
            const tags = nodeID3.read(filePath);
            return {
                title: tags.title || path.basename(filePath, path.extname(filePath)),
                artist: tags.artist || 'Неизвестный исполнитель',
                picture: tags.image ? {
                    data: tags.image.imageBuffer,
                    format: tags.image.mime
                } : null
            };
        } catch (error) {
            console.error('Ошибка при чтении метаданных:', error);
            return {
                title: path.basename(filePath, path.extname(filePath)),
                artist: 'Неизвестный исполнитель',
                picture: null
            };
        }
    });

    ipcMain.handle('get-file-stats', async (event, filePath) => {
        try {
            const stats = await fs.promises.stat(filePath);
            return {
                size: stats.size
            };
        } catch (error) {
            console.error('Ошибка при получении статистики файла:', error);
            throw error;
        }
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
}); 