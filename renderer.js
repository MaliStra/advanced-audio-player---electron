const { ipcRenderer } = require('electron');
const path = require('path');

// Элементы управления
const playBtn = document.getElementById('play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const stopBtn = document.getElementById('stop-btn');
const repeatBtn = document.getElementById('repeat-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const volumeSlider = document.getElementById('volume-slider');
const progressBar = document.getElementById('progress');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const songTitle = document.getElementById('song-title');
const artistName = document.getElementById('artist-name');
const albumArt = document.getElementById('album-art');
const playlistItems = document.getElementById('playlist-items');
const addFilesBtn = document.getElementById('add-files-btn');
const clearPlaylistBtn = document.getElementById('clear-playlist-btn');
const eqBands = document.querySelectorAll('.eq-band');

// Кнопки управления окном
const minimizeBtn = document.getElementById('minimize-btn');
const maximizeBtn = document.getElementById('maximize-btn');
const closeBtn = document.getElementById('close-btn');

// Эквалайзер
const eqPresetBtn = document.getElementById('eq-preset-btn');
const eqResetBtn = document.getElementById('eq-reset-btn');
const eqPresets = document.getElementById('eq-presets');
const presetBtns = document.querySelectorAll('.preset-btn');

// Пресеты эквалайзера
const eqPresetValues = {
    flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    rock: [4, 3, 2, 1, 0, 0, 1, 2, 3, 4],
    pop: [2, 3, 4, 3, 2, 1, 0, -1, -2, -3],
    jazz: [2, 1, 0, -1, -2, -2, -1, 0, 1, 2],
    classic: [-2, -1, 0, 1, 2, 2, 1, 0, -1, -2]
};

let playlist = [];
let currentTrackIndex = 0;
let sound;
let isRepeat = false;
let isShuffle = false;
let isPlaying = false;

// Глобальные переменные для хранения настроек
let currentEffects = {
    balance: 0,
    speed: 100,
    tempo: 100,
    bass: 0,
    chorus: 0,
    echo: 0,
    reverb: 0,
    delay: 0,
    flanger: 0
};

let currentEqualizer = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

// Инициализация плеера
function initPlayer() {
    // Обработчики событий
    playBtn.addEventListener('click', togglePlay);
    prevBtn.addEventListener('click', playPreviousTrack);
    nextBtn.addEventListener('click', playNextTrack);
    stopBtn.addEventListener('click', stopPlayback);
    repeatBtn.addEventListener('click', toggleRepeat);
    shuffleBtn.addEventListener('click', toggleShuffle);
    volumeSlider.addEventListener('input', setVolume);
    progressBar.parentElement.addEventListener('click', seek);
    addFilesBtn.addEventListener('click', addFiles);
    clearPlaylistBtn.addEventListener('click', clearPlaylist);
    
    // Инициализация эквалайзера
    initEqualizer();
    
    // Инициализация эффектов
    initEffects();
}

async function addFiles() {
    const result = await ipcRenderer.invoke('show-open-dialog', {
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac'] }
        ]
    });
    
    if (!result.canceled) {
        result.filePaths.forEach(filePath => {
            addTrackToPlaylist(filePath);
        });
    }
}

async function addTrackToPlaylist(track) {
    const li = document.createElement('li');
    li.className = 'playlist-item';
    
    const img = document.createElement('img');
    img.src = 'https://assets.audiomack.com/hamydex-olamide/3348b56a10ef4b53717ee299921dbadb808a2b792492aa7023336923cb04e305.jpeg';
    img.alt = 'Album Art';
    img.onerror = function() {
        console.error('Ошибка загрузки изображения:', this.src);
        this.src = 'https://assets.audiomack.com/hamydex-olamide/3348b56a10ef4b53717ee299921dbadb808a2b792492aa7023336923cb04e305.jpeg';
    };
    
    const info = document.createElement('div');
    info.className = 'playlist-item-info';
    
    const title = document.createElement('h4');
    const artist = document.createElement('p');
    const bitrate = document.createElement('span');
    bitrate.className = 'playlist-item-bitrate';
    
    try {
        const metadata = await ipcRenderer.invoke('get-audio-metadata', track);
        title.textContent = metadata.title || 'Неизвестный трек';
        artist.textContent = metadata.artist || 'Неизвестный исполнитель';
        
        // Получаем битрейт из метаданных
        if (metadata.bitrate) {
            const kbps = Math.round(metadata.bitrate / 1000);
            bitrate.textContent = `${kbps} kbps`;
        } else {
            // Если битрейт не указан в метаданных, пробуем определить его из размера файла
            try {
                const stats = await ipcRenderer.invoke('get-file-stats', track);
                const audio = new Audio();
                audio.src = track;
                
                audio.addEventListener('loadedmetadata', () => {
                    const duration = audio.duration;
                    const fileSize = stats.size;
                    const kbps = Math.round((fileSize * 8) / (duration * 1000));
                    bitrate.textContent = `${kbps} kbps`;
                });
            } catch (error) {
                console.error('Ошибка при определении битрейта:', error);
                bitrate.textContent = 'Unknown kbps';
            }
        }
        
        if (metadata.picture) {
            try {
                const blob = new Blob([metadata.picture.data], { type: metadata.picture.format });
                img.src = URL.createObjectURL(blob);
            } catch (error) {
                console.error('Ошибка при создании Blob из метаданных:', error);
            }
        }
        
        const duration = document.createElement('span');
        duration.className = 'playlist-item-duration';
        
        // Создаем временный аудио элемент для получения длительности
        const audio = new Audio();
        audio.src = track;
        
        audio.addEventListener('loadedmetadata', () => {
            const minutes = Math.floor(audio.duration / 60);
            const seconds = Math.floor(audio.duration % 60);
            duration.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        });
        
        const controls = document.createElement('div');
        controls.className = 'playlist-item-controls';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.title = 'Удалить';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removeTrackFromPlaylist(li);
        };
        
        info.appendChild(title);
        info.appendChild(artist);
        info.appendChild(bitrate);
        controls.appendChild(removeBtn);
        
        li.appendChild(img);
        li.appendChild(info);
        li.appendChild(duration);
        li.appendChild(controls);
        
        // Добавляем обработчик клика на элемент плейлиста
        li.addEventListener('click', () => {
            const index = Array.from(playlistItems.children).indexOf(li);
            if (index !== -1) {
                playTrack(index);
            }
        });
        
        playlistItems.appendChild(li);
        
        // Сохраняем информацию о треке в массив playlist
        playlist.push({
            src: track,
            title: metadata.title || 'Неизвестный трек',
            artist: metadata.artist || 'Неизвестный исполнитель',
            cover: img.src,
            duration: duration.textContent,
            bitrate: bitrate.textContent
        });
    } catch (error) {
        console.error('Ошибка при добавлении трека:', error);
    }
}

function removeTrackFromPlaylist(element) {
    const index = Array.from(playlistItems.children).indexOf(element);
    if (index !== -1) {
        playlist.splice(index, 1);
        if (currentTrackIndex === index) {
            currentTrackIndex = 0;
            if (sound) {
                sound.unload();
            }
        } else if (currentTrackIndex > index) {
            currentTrackIndex--;
        }
    }
    element.remove();
}

function updatePlaylist() {
    const playlistItems = document.querySelectorAll('.playlist-item');
    playlistItems.forEach((item, index) => {
        if (index === currentTrackIndex) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function clearPlaylist() {
    // Очищаем массив плейлиста
    playlist = [];
    currentTrackIndex = 0;
    
    // Останавливаем воспроизведение
    if (sound) {
        sound.stop();
        sound.unload();
        sound = null;
    }
    
    // Очищаем визуальное отображение плейлиста
    while (playlistItems.firstChild) {
        playlistItems.removeChild(playlistItems.firstChild);
    }
    
    // Сбрасываем информацию о текущем треке
    updateTrackInfo(null);
    
    // Обновляем состояние кнопок
    playBtn.innerHTML = '<i class="fas fa-play"></i>';
    isPlaying = false;
}

function loadTrack(index) {
    if (sound) {
        sound.unload();
    }
    
    const track = playlist[index];
    sound = new Howl({
        src: [track.src],
        html5: true,
        onplay: () => {
            isPlaying = true;
            playBtn.textContent = '⏸';
            requestAnimationFrame(updateProgress);
        },
        onpause: () => {
            isPlaying = false;
            playBtn.textContent = '▶';
        },
        onstop: () => {
            isPlaying = false;
            playBtn.textContent = '▶';
        },
        onend: () => {
            if (isRepeat) {
                sound.play();
            } else {
                playNext();
            }
        }
    });
    
    updateTrackInfo(track);
    updatePlaylist();
}

function updateTrackInfo(track) {
    if (track) {
        songTitle.textContent = track.title;
        artistName.textContent = track.artist;
        albumArt.src = track.cover;
        albumArt.onerror = function() {
            this.src = './assets/image.png';
        };
    } else {
        songTitle.textContent = 'Название трека';
        artistName.textContent = 'Исполнитель';
        albumArt.src = './assets/image.png';
    }
}

function togglePlay() {
    if (!sound) return;
    
    if (sound.playing()) {
        sound.pause();
    } else {
        sound.play();
    }
}

function stopPlayback() {
    if (sound) {
        sound.stop();
    }
}

function playPreviousTrack() {
    if (isShuffle) {
        currentTrackIndex = Math.floor(Math.random() * playlist.length);
    } else {
        currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    }
    loadTrack(currentTrackIndex);
    sound.play();
}

function playNextTrack() {
    if (isShuffle) {
        currentTrackIndex = Math.floor(Math.random() * playlist.length);
    } else {
        currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
    }
    loadTrack(currentTrackIndex);
    sound.play();
}

function toggleRepeat() {
    isRepeat = !isRepeat;
    repeatBtn.style.color = isRepeat ? '#1db954' : '#ffffff';
}

function toggleShuffle() {
    isShuffle = !isShuffle;
    shuffleBtn.style.color = isShuffle ? '#1db954' : '#ffffff';
}

function setVolume() {
    const volume = volumeSlider.value / 100;
    if (sound) {
        sound.volume(volume);
    }
}

// Инициализация эквалайзера
function initEqualizer() {
    // Обработчики для полос эквалайзера
    eqBands.forEach((band, index) => {
        band.addEventListener('input', () => {
            setEqualizer(index, band.value);
        });
    });

    // Обработчик для кнопки сброса
    eqResetBtn.addEventListener('click', () => {
        resetEqualizer();
    });

    // Обработчик для кнопки пресетов
    eqPresetBtn.addEventListener('click', () => {
        eqPresets.style.display = eqPresets.style.display === 'none' ? 'flex' : 'none';
    });

    // Обработчики для пресетов
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            applyEqualizerPreset(preset);
            
            // Обновляем активное состояние кнопок
            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

// Установка значения для полосы эквалайзера
function setEqualizer(index, value) {
    const band = eqBands[index];
    band.style.setProperty('--value', `${(parseFloat(value) + 12) * 4.166}%`);
    
    // Сохраняем значение эквалайзера
    currentEqualizer[index] = parseFloat(value);
    
    if (sound) {
        // Частоты для каждой полосы эквалайзера
        const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
        
        // Создаем или обновляем фильтр для полосы
        if (!sound._filters) {
            sound._filters = [];
        }
        
        if (!sound._filters[index]) {
            // Создаем новый фильтр
            const filter = sound._sounds[0]._node.context.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = frequencies[index];
            filter.Q.value = 1;
            
            // Подключаем фильтр к аудио
            if (index === 0) {
                sound._sounds[0]._node.disconnect();
                sound._sounds[0]._node.connect(filter);
            } else {
                sound._filters[index - 1].disconnect();
                sound._filters[index - 1].connect(filter);
            }
            
            // Подключаем последний фильтр к выходу
            if (index === eqBands.length - 1) {
                filter.connect(sound._sounds[0]._node.context.destination);
            }
            
            sound._filters[index] = filter;
        }
        
        // Устанавливаем усиление для фильтра
        sound._filters[index].gain.value = parseFloat(value);
    }
}

// Применение пресета эквалайзера
// Сброс эквалайзера
function resetEqualizer() {
    eqBands.forEach((band, index) => {
        band.value = 0;
        setEqualizer(index, 0);
        
        // Отключаем фильтры
        if (sound && sound._filters && sound._filters[index]) {
            sound._filters[index].gain.value = 0;
        }
    });
    presetBtns.forEach(btn => btn.classList.remove('active'));
}

// Применение пресета эквалайзера
function applyEqualizerPreset(preset) {
    const values = eqPresetValues[preset];
    eqBands.forEach((band, index) => {
        band.value = values[index];
        setEqualizer(index, values[index]);
    });
}

function seek(e) {
    if (!sound) return;
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const seekTime = sound.duration() * clickPosition;
    
    sound.seek(seekTime);
    updateProgress();
}

function updateProgress() {
    if (sound && sound.playing()) {
        const currentTime = sound.seek();
        const duration = sound.duration();
        const progress = (currentTime / duration) * 100;
        
        progressBar.style.width = `${progress}%`;
        currentTimeEl.textContent = formatTime(currentTime);
        durationEl.textContent = formatTime(duration);
        
        requestAnimationFrame(updateProgress);
    }
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Обработчики для кнопок управления окном
minimizeBtn.addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
});

maximizeBtn.addEventListener('click', () => {
    ipcRenderer.send('maximize-window');
});

closeBtn.addEventListener('click', () => {
    ipcRenderer.send('close-window');
});

// Инициализация при загрузке страницы
window.addEventListener('load', () => {
    initPlayer();
});

function playTrack(index) {
    if (index >= 0 && index < playlist.length) {
        currentTrackIndex = index;
        const track = playlist[index];
        
        if (sound) {
            sound.stop();
            sound.unload();
        }
        
        sound = new Howl({
            src: [track.src],
            html5: true,
            onload: () => {
                updateTrackInfo(track);
                applySavedEffects();
                requestAnimationFrame(updateProgress);
            },
            onplay: () => {
                isPlaying = true;
                updatePlayButton();
                requestAnimationFrame(updateProgress);
            },
            onpause: () => {
                isPlaying = false;
                updatePlayButton();
            },
            onstop: () => {
                isPlaying = false;
                updatePlayButton();
            },
            onend: () => {
                if (isRepeat) {
                    playTrack(currentTrackIndex);
                } else {
                    playNextTrack();
                }
            }
        });
        
        sound.play();
    }
}

document.getElementById('add-folder-btn').addEventListener('click', async () => {
    try {
        const result = await ipcRenderer.invoke('show-directory-dialog');
        if (!result.canceled && result.filePaths.length > 0) {
            const folderPath = result.filePaths[0];
            const files = await ipcRenderer.invoke('get-folder-files', folderPath);
            for (const file of files) {
                if (file.endsWith('.mp3')) {
                    await addTrackToPlaylist(file);
                }
            }
        }
    } catch (error) {
        console.error('Ошибка при добавлении папки:', error);
    }
});

// Обработчик поиска в плейлисте
document.getElementById('search-input').addEventListener('input', (e) => {
    const searchText = e.target.value.toLowerCase();
    const items = playlistItems.querySelectorAll('.playlist-item');
    
    items.forEach(item => {
        const title = item.querySelector('h4').textContent.toLowerCase();
        const artist = item.querySelector('p').textContent.toLowerCase();
        
        if (title.includes(searchText) || artist.includes(searchText)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
});

// Обработчики для сворачиваемых панелей
document.getElementById('eq-toggle').addEventListener('click', () => {
    const panels = document.querySelector('.side-panels');
    const eqPanel = document.getElementById('equalizer-panel');
    const effectsPanel = document.getElementById('effects-panel');
    const eqButton = document.getElementById('eq-toggle');
    const effectsButton = document.getElementById('effects-toggle');
    
    panels.classList.toggle('active');
    eqPanel.classList.toggle('active');
    effectsPanel.classList.remove('active');
    
    eqButton.classList.toggle('active');
    effectsButton.classList.remove('active');
});

document.getElementById('effects-toggle').addEventListener('click', () => {
    const panels = document.querySelector('.side-panels');
    const eqPanel = document.getElementById('equalizer-panel');
    const effectsPanel = document.getElementById('effects-panel');
    const eqButton = document.getElementById('eq-toggle');
    const effectsButton = document.getElementById('effects-toggle');
    
    panels.classList.toggle('active');
    effectsPanel.classList.toggle('active');
    eqPanel.classList.remove('active');
    
    effectsButton.classList.toggle('active');
    eqButton.classList.remove('active');
});

// Инициализация эффектов
function initEffects() {
    // Устанавливаем начальные значения для слайдеров
    document.querySelectorAll('.effect-slider').forEach(slider => {
        const effect = slider.dataset.effect;
        slider.value = currentEffects[effect];
        
        // Обновляем отображение значения
        const label = slider.previousElementSibling;
        label.setAttribute('data-value', currentEffects[effect]);
    });
    
    // Обработчики для эффектов
    document.querySelectorAll('.effect-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const effect = e.target.dataset.effect;
            const value = parseFloat(e.target.value);
            
            // Сохраняем значение эффекта
            currentEffects[effect] = value;
            
            if (sound) {
                switch (effect) {
                    case 'balance':
                        sound.stereo(value / 100);
                        break;
                    case 'speed':
                    case 'tempo':
                        sound.rate(value / 100);
                        break;
                    case 'bass':
                        const bassNode = sound._sounds[0]._node.context.createBiquadFilter();
                        bassNode.type = 'lowshelf';
                        bassNode.frequency.value = 150;
                        bassNode.gain.value = value;
                        sound._sounds[0]._node.connect(bassNode);
                        bassNode.connect(sound._sounds[0]._node.context.destination);
                        break;
                    case 'chorus':
                        const chorusNode = sound._sounds[0]._node.context.createDelay();
                        chorusNode.delayTime.value = 0.0035;
                        const chorusGain = sound._sounds[0]._node.context.createGain();
                        chorusGain.gain.value = value / 100;
                        sound._sounds[0]._node.connect(chorusNode);
                        chorusNode.connect(chorusGain);
                        chorusGain.connect(sound._sounds[0]._node);
                        break;
                    case 'echo':
                        const echoNode = sound._sounds[0]._node.context.createDelay();
                        echoNode.delayTime.value = 0.5;
                        const echoGain = sound._sounds[0]._node.context.createGain();
                        echoGain.gain.value = value / 100;
                        sound._sounds[0]._node.connect(echoNode);
                        echoNode.connect(echoGain);
                        echoGain.connect(sound._sounds[0]._node);
                        break;
                    case 'reverb':
                        const reverbNode = sound._sounds[0]._node.context.createConvolver();
                        const reverbGain = sound._sounds[0]._node.context.createGain();
                        reverbGain.gain.value = value / 100;
                        sound._sounds[0]._node.connect(reverbNode);
                        reverbNode.connect(reverbGain);
                        reverbGain.connect(sound._sounds[0]._node);
                        break;
                    case 'delay':
                        const delayNode = sound._sounds[0]._node.context.createDelay();
                        delayNode.delayTime.value = 0.3;
                        const delayGain = sound._sounds[0]._node.context.createGain();
                        delayGain.gain.value = value / 100;
                        sound._sounds[0]._node.connect(delayNode);
                        delayNode.connect(delayGain);
                        delayGain.connect(sound._sounds[0]._node);
                        break;
                    case 'flanger':
                        const flangerNode = sound._sounds[0]._node.context.createDelay();
                        flangerNode.delayTime.value = 0.005;
                        const flangerGain = sound._sounds[0]._node.context.createGain();
                        flangerGain.gain.value = value / 100;
                        sound._sounds[0]._node.connect(flangerNode);
                        flangerNode.connect(flangerGain);
                        flangerGain.connect(sound._sounds[0]._node);
                        break;
                }
            }
            
            const label = e.target.previousElementSibling;
            label.setAttribute('data-value', value);
        });
    });
    
    // Обработчик кнопки сброса эффектов
    document.getElementById('effects-reset-btn').addEventListener('click', () => {
        // Сбрасываем все слайдеры к значениям по умолчанию
        document.querySelectorAll('.effect-slider').forEach(slider => {
            const effect = slider.dataset.effect;
            const defaultValue = getDefaultEffectValue(effect);
            slider.value = defaultValue;
            
            // Обновляем отображение значения
            const label = slider.previousElementSibling;
            label.setAttribute('data-value', defaultValue);
            
            // Сохраняем значение по умолчанию
            currentEffects[effect] = defaultValue;
            
            // Сбрасываем эффекты в Howler.js
            if (sound) {
                switch (effect) {
                    case 'balance':
                        sound.stereo(0);
                        break;
                    case 'speed':
                    case 'tempo':
                        sound.rate(1);
                        break;
                    case 'bass':
                    case 'chorus':
                    case 'echo':
                    case 'reverb':
                    case 'delay':
                    case 'flanger':
                        // Для этих эффектов нужно пересоздать звук
                        if (sound) {
                            const currentTime = sound.seek();
                            const isPlaying = sound.playing();
                            const currentTrack = playlist[currentTrackIndex];
                            
                            sound.stop();
                            sound.unload();
                            sound = new Howl({
                                src: [currentTrack.src],
                                html5: true,
                                onload: () => {
                                    updateTrackInfo(currentTrack);
                                    applySavedEffects();
                                    if (isPlaying) {
                                        sound.play();
                                        sound.seek(currentTime);
                                    }
                                },
                                onplay: () => {
                                    isPlaying = true;
                                    updatePlayButton();
                                    requestAnimationFrame(updateProgress);
                                },
                                onpause: () => {
                                    isPlaying = false;
                                    updatePlayButton();
                                },
                                onstop: () => {
                                    isPlaying = false;
                                    updatePlayButton();
                                },
                                onend: () => {
                                    if (isRepeat) {
                                        playTrack(currentTrackIndex);
                                    } else {
                                        playNextTrack();
                                    }
                                }
                            });
                        }
                        break;
                }
            }
        });
    });
}

// Функция для получения значения по умолчанию для эффекта
function getDefaultEffectValue(effect) {
    switch (effect) {
        case 'balance':
            return 0;
        case 'speed':
        case 'tempo':
            return 100;
        case 'bass':
        case 'chorus':
        case 'echo':
        case 'reverb':
        case 'delay':
        case 'flanger':
            return 0;
        default:
            return 0;
    }
}

// Функция для применения сохраненных эффектов
function applySavedEffects() {
    if (!sound) return;
    
    // Применяем эффекты
    Object.entries(currentEffects).forEach(([effect, value]) => {
        switch (effect) {
            case 'balance':
                sound.stereo(value / 100);
                break;
            case 'speed':
            case 'tempo':
                sound.rate(value / 100);
                break;
            case 'bass':
                const bassNode = sound._sounds[0]._node.context.createBiquadFilter();
                bassNode.type = 'lowshelf';
                bassNode.frequency.value = 150;
                bassNode.gain.value = value;
                sound._sounds[0]._node.connect(bassNode);
                bassNode.connect(sound._sounds[0]._node.context.destination);
                break;
            case 'chorus':
                const chorusNode = sound._sounds[0]._node.context.createDelay();
                chorusNode.delayTime.value = 0.0035;
                const chorusGain = sound._sounds[0]._node.context.createGain();
                chorusGain.gain.value = value / 100;
                sound._sounds[0]._node.connect(chorusNode);
                chorusNode.connect(chorusGain);
                chorusGain.connect(sound._sounds[0]._node);
                break;
            case 'echo':
                const echoNode = sound._sounds[0]._node.context.createDelay();
                echoNode.delayTime.value = 0.5;
                const echoGain = sound._sounds[0]._node.context.createGain();
                echoGain.gain.value = value / 100;
                sound._sounds[0]._node.connect(echoNode);
                echoNode.connect(echoGain);
                echoGain.connect(sound._sounds[0]._node);
                break;
            case 'reverb':
                const reverbNode = sound._sounds[0]._node.context.createConvolver();
                const reverbGain = sound._sounds[0]._node.context.createGain();
                reverbGain.gain.value = value / 100;
                sound._sounds[0]._node.connect(reverbNode);
                reverbNode.connect(reverbGain);
                reverbGain.connect(sound._sounds[0]._node);
                break;
            case 'delay':
                const delayNode = sound._sounds[0]._node.context.createDelay();
                delayNode.delayTime.value = 0.3;
                const delayGain = sound._sounds[0]._node.context.createGain();
                delayGain.gain.value = value / 100;
                sound._sounds[0]._node.connect(delayNode);
                delayNode.connect(delayGain);
                delayGain.connect(sound._sounds[0]._node);
                break;
            case 'flanger':
                const flangerNode = sound._sounds[0]._node.context.createDelay();
                flangerNode.delayTime.value = 0.005;
                const flangerGain = sound._sounds[0]._node.context.createGain();
                flangerGain.gain.value = value / 100;
                sound._sounds[0]._node.connect(flangerNode);
                flangerNode.connect(flangerGain);
                flangerGain.connect(sound._sounds[0]._node);
                break;
        }
    });
    
    // Применяем эквалайзер
    const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
    
    if (!sound._filters) {
        sound._filters = [];
    }
    
    currentEqualizer.forEach((value, index) => {
        if (!sound._filters[index]) {
            const filter = sound._sounds[0]._node.context.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = frequencies[index];
            filter.Q.value = 1;
            
            if (index === 0) {
                sound._sounds[0]._node.disconnect();
                sound._sounds[0]._node.connect(filter);
            } else {
                sound._filters[index - 1].disconnect();
                sound._filters[index - 1].connect(filter);
            }
            
            if (index === currentEqualizer.length - 1) {
                filter.connect(sound._sounds[0]._node.context.destination);
            }
            
            sound._filters[index] = filter;
        }
        
        sound._filters[index].gain.value = value;
    });
}

// Обновляем функцию playTrack
function playTrack(index) {
    if (index >= 0 && index < playlist.length) {
        currentTrackIndex = index;
        const track = playlist[index];
        
        if (sound) {
            sound.stop();
            sound.unload();
        }
        
        sound = new Howl({
            src: [track.src],
            html5: true,
            onload: () => {
                updateTrackInfo(track);
                applySavedEffects();
                requestAnimationFrame(updateProgress);
            },
            onplay: () => {
                isPlaying = true;
                updatePlayButton();
                requestAnimationFrame(updateProgress);
            },
            onpause: () => {
                isPlaying = false;
                updatePlayButton();
            },
            onstop: () => {
                isPlaying = false;
                updatePlayButton();
            },
            onend: () => {
                if (isRepeat) {
                    playTrack(currentTrackIndex);
                } else {
                    playNextTrack();
                }
            }
        });
        
        sound.play();
    }
}

// Обновляем функцию playNextTrack
function playNextTrack() {
    if (isShuffle) {
        currentTrackIndex = Math.floor(Math.random() * playlist.length);
    } else {
        currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
    }
    playTrack(currentTrackIndex);
}

// Обновляем функцию playPreviousTrack
function playPreviousTrack() {
    if (isShuffle) {
        currentTrackIndex = Math.floor(Math.random() * playlist.length);
    } else {
        currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    }
    playTrack(currentTrackIndex);
}

// Обновляем функцию updatePlayButton
function updatePlayButton() {
    if (isPlaying) {
        playBtn.textContent = '⏸';
    } else {
        playBtn.textContent = '▶';
    }
} 